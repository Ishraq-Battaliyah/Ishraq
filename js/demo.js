/* معاينة المرشد والمستفيد من لوحة الإدارة
   نافذة عائمة تحمّل الموقع نفسه داخل إطار بوضع تجريبي (?demo=mentor أو ?demo=mentee):
   - لا اتصال بقاعدة البيانات الحقيقية إطلاقاً (Firebase معطّل في الإطار)، فلا يدخل الحسابان الافتراضيان في أي قسم أو إحصائية.
   - البيانات تُحفظ في localStorage بمفتاح خاص ('ishraq-demo-db-v1') يتشاركه إطار المرشد وإطار المستفيد، فيرى كل طرف ما يفعله الآخر مباشرة.
   - مفتاح جلسة الدخول مختلف عن مفتاح الإدارة، فلا يتأثر دخول المشرف. */

// داخل الإطار التجريبي: قبل تحميل بقية الملفات
(() => {
  const as = new URLSearchParams(location.search).get('demo');
  if (!as) return;
  window.ISHRAQ_DEMO = { as: as === 'mentee' ? 'mentee' : 'mentor' };
  window.ISHRAQ_CONFIG = { ...window.ISHRAQ_CONFIG, firebase: null };
  document.documentElement.classList.add('demo-mode');
})();

const Demo = (() => {
  const IDS = { cohort: 'demo-c', mentor: 'demo-m', mentee: 'demo-b', mentee2: 'demo-b2' };   // المرشد التجريبي مرتبط بمستفيدين اثنين
  const KEY = 'ishraq-demo-db-v1';
  const iso = n => { const d = new Date(Date.now() + n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // بيانات الحسابين الافتراضيين: مرشد مرتبط بمستفيد، ودفعة أُطلقت ليستطيع المرشد إضافة المواعيد
  function seed() {
    const now = Date.now(), c = IDS.cohort;
    Store.set(`cohorts/${c}`, { id: c, num: 99, name: 'دفعة المعاينة', year: new Date().getFullYear() });
    Store.set(`members/${IDS.mentor}`, { id: IDS.mentor, role: 'mentor', code: 'M9901', cohort: c, seq: 1, name: 'مرشد تجريبي', tagline: 'حساب افتراضي للمعاينة' });
    Store.set(`members/${IDS.mentee}`, { id: IDS.mentee, role: 'mentee', code: 'B9901', cohort: c, seq: 1, name: 'مستفيد تجريبي', tagline: 'حساب افتراضي للمعاينة' });
    Store.set(`members/${IDS.mentee2}`, { id: IDS.mentee2, role: 'mentee', code: 'B9902', cohort: c, seq: 2, name: 'مستفيد تجريبي ٢', tagline: 'حساب افتراضي للمعاينة' });
    Store.set(`contacts/${IDS.mentee2}`, { whatsapp: '0500000003', email: 'mentee2@example.com' });
    Store.set(`contacts/${IDS.mentor}`, { whatsapp: '0500000001', email: 'mentor@example.com' });
    Store.set(`contacts/${IDS.mentee}`, { whatsapp: '0500000002', email: 'mentee@example.com' });
    Store.set(`pairs/${IDS.mentor}`, { [IDS.mentee]: true, [IDS.mentee2]: true }); Store.set(`pairs/${IDS.mentee}`, IDS.mentor); Store.set(`pairs/${IDS.mentee2}`, IDS.mentor);
    Store.set(`network/${c}`, { [IDS.mentor]: { [IDS.mentee]: true, [IDS.mentee2]: true } });
    Store.set(`launches/${c}`, { ts: now - 2 * 864e5 });
    Store.set('extraConfig', { enabled: true, ts: now, by: 'معاينة' });
    Store.set('notifyMail', { enabled: true, ts: now, by: 'معاينة' });
    [[5, '18:00', '19:00'], [7, '20:00', '21:00']].forEach(([d, s, e], i) => Store.set(`slots/demo-s${i + 1}`, { id: `demo-s${i + 1}`, mentorId: IDS.mentor, session: 1, date: iso(d), start: s, end: e, mode: 'both', summary: 'جلسة تعارف وتحديد الأهداف', ts: now }));
    Store.set('meta/demoSeeded', now);
  }

  // عند فتح الإطار: تعبئة البيانات إن لزم، ثم الدخول بالحساب المطلوب (دون المساس بجلسة الإدارة)
  function start() {
    const as = window.ISHRAQ_DEMO.as;
    Auth.KEY = `ishraq-auth-demo-${as}`;
    if (!Store.get('meta/demoSeeded')) seed();
    Auth.set({ kind: as, id: IDS[as] });
    const bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.innerHTML = `<i class="fa-solid fa-flask"></i> معاينة ${as === 'mentor' ? 'المرشد' : 'المستفيد'} — حساب افتراضي، لا يؤثر على بيانات المنصة ولا إحصاءاتها`;
    document.body.prepend(bar);
  }

  /* ===== نوافذ المعاينة العائمة في لوحة الإدارة ===== */
  const LABEL = { mentor: 'معاينة كمرشد', mentee: 'معاينة كمستفيد' };
  const src = kind => { const u = new URL('index.html', location.href); u.search = `?demo=${kind}`; u.hash = `#/${kind}`; return u.href; };

  function open(kind) {
    const old = document.querySelector(`.demo-win[data-kind="${kind}"]`);
    if (old) { old.classList.remove('min'); old.style.zIndex = ++z; return; }
    const w = document.createElement('div');
    w.className = 'demo-win'; w.dataset.kind = kind; w.style.zIndex = ++z;
    // يظهر الأول يساراً والثاني بجانبه (إن اتسعت الشاشة)، فلا تغطي النوافذ أزرار المعاينة في أعلى اليمين
    const width = Math.min(560, innerWidth * .94), n = document.querySelectorAll('.demo-win').length;
    w.style.left = `${Math.max(8, Math.min(24 + n * (width + 16), innerWidth - width - 8))}px`;
    w.innerHTML = `<div class="demo-win-head"><b><i class="fa-solid ${kind === 'mentor' ? 'fa-user-tie' : 'fa-user-graduate'}"></i> ${LABEL[kind]} <small>حساب افتراضي</small></b>
        <span><button type="button" data-demo-reset title="إعادة ضبط البيانات التجريبية"><i class="fa-solid fa-rotate-left"></i></button>
        <button type="button" data-demo-min title="تصغير"><i class="fa-solid fa-window-minimize"></i></button>
        <button type="button" data-demo-close title="إغلاق"><i class="fa-solid fa-xmark"></i></button></span></div>
      <iframe src="${src(kind)}" title="${LABEL[kind]}"></iframe>`;
    document.body.appendChild(w);
  }
  let z = 3000;

  const reloadAll = () => document.querySelectorAll('.demo-win iframe').forEach(f => { f.src = src(f.closest('.demo-win').dataset.kind); });
  function reset() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    reloadAll();
    window.toast && toast('أُعيد ضبط البيانات التجريبية');
  }

  // سحب النافذة من رأسها
  document.addEventListener('pointerdown', e => {
    const head = e.target.closest?.('.demo-win-head');
    if (!head || e.target.closest('button')) return;
    const w = head.closest('.demo-win'), r = w.getBoundingClientRect();
    w.style.zIndex = ++z; w.classList.add('dragging');
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = ev => { w.style.left = `${Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx))}px`; w.style.top = `${Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy))}px`; w.style.right = 'auto'; };
    const up = () => { w.classList.remove('dragging'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  document.addEventListener('click', e => {
    const o = e.target.closest?.('[data-demo-open]'); if (o) return open(o.dataset.demoOpen);
    const w = e.target.closest?.('.demo-win'); if (!w) return;
    if (e.target.closest('[data-demo-close]')) return w.remove();
    if (e.target.closest('[data-demo-min]')) return w.classList.toggle('min');
    if (e.target.closest('[data-demo-reset]')) return reset();
  });

  return { start, open, reset };
})();
