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
        if (CFG.firebase.apiKey && !window.firebase?.auth) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`);
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
    // للاختبار فقط: الاتصال بمحاكيات Firebase المحلية عند تحديدها في الإعدادات
    if (CFG.emulators?.database) { const [h, p] = CFG.emulators.database.split(':'); db.useEmulator(h, +p); }
    rootRef = db.ref(CFG.dbRoot || 'ishraq');
    db.ref('.info/connected').on('value', snap => {
      connected = !!snap.val();
      if (connected) everConnected = true;
      notify();
    });
    if (CFG.firebase.apiKey && !window.firebase.auth) {
      // لا نرجع للدخول القديم إذا تعذّر تحميل مكتبة تسجيل الدخول
      bootMsg('تعذّر تحميل مكتبة تسجيل الدخول.<br><button class="btn primary sm" onclick="location.reload()">إعادة المحاولة</button>');
      await new Promise(() => {});
    }
    if (window.firebase.auth && CFG.firebase.apiKey) {
      authApi = app.auth();
      if (CFG.emulators?.auth) authApi.useEmulator(CFG.emulators.auth, { disableWarnings: true });
      await authApi.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
    }
    mode = 'firebase';
    fbApp = app;
    // تنبيه قبل إغلاق الصفحة إذا وُجدت تعديلات لم تصل للقاعدة بعد
    window.addEventListener('beforeunload', e => {
      if (pending > 0) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  /* ===== نطاقات القراءة: كل دور يستمع فقط للمسارات المسموح له بقراءتها ===== */
  let fbApp = null;
  let authApi = null;
  let secondaryApp = null;
  const listeners = new Map();   // path -> ref
  let scopeKey = null;

  function listen(path) {
    if (listeners.has(path) || !rootRef) return Promise.resolve();
    const ref = path ? rootRef.child(path) : rootRef;
    listeners.set(path, ref);
    return new Promise(resolve => {
      let first = true;
      ref.on('value', snap => {
        const v = snap.val();
        if (path) state = setIn(state, path, v); else state = v || {};
        if (first) { first = false; resolve(); }
        notify();
      }, err => {
        // مسار غير مسموح لهذا الدور: نتركه فارغاً ولا نعلّق التحميل
        console.warn('read denied', path, err && err.code);
        listeners.delete(path);
        if (path) state = setIn(state, path, null);
        if (first) { first = false; resolve(); }
        notify();
      });
    });
  }

  function unlistenAll() {
    listeners.forEach(ref => ref.off());
    listeners.clear();
  }

  // paths: قائمة المسارات، أو [''] لقراءة كل البيانات (الإدارة)
  async function setScope(key, paths) {
    if (mode !== 'firebase') { scopeKey = key; return; }
    if (scopeKey === key) return;
    scopeKey = key;
    unlistenAll();
    state = {};
    notify();
    const slow = setTimeout(() => bootMsg('جارٍ الاتصال بقاعدة البيانات... الاتصال بطيء، يرجى الانتظار'), 5000);
    const retry = setTimeout(() => bootMsg('ما زال الاتصال بقاعدة البيانات جارياً...<br><button class="btn primary sm" onclick="location.reload()">إعادة المحاولة</button>'), 25000);
    // ننتظر أول نسخة حقيقية من البيانات دون مهلة، ولا ننتقل للعمل المحلي
    await Promise.all(paths.map(listen));
    clearTimeout(slow); clearTimeout(retry);
  }
  const watch = path => listen(path);

  async function readOnce(path) {
    if (mode !== 'firebase') return get(path);
    try { return (await rootRef.child(path).once('value')).val(); } catch { return null; }
  }

  // تطبيق Firebase ثانوي لإنشاء حسابات الأعضاء والمشرفين دون الخروج من حساب المشرف الحالي
  function secondaryAuth() {
    if (!authApi) return null;
    if (!secondaryApp) {
      secondaryApp = firebase.apps.find(a => a.name === 'ishraq-secondary') || firebase.initializeApp(CFG.firebase, 'ishraq-secondary');
      if (CFG.emulators?.auth) secondaryApp.auth().useEmulator(CFG.emulators.auth, { disableWarnings: true });
      secondaryApp.auth().setPersistence(firebase.auth.Auth.Persistence.NONE).catch(() => {});
    }
    return secondaryApp.auth();
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
      let res;
      try { res = await rootRef.child('meta/seeded').transaction(cur => (cur ? undefined : Date.now())); } catch { return; }
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
    if (rootRef) listeners.forEach((ref, path) => ref.once('value').then(snap => {
      if (path) state = setIn(state, path, snap.val()); else state = snap.val() || {};
      notify();
    }).catch(() => {}));
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

  return { init, get, list, set, update, remove, push, newId, subscribe, seedOnce, dump, setScope, watch, readOnce, secondaryAuth,
    get auth() { return authApi; }, get hasAuth() { return !!authApi; }, get scope() { return scopeKey; },
    get mode() { return mode; }, get lastError() { return lastError; },
    get connected() { return connected; }, get everConnected() { return everConnected; }, get pending() { return pending; } };
})();
