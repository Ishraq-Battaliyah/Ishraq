/* الأمان: جلسة الدخول، حسابات Firebase Authentication، المشرفون، وترقية البيانات
 *
 * وضعان للعمل:
 * - الوضع الآمن (Firebase + apiKey): الدخول عبر Firebase Authentication، وكل دور يقرأ ما يسمح له به فقط.
 * - الوضع السابق (بدون apiKey أو محلياً): الدخول بالرموز داخل الصفحة كما كان.
 */

const PUBLIC_PATHS = ['content', 'form', 'regform', 'cohorts', 'announcement', 'meta', 'events', 'members', 'featured', 'launches', 'news', 'extraConfig', 'notifyMail'];
// العضو يقرأ سجلاته فقط: استعلامات تفرضها القواعد على مستوى كل سجل
const q = (path, child, equalTo) => ({ path, child, equalTo });
function memberPaths(id, role, partner) {
  // المستفيد له مرشد واحد (نص)، والمرشد قد يكون له عدة مستفيدين (كائن) أو واحد (نص)
  const partners = Data.netIds(partner);
  const mentorId = role === 'mentor' ? id : partners[0];
  return [...PUBLIC_PATHS, `contacts/${id}`, `notifications/${id}`, `myRegs/${id}`, `certs/templates/${role}`, `certs/names/${id}`, `certs/issued/${id}`, `pairs/${id}`, `approvedReviews/${id}`, 'extraTaken',
    q('bookings', role === 'mentor' ? 'mentorId' : 'menteeId', id), q('wishes', role === 'mentor' ? 'mentorId' : 'menteeId', id), q('reviews', 'authorId', id),
    q('messages', 'aud', 'all'), q('messages', 'aud', role), q('messages', 'aud', id), q('tickets', 'memberId', id),
    // مواعيد المرشد الأساسية (المرشد نفسه أو مرشد المستفيد)، ومواعيد الجلسات الإضافية المفتوحة لكل المستفيدين
    ...(mentorId ? [q('slots', 'mentorId', mentorId)] : []), ...(role === 'mentee' ? [q('slots', 'extra', true)] : []),
    ...partners.map(p => `contacts/${p}`)];
}
// المشرف الجزئي يقرأ ما تحتاجه صلاحياته فقط
const PERM_PATHS = {
  content: [], announce: ['registrations', 'regform', 'cohorts', 'launches'], interests: ['interests'],
  cohorts: ['contacts', 'uids', 'counters', 'network', 'pairs', 'bookings', 'slots', 'myRegs'],
  sessions: ['contacts', 'network', 'pairs', 'bookings', 'slots', 'extraTaken', 'extraPairs', 'wishes'],
  reviews: ['reviews', 'approvedReviews', 'network', 'pairs', 'bookings'],
  messages: ['messages', 'inbox', 'tickets', 'ticketStaff', 'network', 'pairs'],
  events: ['eventRegs', 'myRegs'],
  certificates: ['contacts', 'eventRegs', 'certs']
};
const CONTACT_KEYS = ['whatsapp', 'email', 'linkedin', 'website', 'twitter', 'instagram'];

// الصلاحيات الجزئية للمشرفين (يجب أن تطابق PERMS في tools/build_rules.py)
const PERMISSIONS = [
  { k: 'content', label: 'محتوى الصفحة الرئيسية', desc: 'الأقسام وترتيبها وحقول نموذج التسجيل', icon: 'fa-pen-ruler' },
  { k: 'cohorts', label: 'الدفعات والعضويات', desc: 'البطاقات ورموز الدخول والشبكة واستيراد CSV', icon: 'fa-people-group' },
  { k: 'sessions', label: 'الجلسات', desc: 'متابعة الجلسات وإحصاءاتها', icon: 'fa-calendar-days' },
  { k: 'reviews', label: 'التقييمات', desc: 'اعتماد التقييمات واختيار المعروض منها', icon: 'fa-star' },
  { k: 'messages', label: 'الرسائل', desc: 'إرسال الرسائل للأعضاء والرسائل الواردة', icon: 'fa-envelope' },
  { k: 'announce', label: 'الإعلان المنبثق', desc: 'نافذة الإعلان في الصفحة الرئيسية', icon: 'fa-bullhorn' },
  { k: 'events', label: 'الفعاليات', desc: 'إعلانات الفعاليات والمسجلون فيها', icon: 'fa-person-chalkboard' },
  { k: 'certificates', label: 'الشهادات', desc: 'إصدار الشهادات وإرسالها وتعديل قوالبها', icon: 'fa-award' },
  { k: 'interests', label: 'المهتمون', desc: 'تسجيلات الاهتمام بالانضمام', icon: 'fa-user-plus' }
];
const RULES_VERSION = 12;

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

  function randomSuffix(n = 6) {
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

  /* ===== الحسابات الرئيسية والصلاحيات ===== */
  const OWNERS = (window.ISHRAQ_CONFIG.ownerEmails || []).map(e => String(e).toLowerCase());
  const isOwnerUser = u => !!u && u.emailVerified === true && OWNERS.includes(String(u.email || '').toLowerCase());
  const currentUser = () => (secure() ? Store.auth.currentUser : null);
  const isOwner = () => !secure() || isOwnerUser(currentUser());
  const adminRec = () => { const u = currentUser(); return u ? Store.get(`admins/${u.uid}`) : null; };
  // صلاحية كاملة: حساب رئيسي، أو role=full، أو مشرف قديم بلا role
  const isFull = () => isOwner() || (!!adminRec() && (adminRec().role === 'full' || !adminRec().role));
  const can = perm => isFull() || !!adminRec()?.perms?.[perm];
  const adminName = () => { const u = currentUser(); return adminRec()?.name || u?.displayName || u?.email || 'مشرف'; };

  function log(action, target = '', details = '') {
    const u = currentUser();
    if (!u) return;
    Store.push('adminLog', { ts: Date.now(), action, target, details, by: { uid: u.uid, email: u.email || '', name: adminName() } });
  }

  /* ===== بقاء المشرف مسجلاً مع حد لعدم النشاط ===== */
  const ACTIVE_KEY = 'ishraq-admin-active';
  const idleMs = () => (Number(window.ISHRAQ_CONFIG.adminIdleHours) || 72) * 3600 * 1000;
  const touch = () => { try { localStorage.setItem(ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ } };
  const lastActive = () => { try { return Number(localStorage.getItem(ACTIVE_KEY) || 0); } catch { return 0; } };
  const idleExpired = () => { const t = lastActive(); return !t || Date.now() - t > idleMs(); };
  let lastTouch = 0;
  ['click', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, () => {
    if (Auth.current()?.kind !== 'admin' || Date.now() - lastTouch < 60000) return;
    lastTouch = Date.now(); touch();
  }, { passive: true }));
  async function checkIdle() {
    if (!secure() || Auth.current()?.kind !== 'admin' || !idleExpired()) return;
    await Auth.logout();
    toast('انتهت جلسة الإدارة لعدم النشاط، سجّل الدخول من جديد');
  }
  setInterval(checkIdle, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkIdle(); });

  const persist = kind => Store.auth.setPersistence(kind === 'admin' ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION).catch(() => {});

  /* ===== نطاق القراءة حسب الدور ===== */
  async function applyScope(session) {
    if (Store.mode !== 'firebase') return;
    if (!secure()) return Store.setScope('all', ['']);
    if (!session) return Store.setScope('public', PUBLIC_PATHS);
    if (session.kind === 'admin') {
      if (isFull()) return Store.setScope('admin', ['']);
      const u = currentUser();
      if (!Store.get(`admins/${u.uid}`)) await Store.setScope(`admin-rec:${u.uid}`, [...PUBLIC_PATHS, `admins/${u.uid}`]);
      if (isFull()) return Store.setScope('admin', ['']);
      const perms = Object.keys(adminRec()?.perms || {}).filter(k => adminRec().perms[k]).sort();
      const paths = new Set([...PUBLIC_PATHS, `admins/${u.uid}`, 'notifications']);
      perms.forEach(k => (PERM_PATHS[k] || []).forEach(p => paths.add(p)));
      return Store.setScope(`admin:${u.uid}:${perms.join(',')}`, [...paths]);
    }
    const partner = await Store.readOnce(`pairs/${session.id}`);
    return Store.setScope(`member:${session.id}`, memberPaths(session.id, session.kind, partner));
  }

  async function roleFor(uid) {
    const u = Store.auth?.currentUser;
    if (u && u.uid === uid && isOwnerUser(u)) return { kind: 'admin', uid, owner: true };
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
      let expired = false;
      if (session?.kind === 'admin') {
        if (lastActive() && idleExpired()) expired = true; else touch();
      } else if (!session && viaGoogle && idleExpired() && lastActive()) expired = true;
      if (expired) {
        session = null;
        setTimeout(() => window.toast && toast('انتهت جلسة الإدارة لعدم النشاط، سجّل الدخول من جديد'), 800);
      }
      if (!session && viaGoogle && !expired) {
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
      await persist('member');
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
      // الوضع السابق للتجربة المحلية فقط: يعمل عند تحديد adminCode في الإعدادات
      const code = window.ISHRAQ_CONFIG.adminCode;
      if (!code) throw new Error('الدخول بالرمز غير متاح؛ فعّل Firebase Authentication');
      if (toEnDigits(password).trim() !== String(code)) throw new Error('الرمز السري غير صحيح');
      Auth.set({ kind: 'admin' });
      await applyScope(Auth.current());
      return { session: Auth.current() };
    }
    await persist('admin');
    try { await Store.auth.signInWithEmailAndPassword(String(email).trim(), password); }
    catch (e) { throw new Error(authMsg(e)); }
    const user = Store.auth.currentUser;
    // الحساب الرئيسي بكلمة سر يحتاج تأكيد البريد مرة واحدة
    if (OWNERS.includes(String(user.email).toLowerCase()) && !user.emailVerified) {
      await user.sendEmailVerification().catch(() => {});
      await Store.auth.signOut();
      throw new Error(`أرسلنا رابط تأكيد إلى ${user.email}. افتحه ثم سجّل الدخول من جديد، أو استخدم «الدخول بحساب Google».`);
    }
    const s = await roleFor(user.uid);
    if (s?.kind !== 'admin') { await Store.auth.signOut(); throw new Error('هذا الحساب ليس من حسابات الإدارة'); }
    return startAdmin(s);
  }

  // بعد نجاح دخول المشرف: تسجيل النشاط، وإنشاء سجل للحساب الرئيسي إن لم يوجد
  async function startAdmin(s) {
    touch();
    Auth.set(s);
    await applyScope(s);
    const u = currentUser();
    if (s.owner && !Store.get(`admins/${u.uid}`)) {
      Store.set(`admins/${u.uid}`, { email: u.email, name: u.displayName || '', role: 'full', owner: true, addedAt: Date.now(), via: (u.providerData || []).some(p => p.providerId === 'google.com') ? 'google' : 'password' });
    }
    return { session: s };
  }

  /* ===== دخول الإدارة بحساب Google (بدعوة مسبقة) ===== */
  // مفتاح الدعوة: البريد بأحرف صغيرة مع استبدال النقاط بفواصل (النقطة غير مسموحة في مفاتيح القاعدة)
  const inviteKey = email => String(email || '').trim().toLowerCase().replace(/\./g, ',');
  const googleProvider = () => { const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };

  async function googleAdminLogin() {
    if (!secure()) throw new Error('الدخول بحساب Google يتطلب الوضع الآمن');
    await persist('admin');
    try { await Store.auth.signInWithPopup(googleProvider()); }
    catch (e) {
      // إعادة التوجيه لا تعمل حين يختلف نطاق الموقع عن authDomain في المتصفحات الحديثة، لذلك نكتفي بالنافذة المنبثقة
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') throw new Error('المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة');
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
    if (s?.kind === 'admin') return startAdmin(s);
    if (s) { await Store.auth.signOut(); throw new Error('هذا الحساب مرتبط بعضوية وليس بالإدارة'); }
    const root = firebase.app().database().ref(window.ISHRAQ_CONFIG.dbRoot || 'ishraq');
    const key = inviteKey(user.email);
    const inv = (await root.child(`adminInvites/${key}`).once('value').catch(() => null))?.val();
    if (!inv) {
      await Store.auth.signOut();
      throw new Error(`الحساب ${user.email} غير مدعو للإدارة. اطلب من أحد الحسابات الرئيسية دعوته.`);
    }
    try {
      await root.child(`admins/${user.uid}`).set({
        email: user.email, name: inv.name || user.displayName || '', addedAt: Date.now(), via: 'google',
        role: inv.role || 'partial', perms: inv.perms || null, invitedBy: inv.invitedBy || null
      });
    } catch (e) {
      console.warn(e);
      await Store.auth.signOut();
      throw new Error('تعذّر تفعيل الدعوة، اطلب من الحساب الرئيسي إعادة إرسالها');
    }
    await root.child(`adminInvites/${key}`).remove().catch(() => {});
    s = { kind: 'admin', uid: user.uid };
    await startAdmin(s);
    log('تفعيل دعوة', user.email, `دعاه: ${inv.invitedBy?.name || inv.invitedBy?.email || '—'}`);
    return { session: s };
  }

  function permsSummary(role, perms) {
    if (role === 'full') return 'صلاحية كاملة';
    const on = PERMISSIONS.filter(p => perms?.[p.k]).map(p => p.label);
    return on.length ? `صلاحية جزئية: ${on.join('، ')}` : 'بدون صلاحيات';
  }

  function inviteAdmin(email, name, role = 'partial', perms = {}) {
    email = String(email || '').trim().toLowerCase();
    const u = currentUser();
    Store.set(`adminInvites/${inviteKey(email)}`, {
      email, name: name || '', invitedAt: Date.now(), role, perms: role === 'full' ? null : cleanPerms(perms),
      invitedBy: { uid: u.uid, email: u.email || '', name: adminName() }
    });
    log('إرسال دعوة Google', email, `${name ? name + ' — ' : ''}${permsSummary(role, perms)}`);
  }

  function cancelInvite(key) {
    const inv = Store.get(`adminInvites/${key}`);
    Store.remove(`adminInvites/${key}`);
    log('إلغاء دعوة', inv?.email || key);
  }

  const cleanPerms = perms => { const o = {}; PERMISSIONS.forEach(p => { if (perms?.[p.k]) o[p.k] = true; }); return Object.keys(o).length ? o : null; };

  function setAdminPerms(uid, role, perms) {
    const a = Store.get(`admins/${uid}`);
    Store.update(`admins/${uid}`, { role, perms: role === 'full' ? null : cleanPerms(perms) });
    log('تعديل صلاحيات', a?.email || uid, permsSummary(role, perms));
  }

  function removeAdmin(uid) {
    const a = Store.get(`admins/${uid}`);
    Store.remove(`admins/${uid}`);
    log('إزالة مشرف', a?.email || uid);
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
  async function addAdmin(email, password, name, role = 'partial', perms = {}) {
    const uid = await withSecondary(async a2 => {
      try { return (await a2.createUserWithEmailAndPassword(String(email).trim(), password)).user.uid; }
      catch (e) {
        if (e.code !== 'auth/email-already-in-use') throw new Error(authMsg(e));
        try { return (await a2.signInWithEmailAndPassword(String(email).trim(), password)).user.uid; }
        catch (e2) { throw new Error('هذا البريد مسجّل مسبقاً بكلمة سر مختلفة'); }
      }
    });
    const u = currentUser();
    Store.set(`admins/${uid}`, {
      email: String(email).trim(), name: name || '', addedAt: Date.now(), via: 'password', role, perms: role === 'full' ? null : cleanPerms(perms),
      addedBy: { uid: u.uid, email: u.email || '', name: adminName() }
    });
    log('إضافة مشرف ببريد وكلمة سر', String(email).trim(), `${name ? name + ' — ' : ''}${permsSummary(role, perms)}`);
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
    googleAdminLogin, finishGoogleAdmin, inviteAdmin, inviteKey, cancelInvite, setAdminPerms, removeAdmin, permsSummary,
    isOwner, isFull, can, log, adminName, OWNERS, RULES_VERSION,
    createMemberAccount, regenerateCode, deleteMemberAccount, addAdmin, needsMigration, migrate, setFeatured,
    newSecret, emailFor, normCode, authMsg, CONTACT_KEYS
  };
})();
