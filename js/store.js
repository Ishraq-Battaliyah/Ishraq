/* طبقة البيانات: Firebase Realtime Database (أو localStorage عند عدم إعداد Firebase) */
const Store = (() => {
  const CFG = window.ISHRAQ_CONFIG || {};
  // المعاينة التجريبية (js/demo.js) تحفظ بياناتها بمفتاح مستقل ولا تتصل بقاعدة البيانات الحقيقية
  const LOCAL_KEY = window.ISHRAQ_DEMO ? 'ishraq-demo-db-v1' : 'ishraq-db-v1';
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
    // Firebase App Check: يثبت أن الطلبات صادرة من موقع المنصة (يحدّ من الإغراق الآلي)
    if (CFG.appCheckKey && !CFG.emulators) {
      try {
        if (!window.firebase.appCheck) await Promise.race([loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-check-compat.js`), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
        // Fraud Defense (reCAPTCHA Enterprise) هو المزوّد المعتمد، وreCAPTCHA v3 الكلاسيكي أُوقف
        const P = CFG.appCheckProvider === 'v3' ? firebase.appCheck.ReCaptchaV3Provider : firebase.appCheck.ReCaptchaEnterpriseProvider;
        app.appCheck().activate(new P(CFG.appCheckKey), true);
      } catch (e) { console.warn('App Check', e); }
    }
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
      // لا نضبط نوع التخزين هنا: يحدده الدخول نفسه (دائم للإدارة، وللجلسة فقط للأعضاء). ضبطه عند كل فتح للصفحة ينقل جلسة المشرف إلى تخزين مؤقت فيفقدها عند إغلاق المتصفح
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

  // استعلام: {path, child, equalTo} يجلب فقط السجلات المطابقة (تفرضه قواعد الحماية لكل عضو)
  const queryData = new Map();   // key -> {path, data}
  const qkey = q => `${q.path}?${q.child}=${q.equalTo}`;
  function mergeQueries(path) {
    const merged = {};
    queryData.forEach(q => { if (q.path === path) Object.assign(merged, q.data || {}); });
    state = setIn(state, path, Object.keys(merged).length ? merged : null);
  }

  function listen(spec) {
    if (!rootRef) return Promise.resolve();
    const isQ = typeof spec === 'object' && spec;
    const key = isQ ? qkey(spec) : spec;
    if (listeners.has(key)) return Promise.resolve();
    const path = isQ ? spec.path : spec;
    let ref = path ? rootRef.child(path) : rootRef;
    if (isQ) { ref = ref.orderByChild(spec.child).equalTo(spec.equalTo); queryData.set(key, { path, data: {} }); }
    listeners.set(key, { ref, isQ, path });
    const apply = v => {
      if (isQ) { queryData.get(key).data = v || {}; mergeQueries(path); }
      else if (path) state = setIn(state, path, v); else state = v || {};
    };
    return new Promise(resolve => {
      let first = true;
      ref.on('value', snap => {
        apply(snap.val());
        if (first) { first = false; resolve(); }
        notify();
      }, err => {
        // مسار غير مسموح لهذا الدور: نتركه فارغاً ولا نعلّق التحميل
        console.warn('read denied', key, err && err.code);
        listeners.delete(key);
        if (isQ) { queryData.delete(key); mergeQueries(path); } else if (path) state = setIn(state, path, null);
        if (first) { first = false; resolve(); }
        notify();
      });
    });
  }

  function unlistenAll() {
    listeners.forEach(l => l.ref.off());
    listeners.clear();
    queryData.clear();
  }

  // paths: قائمة المسارات أو الاستعلامات، أو [''] لقراءة كل البيانات (الإدارة الكاملة)
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
    if (rootRef) listeners.forEach((l, key) => l.ref.once('value').then(snap => {
      if (l.isQ) { const q = queryData.get(key); if (q) { q.data = snap.val() || {}; mergeQueries(l.path); } }
      else if (l.path) state = setIn(state, l.path, snap.val()); else state = snap.val() || {};
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

  // زيادة ذرّية لعدّاد (أرقام العضوية) حتى لا يحصل مشرفان على الرقم نفسه
  async function transaction(path, fn) {
    if (!rootRef) { const v = fn(get(path)); set(path, v); return v; }
    const res = await rootRef.child(parts(path).join('/')).transaction(fn);
    if (!res.committed) throw new Error('transaction aborted');
    const v = res.snapshot.val();
    state = setIn(state, path, v); notify();
    return v;
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function push(path, obj) {
    const id = newId();
    set(`${path}/${id}`, { ...obj, id });
    return id;
  }

  const get = path => getIn(state, path);
  // حماية إضافية: تجاهل المفاتيح التي تحوي رموز HTML، ورقم السجل غير الآمن يُستبدل بمفتاحه
  const SAFE_KEY = /^[^"'<>&\s`]+$/;
  const list = path => Object.entries(get(path) || {})
    .filter(([k, v]) => v && SAFE_KEY.test(k))
    .map(([k, v]) => (typeof v === 'object' && v.id != null && !SAFE_KEY.test(String(v.id)) ? { ...v, id: k } : v));
  const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
  const dump = () => JSON.parse(JSON.stringify(state || {}));

  return { init, get, list, set, update, remove, push, transaction, newId, subscribe, seedOnce, dump, setScope, watch, readOnce, secondaryAuth,
    get auth() { return authApi; }, get hasAuth() { return !!authApi; }, get scope() { return scopeKey; },
    get mode() { return mode; }, get lastError() { return lastError; },
    get connected() { return connected; }, get everConnected() { return everConnected; }, get pending() { return pending; } };
})();
