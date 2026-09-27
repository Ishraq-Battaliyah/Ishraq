/* الأمان: جلسة الدخول، حسابات Firebase Authentication، المشرفون، وترقية البيانات
 *
 * وضعان للعمل:
 * - الوضع الآمن (Firebase + apiKey): الدخول عبر Firebase Authentication، وكل دور يقرأ ما يسمح له به فقط.
 * - الوضع السابق (بدون apiKey أو محلياً): الدخول بالرموز داخل الصفحة كما كان.
 */

const PUBLIC_PATHS = ['content', 'form', 'cohorts', 'announcement', 'meta', 'events', 'members', 'featured'];
const memberPaths = id => [...PUBLIC_PATHS, 'network', 'slots', 'bookings', 'reviews', 'messages', `contacts/${id}`, `notifications/${id}`, `myRegs/${id}`];
const CONTACT_KEYS = ['whatsapp', 'email', 'linkedin', 'website', 'twitter', 'instagram'];

const Auth = {
  KEY: 'ishraq-auth',
  get() { try { return JSON.parse(sessionStorage.getItem(this.KEY) || 'null'); } catch { return window.__auth || null; } },
  current() { return this.get() || window.__auth || null; },
  // تعيين الجلسة داخل الصفحة فقط (في الوضع الآمن لا يمنح أي صلاحية دون حساب Firebase حقيقي)
  login(v) { this.set(v); },
  set(v) { window.__auth = v; try { v ? sessionStorage.setItem(this.KEY, JSON.stringify(v)) : sessionStorage.removeItem(this.KEY); } catch { /* ignore */ } },
  async logout() {
    this.set(null);
    if (Store.auth) await Store.auth.signOut().catch(() => {});
    await Security.applyScope(null);
    location.hash = '#/';
  }
};

const Security = (() => {
  const secure = () => Store.hasAuth;
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  function randomSuffix(n = 4) {
    const a = new Uint32Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.from(a, x => ALPHABET[x % ALPHABET.length]).join('');
  }
  const newSecret = memberCode => `${String(memberCode).toUpperCase()}-${randomSuffix()}`;
  const emailFor = memberCode => `ishraq-${String(memberCode).toLowerCase()}@example.com`;
  const normCode = c => toEnDigits(c).trim().toUpperCase().replace(/\s+/g, '').replace(/[–—_]/g, '-');

  const authMsg = e => ({
    'auth/wrong-password': 'البيانات غير صحيحة',
    'auth/invalid-credential': 'البيانات غير صحيحة',
    'auth/invalid-login-credentials': 'البيانات غير صحيحة',
    'auth/user-not-found': 'البيانات غير صحيحة',
    'auth/invalid-email': 'البريد الإلكتروني غير صالح',
    'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
    'auth/network-request-failed': 'تعذّر الاتصال، تحقق من الإنترنت',
    'auth/email-already-in-use': 'هذا البريد مستخدم لحساب آخر',
    'auth/weak-password': 'كلمة السر ضعيفة (6 أحرف على الأقل)',
    'auth/operation-not-allowed': 'تسجيل الدخول بالبريد وكلمة السر غير مفعّل في Firebase Authentication'
  }[e && e.code] || (e && e.message) || 'حدث خطأ غير متوقع');

  /* ===== نطاق القراءة حسب الدور ===== */
  async function applyScope(session) {
    if (Store.mode !== 'firebase') return;
    if (!secure()) return Store.setScope('all', ['']);
    if (!session) return Store.setScope('public', PUBLIC_PATHS);
    if (session.kind === 'admin') return Store.setScope('admin', ['']);
    return Store.setScope(`member:${session.id}`, memberPaths(session.id));
  }

  async function roleFor(uid) {
    const admin = await Store.readOnce(`admins/${uid}`);
    if (admin) return { kind: 'admin', uid };
    const id = await Store.readOnce(`uids/${uid}`);
    if (!id) return null;
    const m = await Store.readOnce(`members/${id}`);
    return m ? { kind: m.role, id, uid } : null;
  }

  // عند فتح الصفحة: استعادة الجلسة من Firebase Authentication
  async function restore() {
    if (!secure()) {
      await applyScope(null);
      return;
    }
    const user = await new Promise(res => { const un = Store.auth.onAuthStateChanged(u => { un(); res(u); }); });
    let session = null;
    if (user) {
      session = await roleFor(user.uid);
      const viaGoogle = (user.providerData || []).some(p => p.providerId === 'google.com');
      if (!session && viaGoogle) {
        try { session = (await finishGoogleAdmin()).session; location.hash = '#/admin'; } catch (e) { setTimeout(() => window.toast && toast(e.message, 'error'), 800); }
      }
      if (!session) await Store.auth.signOut().catch(() => {});
    }
    Auth.set(session);
    await applyScope(session);
  }

  /* ===== دخول المرشد والمستفيد ===== */
  async function memberLogin(kind, rawCode) {
    const code = normCode(rawCode);
    if (!code) throw new Error('فضلاً أدخل رمز الدخول');
    if (secure()) {
      const prefix = code.split('-')[0];
      if (!code.includes('-')) throw new Error('الرمز غير مكتمل — اكتبه كما وصلك، مثل M211-7K4Q');
      try { await Store.auth.signInWithEmailAndPassword(emailFor(prefix), code); }
      catch (e) { throw new Error(authMsg(e)); }
      const s = await roleFor(Store.auth.currentUser.uid);
      if (!s || s.kind !== kind) { await Store.auth.signOut(); throw new Error('رمز الدخول غير صحيح'); }
      return { session: s, member: await Store.readOnce(`members/${s.id}`) };
    }
    // الوضع السابق: المقارنة داخل الصفحة
    const all = Store.list('members');
    const bySecret = all.find(m => normCode(Store.get(`secrets/codes/${m.id}`) || '') === code);
    const legacy = all.find(m => !Store.get(`secrets/codes/${m.id}`) && String(m.code).toUpperCase() === code);
    const m = bySecret || legacy;
    if (!m || m.role !== kind) throw new Error('رمز الدخول غير صحيح');
    return { session: { kind, id: m.id }, member: Data.member(m.id) };
  }

  async function confirmMember(session) {
    Auth.set(session);
    await applyScope(session);
    location.hash = `#/${session.kind}`;
  }
  async function cancelMember() {
    if (secure()) await Store.auth.signOut().catch(() => {});
  }

  /* ===== دخول الإدارة ===== */
  async function adminLogin(email, password) {
    if (!secure()) {
      if (toEnDigits(password).trim() !== String(window.ISHRAQ_CONFIG.adminCode || '2026')) throw new Error('الرمز السري غير صحيح');
      Auth.set({ kind: 'admin' });
      await applyScope(Auth.current());
      return { session: Auth.current() };
    }
    try { await Store.auth.signInWithEmailAndPassword(String(email).trim(), password); }
    catch (e) { throw new Error(authMsg(e)); }
    const user = Store.auth.currentUser;
    let s = await roleFor(user.uid);
    if (s?.kind !== 'admin') {
      // أول مشرف: تسمح القواعد بتسجيل أول حساب مشرفاً فقط عندما لا يوجد أي مشرف
      const claimed = await claimFirstAdmin(user);
      if (!claimed) { await Store.auth.signOut(); throw new Error('هذا الحساب ليس من حسابات الإدارة'); }
      s = { kind: 'admin', uid: user.uid };
    }
    Auth.set(s);
    await applyScope(s);
    return { session: s };
  }

  async function claimFirstAdmin(user) {
    const ok = await confirmDialog('لا يوجد مشرفون مسجلون في المنصة بعد.<br>هل تريد تعيين هذا الحساب <b dir="ltr">' + esc(user.email) + '</b> كأول مشرف؟',
      { ok: 'تعيين كمشرف', title: 'أول مشرف' });
    if (!ok) return false;
    try {
      await firebase.app().database().ref(`${window.ISHRAQ_CONFIG.dbRoot || 'ishraq'}/admins/${user.uid}`)
        .set({ email: user.email, name: 'المشرف الرئيسي', addedAt: Date.now(), first: true });
      return true;
    } catch (e) {
      console.warn(e);
      return false;
    }
  }

  /* ===== دخول الإدارة بحساب Google (بدعوة مسبقة) ===== */
  // مفتاح الدعوة: البريد بأحرف صغيرة مع استبدال النقاط بفواصل (النقطة غير مسموحة في مفاتيح القاعدة)
  const inviteKey = email => String(email || '').trim().toLowerCase().replace(/\./g, ',');
  const googleProvider = () => { const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };

  async function googleAdminLogin() {
    if (!secure()) throw new Error('الدخول بحساب Google يتطلب الوضع الآمن');
    try { await Store.auth.signInWithPopup(googleProvider()); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await Store.auth.signInWithRedirect(googleProvider());
        return new Promise(() => {}); // تنتقل الصفحة إلى Google ثم تعود
      }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') throw new Error('أُغلقت نافذة Google قبل إكمال الدخول');
      if (e.code === 'auth/unauthorized-domain') throw new Error('نطاق الموقع غير مضاف في Firebase ← Authentication ← Settings ← Authorized domains');
      throw new Error(authMsg(e));
    }
    return finishGoogleAdmin();
  }

  // بعد الدخول بـ Google: مشرف موجود، أو دعوة تُفعَّل، أو أول مشرف
  async function finishGoogleAdmin() {
    const user = Store.auth.currentUser;
    let s = await roleFor(user.uid);
    if (s?.kind === 'admin') { Auth.set(s); await applyScope(s); return { session: s }; }
    if (s) { await Store.auth.signOut(); throw new Error('هذا الحساب مرتبط بعضوية وليس بالإدارة'); }
    const root = firebase.app().database().ref(window.ISHRAQ_CONFIG.dbRoot || 'ishraq');
    try {
      await root.child(`admins/${user.uid}`).set({ email: user.email, name: user.displayName || '', addedAt: Date.now(), via: 'google' });
      s = { kind: 'admin', uid: user.uid };
      Auth.set(s);
      await applyScope(s);
      // الاسم من الدعوة إن لم يكن في حساب Google اسم
      const inv = (await root.child(`adminInvites/${inviteKey(user.email)}`).once('value').catch(() => null))?.val();
      if (inv?.name && !user.displayName) Store.set(`admins/${user.uid}/name`, inv.name);
      Store.remove(`adminInvites/${inviteKey(user.email)}`);
      return { session: s };
    } catch (e) {
      // القواعد تسمح بهذه الكتابة فقط إذا كان البريد مدعواً (أو لا يوجد مشرفون بعد)
      await Store.auth.signOut();
      throw new Error(`الحساب ${user.email} غير مدعو للإدارة. اطلب من أحد المشرفين دعوته من تبويب «المشرفون».`);
    }
  }

  function inviteAdmin(email, name) {
    email = String(email || '').trim().toLowerCase();
    Store.set(`adminInvites/${inviteKey(email)}`, { email, name: name || '', invitedAt: Date.now() });
  }

  async function changeMyPassword(current, next) {
    const user = Store.auth.currentUser;
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
    try { await user.reauthenticateWithCredential(cred); await user.updatePassword(next); }
    catch (e) { throw new Error(authMsg(e)); }
  }

  /* ===== حسابات الأعضاء (تُنشأ عبر تطبيق ثانوي حتى لا يخرج المشرف من حسابه) ===== */
  async function withSecondary(fn) {
    const a2 = Store.secondaryAuth();
    try { return await fn(a2); }
    finally { await a2.signOut().catch(() => {}); }
  }

  async function retry(fn) {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (e) {
        if (e.code === 'auth/too-many-requests' && i < 4) { await new Promise(r => setTimeout(r, 3000 * (i + 1))); continue; }
        throw e;
      }
    }
  }

  // ينشئ حساب دخول للعضو ويعيد الرمز الجديد
  async function createMemberAccount(member) {
    const secret = newSecret(member.code);
    if (!secure()) {
      Store.set(`secrets/codes/${member.id}`, secret);
      return secret;
    }
    const uid = await withSecondary(a2 => retry(async () => {
      try { return (await a2.createUserWithEmailAndPassword(emailFor(member.code), secret)).user.uid; }
      catch (e) {
        if (e.code !== 'auth/email-already-in-use') throw e;
        // حساب موجود مسبقاً (مثلاً من محاولة سابقة): نغيّر رمزه باستخدام الرمز المحفوظ
        const old = Store.get(`secrets/codes/${member.id}`);
        if (!old) throw new Error('يوجد حساب دخول سابق لهذا العضو ولا يُعرف رمزه');
        const u = (await a2.signInWithEmailAndPassword(emailFor(member.code), old)).user;
        await u.updatePassword(secret);
        return u.uid;
      }
    }));
    Store.set(`uids/${uid}`, member.id);
    Store.set(`members/${member.id}/uid`, uid);
    Store.set(`secrets/codes/${member.id}`, secret);
    return secret;
  }

  async function regenerateCode(member) {
    const old = Store.get(`secrets/codes/${member.id}`);
    if (!secure() || !member.uid || !old) return createMemberAccount(member);
    const secret = newSecret(member.code);
    await withSecondary(a2 => retry(async () => {
      const u = (await a2.signInWithEmailAndPassword(emailFor(member.code), old)).user;
      await u.updatePassword(secret);
    }));
    Store.set(`secrets/codes/${member.id}`, secret);
    return secret;
  }

  async function deleteMemberAccount(member) {
    if (!secure() || !member.uid) return;
    const code = Store.get(`secrets/codes/${member.id}`);
    try {
      if (code) await withSecondary(async a2 => { const u = (await a2.signInWithEmailAndPassword(emailFor(member.code), code)).user; await u.delete(); });
    } catch (e) { console.warn('delete auth user failed', e); }
    Store.remove(`uids/${member.uid}`);
  }

  /* ===== المشرفون ===== */
  async function addAdmin(email, password, name) {
    const uid = await withSecondary(async a2 => {
      try { return (await a2.createUserWithEmailAndPassword(String(email).trim(), password)).user.uid; }
      catch (e) {
        if (e.code !== 'auth/email-already-in-use') throw new Error(authMsg(e));
        try { return (await a2.signInWithEmailAndPassword(String(email).trim(), password)).user.uid; }
        catch (e2) { throw new Error('هذا البريد مسجّل مسبقاً بكلمة سر مختلفة'); }
      }
    });
    Store.set(`admins/${uid}`, { email: String(email).trim(), name: name || '', addedAt: Date.now() });
    return uid;
  }

  /* ===== ترقية البيانات إلى البنية الآمنة (مرة واحدة) ===== */
  const needsMigration = () => Number(Store.get('meta/securityVersion') || 0) < 2;

  async function migrate(onProgress = () => {}) {
    const data = Store.dump();
    // 1) نقل بيانات التواصل من البطاقات العامة إلى مسار خاص
    Object.values(data.members || {}).forEach(m => {
      const c = {};
      CONTACT_KEYS.forEach(k => { if (m[k]) c[k] = m[k]; });
      if (Object.keys(c).length) Store.update(`contacts/${m.id}`, c);
      const strip = {};
      CONTACT_KEYS.forEach(k => { if (k in m) strip[k] = null; });
      if (Object.keys(strip).length) Store.update(`members/${m.id}`, strip);
    });
    onProgress('نُقلت بيانات التواصل إلى مسار خاص');
    // 2) الإشعارات: من قائمة واحدة إلى قائمة لكل مستلم
    Object.entries(data.notifications || {}).forEach(([id, n]) => {
      if (n && typeof n === 'object' && n.to && n.text) {
        Store.set(`notifications/${n.to}/${id}`, n);
        Store.remove(`notifications/${id}`);
      }
    });
    onProgress('أُعيد تنظيم الإشعارات');
    // 3) التقييمات المعروضة في الصفحة الرئيسية
    Object.values(data.reviews || {}).filter(r => r.featured).forEach(r => setFeatured(r, true));
    // 4) تسجيلات الأعضاء في الفعاليات
    Object.values(data.eventRegs || {}).filter(r => r.memberId).forEach(r => Store.set(`myRegs/${r.memberId}/${r.eventId}`, { regId: r.id, ts: r.ts }));
    onProgress('نُقلت التقييمات المعروضة وتسجيلات الفعاليات');
    // 5) حسابات دخول الأعضاء
    const members = Object.values(data.members || {}).filter(m => !m.uid || !data.secrets?.codes?.[m.id]);
    let done = 0, failed = [];
    for (const m of members) {
      try { await createMemberAccount(m); }
      catch (e) { console.error(e); failed.push(`${m.name} (${m.code}): ${authMsg(e)}`); }
      done++;
      onProgress(`حسابات الأعضاء: ${done} / ${members.length}`);
    }
    if (!failed.length) Store.set('meta/securityVersion', 2);
    return { failed };
  }

  function setFeatured(r, on) {
    if (!on) return Store.remove(`featured/${r.id}`);
    const a = Store.get(`members/${r.authorId}`);
    Store.set(`featured/${r.id}`, { id: r.id, text: r.text, authorId: r.authorId || '', authorName: a?.name || r.authorName || '', role: a?.role || r.from || '', cohort: a?.cohort || '', ts: r.ts || Date.now() });
  }

  return {
    secure, applyScope, restore, memberLogin, confirmMember, cancelMember, adminLogin, changeMyPassword,
    googleAdminLogin, finishGoogleAdmin, inviteAdmin, inviteKey,
    createMemberAccount, regenerateCode, deleteMemberAccount, addAdmin, needsMigration, migrate, setFeatured,
    newSecret, emailFor, normCode, authMsg, CONTACT_KEYS
  };
})();
