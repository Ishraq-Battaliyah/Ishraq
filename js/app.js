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
  await Security.restore();

  // التعبئة الافتراضية والترقيات البسيطة: من الإدارة فقط في الوضع الآمن (القواعد لا تسمح لغيرها بالكتابة)
  let housekeepingDone = false;
  async function housekeeping() {
    if (housekeepingDone) return;
    if (Security.secure() && (Auth.current()?.kind !== 'admin' || !Security.isFull())) return;
    housekeepingDone = true;
    if (!Store.get('meta/seeded')) await Store.seedOnce(defaultData);
    else migrateEventsSection();
    // ترقية البيانات للبنية الجديدة بعد نشر القواعد الحديثة (أو دائماً في الوضع المحلي)
    if (!Security.secure() || Number(Store.get('meta/rulesVersion') || 0) >= Security.RULES_VERSION) Data.backfill();
  }
  await housekeeping();
  window.addEventListener('hashchange', housekeeping);

  // شريط حالة الاتصال: يظهر عند انقطاع الاتصال أو وجود تعديلات لم تُحفظ بعد
  const bar = document.createElement('div');
  bar.id = 'conn-bar';
  document.body.appendChild(bar);
  let wasOffline = false;
  const updateBar = () => {
    if (mode !== 'firebase') return;
    const offline = !Store.connected && Store.everConnected;
    if (offline) {
      wasOffline = true;
      bar.className = 'show offline';
      bar.innerHTML = `<i class="fa-solid fa-wifi"></i> انقطع الاتصال بقاعدة البيانات${Store.pending ? ` — ${Store.pending} تعديل بانتظار الحفظ، لا تغلق الصفحة حتى يعود الاتصال` : ' — جارٍ إعادة الاتصال...'}`;
    } else if (Store.pending > 0 && wasOffline) {
      bar.className = 'show saving';
      bar.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> جارٍ حفظ التعديلات...';
    } else if (wasOffline) {
      wasOffline = false;
      bar.className = 'show online';
      bar.innerHTML = '<i class="fa-solid fa-circle-check"></i> عاد الاتصال وتم حفظ كل التعديلات';
      setTimeout(() => { if (!wasOffline) bar.className = ''; }, 3000);
    }
  };
  Store.subscribe(updateBar);

  document.getElementById('boot')?.remove();
  render(false);
  window.addEventListener('hashchange', () => render(false));
  window.addEventListener('ishraq-rerender', () => render(true));
  let t;
  Store.subscribe(() => { clearTimeout(t); t = setTimeout(() => render(true), 60); });
})();
