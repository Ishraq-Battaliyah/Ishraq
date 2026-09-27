/* طبقة البيانات: Firebase Realtime Database (أو localStorage عند عدم إعداد Firebase) */
const Store = (() => {
  const CFG = window.ISHRAQ_CONFIG || {};
  const LOCAL_KEY = 'ishraq-db-v1';
  const FB_VER = '10.12.2';
  let state = {};
  let mode = 'local';
  let rootRef = null;
  const subs = new Set();
  let notifyQueued = false;

  const parts = p => String(p || '').split('/').filter(Boolean);

  function getIn(obj, path) {
    return parts(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function setIn(obj, path, val) {
    const ps = parts(path);
    if (!ps.length) return val ?? {};
    let o = obj;
    for (let i = 0; i < ps.length - 1; i++) {
      if (o[ps[i]] == null || typeof o[ps[i]] !== 'object') o[ps[i]] = {};
      o = o[ps[i]];
    }
    const last = ps[ps.length - 1];
    if (val === undefined || val === null) delete o[last];
    else o[last] = val;
    return obj;
  }

  function clean(v) {
    // Firebase لا يقبل undefined
    return v === undefined ? null : JSON.parse(JSON.stringify(v));
  }

  function notify() {
    if (notifyQueued) return;
    notifyQueued = true;
    queueMicrotask(() => {
      notifyQueued = false;
      subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
    });
  }

  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }

  let connected = false;
  let everConnected = false;
  let pending = 0;

  function bootMsg(html) {
    const el = document.querySelector('#boot span');
    if (el) el.innerHTML = html;
  }

  async function loadFirebaseSdk() {
    // محاولات متكررة لتحميل مكتبة Firebase قبل الاستسلام
    for (let i = 0; i < 3; i++) {
      try {
        if (!window.firebase) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
        if (!window.firebase?.database) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`);
        return;
      } catch (e) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    throw new Error('sdk');
  }

  async function initFirebase() {
    try { await loadFirebaseSdk(); }
    catch {
      bootMsg('تعذّر تحميل مكتبة الاتصال بقاعدة البيانات.<br><button class="btn primary sm" onclick="location.reload()">إعادة المحاولة</button>');
      // لا نعمل محلياً أبداً عند إعداد Firebase حتى لا تضيع التعديلات أو تُكتب بيانات افتراضية فوق الحقيقية
      await new Promise(() => {});
    }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG.firebase);
    const db = app.database();
    rootRef = db.ref(CFG.dbRoot || 'ishraq');
    db.ref('.info/connected').on('value', snap => {
      connected = !!snap.val();
      if (connected) everConnected = true;
      notify();
    });
    const slow = setTimeout(() => bootMsg('جارٍ الاتصال بقاعدة البيانات... الاتصال بطيء، يرجى الانتظار'), 5000);
    const retry = setTimeout(() => bootMsg('ما زال الاتصال بقاعدة البيانات جارياً...<br><button class="btn primary sm" onclick="location.reload()">إعادة المحاولة</button>'), 25000);
    // ننتظر أول نسخة حقيقية من البيانات دون مهلة، ولا ننتقل للعمل المحلي
    await new Promise(resolve => {
      let first = true;
      rootRef.on('value', snap => {
        state = snap.val() || {};
        if (first) { first = false; resolve(); }
        notify();
      }, err => {
        console.error(err);
        bootMsg(`تعذّرت قراءة قاعدة البيانات (${err.code || err.message}). تحقق من قواعد Firebase.<br><button class="btn primary sm" onclick="location.reload()">إعادة المحاولة</button>`);
      });
    });
    clearTimeout(slow); clearTimeout(retry);
    mode = 'firebase';
    // تنبيه قبل إغلاق الصفحة إذا وُجدت تعديلات لم تصل للقاعدة بعد
    window.addEventListener('beforeunload', e => {
      if (pending > 0) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  function initLocal() {
    try { state = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { state = {}; }
    window.addEventListener('storage', e => {
      if (e.key !== LOCAL_KEY) return;
      try { state = JSON.parse(e.newValue || '{}') || {}; } catch { state = {}; }
      notify();
    });
    mode = 'local';
    connected = true;
  }

  async function init() {
    if (CFG.firebase && CFG.firebase.databaseURL) { await initFirebase(); return mode; }
    initLocal();
    return mode;
  }

  function track(promise) {
    pending++;
    notify();
    return promise.then(() => { lastError = null; }, writeFailed).finally(() => { pending = Math.max(0, pending - 1); notify(); });
  }

  // تعبئة المحتوى الافتراضي مرة واحدة فقط، ولا تكتب فوق أي بيانات موجودة
  async function seedOnce(buildDefaults) {
    if (get('meta/seeded')) return;
    if (rootRef) {
      const res = await rootRef.child('meta/seeded').transaction(cur => (cur ? undefined : Date.now()));
      if (!res.committed) return;
    }
    const data = buildDefaults();
    Object.entries(data).forEach(([k, v]) => {
      if (k === 'meta') Object.entries(v).forEach(([mk, mv]) => { if (get(`meta/${mk}`) == null) set(`meta/${mk}`, mv); });
      else if (get(k) == null) set(k, v);
    });
    if (!rootRef) set('meta/seeded', Date.now());
  }

  let lastError = null;
  // عند رفض الحفظ نعيد تحميل البيانات من الخادم حتى لا تُعرض تغييرات لم تُحفظ فعلياً
  function writeFailed(err) {
    console.error(err);
    lastError = { message: err.message || String(err), ts: Date.now() };
    window.toast && toast('لم يتم الحفظ في قاعدة البيانات: ' + lastError.message, 'error');
    if (rootRef) rootRef.once('value').then(snap => { state = snap.val() || {}; notify(); }).catch(() => notify());
  }

  function set(path, val) {
    val = clean(val);
    state = setIn(state, path, val);
    if (rootRef) {
      const p = parts(path).join('/');
      if (!p) throw new Error('refusing to overwrite database root');
      track(rootRef.child(p).set(val));
    } else saveLocal();
    notify();
  }

  function update(path, obj) {
    obj = clean(obj) || {};
    Object.entries(obj).forEach(([k, v]) => { state = setIn(state, parts(path).concat(k).join('/'), v); });
    if (rootRef) {
      const p = parts(path).join('/');
      if (!p) throw new Error('refusing to update database root');
      track(rootRef.child(p).update(obj));
    } else saveLocal();
    notify();
  }

  const remove = path => set(path, null);

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function push(path, obj) {
    const id = newId();
    set(`${path}/${id}`, { ...obj, id });
    return id;
  }

  const get = path => getIn(state, path);
  const list = path => Object.values(get(path) || {}).filter(Boolean);
  const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
  const dump = () => JSON.parse(JSON.stringify(state || {}));

  return { init, get, list, set, update, remove, push, newId, subscribe, seedOnce, dump,
    get mode() { return mode; }, get lastError() { return lastError; },
    get connected() { return connected; }, get everConnected() { return everConnected; }, get pending() { return pending; } };
})();
