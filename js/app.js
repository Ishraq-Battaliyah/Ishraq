/* الموجّه الرئيسي */

(async () => {
  const root = document.getElementById('app');
  let lastRoute = null;

  function route() {
    const r = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
    return ['home', 'members', 'admin', 'mentor', 'mentee'].includes(r) ? r : 'home';
  }

  /* الاحتفاظ بقيم الحقول والتركيز عند إعادة الرسم بسبب تحديثات البيانات */
  function snapshot() {
    const vals = $$('input,textarea,select', root).map(el => [el.name || '', el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value]);
    const a = document.activeElement;
    const idx = a && root.contains(a) ? $$('input,textarea,select', root).indexOf(a) : -1;
    return { vals, idx, y: window.scrollY };
  }
  function restore(s) {
    const els = $$('input,textarea,select', root);
    if (els.length !== s.vals.length) return;
    els.forEach((el, i) => {
      const [n, v] = s.vals[i];
      if ((el.name || '') !== n || el.type === 'file') return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = v; else if (el.value !== v) el.value = v;
    });
    if (s.idx >= 0 && els[s.idx]) els[s.idx].focus({ preventScroll: true });
  }

  function render(fromData) {
    const r = route();
    const auth = Auth.current();
    const same = r === lastRoute;
    const snap = same && fromData ? snapshot() : null;
    root.onclick = root.onchange = root.onsubmit = null;
    document.body.dataset.route = r;
    window.onscroll = null;

    if (r === 'admin') {
      if (auth?.kind !== 'admin') { location.hash = '#/'; return; }
      document.title = 'إشراق | لوحة الإدارة';
      Admin.render(root);
    } else if (r === 'mentor' || r === 'mentee') {
      if (auth?.kind !== r) { location.hash = '#/'; return; }
      document.title = `إشراق | ${r === 'mentor' ? 'بوابة المرشد' : 'بوابة المستفيد'}`;
      Portal.render(root, r, auth.id);
    } else if (r === 'members') {
      document.title = 'إشراق | أعضاء الدفعات';
      Home.renderMembers(root);
    } else {
      document.title = 'إشراق | معك لمستقبل طموح';
      // لا نعيد رسم الصفحة أثناء تشغيل مقطع فيديو حتى لا يتوقف
      const playing = $$('.video-frame.playing', root).length || $$('.video-frame video', root).some(v => !v.paused);
      if (fromData && same && playing) return;
      Home.render(root, fromData);
      if (!fromData) setTimeout(Home.maybeAnnouncement, 700);
    }
    if (snap) { restore(snap); window.scrollTo(0, snap.y); }
    else if (!same) window.scrollTo(0, 0);
    lastRoute = r;
  }

  const mode = await Store.init();
  if (!Store.get('meta/seeded')) seedDatabase();
  else migrateEventsSection();
  if (mode === 'local-fallback') toast('تعذّر الاتصال بقاعدة البيانات، يتم العمل محلياً مؤقتاً', 'error');

  document.getElementById('boot')?.remove();
  render(false);
  window.addEventListener('hashchange', () => render(false));
  let t;
  Store.subscribe(() => { clearTimeout(t); t = setTimeout(() => render(true), 60); });
})();
