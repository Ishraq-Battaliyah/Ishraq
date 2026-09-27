/* لوحة تحكم الإدارة */

const Admin = (() => {
  const TABS = [
    { id: 'content', label: 'محتوى الصفحة', icon: 'fa-pen-ruler' },
    { id: 'cohorts', label: 'الدفعات', icon: 'fa-people-group' },
    { id: 'sessions', label: 'الجلسات', icon: 'fa-calendar-days' },
    { id: 'reviews', label: 'التقييمات', icon: 'fa-star' },
    { id: 'messages', label: 'الرسائل', icon: 'fa-envelope' },
    { id: 'events', label: 'فعاليات', icon: 'fa-person-chalkboard' },
    { id: 'announce', label: 'الإعلان', icon: 'fa-bullhorn' },
    { id: 'interests', label: 'المهتمون', icon: 'fa-user-plus' },
    { id: 'admins', label: 'المشرفون', icon: 'fa-user-shield' }
  ];
  const ui = { tab: 'content', cohort: null, sub: null, sessMentor: null, sessCohort: 'all', sessStat: null, revMentor: null, revCohort: 'all', intRole: 'all', netDraft: {}, netCohort: null };

  // كل تبويب مرتبط بصلاحية؛ تبويب «المشرفون» للحسابات الرئيسية فقط
  const TAB_PERM = { content: 'content', cohorts: 'cohorts', sessions: 'sessions', reviews: 'reviews', messages: 'messages', events: 'events', announce: 'announce', interests: 'interests' };
  const tabAllowed = id => (id === 'admins' ? Security.isOwner() : Security.can(TAB_PERM[id]));

  function render(root) {
    const tabs = TABS.filter(t => tabAllowed(t.id));
    if (ui.tab && !tabAllowed(ui.tab)) ui.tab = tabs[0]?.id || null;
    const pendingReviews = Data.reviews().filter(r => r.status === 'pending' && r.type !== 'program').length;
    const badges = { reviews: pendingReviews, interests: Store.list('interests').filter(x => !x.seen).length, messages: Store.list('inbox').filter(x => !x.read).length, events: Events.unseen() };
    root.innerHTML = `<div class="dash admin">
      ${Portal.topbar('admin')}
      <main class="container dash-main">
        <section class="dash-hello admin-hello">
          <div><small>لوحة تحكم الإدارة</small><h1>أهلاً بك في إدارة إشراق</h1>
          <span class="muted small">${Store.mode === 'firebase' ? '<i class="fa-solid fa-cloud"></i> متصل بقاعدة البيانات' : '<i class="fa-solid fa-hard-drive"></i> وضع محلي (البيانات في هذا المتصفح فقط)'}</span></div>
          <div class="kpis">${kpis()}</div>
        </section>
        ${securityBanner()}
        ${dbWarning()}
        ${backupBar()}
        ${tabs.length ? '' : `<div class="panel">${emptyState('لم تُمنح لحسابك أي صلاحيات بعد. تواصل مع أحد الحسابات الرئيسية.', 'fa-user-lock')}</div>`}
        <nav class="admin-tabs">${tabs.map(t => `<button class="${ui.tab === t.id ? 'active' : ''}" data-tab="${t.id}" aria-expanded="${ui.tab === t.id}"><i class="fa-solid ${t.icon}"></i><span>${t.label}</span>${badges[t.id] ? `<em class="badge">${badges[t.id]}</em>` : ''}<i class="fa-solid fa-chevron-down caret"></i></button>`).join('')}</nav>
        <div class="tab-panel">${ui.tab ? (P[ui.tab] ? P[ui.tab]() : '') : `<div class="tab-hint">${emptyState('اضغط على أي تبويب لعرض تفاصيله، واضغط عليه مرة أخرى لإخفائها.', 'fa-hand-pointer')}</div>`}</div>
      </main>
    </div>`;
    wire(root);
  }

  function dbWarning() {
    const e = Store.lastError;
    if (Store.mode === 'firebase' && !e) return '';
    const msg = Store.mode !== 'firebase'
      ? 'قاعدة البيانات غير مُعدّة، والتعديلات تُحفظ في هذا المتصفح فقط ولن تظهر للزوار. أضف رابط Firebase في <code>js/config.js</code>.'
      : `آخر عملية حفظ رُفضت من قاعدة البيانات (${esc(e.message)}). تأكد من قواعد Firebase ← Realtime Database ← Rules ثم أعد المحاولة.`;
    return `<div class="db-warning"><i class="fa-solid fa-triangle-exclamation"></i><p>${msg}</p></div>`;
  }

  /* ===== النسخ الاحتياطي ===== */
  function backupBar() {
    const last = Store.get('meta/lastBackup');
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    const due = days === null || days >= 7;
    return `<div class="backup-bar ${due ? 'due' : ''}">
      <div><i class="fa-solid ${due ? 'fa-triangle-exclamation' : 'fa-shield-halved'}"></i>
        <span>${last ? `آخر نسخة احتياطية: <b class="num">${fmtTs(last)}</b>${due ? ` — مضى <span class="num">${days}</span> يوماً، يُنصح بأخذ نسخة جديدة` : ''}` : 'لم تُؤخذ نسخة احتياطية بعد — يُنصح بأخذ نسخة أسبوعياً'}</span></div>
      <div class="head-actions">
        <button class="btn sm primary" data-backup><i class="fa-solid fa-download"></i> نسخة احتياطية</button>
        ${Security.isFull() ? '<label class="btn sm ghost"><i class="fa-solid fa-upload"></i> استرجاع نسخة<input type="file" accept=".json,application/json" data-restore hidden></label>' : ''}
      </div>
    </div>`;
  }

  function backupFile() {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `ishraq-backup-${stamp}.json`;
  }

  function downloadBackup(silent) {
    const data = Store.dump();
    const payload = { app: 'ishraq', version: 1, exportedAt: new Date().toISOString(), data };
    download(backupFile(), JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    if (!silent) { Store.set('meta/lastBackup', Date.now()); toast('تم تنزيل النسخة الاحتياطية'); }
  }

  async function restoreBackup(file) {
    let json;
    try { json = JSON.parse(await file.text()); } catch { return toast('الملف غير صالح أو ليس ملف JSON', 'error'); }
    // يقبل ملف المنصة، أو ملف «Export JSON» من Firebase Console (كامل أو لمسار ishraq)
    const data = json?.app === 'ishraq' ? json.data : json?.ishraq && typeof json.ishraq === 'object' ? json.ishraq : json;
    if (!data || typeof data !== 'object' || !(data.content || data.members || data.meta)) return toast('هذا الملف لا يحتوي على بيانات منصة إشراق', 'error');
    const count = k => Object.keys(data[k] || {}).length;
    const when = json.exportedAt ? fmtTs(Date.parse(json.exportedAt)) : 'غير معروف';
    const ok = await confirmDialog(`<b>استرجاع نسخة بتاريخ ${when}</b><br><br>
      تحتوي على: <span class="num">${count('members')}</span> عضواً، <span class="num">${count('bookings')}</span> جلسة، <span class="num">${count('reviews')}</span> تقييماً، <span class="num">${count('interests')}</span> مهتماً، <span class="num">${count('events')}</span> فعالية، و<span class="num">${Object.keys(data.content?.sections || {}).length}</span> قسماً في الصفحة الرئيسية.<br><br>
      سيتم <b>استبدال كل البيانات الحالية</b> بمحتوى هذه النسخة. ستُنزَّل نسخة من البيانات الحالية تلقائياً قبل الاسترجاع للاحتياط.`,
      { danger: true, ok: 'استرجاع', title: 'استرجاع نسخة احتياطية' });
    if (!ok) return;
    downloadBackup(true);
    const current = Store.dump();
    // بيانات المشرفين وصلاحياتهم لا تُستبدل عند الاسترجاع
    const KEEP = ['meta', 'admins', 'adminInvites', 'adminLog'];
    Object.keys(current).forEach(k => { if (!(k in data) && !KEEP.includes(k)) Store.remove(k); });
    Object.entries(data).forEach(([k, v]) => { if (!KEEP.includes(k)) Store.set(k, v); });
    Store.set('meta', { ...(data.meta || {}), seeded: data.meta?.seeded || Date.now(), eventsSection: true, lastBackup: current.meta?.lastBackup || null, restoredAt: Date.now(), rulesVersion: current.meta?.rulesVersion || null, securityVersion: current.meta?.securityVersion || data.meta?.securityVersion || null });
    Security.log('استرجاع نسخة احتياطية', file.name || '');
    toast('تم استرجاع النسخة الاحتياطية');
  }

  function kpis() {
    const s = Data.stats(Data.bookings());
    const k = (v, l, i) => `<div class="kpi"><i class="fa-solid ${i}"></i><b>${v}</b><span>${l}</span></div>`;
    return k(Data.members('mentor').length, 'مرشد', 'fa-user-tie') + k(Data.members('mentee').length, 'مستفيد', 'fa-user-graduate')
      + k(s.done, 'جلسة منجزة', 'fa-circle-check') + k(s.hours, 'ساعة إرشادية', 'fa-clock');
  }

  const P = {};

  /* =============== 1) المحتوى =============== */
  P.content = () => {
    const secs = Store.list('content/sections').sort(byOrder);
    const typeLabel = t => SECTION_TYPES[t]?.label || t;
    const preview = s => esc(s.title || s.brand || s.body || '').slice(0, 70);
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-layer-group"></i> أقسام الصفحة الرئيسية</h2>
        <div class="head-actions">${exportBar('content')}<a class="btn ghost" href="#/" target="_blank"><i class="fa-solid fa-eye"></i> معاينة</a>
        <button class="btn primary" data-add-section><i class="fa-solid fa-plus"></i> إضافة قسم</button></div></div>
      <p class="muted small"><i class="fa-solid fa-arrows-up-down"></i> اسحب الأقسام وأفلتها لتغيير ترتيب عرضها (بما فيها الترويسة والتذييل)، أو استخدم الأسهم.</p>
      <ul class="sortable" data-sortable>${secs.map((s, i) => `<li draggable="true" data-id="${s.id}" class="${s.visible === false ? 'is-hidden' : ''}">
        <span class="drag"><i class="fa-solid fa-grip-vertical"></i></span>
        <span class="sec-ic"><i class="fa-solid ${SECTION_TYPES[s.type]?.icon || 'fa-square'}"></i></span>
        <div class="sec-info"><b>${typeLabel(s.type)}</b><small>${preview(s)}</small></div>
        <div class="sec-actions">
          <button class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} title="أعلى"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="icon-btn" data-move="1" ${i === secs.length - 1 ? 'disabled' : ''} title="أسفل"><i class="fa-solid fa-arrow-down"></i></button>
          <button class="icon-btn" data-toggle-vis title="${s.visible === false ? 'إظهار' : 'إخفاء'}"><i class="fa-solid ${s.visible === false ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
          <button class="icon-btn" data-edit-sec title="تعديل"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn danger" data-del-sec title="حذف"><i class="fa-solid fa-trash"></i></button>
        </div></li>`).join('')}</ul>
    </div>
    ${formBuilderPanel()}`;
  };

  function formBuilderPanel() {
    const fields = Store.list('form/fields').sort(byOrder);
    const types = { text: 'نص قصير', textarea: 'نص طويل', tel: 'رقم جوال', email: 'بريد إلكتروني', url: 'رابط', select: 'قائمة اختيار', number: 'رقم', date: 'تاريخ' };
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-clipboard-list"></i> حقول نموذج التسجيل</h2>
      <button class="btn primary" data-add-field><i class="fa-solid fa-plus"></i> إضافة حقل</button></div>
      <p class="muted small">يحتوي النموذج دائماً على اختيار «مرشد / مستفيد». أضف ما تحتاجه من حقول: بيانات التواصل، الخبرات، روابط السير الذاتية والملفات والمصادر (كروابط دون رفع ملفات). تظهر الردود في تبويب «المهتمون».</p>
      <ul class="sortable fields" data-sortable-fields>
        <li class="locked"><span class="drag"><i class="fa-solid fa-lock"></i></span><div class="sec-info"><b>مرشد أو مستفيد</b><small>اختيار إلزامي</small></div></li>
        ${fields.map(f => `<li draggable="true" data-id="${f.id}"><span class="drag"><i class="fa-solid fa-grip-vertical"></i></span>
        <div class="sec-info"><b>${esc(f.label)} ${f.required ? '<em class="req">*</em>' : ''}</b><small>${types[f.type] || f.type}</small></div>
        <div class="sec-actions"><button class="icon-btn" data-edit-field title="تعديل"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" data-del-field title="حذف"><i class="fa-solid fa-trash"></i></button></div></li>`).join('')}
      </ul>
      <button class="btn ghost" data-preview-form><i class="fa-solid fa-eye"></i> معاينة النموذج</button>
    </div>`;
  }

  function editField(f) {
    const types = [['text', 'نص قصير'], ['textarea', 'نص طويل'], ['tel', 'رقم جوال'], ['email', 'بريد إلكتروني'], ['url', 'رابط (سيرة ذاتية، ملف، مصدر...)'], ['select', 'قائمة اختيار'], ['number', 'رقم'], ['date', 'تاريخ']];
    f = f || {};
    openModal({
      title: f.id ? 'تعديل حقل' : 'إضافة حقل', size: 'sm',
      body: `<form class="form-grid one">
        ${fieldInput({ k: 'label', label: 'عنوان الحقل', required: true }, f.label || '')}
        <div class="field"><label>نوع الحقل</label><select name="type">${types.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${fieldInput({ k: 'options', label: 'الخيارات (سطر لكل خيار) — لقائمة الاختيار', type: 'textarea', rows: 3 }, f.options || '')}
        ${fieldInput({ k: 'placeholder', label: 'نص إرشادي داخل الحقل (اختياري)' }, f.placeholder || '')}
        ${fieldInput({ k: 'required', label: 'حقل إلزامي', type: 'checkbox' }, f.required)}
      </form>`,
      actions: [{
        label: 'حفظ', cls: 'primary', onClick: m => {
          const form = $('form', m.body);
          if (!validateForm(form)) return false;
          const v = readForm(form);
          if (f.id) Store.update(`form/fields/${f.id}`, v);
          else {
            const max = Math.max(0, ...Store.list('form/fields').map(x => x.order || 0));
            Store.push('form/fields', { ...v, order: max + 1 });
          }
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  function editSection(s) {
    const T = SECTION_TYPES[s.type] || { fields: ['title', 'body'] };
    const itemFields = T.items || [];
    let items = JSON.parse(JSON.stringify(s.items || []));
    const itemRow = (it, i) => `<div class="item-row" data-i="${i}">
      <div class="item-fields">${itemFields.map(k => ITEM_META[k][1] === 'checkbox'
        ? `<label class="check"><input type="checkbox" data-k="${k}" ${it[k] ? 'checked' : ''}><span>${ITEM_META[k][0]}</span></label>`
        : ITEM_META[k][1] === 'textarea' ? `<label><small>${ITEM_META[k][0]}</small><textarea data-k="${k}" rows="2">${esc(it[k] || '')}</textarea></label>`
          : `<label><small>${ITEM_META[k][0]}</small><input data-k="${k}" value="${esc(it[k] || '')}" ${k === 'icon' ? 'dir="ltr"' : ''}></label>`).join('')}</div>
      <div class="item-ctl"><button type="button" class="icon-btn" data-imove="-1"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" class="icon-btn" data-imove="1"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" class="icon-btn danger" data-idel><i class="fa-solid fa-trash"></i></button></div></div>`;
    const readItems = m => $$('.item-row', m.body).map(r => {
      const o = {};
      $$('[data-k]', r).forEach(el => { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
      return o;
    });
    const drawItems = m => {
      $('.items-list', m.body).innerHTML = items.map(itemRow).join('') || '<p class="muted small">لا توجد عناصر</p>';
    };
    const body = `<form class="form-grid one sec-form">
      ${T.fields.map(k => fieldInput({ k, label: FIELD_META[k][0], type: FIELD_META[k][1] }, s[k] || '')).join('')}
      ${T.social ? `<fieldset class="social-fields"><legend>حسابات التواصل الاجتماعي (تظهر كأيقونات عند إضافة الرابط)</legend>
        <div class="form-grid">${SOCIALS.map(x => `<div class="field"><label><i class="${x.icon}"></i> ${x.label}</label><input name="social_${x.k}" dir="ltr" value="${esc(s.social?.[x.k] || '')}" placeholder="${x.k === 'email' ? 'name@example.com' : x.k === 'whatsapp' ? '9665xxxxxxxx' : 'https://'}"></div>`).join('')}</div></fieldset>` : ''}
      ${itemFields.length ? `<fieldset><legend>العناصر</legend><div class="items-list"></div>
        <button type="button" class="btn ghost sm" data-iadd><i class="fa-solid fa-plus"></i> إضافة عنصر</button>
        ${itemFields.includes('icon') ? '<small class="hint">أسماء الأيقونات من <a href="https://fontawesome.com/search?o=r&m=free&s=solid" target="_blank" rel="noopener">Font Awesome</a> مثل fa-star أو fa-user-tie</small>' : ''}</fieldset>` : ''}
      ${s.type === 'testimonials' ? '<p class="muted small">يعرض هذا القسم تقييمات البرنامج التي تختارها من تبويب «التقييمات»، ولا يظهر إذا لم يتم اختيار أي تقييم.</p>' : ''}
      ${s.type === 'portals' ? '<p class="muted small">يعرض أزرار دخول المرشد والمستفيد والإدارة.</p>' : ''}
    </form>`;
    openModal({
      title: `<i class="fa-solid ${T.icon || 'fa-pen'}"></i> ${T.label || 'قسم'}`, size: 'lg', body,
      actions: [{
        label: 'حفظ', cls: 'primary', onClick: m => {
          const form = $('.sec-form', m.body);
          const v = {};
          T.fields.forEach(k => { const el = $(`[name="${k}"]`, form); v[k] = el ? el.value.trim() : ''; });
          if (T.social) { v.social = {}; SOCIALS.forEach(x => { v.social[x.k] = $(`[name="social_${x.k}"]`, form).value.trim(); }); }
          if (itemFields.length) v.items = readItems(m);
          if (s.id) Store.update(`content/sections/${s.id}`, v);
          else {
            const max = Math.max(0, ...Store.list('content/sections').map(x => x.order || 0));
            const footer = Store.list('content/sections').find(x => x.type === 'footer');
            const portals = Store.list('content/sections').find(x => x.type === 'portals');
            const before = portals || footer;
            let order = max + 1;
            if (before) { order = before.order - 0.5; }
            Store.push('content/sections', { type: s.type, visible: true, ...v, order });
            normalizeOrder();
          }
          toast('تم حفظ القسم');
        }
      }, { label: 'إلغاء', cls: 'ghost' }],
      onOpen: m => {
        if (!itemFields.length) return;
        drawItems(m);
        m.body.addEventListener('click', e => {
          const add = e.target.closest('[data-iadd]'), del = e.target.closest('[data-idel]'), mv = e.target.closest('[data-imove]');
          if (!add && !del && !mv) return;
          items = readItems(m);
          if (add) items.push({});
          if (del) items.splice(+del.closest('.item-row').dataset.i, 1);
          if (mv) {
            const i = +mv.closest('.item-row').dataset.i, j = i + +mv.dataset.imove;
            if (j >= 0 && j < items.length) [items[i], items[j]] = [items[j], items[i]];
          }
          drawItems(m);
        });
      }
    });
  }

  function addSection() {
    const existing = new Set(Store.list('content/sections').map(s => s.type));
    const opts = Object.entries(SECTION_TYPES).filter(([k, t]) => !(t.single && existing.has(k)));
    const mm = openModal({
      title: 'إضافة قسم جديد', size: 'md',
      body: `<div class="type-grid">${opts.map(([k, t]) => `<button class="type-card" data-type="${k}"><i class="fa-solid ${t.icon}"></i><span>${t.label}</span></button>`).join('')}</div>`
    });
    $$('[data-type]', mm.el).forEach(b => b.onclick = () => {
      mm.close();
      const t = b.dataset.type;
      const preset = t === 'register' ? { kicker: 'الدفعة القادمة', title: 'التسجيل في الدفعة الجديدة مفتوح', body: '', button: 'سجّل الآن' } : {};
      setTimeout(() => editSection({ type: t, ...preset }), 220);
    });
  }

  function normalizeOrder() {
    const upd = {};
    Store.list('content/sections').sort(byOrder).forEach((s, i) => { upd[`${s.id}/order`] = i + 1; });
    Store.update('content/sections', upd);
  }
  function reorder(path, ids) {
    const upd = {};
    ids.forEach((id, i) => { upd[`${id}/order`] = i + 1; });
    Store.update(path, upd);
  }

  function enableSortable(ul, path) {
    let dragEl = null;
    ul.addEventListener('dragstart', e => {
      dragEl = e.target.closest('li[draggable]');
      if (!dragEl) return;
      dragEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragEl.dataset.id); } catch { /* ignore */ }
    });
    ul.addEventListener('dragover', e => {
      if (!dragEl) return;
      e.preventDefault();
      const after = $$('li[draggable]:not(.dragging)', ul).find(li => {
        const r = li.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (after) ul.insertBefore(dragEl, after); else ul.appendChild(dragEl);
    });
    ul.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      dragEl = null;
      reorder(path, $$('li[draggable]', ul).map(li => li.dataset.id));
    });
  }

  /* =============== 2) الدفعات =============== */
  P.cohorts = () => {
    const cohorts = Data.cohorts();
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-people-group"></i> أفواج أعضاء المبادرة</h2>
      <button class="btn primary" data-add-cohort><i class="fa-solid fa-plus"></i> إضافة دفعة جديدة</button></div>
      <div class="cohort-list">${cohorts.map(c => `<div class="cohort ${ui.cohort === c.id ? 'open' : ''}">
        <div class="cohort-row"><button class="cohort-btn" data-cohort="${c.id}"><i class="fa-solid fa-users"></i> ${esc(c.name)} <span class="year">${c.year}</span>
          <small>${Data.members('mentor', c.id).length} مرشد · ${Data.members('mentee', c.id).length} مستفيد</small><i class="fa-solid fa-chevron-down caret"></i></button>
          <button class="icon-btn" data-edit-cohort="${c.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn danger" data-del-cohort="${c.id}" title="حذف"><i class="fa-solid fa-trash"></i></button></div>
        ${ui.cohort === c.id ? cohortBody(c) : ''}
      </div>`).join('')}</div>
    </div>`;
  };

  function cohortBody(c) {
    const subs = [['mentor', 'معلومات المرشدين', 'fa-user-tie'], ['mentee', 'معلومات المستفيدين', 'fa-user-graduate'], ['network', 'الشبكة', 'fa-diagram-project']];
    return `<div class="cohort-body">
      <div class="sub-tabs">${subs.map(([k, l, i]) => `<button class="${ui.sub === k ? 'active' : ''}" data-sub="${k}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}</div>
      ${ui.sub === 'mentor' || ui.sub === 'mentee' ? membersBlock(c, ui.sub) : ''}
      ${ui.sub === 'network' ? networkBlock(c) : ''}
    </div>`;
  }

  function membersBlock(c, role) {
    const list = Data.members(role, c.id);
    const label = role === 'mentor' ? 'المرشدين' : 'المستفيدين';
    return `<div class="members-block">
      <div class="block-head"><h3>${label} — ${esc(c.name)} <span class="count">${list.length}</span></h3>
        <div class="head-actions">${exportBar(`members:${c.id}:${role}`)}
        <button class="btn ghost sm" data-csv-template="${role}"><i class="fa-solid fa-file-arrow-down"></i> تحميل قالب CSV</button></div></div>
      <label class="dropzone" data-drop="${role}">
        <input type="file" accept=".csv,text/csv" hidden>
        <i class="fa-solid fa-cloud-arrow-up"></i><span>اسحب ملف CSV وأفلته هنا لإضافة ${label} دفعة واحدة، أو اضغط لاختيار الملف</span>
      </label>
      <div class="card-grid">
        <button class="add-card" data-add-member="${role}"><i class="fa-solid fa-plus"></i><span>إضافة ${role === 'mentor' ? 'مرشد' : 'مستفيد'} جديد</span></button>
        ${list.map(m => memberCard(m, { secret: Store.get(`secrets/codes/${m.id}`), actions: `<button class="btn xs send-cred" data-send-cred="${m.id}"><i class="fa-solid fa-share-nodes"></i> مشاركة البطاقة ومعلومات الدخول${m.credSentAt ? ' <i class="fa-solid fa-check-double" title="أُرسلت سابقاً"></i>' : ''}</button><button class="btn xs ghost" data-edit-member="${m.id}"><i class="fa-solid fa-pen"></i> تعديل</button><button class="btn xs ghost" data-regen="${m.id}" title="توليد رمز دخول جديد"><i class="fa-solid fa-key"></i> رمز جديد</button><button class="btn xs ghost danger" data-del-member="${m.id}"><i class="fa-solid fa-trash"></i> حذف</button>` })).join('')}
      </div>
    </div>`;
  }

  const CSV_COLS = [
    ['name', 'الاسم'], ['tagline', 'السطر التعريفي'], ['photo', 'رابط الصورة (Google Drive)'], ['bio', 'النبذة التعريفية'],
    ['areas', 'المجالات'], ['whatsapp', 'واتساب'], ['email', 'الإيميل'], ['linkedin', 'لينكدإن'], ['website', 'الموقع الشخصي'],
    ['twitter', 'تويتر'], ['instagram', 'أنستقرام']
  ];

  function csvTemplate(role) {
    const sample = role === 'mentor'
      ? ['م. أحمد مثال', 'مهندس برمجيات', 'https://drive.google.com/file/d/FILE_ID/view', 'نبذة تعريفية مطولة عن المرشد', 'البرمجة، ريادة الأعمال', '9665xxxxxxxx', 'name@example.com', 'https://linkedin.com/in/username', 'https://example.com', '', '']
      : ['سارة مثال', 'طالبة هندسة حاسب', 'https://drive.google.com/file/d/FILE_ID/view', 'نبذة تعريفية مطولة عن المستفيد', 'الذكاء الاصطناعي', '9665xxxxxxxx', 'name@example.com', '', '', '', ''];
    download(`ishraq-${role === 'mentor' ? 'mentors' : 'mentees'}-template.csv`, toCSV(CSV_COLS.map(c => c[1]), [sample]));
  }

  async function importCSV(file, role, cohortId) {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return toast('الملف فارغ أو غير صالح', 'error');
    const head = rows[0].map(h => h.trim());
    const idx = CSV_COLS.map(([k, l]) => {
      let i = head.findIndex(h => h === l || h.toLowerCase() === k);
      if (i < 0) i = head.findIndex(h => h.startsWith(l.split(' ')[0]));
      return [k, i];
    });
    const nameIdx = idx.find(x => x[0] === 'name')[1];
    if (nameIdx < 0) return toast('لم يتم العثور على عمود «الاسم»', 'error');
    const items = rows.slice(1).map(r => {
      const d = {};
      idx.forEach(([k, i]) => { if (i >= 0) d[k] = String(r[i] ?? '').trim(); });
      if (d.whatsapp) d.whatsapp = toEnDigits(d.whatsapp);
      return d;
    }).filter(d => d.name && !d.name.includes('مثال'));
    if (!items.length) return toast('لم تتم إضافة أي بطاقة', 'error');
    const prog = openModal({ title: '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ إضافة البطاقات', size: 'sm', dismissible: false, body: '<p class="confirm-msg" data-prog>...</p>' });
    const failed = [];
    for (let i = 0; i < items.length; i++) {
      $('[data-prog]', prog.el).textContent = `${i + 1} / ${items.length} — ${items[i].name}`;
      const r = await Data.addMember(role, cohortId, items[i]);
      if (r.error) failed.push(`${items[i].name}: ${r.error}`);
    }
    prog.close();
    if (failed.length) openModal({ title: 'تمت الإضافة مع ملاحظات', size: 'md', body: `<p>أُضيفت ${items.length} بطاقة، وتعذّر إنشاء رمز الدخول لـ ${failed.length} منها. استخدم زر «رمز جديد» على بطاقاتهم لاحقاً.</p><ul>${failed.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`, actions: [{ label: 'حسناً', cls: 'primary' }] });
    else toast(`تمت إضافة ${items.length} بطاقة بنجاح مع رموز الدخول`);
  }

  function addMember(role, cohortId) {
    const preview = Data.nextCode(role, cohortId).code;
    const fields = PROFILE_FIELDS.map(f => ({ ...f, label: typeof f.label === 'object' ? f.label[role] : f.label, wide: f.type === 'textarea' || f.k === 'photo' }));
    openModal({
      title: `<i class="fa-solid fa-plus"></i> ${role === 'mentor' ? 'مرشد' : 'مستفيد'} جديد <span class="code-chip">${preview}</span>`, size: 'lg',
      body: `<form class="form-grid"><p class="wide muted small">رقم العضوية يتولد آلياً، ويُنشأ للعضو رمز دخول سري (مثل <span class="num">${preview}-7K4Q</span>) يصله عبر «مشاركة البطاقة ومعلومات الدخول».</p>${fields.map(f => fieldInput(f)).join('')}</form>`,
      actions: [{
        label: 'حفظ البطاقة', cls: 'primary', onClick: async m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const btn = $('[data-act="0"]', m.el); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحفظ...';
          const mem = await Data.addMember(role, cohortId, readForm(f));
          if (mem.error) toast(`أُضيفت البطاقة ${mem.code} لكن تعذّر إنشاء رمز الدخول: ${mem.error}`, 'error');
          else toast(`تمت الإضافة — رمز الدخول ${mem.secret}`);
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  /* إرسال معلومات الدخول: صورة البطاقة + رسالة واتساب برقم العضوية */
  function credentialsText(m) {
    const role = m.role === 'mentor' ? 'المرشد' : 'المستفيد';
    const url = window.ISHRAQ_CONFIG.siteUrl || location.href.replace(/#.*$/, '');
    const code = Store.get(`secrets/codes/${m.id}`) || m.code;
    return `تحية طيبة عزيزي ${role}، تم إضافتك إلى منصة إشراق، يمكنك الدخول إلى المنصة وتعديل البيانات وإدارة حجوزات الجلسات الإرشادية وكتابة التقييمات عبر الدخول إلى الرابط ( ${url} ) والضغط على (دخول ${role}) واستخدام رمز الدخول الخاص بك (${code})`;
  }

  async function sendCredentials(m) {
    if (!m) return;
    if (!Store.get(`secrets/codes/${m.id}`) && Security.secure()) {
      const ok = await confirmDialog('لا يوجد رمز دخول لهذا العضو بعد. هل تريد إنشاء رمز الآن؟', { ok: 'إنشاء الرمز' });
      if (!ok) return;
      try { await Security.createMemberAccount(m); m = Data.member(m.id); } catch (e) { return toast(Security.authMsg(e), 'error'); }
    }
    let blob = null;
    const file = `ishraq-${m.role === 'mentor' ? 'mentor' : 'mentee'}-card.png`;
    const markSent = () => Store.update(`members/${m.id}`, { credSentAt: Date.now() });
    const copyText = async text => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };
    const modal = openModal({
      title: `<i class="fa-solid fa-share-nodes"></i> مشاركة البطاقة ومعلومات الدخول — ${esc(m.name)}`, size: 'md',
      body: `<div class="cred">
        <div class="cred-preview"><div class="cred-loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ تجهيز صورة البطاقة...</div></div>
        <div class="field"><label>نص الرسالة${m.whatsapp ? ` <small class="muted">(واتساب العضو: <span dir="ltr">${esc(m.whatsapp)}</span>)</small>` : ''}</label><textarea name="msg" rows="6">${esc(credentialsText(m))}</textarea></div>
        <p class="hint cred-hint"><i class="fa-solid fa-circle-info"></i> «مشاركة الصورة والرسالة» تفتح قائمة المشاركة في جهازك لإرسال الصورة والنص معاً (واتساب أو غيره). إذا لم يدعم المتصفح مشاركة الصور، تُنزّل الصورة ويُنسخ النص لتلصقهما في المحادثة.</p>
      </div>`,
      actions: [
        {
          label: '<i class="fa-solid fa-share-nodes"></i> مشاركة الصورة والرسالة', cls: 'primary', onClick: async md => {
            if (!blob) { toast('انتظر حتى تجهز صورة البطاقة', 'error'); return false; }
            const text = $('[name=msg]', md.body).value;
            const f = new File([blob], file, { type: 'image/png' });
            let canFiles = false;
            try { canFiles = !!(navigator.canShare && navigator.canShare({ files: [f] })); } catch { /* ignore */ }
            if (canFiles) {
              try { await navigator.share({ files: [f], text }); markSent(); return; }
              catch (e) { if (e.name === 'AbortError') return false; }
            }
            // بديل: تنزيل الصورة ونسخ النص
            download(file, blob);
            const ok = await copyText(text);
            markSent();
            toast(ok ? 'تم تنزيل صورة البطاقة ونسخ نص الرسالة — الصقهما في المحادثة' : 'تم تنزيل صورة البطاقة — انسخ نص الرسالة وأرسله معها');
            return false;
          }
        },
        { label: '<i class="fa-solid fa-download"></i> تنزيل البطاقة', cls: 'ghost', onClick: () => { if (blob) download(file, blob); return false; } }
      ]
    });
    try {
      const r = await CardImage.toBlob(m);
      blob = r.blob;
      const prev = $('.cred-preview', modal.el);
      if (prev) prev.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="بطاقة ${esc(m.name)}">${r.photoFailed ? '<p class="hint err-hint">تعذّر تضمين الصورة الشخصية من Google Drive، وظهرت الأحرف الأولى بدلاً منها.</p>' : ''}`;
    } catch (e) {
      console.error(e);
      const prev = $('.cred-preview', modal.el);
      if (prev) prev.innerHTML = '<p class="hint err-hint">تعذّر إنشاء صورة البطاقة.</p>';
    }
  }

  function networkBlock(c) {
    const mentors = Data.members('mentor', c.id), mentees = Data.members('mentee', c.id);
    if (ui.netCohort !== c.id) { ui.netCohort = c.id; ui.netDraft = { ...(Store.get(`network/${c.id}`) || {}) }; }
    const draft = ui.netDraft;
    const used = new Set(Object.values(draft).filter(Boolean));
    const saved = Store.get(`network/${c.id}`) || {};
    const dirty = JSON.stringify(Object.entries(draft).filter(e => e[1]).sort()) !== JSON.stringify(Object.entries(saved).filter(e => e[1]).sort());
    return `<div class="network-block">
      <div class="block-head"><h3>الشبكة: ربط المرشدين بالمستفيدين</h3>
      <div class="head-actions">${exportBar(`network:${c.id}`)}<button class="btn primary" data-save-net ${dirty ? '' : 'disabled'}><i class="fa-solid fa-floppy-disk"></i> حفظ الشبكة</button></div></div>
      ${dirty ? '<p class="warn-note"><i class="fa-solid fa-triangle-exclamation"></i> توجد تعديلات غير محفوظة</p>' : ''}
      ${!mentors.length ? emptyState('أضف المرشدين أولاً', 'fa-user-tie') : `<div class="net-head"><span>المرشد</span><span></span><span>المستفيد</span></div>
      <ul class="net-list">${mentors.map(m => {
        const cur = draft[m.id] || '';
        const opts = mentees.filter(x => !used.has(x.id) || x.id === cur);
        return `<li>${miniMember(m)}<i class="fa-solid fa-xmark net-x"></i>
          <div class="net-pick"><select data-net="${m.id}"><option value="">— اختر المستفيد —</option>${opts.map(x => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)} (${x.code})</option>`).join('')}</select>
          ${cur ? `<button class="icon-btn danger" data-unassign="${m.id}" title="إلغاء التعيين"><i class="fa-solid fa-link-slash"></i></button>` : ''}</div></li>`;
      }).join('')}</ul>
      <p class="muted small">المستفيدون غير المعيّنين: ${mentees.filter(x => !used.has(x.id)).map(x => esc(x.name)).join('، ') || 'لا يوجد'}</p>`}
    </div>`;
  }

  function editCohort(c) {
    const cohorts = Data.cohorts();
    const num = c ? c.num : Math.max(0, ...cohorts.map(x => x.num)) + 1;
    const year = c ? c.year : Math.max(2024, ...cohorts.map(x => +x.year || 0)) + 1;
    openModal({
      title: c ? 'تعديل الدفعة' : 'إضافة دفعة جديدة', size: 'sm',
      body: `<form class="form-grid one">
        ${fieldInput({ k: 'name', label: 'اسم الدفعة', required: true }, c?.name || `الدفعة ${ORDINALS[num - 1] || num}`)}
        ${fieldInput({ k: 'year', label: 'السنة', type: 'number', required: true }, String(year))}
        <p class="muted small">رقم الدفعة في رموز العضوية: <b>${num}</b> (مثال: M${num}11 و B${num}11)</p>
      </form>`,
      actions: [{
        label: 'حفظ', cls: 'primary', onClick: m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const v = readForm(f);
          if (c) Store.update(`cohorts/${c.id}`, { name: v.name, year: +toEnDigits(v.year) });
          else { const id = 'c' + num; Store.set(`cohorts/${id}`, { id, num, name: v.name, year: +toEnDigits(v.year) }); }
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  /* =============== 3) الجلسات =============== */
  function cohortFilter(key) {
    return `<div class="chip-filter">${[{ id: 'all', name: 'كل الدفعات' }, ...Data.cohorts()].map(c => `<button class="${ui[key] === c.id ? 'active' : ''}" data-filter="${key}" data-val="${c.id}">${esc(c.name)}</button>`).join('')}</div>`;
  }
  const inCohort = (key, m) => ui[key] === 'all' || m.cohort === ui[key];

  P.sessions = () => {
    const mentors = Data.members('mentor').filter(m => inCohort('sessCohort', m));
    const ids = new Set(mentors.map(m => m.id));
    const all = Data.bookings().filter(b => ids.has(b.mentorId));
    const sel = mentors.find(m => m.id === ui.sessMentor);
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-chart-pie"></i> إحصائية عامة لجميع الجلسات</h2>${exportBar('sessions')}</div>
      ${cohortFilter('sessCohort')}
      ${statsBoxes(Data.stats(all), true, { clickable: true, active: ui.sessStat })}
      ${ui.sessStat ? statList(all, ui.sessStat) : '<p class="muted small"><i class="fa-solid fa-hand-pointer"></i> اضغط على أي مربع لعرض الجلسات المندرجة تحته.</p>'}
      <h3 class="sub">المرشدون</h3>
      ${mentors.length ? `<div class="icon-people">${mentors.map(m => {
        const st = Data.stats(Data.bookings({ mentorId: m.id }));
        return `<button class="person ${ui.sessMentor === m.id ? 'active' : ''}" data-sess-mentor="${m.id}">${avatar(m, 'lg')}<b>${esc(m.name)}</b><small>${st.done}/3 منجزة</small></button>`;
      }).join('')}</div>` : emptyState('لا يوجد مرشدون', 'fa-user-tie')}
    </div>
    ${bandsPanel()}
    ${sel ? mentorSessions(sel) : ''}`;
  };

  /* ===== إطلاق الدفعة ونطاقات متابعة التعثر ===== */
  function bandsPanel() {
    const cohorts = Data.cohorts();
    if (!cohorts.length) return '';
    const cid = ui.sessCohort !== 'all' && Data.cohort(ui.sessCohort) ? ui.sessCohort : cohorts[cohorts.length - 1].id;
    const c = Data.cohort(cid);
    const L = Bands.launch(cid);
    const head = `<div class="panel-head"><h2><i class="fa-solid fa-layer-group"></i> نطاقات متابعة الجلسات — ${esc(c.name)}</h2>
      ${L ? `<div class="head-actions"><span class="pill st-done"><i class="fa-solid fa-rocket"></i> أُطلقت ${fmtTs(L.ts)}</span><button class="btn xs ghost" data-unlaunch="${cid}" title="إلغاء الإطلاق"><i class="fa-solid fa-rotate-left"></i></button></div>` : ''}</div>
      ${ui.sessCohort === 'all' && cohorts.length > 1 ? '<p class="muted small">تُعرض أحدث دفعة؛ اختر دفعة من الأعلى لعرض نطاقاتها.</p>' : ''}`;
    if (!L) return `<div class="panel bands-panel">${head}
      <div class="launch-box"><i class="fa-solid fa-rocket"></i><div><b>لم تُطلق هذه الدفعة بعد</b>
      <p>عند الضغط على «إطلاق الدفعة» يبدأ حساب المدد: فترة الجلسة الأولى الأسابيع 1-4، والثانية 5-8، والثالثة 9-12. ويظهر للمرشدين شريط «تم إطلاق الدفعة رسمياً» وتُفتح لهم إضافة المواعيد.</p></div>
      <button class="btn primary lg" data-launch="${cid}"><i class="fa-solid fa-rocket"></i> إطلاق الدفعة</button></div></div>`;
    const mentors = Data.members('mentor', cid);
    const now = Date.now();
    const curWeek = Bands.weekOf(now, L.ts);
    const rows = Bands.SESSIONS.map(n => {
      const start = Bands.windowStart(L.ts, n);
      const sts = mentors.map(m => ({ m, st: Bands.status(m, n, now) }));
      const cols = Bands.LEVELS.map(lv => {
        const inBand = sts.filter(x => x.st.level && x.st.level.k === lv.k);
        return `<div class="band ${lv.cls}"><header><i class="fa-solid ${lv.icon}"></i><b>${lv.name}</b><small>${lv.period}</small><em>${inBand.length}</em></header>
          <ul>${inBand.map(({ m, st }) => {
            const last = lastReminder(m.id, n);
            return `<li class="${st.added ? 'added' : 'waiting'}"><span class="bm-name" data-sess-mentor="${m.id}" title="عرض جلسات المرشد">${esc(m.name)}</span>
              <small>${st.added ? `<i class="fa-solid fa-check"></i> أضاف ${fmtTs(st.at)}` : `<i class="fa-solid fa-hourglass-half"></i> لم يُضف — الأسبوع ${st.week}`}${last ? ` · <i class="fa-regular fa-bell"></i> ذُكّر ${fmtTs(last.ts)}` : ''}</small>
              ${st.added ? '' : `<button class="btn xs ghost" data-remind="${m.id}" data-session="${n}"><i class="fa-solid fa-paper-plane"></i> تذكير</button>`}</li>`;
          }).join('')}</ul></div>`;
      }).join('');
      const pending = sts.filter(x => x.st.notStarted).length;
      return `<div class="band-row"><h3 class="sub">${sessionName(n)} <small class="muted">الأسابيع ${(n - 1) * 4 + 1}-${n * 4} · تبدأ ${fmtDate(new Date(start).toISOString().slice(0, 10))}</small>
        ${now < start ? `<span class="chip">لم تبدأ فترتها بعد${pending ? ` · ${pending} بانتظار` : ''}</span>` : ''}</h3>
        <div class="bands">${cols}</div></div>`;
    }).join('');
    return `<div class="panel bands-panel">${head}
      <p class="muted small">الأسبوع الحالي منذ الإطلاق: <b>${curWeek}</b>. يُصنَّف المرشد حسب أسبوع إضافته لأول موعد للجلسة، ومن لم يُضف ينتقل تلقائياً بين النطاقات مع مرور الأسابيع.</p>
      ${mentors.length ? rows : emptyState('لا يوجد مرشدون في هذه الدفعة', 'fa-user-tie')}
      <details class="band-legend"><summary><i class="fa-solid fa-circle-info"></i> مصفوفة المتابعة والإجراء المتبع</summary>
        <ul>${Bands.LEVELS.map(lv => `<li class="${lv.cls}"><b>${lv.period}</b><span>${lv.rate}</span><em>${lv.name}</em><p>${lv.action}</p></li>`).join('')}</ul></details>
    </div>`;
  }

  const lastReminder = (mid, n) => Data.notifications(mid).find(x => x.kind === 'reminder' && x.session === n);

  function remindDialog(mid, n) {
    const m = Data.member(mid);
    const st = Bands.status(m, n);
    if (!m || !st || !st.level) return;
    const phone = m.whatsapp, email = m.email;
    openModal({
      title: `<i class="fa-solid fa-paper-plane"></i> تذكير ${esc(m.name)} — ${sessionName(n)}`, size: 'md',
      body: `<div class="band-tag ${st.level.cls}"><i class="fa-solid ${st.level.icon}"></i> ${st.level.name} · الأسبوع ${st.week} من فترة الجلسة</div>
        <p class="muted small">${st.level.action}</p>
        <form><div class="field"><label>نص التذكير (يمكنك تعديله قبل الإرسال)</label><textarea name="text" rows="7">${esc(Bands.reminderText(m, st))}</textarea></div></form>
        <div class="remind-share">
          <button class="btn wa" data-rs="wa" ${phone ? '' : 'disabled title="لا يوجد رقم واتساب"'}><i class="fa-brands fa-whatsapp"></i> واتساب</button>
          <button class="btn ghost" data-rs="mail" ${email ? '' : 'disabled title="لا يوجد بريد"'}><i class="fa-regular fa-envelope"></i> البريد الإلكتروني</button>
        </div>`,
      onOpen: api => api.body.addEventListener('click', e => {
        const b = e.target.closest('[data-rs]'); if (!b) return;
        const text = $('[name=text]', api.body).value.trim();
        const url = b.dataset.rs === 'wa' ? waLink(phone, text) : `mailto:${email}?subject=${encodeURIComponent(`تذكير — ${sessionName(n)} | برنامج إشراق`)}&body=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener');
      }),
      actions: [
        { label: '<i class="fa-solid fa-bell"></i> إرسال التنبيه في صفحة المرشد', cls: 'primary', onClick: mm => {
          const text = $('[name=text]', mm.body).value.trim();
          if (!text) { toast('اكتب نص التذكير', 'error'); return false; }
          Data.notify(m.id, text, { icon: st.level.icon, kind: 'reminder', session: n, band: st.level.k, week: st.week });
          Security.log('إرسال تذكير جلسة', m.name, `${sessionName(n)} — ${st.level.name}`);
          toast('وصل التنبيه إلى صفحة المرشد');
        } },
        { label: 'إغلاق', cls: 'ghost' }
      ]
    });
  }

  function statList(all, key) {
    const cat = key === 'hours' ? 'done' : key;
    const list = key === 'total' ? all : all.filter(b => Data.category(b) === cat);
    const sorted = list.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return `<div class="stat-list" id="stat-list">
      <h3 class="sub"><i class="fa-solid fa-list"></i> ${STAT_LABELS[key]} <span class="count">${list.length}</span></h3>
      ${sorted.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>المرشد</th><th>المستفيد</th><th>الجلسة</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr></thead><tbody>
        ${sorted.map(b => `<tr><td data-l="المرشد">${esc(Data.member(b.mentorId)?.name || '—')}</td><td data-l="المستفيد">${esc(Data.member(b.menteeId)?.name || '—')}</td>
          <td data-l="الجلسة">${sessionName(b.session)}</td><td data-l="التاريخ">${fmtDate(b.date)}</td><td data-l="الوقت">${tRange(b.start, b.end)}</td><td data-l="الحالة">${bookingPill(b)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا توجد جلسات في هذا التصنيف', 'fa-calendar')}
    </div>`;
  }

  function mentorSessions(m) {
    const mentee = Data.menteeOf(m.id);
    const slots = Data.slots(m.id);
    const bks = Data.bookings({ mentorId: m.id });
    return `<div class="panel" id="mentor-sessions">
      <div class="panel-head"><h2>${miniMember(m)} <i class="fa-solid fa-arrows-left-right muted"></i> ${miniMember(mentee)}</h2>${exportBar(`mentor-sessions:${m.id}`)}</div>
      <h3 class="sub"><i class="fa-regular fa-calendar"></i> المواعيد المعلنة من المرشد</h3>
      ${slots.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>الجلسة</th><th>التاريخ</th><th>الوقت</th><th>النوع</th><th>المحتوى</th></tr></thead><tbody>
        ${slots.map(s => `<tr><td data-l="الجلسة">${sessionName(s.session)}</td><td data-l="التاريخ">${fmtDate(s.date)}</td><td data-l="الوقت">${tRange(s.start, s.end)}</td><td data-l="النوع">${MODES[s.mode] || ''}</td><td data-l="المحتوى">${esc(s.summary || '—')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small">لم يعلن المرشد أي مواعيد بعد.</p>'}
      <h3 class="sub"><i class="fa-solid fa-list-check"></i> تحديثات الجلسات</h3>
      ${bks.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>رقم الجلسة</th><th>تاريخ الجلسة</th><th>الوقت</th><th>النوع</th><th>وضع الجلسة</th></tr></thead><tbody>
        ${bks.map(b => `<tr><td data-l="رقم الجلسة">${sessionName(b.session)}</td><td data-l="التاريخ">${fmtDate(b.date)}</td><td data-l="الوقت">${tRange(b.start, b.end)}</td><td data-l="النوع">${MODES[b.mode] || ''}</td><td data-l="الحالة">${bookingPill(b)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small">لم يتم حجز أي جلسة بعد.</p>'}
      ${statsBoxes(Data.stats(bks), true)}
    </div>`;
  }

  /* =============== 4) التقييمات =============== */
  P.reviews = () => {
    const mentors = Data.members('mentor').filter(m => inCohort('revCohort', m));
    const sel = mentors.find(m => m.id === ui.revMentor);
    const program = Data.reviews({ type: 'program' }).sort((a, b) => b.ts - a.ts);
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-star"></i> التقييمات المتبادلة</h2>${exportBar('reviews')}</div>
      <p class="muted small">تقييمات المرشد والمستفيد عن بعضهما تصل هنا أولاً، ولا تظهر للطرف الآخر إلا بعد اعتمادها.</p>
      ${cohortFilter('revCohort')}
      ${mentors.length ? `<div class="icon-people">${mentors.map(m => {
        const mentee = Data.menteeOf(m.id);
        const pend = Data.reviews().filter(r => r.mentorId === m.id && r.status === 'pending' && r.type !== 'program').length;
        return `<button class="person ${ui.revMentor === m.id ? 'active' : ''}" data-rev-mentor="${m.id}">${avatar(m, 'lg')}<b>${esc(m.name)}</b><small><i class="fa-solid fa-user-graduate"></i> ${esc(mentee?.name || 'غير معيّن')}</small>${pend ? `<em class="badge">${pend}</em>` : ''}</button>`;
      }).join('')}</div>` : emptyState('لا يوجد مرشدون', 'fa-user-tie')}
    </div>
    ${sel ? pairReviews(sel) : ''}
    <div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-comment-dots"></i> تقييمات البرنامج</h2>${exportBar('program-reviews')}</div>
      <p class="muted small">اختر ما تريد عرضه في قسم «آراء المشاركين» بالصفحة الرئيسية.</p>
      ${program.length ? `<ul class="review-list admin-reviews">${program.map(r => {
        const a = Data.member(r.authorId);
        return `<li class="review ${r.featured ? 'featured' : ''}"><header>${miniMember(a)}<span class="chip">${r.from === 'mentor' ? 'مرشد' : 'مستفيد'}</span><small>${fmtTs(r.ts)}</small></header>
          <p>${nl2br(r.text)}</p><footer><label class="switch"><input type="checkbox" data-feature="${r.id}" ${r.featured ? 'checked' : ''}><span></span> عرض في الصفحة الرئيسية</label>
          <button class="icon-btn danger" data-del-review="${r.id}" title="حذف"><i class="fa-solid fa-trash"></i></button></footer></li>`;
      }).join('')}</ul>` : emptyState('لا توجد تقييمات للبرنامج بعد', 'fa-comment-slash')}
    </div>`;
  };

  function pairReviews(m) {
    const mentee = Data.menteeOf(m.id);
    const all = Data.reviews().filter(r => r.mentorId === m.id && r.type !== 'program');
    const block = (from, title) => {
      const list = all.filter(r => r.from === from);
      const authorName = from === 'mentee' ? (mentee?.name || '') : m.name;
      return `<div class="review-box"><h3>${title}</h3>${list.length ? `<ul class="review-list">${list.map(r => `<li class="review">
        <header><b>تقييم ${from === 'mentee' ? 'المستفيد' : 'المرشد'} «${esc(Data.member(r.authorId)?.name || authorName)}» ${r.type === 'final' ? 'الختامي' : 'حول ' + sessionName(r.session)}</b>
        <span class="pill ${r.status === 'approved' ? 'st-done' : r.status === 'rejected' ? 'st-absent-mentor' : 'st-upcoming'}">${r.status === 'approved' ? 'معتمد' : r.status === 'rejected' ? 'غير معتمد' : 'بانتظار الاعتماد'}</span></header>
        <p>${nl2br(r.text)}</p>${r.extra ? `<p class="extra"><b>${from === 'mentor' ? 'التوصية' : 'المستفاد'}:</b> ${nl2br(r.extra)}</p>` : ''}
        <footer><small>${fmtTs(r.ts)}</small><span>
          <button class="btn xs success" data-approve="${r.id}" ${r.status === 'approved' ? 'disabled' : ''}><i class="fa-solid fa-check"></i> اعتماد وعرض للطرف الآخر</button>
          <button class="btn xs ghost danger" data-reject="${r.id}" ${r.status === 'rejected' ? 'disabled' : ''}><i class="fa-solid fa-ban"></i> عدم العرض</button></span></footer></li>`).join('')}</ul>` : '<p class="muted small">لا توجد تقييمات بعد.</p>'}</div>`;
    };
    return `<div class="panel"><div class="panel-head"><h2>${miniMember(m)} <i class="fa-solid fa-arrows-left-right muted"></i> ${miniMember(mentee)}</h2></div>
      <div class="review-grid">${block('mentee', `تقييمات المستفيد للمرشد`)}${block('mentor', `تقييمات المرشد للمستفيد`)}</div></div>`;
  }

  /* =============== 5) الرسائل =============== */
  P.messages = () => {
    const msgs = Store.list('messages').sort((a, b) => b.ts - a.ts);
    const inbox = Store.list('inbox').sort((a, b) => b.ts - a.ts);
    const target = x => x.target === 'member' ? (Data.member(x.memberId)?.name || 'عضو محذوف') : { all_mentors: 'كل المرشدين', all_mentees: 'كل المستفيدين', all: 'كل المرشدين والمستفيدين' }[x.target];
    const composer = (kind, title, icon, select) => `<form class="composer" data-compose="${kind}">
      <h3><i class="fa-solid ${icon}"></i> ${title}</h3>${select}
      <input name="title" placeholder="عنوان الرسالة / التنبيه (اختياري)">
      <textarea name="body" rows="3" required placeholder="نص الرسالة"></textarea>
      <button class="btn primary sm" type="submit"><i class="fa-solid fa-paper-plane"></i> نشر الرسالة</button></form>`;
    const opt = role => Data.members(role).map(m => `<option value="${m.id}">${esc(m.name)} (${m.code})</option>`).join('');
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-paper-plane"></i> إرسال رسالة / تنبيه</h2></div>
      <div class="composers">
        ${composer('mentor', 'رسالة لمرشد', 'fa-user-tie', `<select name="to" required><option value="">— اختر المرشد —</option>${opt('mentor')}</select>`)}
        ${composer('mentee', 'رسالة لمستفيد', 'fa-user-graduate', `<select name="to" required><option value="">— اختر المستفيد —</option>${opt('mentee')}</select>`)}
        ${composer('group', 'رسالة جماعية', 'fa-users', `<select name="to" required><option value="all_mentors">كل المرشدين</option><option value="all_mentees">كل المستفيدين</option><option value="all">كل المرشدين والمستفيدين</option></select>`)}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-list"></i> الرسائل المنشورة</h2>${exportBar('messages')}</div>
      ${msgs.length ? `<ul class="msg-list">${msgs.map(x => `<li><i class="fa-solid fa-bullhorn"></i><div><span class="chip">إلى: ${esc(target(x))}</span>${x.title ? `<b>${esc(x.title)}</b>` : ''}<p>${nl2br(x.body)}</p><small>${fmtTs(x.ts)}</small></div>
        <button class="icon-btn danger" data-del-msg="${x.id}" title="مسح"><i class="fa-solid fa-trash"></i></button></li>`).join('')}</ul>` : emptyState('لا توجد رسائل منشورة', 'fa-envelope')}
    </div>
    <div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-inbox"></i> رسائل واردة من الأعضاء</h2>${exportBar('inbox')}</div>
      ${inbox.length ? `<ul class="msg-list">${inbox.map(x => `<li class="${x.read ? '' : 'unread'}"><i class="fa-solid fa-envelope"></i><div><b>${esc(x.fromName)}</b> <span class="chip">${x.role === 'mentor' ? 'مرشد' : 'مستفيد'}</span><p>${nl2br(x.body)}</p><small>${fmtTs(x.ts)}</small></div>
        <button class="icon-btn danger" data-del-inbox="${x.id}" title="حذف"><i class="fa-solid fa-trash"></i></button></li>`).join('')}</ul>` : emptyState('لا توجد رسائل واردة', 'fa-inbox')}
    </div>`;
  };

  /* =============== 6) الإعلان =============== */
  P.announce = () => {
    const a = Store.get('announcement') || {};
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-bullhorn"></i> النافذة المنبثقة للإعلان</h2></div>
      <form class="form-grid" data-ann-form>
        <label class="switch wide"><input type="checkbox" name="enabled" ${a.enabled ? 'checked' : ''}><span></span> تفعيل الإعلان عند زيارة الصفحة الرئيسية</label>
        ${fieldInput({ k: 'title', label: 'عنوان الإعلان', required: true }, a.title || '')}
        <div class="field"><label>تكرار الظهور</label><select name="frequency">
          <option value="always" ${a.frequency === 'always' ? 'selected' : ''}>في كل زيارة</option>
          <option value="session" ${a.frequency === 'session' || !a.frequency ? 'selected' : ''}>مرة واحدة في كل جلسة تصفح</option>
          <option value="once" ${a.frequency === 'once' ? 'selected' : ''}>مرة واحدة فقط لكل زائر</option></select></div>
        ${fieldInput({ k: 'body', label: 'نص الإعلان', type: 'textarea', wide: true }, a.body || '')}
        ${fieldInput({ k: 'image', label: 'رابط صورة (اختياري)', type: 'url' }, a.image || '')}
        ${fieldInput({ k: 'button', label: 'نص الزر (اختياري)' }, a.button || '')}
        ${fieldInput({ k: 'link', label: 'رابط الزر (اتركه فارغاً لفتح نموذج التسجيل)', type: 'url', wide: true }, a.link || '')}
        <div class="wide form-actions"><button class="btn primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> حفظ الإعلان</button>
        <button class="btn ghost" type="button" data-ann-preview><i class="fa-solid fa-eye"></i> معاينة</button></div>
      </form>
    </div>`;
  };

  /* =============== 7) المهتمون =============== */
  function interestRows() {
    const fields = Store.list('form/fields').sort(byOrder);
    const list = Store.list('interests').filter(x => ui.intRole === 'all' || x.role === ui.intRole).sort((a, b) => b.ts - a.ts);
    const headers = ['التاريخ', 'الصفة', 'المصدر', ...fields.map(f => f.label)];
    const rows = list.map(x => [fmtTs(x.ts), x.role === 'mentor' ? 'مرشد' : 'مستفيد', x.source || 'نموذج التسجيل', ...fields.map(f => x.answers?.[f.id] ?? '')]);
    return { fields, list, headers, rows };
  }
  P.events = () => Events.panel();

  /* =============== المشرفون =============== */
  P.admins = () => {
    if (!Security.secure()) return `<div class="panel"><h2><i class="fa-solid fa-user-shield"></i> المشرفون</h2>${emptyState('إدارة عدة مشرفين بحسابات مستقلة تتاح بعد تفعيل الوضع الآمن (Firebase Authentication).', 'fa-lock')}</div>`;
    const me = Store.auth.currentUser;
    const all = Object.entries(Store.get('admins') || {}).map(([uid, a]) => ({ uid, ...a }));
    const isOwnerEmail = e => Security.OWNERS.includes(String(e || '').toLowerCase());
    const admins = all.filter(a => !isOwnerEmail(a.email)).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    const invites = Object.entries(Store.get('adminInvites') || {}).map(([key, i]) => ({ key, ...i })).sort((a, b) => (b.invitedAt || 0) - (a.invitedAt || 0));
    const logs = Store.list('adminLog').sort((a, b) => b.ts - a.ts).slice(0, 60);
    const roleBadge = a => a.role === 'full' || !a.role ? '<span class="pill st-done">صلاحية كاملة</span>'
      : `<span class="pill st-await">${Object.keys(a.perms || {}).length ? `جزئية · ${Object.keys(a.perms).length}` : 'بدون صلاحيات'}</span>`;
    const permChips = a => a.role === 'full' || !a.role ? '' : `<div class="perm-chips">${PERMISSIONS.filter(p => a.perms?.[p.k]).map(p => `<span class="chip"><i class="fa-solid ${p.icon}"></i> ${p.label}</span>`).join('') || '<small class="muted">لم تُحدد صلاحيات</small>'}</div>`;
    const byLine = x => x ? `<small class="muted">بواسطة ${esc(x.name || x.email || '')}</small>` : '';
    const ownerRows = Security.OWNERS.map(email => {
      const rec = all.find(a => String(a.email).toLowerCase() === email);
      return `<li class="owner"><span class="avatar sm"><span class="avatar-fallback"><i class="fa-solid fa-crown"></i></span></span>
        <div><b>${esc(rec?.name || 'حساب رئيسي')}</b>${rec?.uid === me?.uid ? ' <span class="chip">أنت</span>' : ''}<small dir="ltr">${esc(email)}</small></div>
        <span class="pill st-done">حساب رئيسي</span>${rec ? `<small class="muted">آخر تفعيل ${fmtTs(rec.addedAt)}</small>` : '<small class="muted">لم يدخل بعد</small>'}
        ${rec?.uid === me?.uid && (me.providerData || []).some(p => p.providerId === 'password') ? '<button class="btn xs ghost" data-my-password><i class="fa-solid fa-key"></i> تغيير كلمة السر</button>' : ''}</li>`;
    }).join('');
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-user-shield"></i> المشرفون والصلاحيات</h2>
      <div class="head-actions"><button class="btn ghost" data-invite-admin><i class="fa-brands fa-google"></i> دعوة بحساب Google</button>
      <button class="btn primary" data-add-admin><i class="fa-solid fa-plus"></i> إضافة مشرف ببريد وكلمة سر</button></div></div>
      <p class="muted small">الحسابات الرئيسية الثلاثة لها صلاحية كاملة دائماً، وهي وحدها تدير المشرفين وصلاحياتهم. الصلاحية الجزئية تحدد التبويبات التي يراها المشرف ويعدّلها، وتفرضها قواعد قاعدة البيانات نفسها.</p>
      <h3 class="sub"><i class="fa-solid fa-crown"></i> الحسابات الرئيسية</h3>
      <ul class="admin-list">${ownerRows}</ul>
      <h3 class="sub"><i class="fa-solid fa-user-shield"></i> المشرفون <span class="count">${admins.length}</span></h3>
      ${admins.length ? `<ul class="admin-list">${admins.map(a => `<li>
        <span class="avatar sm"><span class="avatar-fallback"><i class="fa-solid fa-user-shield"></i></span></span>
        <div><b>${esc(a.name || 'مشرف')}</b>${a.via === 'google' ? ' <span class="chip"><i class="fa-brands fa-google"></i> Google</span>' : ''}<small dir="ltr">${esc(a.email || '')}</small>${permChips(a)}</div>
        ${roleBadge(a)}
        <div class="admin-meta"><small class="muted">أُضيف ${a.addedAt ? fmtTs(a.addedAt) : ''}</small>${byLine(a.invitedBy || a.addedBy)}</div>
        <button class="btn xs ghost" data-perms="${a.uid}"><i class="fa-solid fa-sliders"></i> الصلاحيات</button>
        <button class="icon-btn danger" data-del-admin="${a.uid}" title="إزالة"><i class="fa-solid fa-user-minus"></i></button></li>`).join('')}</ul>` : '<p class="muted small">لا يوجد مشرفون إضافيون بعد.</p>'}
      ${invites.length ? `<h3 class="sub"><i class="fa-brands fa-google"></i> دعوات بانتظار أول دخول <span class="count">${invites.length}</span></h3>
        <ul class="admin-list">${invites.map(i => `<li class="invite"><span class="avatar sm"><span class="avatar-fallback"><i class="fa-regular fa-envelope"></i></span></span>
          <div><b>${esc(i.name || 'مشرف مدعو')}</b><small dir="ltr">${esc(i.email)}</small>${permChips(i)}</div>${roleBadge(i)}
          <div class="admin-meta"><small class="muted">دُعي ${fmtTs(i.invitedAt)}</small>${byLine(i.invitedBy)}</div>
          <button class="icon-btn danger" data-del-invite="${esc(i.key)}" title="إلغاء الدعوة"><i class="fa-solid fa-xmark"></i></button></li>`).join('')}</ul>` : ''}
    </div>
    <div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-clock-rotate-left"></i> سجل إجراءات المشرفين</h2>${exportBar('adminLog')}</div>
      ${logs.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>الوقت</th><th>المشرف</th><th>الإجراء</th><th>على</th><th>التفاصيل</th></tr></thead><tbody>
        ${logs.map(l => `<tr><td data-l="الوقت"><small>${fmtTs(l.ts)}</small></td><td data-l="المشرف">${esc(l.by?.name || l.by?.email || '')}</td><td data-l="الإجراء"><b>${esc(l.action)}</b></td>
          <td data-l="على"><span dir="auto">${esc(l.target || '')}</span></td><td data-l="التفاصيل"><small>${esc(l.details || '')}</small></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا توجد إجراءات مسجلة بعد', 'fa-clock-rotate-left')}
    </div>`;
  };

  // اختيار الصلاحية: كاملة أو جزئية مع قائمة المهام
  function permPicker(role = 'partial', perms = {}) {
    return `<fieldset class="wide perm-picker"><legend>الصلاحيات</legend>
      <div class="radio-row">
        <label class="radio"><input type="radio" name="role" value="full" ${role === 'full' ? 'checked' : ''}><span><i class="fa-solid fa-crown"></i> صلاحية كاملة</span></label>
        <label class="radio"><input type="radio" name="role" value="partial" ${role !== 'full' ? 'checked' : ''}><span><i class="fa-solid fa-sliders"></i> صلاحية جزئية</span></label>
      </div>
      <div class="perm-list" ${role === 'full' ? 'hidden' : ''}>${PERMISSIONS.map(p => `<label class="perm-item"><input type="checkbox" name="perm_${p.k}" ${perms?.[p.k] ? 'checked' : ''}>
        <i class="fa-solid ${p.icon}"></i><span><b>${p.label}</b><small>${p.desc}</small></span></label>`).join('')}</div>
      <small class="hint">الصلاحية الكاملة تشمل كل المهام والنسخ الاحتياطي والاسترجاع، ما عدا إدارة المشرفين والصلاحيات (للحسابات الرئيسية فقط).</small>
    </fieldset>`;
  }
  const readPerms = f => {
    const role = $('input[name=role]:checked', f)?.value || 'partial';
    const perms = {}; PERMISSIONS.forEach(p => { if ($(`[name=perm_${p.k}]`, f)?.checked) perms[p.k] = true; });
    return { role, perms };
  };
  const wirePermPicker = root => $$('input[name=role]', root).forEach(r => r.addEventListener('change', () => { $('.perm-list', root).hidden = $('input[name=role]:checked', root).value === 'full'; }));

  function permsDialog(uid) {
    const a = Store.get(`admins/${uid}`);
    openModal({
      title: `<i class="fa-solid fa-sliders"></i> صلاحيات ${esc(a?.name || a?.email || '')}`, size: 'md',
      body: `<form class="form-grid one">${permPicker(a?.role || 'full', a?.perms)}</form>`,
      actions: [{ label: 'حفظ الصلاحيات', cls: 'primary', onClick: m => { const { role, perms } = readPerms($('form', m.body)); Security.setAdminPerms(uid, role, perms); toast('تم حفظ الصلاحيات'); } }, { label: 'إلغاء', cls: 'ghost' }],
      onOpen: m => wirePermPicker(m.body)
    });
  }

  function inviteAdminDialog() {
    openModal({
      title: '<i class="fa-brands fa-google"></i> دعوة مشرف بحساب Google', size: 'md',
      body: `<form class="form-grid one">
        ${fieldInput({ k: 'name', label: 'الاسم', required: true })}
        ${fieldInput({ k: 'email', label: 'بريد حساب Google (Gmail)', type: 'email', required: true, hint: 'يدخل المشرف من «دخول الإدارة» بزر «الدخول بحساب Google» بنفس هذا البريد، فيُفعَّل تلقائياً بالصلاحيات المحددة هنا.' })}
        ${permPicker('partial', {})}
      </form>`,
      actions: [{
        label: 'إرسال الدعوة', cls: 'primary', onClick: m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const v = readForm(f); const { role, perms } = readPerms(f);
          Security.inviteAdmin(v.email, v.name, role, perms);
          toast('تمت الدعوة — أخبر المشرف بالدخول بحساب Google');
        }
      }, { label: 'إلغاء', cls: 'ghost' }],
      onOpen: m => wirePermPicker(m.body)
    });
  }

  function addAdminDialog() {
    openModal({
      title: '<i class="fa-solid fa-user-plus"></i> إضافة مشرف ببريد وكلمة سر', size: 'md',
      body: `<form class="form-grid one">
        ${fieldInput({ k: 'name', label: 'الاسم', required: true })}
        ${fieldInput({ k: 'email', label: 'البريد الإلكتروني', type: 'email', required: true })}
        ${fieldInput({ k: 'password', label: 'كلمة السر المبدئية (6 أحرف على الأقل)', required: true, hint: 'أرسلها للمشرف ليغيّرها بعد أول دخول.' })}
        ${permPicker('partial', {})}
      </form>`,
      actions: [{
        label: 'إضافة', cls: 'primary', onClick: async m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const v = readForm(f); const { role, perms } = readPerms(f);
          if (v.password.length < 6) { toast('كلمة السر 6 أحرف على الأقل', 'error'); return false; }
          try { await Security.addAdmin(v.email, v.password, v.name, role, perms); toast('تمت إضافة المشرف'); }
          catch (e) { toast(e.message, 'error'); return false; }
        }
      }, { label: 'إلغاء', cls: 'ghost' }],
      onOpen: m => wirePermPicker(m.body)
    });
  }

  function myPasswordDialog() {
    openModal({
      title: '<i class="fa-solid fa-key"></i> تغيير كلمة السر', size: 'sm',
      body: `<form class="form-grid one">
        <div class="field"><label>كلمة السر الحالية</label><input type="password" name="cur" required dir="ltr"></div>
        <div class="field"><label>كلمة السر الجديدة (6 أحرف على الأقل)</label><input type="password" name="next" required minlength="6" dir="ltr"></div>
      </form>`,
      actions: [{
        label: 'حفظ', cls: 'primary', onClick: async m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          try { await Security.changeMyPassword(f.cur.value, f.next.value); toast('تم تغيير كلمة السر'); }
          catch (e) { toast(e.message, 'error'); return false; }
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  /* =============== ترقية الأمان =============== */
  function securityBanner() {
    if (!Security.secure()) return `<div class="sec-banner warn"><i class="fa-solid fa-shield-halved"></i><div><b>الوضع الآمن غير مفعّل</b>
      <p>أضف إعدادات مشروع Firebase (apiKey وغيرها) في <code>js/config.js</code> لتفعيل الدخول الآمن وحماية البيانات.</p></div></div>`;
    if (!Security.isFull()) return '';
    if (Security.needsMigration()) return `<div class="sec-banner"><i class="fa-solid fa-shield-halved"></i><div><b>خطوة أخيرة: ترقية البيانات إلى البنية الآمنة</b>
      <p>تُنقل بيانات التواصل إلى مسار خاص، وتُنشأ رموز دخول سرية جديدة لكل الأعضاء (مثل <span class="num">M211-7K4Q</span>). تُنزَّل نسخة احتياطية تلقائياً قبل البدء.</p>
      <button class="btn primary sm" data-migrate><i class="fa-solid fa-wand-magic-sparkles"></i> ابدأ الترقية</button></div></div>`;
    const rulesV = Number(Store.get('meta/rulesVersion') || (Store.get('meta/rulesPublished') ? 2 : 0));
    if (rulesV < Security.RULES_VERSION && Security.isOwner()) return `<div class="sec-banner"><i class="fa-solid fa-shield-halved"></i><div><b>${rulesV ? 'حدّث قواعد الحماية' : 'انشر قواعد الحماية الجديدة'}</b>
      <p>${rulesV ? 'أُضيفت ميزات جديدة (صلاحيات المشرفين وإطلاق الدفعة) تحتاج نسخة جديدة من القواعد.' : 'اكتملت ترقية البيانات.'} انسخ القواعد وانشرها في Firebase Console ← Realtime Database ← Rules ← Publish${rulesV ? '' : '، ثم أرسل للأعضاء رموزهم الجديدة'}.</p>
      <button class="btn primary sm" data-show-rules><i class="fa-solid fa-copy"></i> عرض القواعد ونسخها</button>
      <button class="btn ghost sm" data-rules-done><i class="fa-solid fa-check"></i> نشرتها</button></div></div>`;
    return '';
  }

  async function runMigration() {
    if (!(await confirmDialog('ستبدأ ترقية البيانات الآن. لا تغلق الصفحة حتى تنتهي. ستُنزَّل نسخة احتياطية أولاً.', { ok: 'ابدأ' }))) return;
    downloadBackup(true);
    const prog = openModal({ title: '<i class="fa-solid fa-spinner fa-spin"></i> ترقية البيانات', size: 'sm', dismissible: false, body: '<p class="confirm-msg" data-prog>جارٍ البدء...</p>' });
    try {
      const r = await Security.migrate(t => { $('[data-prog]', prog.el).textContent = t; });
      prog.close();
      if (r.failed.length) openModal({ title: 'اكتملت الترقية مع ملاحظات', size: 'md', body: `<p>تعذّر إنشاء رموز الدخول لـ ${r.failed.length} عضواً. أعد تشغيل الترقية لاحقاً أو استخدم «رمز جديد» على بطاقاتهم.</p><ul>${r.failed.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`, actions: [{ label: 'حسناً', cls: 'primary' }] });
      else toast('اكتملت ترقية البيانات');
    } catch (e) { prog.close(); toast(Security.authMsg(e), 'error'); }
  }

  async function showRules() {
    let rules = '';
    try { rules = await (await fetch('database.rules.json', { cache: 'no-store' })).text(); } catch { rules = 'تعذّر تحميل الملف database.rules.json'; }
    openModal({
      title: '<i class="fa-solid fa-shield-halved"></i> قواعد الحماية', size: 'lg',
      body: `<p class="muted small">في Firebase Console: Realtime Database ← Rules ← احذف المحتوى الحالي والصق هذه القواعد ← Publish.</p><pre class="rules-pre" dir="ltr">${esc(rules)}</pre>`,
      actions: [{ label: '<i class="fa-solid fa-copy"></i> نسخ القواعد', cls: 'primary', onClick: async () => { try { await navigator.clipboard.writeText(rules); toast('تم نسخ القواعد'); } catch { toast('انسخها يدوياً من الصندوق', 'error'); } return false; } }, { label: 'إغلاق', cls: 'ghost' }]
    });
  }

  P.interests = () => {
    const { fields, list } = interestRows();
    const all = Store.list('interests');
    const cell = (f, v) => {
      v = String(v ?? '');
      if (!v) return '—';
      if (f.type === 'url' || /^https?:\/\//.test(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> فتح الرابط</a>`;
      if (f.type === 'email') return `<a href="mailto:${esc(v)}" dir="ltr">${esc(v)}</a>`;
      if (f.type === 'tel') return `<a href="${esc(waLink(v))}" target="_blank" rel="noopener" dir="ltr"><i class="fa-brands fa-whatsapp"></i> ${esc(v)}</a>`;
      return nl2br(v);
    };
    setTimeout(() => all.filter(x => !x.seen).forEach(x => Store.set(`interests/${x.id}/seen`, true)), 1500);
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-user-plus"></i> المسجلون في نموذج الاهتمام <span class="count">${all.length}</span></h2>
      <div class="head-actions">${exportBar('interests')}<button class="btn ghost sm" data-goto-form><i class="fa-solid fa-clipboard-list"></i> تعديل حقول النموذج</button></div></div>
      <div class="chip-filter">${[['all', 'الكل'], ['mentor', 'مرشد'], ['mentee', 'مستفيد']].map(([k, l]) => `<button class="${ui.intRole === k ? 'active' : ''}" data-int-role="${k}">${l} <span>${k === 'all' ? all.length : all.filter(x => x.role === k).length}</span></button>`).join('')}</div>
      ${list.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>التاريخ</th><th>الصفة</th>${fields.map(f => `<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead><tbody>
        ${list.map(x => `<tr class="${x.seen ? '' : 'new'}"><td data-l="التاريخ"><small>${fmtTs(x.ts)}</small>${x.source ? `<br><span class="chip source-chip"><i class="fa-solid fa-person-chalkboard"></i> ${esc(x.source)}</span>` : ''}</td><td data-l="الصفة"><span class="chip ${x.role}">${x.role === 'mentor' ? 'مرشد' : 'مستفيد'}</span></td>
          ${fields.map(f => `<td data-l="${esc(f.label)}">${cell(f, x.answers?.[f.id])}</td>`).join('')}
          <td><button class="icon-btn danger" data-del-interest="${x.id}" title="حذف"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا توجد تسجيلات بعد', 'fa-user-plus')}
    </div>`;
  };

  /* =============== التصدير =============== */
  function exportData(key) {
    const [kind, a, b] = key.split(':');
    const memberRow = m => [m.code, m.name, m.tagline, Data.cohort(m.cohort)?.name, m.areas, m.whatsapp, m.email, m.linkedin, m.website, m.bio];
    const memberHead = ['رقم العضوية', 'الاسم', 'السطر التعريفي', 'الدفعة', 'المجالات', 'واتساب', 'الإيميل', 'لينكدإن', 'الموقع', 'النبذة'];
    const bookingHead = ['المرشد', 'المستفيد', 'الجلسة', 'التاريخ', 'الوقت', 'النوع', 'الحالة'];
    const bookingRow = x => [Data.member(x.mentorId)?.name, Data.member(x.menteeId)?.name, sessionName(x.session), fmtDate(x.date), `${x.start} - ${x.end}`, MODES[x.mode], STATUS[Data.displayStatus(x)]?.label];
    const reviewHead = ['النوع', 'من', 'الكاتب', 'عن', 'الجلسة', 'التقييم', 'التوصية / المستفاد', 'الحالة', 'التاريخ'];
    const reviewRow = r => [r.type === 'program' ? 'تقييم البرنامج' : r.type === 'final' ? 'ختامي' : 'جلسة', r.from === 'mentor' ? 'مرشد' : 'مستفيد',
      Data.member(r.authorId)?.name || r.authorName, r.type === 'program' ? 'البرنامج' : Data.member(r.targetId)?.name, r.session ? sessionName(r.session) : '', r.text, r.extra || '',
      r.type === 'program' ? (r.featured ? 'معروض' : '') : ({ pending: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'غير معتمد' }[r.status]), fmtTs(r.ts)];
    switch (kind) {
      case 'content': return { title: 'أقسام الصفحة الرئيسية', headers: ['الترتيب', 'النوع', 'العنوان', 'الحالة', 'المحتوى'], rows: Store.list('content/sections').sort(byOrder).map((s, i) => [i + 1, SECTION_TYPES[s.type]?.label, s.title || s.brand || '', s.visible === false ? 'مخفي' : 'ظاهر', [s.body, ...(s.items || []).map(it => [it.title, it.text, it.value, it.label, it.people].filter(Boolean).join(' - '))].filter(Boolean).join(' | ')]) };
      case 'members': return { title: `${a && Data.cohort(a)?.name} — ${b === 'mentor' ? 'المرشدون' : 'المستفيدون'}`, headers: memberHead, rows: Data.members(b, a).map(memberRow) };
      case 'network': return { title: `الشبكة — ${Data.cohort(a)?.name}`, headers: ['رقم المرشد', 'المرشد', 'رقم المستفيد', 'المستفيد'], rows: Data.members('mentor', a).map(m => { const x = Data.menteeOf(m.id); return [m.code, m.name, x?.code || '', x?.name || '']; }) };
      case 'sessions': {
        const ids = new Set(Data.members('mentor').filter(m => inCohort('sessCohort', m)).map(m => m.id));
        return { title: 'الجلسات الإرشادية', headers: bookingHead, rows: Data.bookings().filter(x => ids.has(x.mentorId)).map(bookingRow) };
      }
      case 'mentor-sessions': return { title: `جلسات ${Data.member(a)?.name}`, headers: bookingHead, rows: Data.bookings({ mentorId: a }).map(bookingRow) };
      case 'reviews': return { title: 'التقييمات المتبادلة', headers: reviewHead, rows: Data.reviews().filter(r => r.type !== 'program').map(reviewRow) };
      case 'program-reviews': return { title: 'تقييمات البرنامج', headers: reviewHead, rows: Data.reviews({ type: 'program' }).map(reviewRow) };
      case 'messages': return { title: 'الرسائل المنشورة', headers: ['إلى', 'العنوان', 'النص', 'التاريخ'], rows: Store.list('messages').map(x => [x.target === 'member' ? Data.member(x.memberId)?.name : x.target, x.title, x.body, fmtTs(x.ts)]) };
      case 'inbox': return { title: 'الرسائل الواردة', headers: ['من', 'الصفة', 'الرسالة', 'التاريخ'], rows: Store.list('inbox').map(x => [x.fromName, x.role === 'mentor' ? 'مرشد' : 'مستفيد', x.body, fmtTs(x.ts)]) };
      case 'event': case 'events': return Events.exportData(key);
      case 'adminLog': return { title: 'سجل إجراءات المشرفين', headers: ['الوقت', 'المشرف', 'البريد', 'الإجراء', 'على', 'التفاصيل'], rows: Store.list('adminLog').sort((a, b) => b.ts - a.ts).map(l => [fmtTs(l.ts), l.by?.name || '', l.by?.email || '', l.action, l.target || '', l.details || '']) };
      case 'interests': { const r = interestRows(); return { title: 'المهتمون بالتسجيل', headers: r.headers, rows: r.rows }; }
    }
    return null;
  }

  function doExport(btn) {
    const key = btn.dataset.export, fmt = btn.dataset.fmt;
    const d = exportData(key);
    if (!d) return;
    if (fmt === 'csv') return download(`ishraq-${key.replace(/:/g, '-')}.csv`, toCSV(d.headers, d.rows));
    const panel = btn.closest('.ev-regs, .panel, .members-block, .network-block');
    const clone = panel.cloneNode(true);
    $$('button:not(.person), .export-bar, .dropzone, select, input, .add-card, .mc-actions, .sec-actions', clone).forEach(el => el.remove());
    exportPDF(d.title, `<div class="print-body">${clone.innerHTML}</div>`);
  }

  /* =============== الربط =============== */
  function wire(root) {
    $('[data-logout]', root).onclick = () => Auth.logout();
    $$('[data-tab]', root).forEach(b => b.onclick = () => { ui.tab = ui.tab === b.dataset.tab ? null : b.dataset.tab; render(root); });
    root.onclick = e => {
      const t = e.target;
      const ex = t.closest('[data-export]'); if (ex) return doExport(ex);
      const li = t.closest('[data-sortable] li');
      if (li) {
        const id = li.dataset.id, s = Store.get(`content/sections/${id}`);
        if (t.closest('[data-edit-sec]')) return editSection(s);
        if (t.closest('[data-toggle-vis]')) return Store.set(`content/sections/${id}/visible`, s.visible === false);
        if (t.closest('[data-del-sec]')) return confirmDialog(`حذف قسم «${esc(s.title || SECTION_TYPES[s.type]?.label)}» نهائياً؟`, { danger: true, ok: 'حذف' }).then(ok => ok && Store.remove(`content/sections/${id}`));
        const mv = t.closest('[data-move]');
        if (mv) {
          const ids = $$('[data-sortable] li', root).map(x => x.dataset.id);
          const i = ids.indexOf(id), j = i + +mv.dataset.move;
          if (j < 0 || j >= ids.length) return;
          [ids[i], ids[j]] = [ids[j], ids[i]];
          return reorder('content/sections', ids);
        }
      }
      if (t.closest('[data-add-section]')) return addSection();
      if (t.closest('[data-add-field]')) return editField();
      const fl = t.closest('[data-sortable-fields] li[data-id]');
      if (fl) {
        const f = Store.get(`form/fields/${fl.dataset.id}`);
        if (t.closest('[data-edit-field]')) return editField(f);
        if (t.closest('[data-del-field]')) return confirmDialog(`حذف حقل «${esc(f.label)}»؟`, { danger: true, ok: 'حذف' }).then(ok => ok && Store.remove(`form/fields/${f.id}`));
      }
      if (t.closest('[data-preview-form]')) return Home.openInterestForm();
      // الدفعات
      const cb = t.closest('[data-cohort]');
      if (cb) { ui.cohort = ui.cohort === cb.dataset.cohort ? null : cb.dataset.cohort; ui.sub = ui.cohort ? (ui.sub || 'mentor') : null; return render(root); }
      if (t.closest('[data-add-cohort]')) return editCohort();
      const ec = t.closest('[data-edit-cohort]'); if (ec) return editCohort(Data.cohort(ec.dataset.editCohort));
      const dc = t.closest('[data-del-cohort]');
      if (dc) {
        const c = Data.cohort(dc.dataset.delCohort);
        if (Store.list('members').some(m => m.cohort === c.id)) return toast('لا يمكن حذف دفعة تحتوي على أعضاء', 'error');
        return confirmDialog(`حذف «${esc(c.name)}»؟`, { danger: true, ok: 'حذف' }).then(ok => ok && Store.remove(`cohorts/${c.id}`));
      }
      const sb = t.closest('[data-sub]'); if (sb) { ui.sub = ui.sub === sb.dataset.sub ? null : sb.dataset.sub; return render(root); }
      const am = t.closest('[data-add-member]'); if (am) return addMember(am.dataset.addMember, ui.cohort);
      const sc = t.closest('[data-send-cred]'); if (sc) return sendCredentials(Data.member(sc.dataset.sendCred));
      const rg = t.closest('[data-regen]');
      if (rg) {
        const m = Data.member(rg.dataset.regen);
        return confirmDialog(`توليد رمز دخول جديد لـ «${esc(m.name)}»؟ سيتوقف رمزه الحالي عن العمل، ثم أرسل له الرمز الجديد عبر «مشاركة البطاقة ومعلومات الدخول».`, { ok: 'توليد رمز جديد' })
          .then(async ok => { if (!ok) return; try { const c = await Security.regenerateCode(m); toast(`الرمز الجديد: ${c}`); } catch (e) { toast(Security.authMsg(e), 'error'); } });
      }
      const em = t.closest('[data-edit-member]'); if (em) return Portal.editProfile(Data.member(em.dataset.editMember));
      const dm = t.closest('[data-del-member]');
      if (dm) {
        const m = Data.member(dm.dataset.delMember);
        return confirmDialog(`حذف بطاقة «${esc(m.name)}» (${m.code})؟ سيتم أيضاً إلغاء تعيينه في الشبكة.`, { danger: true, ok: 'حذف' }).then(ok => { if (ok) { Data.removeMember(m.id); ui.netCohort = null; } });
      }
      if (t.closest('[data-backup]')) return downloadBackup();
      if (t.closest('[data-migrate]')) return runMigration();
      if (t.closest('[data-show-rules]')) return showRules();
      if (t.closest('[data-rules-done]')) { Store.update('meta', { rulesPublished: Date.now(), rulesVersion: Security.RULES_VERSION }); return Security.log('نشر قواعد الحماية', `الإصدار ${Security.RULES_VERSION}`); }
      if (t.closest('[data-add-admin]')) return addAdminDialog();
      if (t.closest('[data-invite-admin]')) return inviteAdminDialog();
      const di2 = t.closest('[data-del-invite]'); if (di2) return confirmDialog('إلغاء هذه الدعوة؟', { danger: true, ok: 'إلغاء الدعوة', cancel: 'رجوع' }).then(ok => ok && Security.cancelInvite(di2.dataset.delInvite));
      const pm = t.closest('[data-perms]'); if (pm) return permsDialog(pm.dataset.perms);
      if (t.closest('[data-my-password]')) return myPasswordDialog();
      const da = t.closest('[data-del-admin]');
      if (da) return confirmDialog('إزالة هذا المشرف؟ لن يستطيع الدخول إلى لوحة الإدارة بعد الآن.', { danger: true, ok: 'إزالة' }).then(ok => ok && Security.removeAdmin(da.dataset.delAdmin));
      const tpl = t.closest('[data-csv-template]'); if (tpl) return csvTemplate(tpl.dataset.csvTemplate);
      const un = t.closest('[data-unassign]'); if (un) { delete ui.netDraft[un.dataset.unassign]; return render(root); }
      if (t.closest('[data-save-net]')) {
        const clean = {}; Object.entries(ui.netDraft).forEach(([k, v]) => { if (v) clean[k] = v; });
        const before = Store.get(`network/${ui.cohort}`) || {};
        Store.set(`network/${ui.cohort}`, clean);
        Object.entries(clean).forEach(([mid, bid]) => {
          if (before[mid] !== bid) { Data.notify(mid, `تم تعيين المستفيد ${Data.member(bid)?.name} لك`, { icon: 'fa-handshake' }); Data.notify(bid, `تم تعيين المرشد ${Data.member(mid)?.name} لك`, { icon: 'fa-handshake' }); }
        });
        return toast('تم حفظ الشبكة');
      }
      // الجلسات والتقييمات
      const fb = t.closest('[data-filter]'); if (fb) { ui[fb.dataset.filter] = fb.dataset.val; return render(root); }
      const st = t.closest('[data-stat]');
      if (st) { ui.sessStat = ui.sessStat === st.dataset.stat ? null : st.dataset.stat; render(root); return ui.sessStat && $('#stat-list')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      const la = t.closest('[data-launch]');
      if (la) return confirmDialog(`إطلاق «${esc(Data.cohort(la.dataset.launch)?.name || '')}» الآن؟ يبدأ من هذه اللحظة حساب مدد الجلسات، ويظهر للمرشدين شريط الإطلاق وتُفتح لهم إضافة المواعيد.`, { ok: 'إطلاق الدفعة' }).then(ok => { if (ok) { Bands.doLaunch(la.dataset.launch); toast('تم إطلاق الدفعة'); } });
      const ul = t.closest('[data-unlaunch]');
      if (ul) return confirmDialog('إلغاء إطلاق الدفعة؟ ستُغلق إضافة المواعيد للمرشدين ويُعاد الحساب من جديد عند الإطلاق مرة أخرى.', { danger: true, ok: 'إلغاء الإطلاق', cancel: 'رجوع' }).then(ok => ok && Bands.undoLaunch(ul.dataset.unlaunch));
      const rmd = t.closest('[data-remind]'); if (rmd) return remindDialog(rmd.dataset.remind, Number(rmd.dataset.session));
      const sm = t.closest('[data-sess-mentor]');
      if (sm) { ui.sessMentor = ui.sessMentor === sm.dataset.sessMentor ? null : sm.dataset.sessMentor; render(root); return $('#mentor-sessions')?.scrollIntoView({ behavior: 'smooth' }); }
      const rm = t.closest('[data-rev-mentor]'); if (rm) { ui.revMentor = ui.revMentor === rm.dataset.revMentor ? null : rm.dataset.revMentor; return render(root); }
      const ap = t.closest('[data-approve]');
      if (ap) {
        const r = Store.get(`reviews/${ap.dataset.approve}`);
        Store.update(`reviews/${r.id}`, { status: 'approved', decidedAt: Date.now() });
        r.targetId && Data.notify(r.targetId, `وصلك تقييم جديد من ${r.from === 'mentor' ? 'المرشد' : 'المستفيد'} ${Data.member(r.authorId)?.name || ''}`, { icon: 'fa-star' });
        Data.notify(r.authorId, 'تم اعتماد تقييمك من الإدارة', { icon: 'fa-circle-check' });
        return toast('تم اعتماد التقييم');
      }
      const rj = t.closest('[data-reject]'); if (rj) return Store.update(`reviews/${rj.dataset.reject}`, { status: 'rejected', decidedAt: Date.now() });
      const dr = t.closest('[data-del-review]'); if (dr) return confirmDialog('حذف هذا التقييم؟', { danger: true, ok: 'حذف' }).then(ok => { if (ok) { Store.remove(`reviews/${dr.dataset.delReview}`); Store.remove(`featured/${dr.dataset.delReview}`); } });
      // الرسائل
      const dmsg = t.closest('[data-del-msg]'); if (dmsg) return confirmDialog('مسح هذه الرسالة؟ ستختفي من صفحات الأعضاء.', { danger: true, ok: 'مسح' }).then(ok => ok && Store.remove(`messages/${dmsg.dataset.delMsg}`));
      const di = t.closest('[data-del-inbox]'); if (di) return Store.remove(`inbox/${di.dataset.delInbox}`);
      // الإعلان
      if (t.closest('[data-ann-preview]')) {
        const f = $('[data-ann-form]', root); const v = readForm(f);
        return openModal({ title: '', size: 'md', cls: 'announce', body: `<div class="ann">${v.image ? `<img src="${esc(driveImg(v.image))}" alt="" referrerpolicy="no-referrer">` : '<div class="ann-icon"><i class="fa-solid fa-bullhorn"></i></div>'}<h2>${esc(v.title)}</h2><p>${nl2br(v.body)}</p></div>`, actions: [...(v.button ? [{ label: esc(v.button), cls: 'primary' }] : []), { label: 'إغلاق', cls: 'ghost' }] });
      }
      // المهتمون
      const ir = t.closest('[data-int-role]'); if (ir) { ui.intRole = ir.dataset.intRole; return render(root); }
      const dint = t.closest('[data-del-interest]'); if (dint) return confirmDialog('حذف هذا التسجيل؟', { danger: true, ok: 'حذف' }).then(ok => ok && Store.remove(`interests/${dint.dataset.delInterest}`));
      if (t.closest('[data-goto-form]')) { ui.tab = 'content'; render(root); return $('[data-sortable-fields]')?.scrollIntoView({ behavior: 'smooth' }); }
    };

    root.onchange = e => {
      const t = e.target;
      if (t.matches('[data-net]')) { ui.netDraft[t.dataset.net] = t.value; return render(root); }
      if (t.matches('[data-feature]')) { Store.set(`reviews/${t.dataset.feature}/featured`, t.checked); return Security.setFeatured(Store.get(`reviews/${t.dataset.feature}`), t.checked); }
      if (t.matches('[data-restore]') && t.files[0]) { const f = t.files[0]; t.value = ''; return restoreBackup(f); }
      if (t.matches('.dropzone input[type=file]') && t.files[0]) importCSV(t.files[0], t.closest('[data-drop]').dataset.drop, ui.cohort);
    };

    root.onsubmit = e => {
      const f = e.target;
      if (f.matches('[data-compose]')) {
        e.preventDefault();
        const v = readForm(f);
        if (!v.body || !v.to) return validateForm(f);
        const kind = f.dataset.compose;
        const msg = kind === 'group' ? { target: v.to } : { target: 'member', memberId: v.to };
        Store.push('messages', { ...msg, title: v.title, body: v.body, ts: Date.now() });
        const recipients = kind === 'group' ? Data.members(v.to === 'all_mentors' ? 'mentor' : v.to === 'all_mentees' ? 'mentee' : null) : [Data.member(v.to)];
        recipients.forEach(m => m && Data.notify(m.id, `رسالة جديدة من الإدارة${v.title ? ': ' + v.title : ''}`, { icon: 'fa-envelope' }));
        toast('تم نشر الرسالة');
      }
      if (f.matches('[data-ann-form]')) {
        e.preventDefault();
        if (!validateForm(f)) return;
        const prev = Store.get('announcement') || {};
        Store.set('announcement', { ...readForm(f), version: (prev.version || 0) + 1 });
        toast('تم حفظ الإعلان');
      }
    };

    const ul = $('[data-sortable]', root); ul && enableSortable(ul, 'content/sections');
    const fl = $('[data-sortable-fields]', root); fl && enableSortable(fl, 'form/fields');
    $$('[data-drop]', root).forEach(z => {
      ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('over'); }));
      z.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; f && importCSV(f, z.dataset.drop, ui.cohort); });
    });
  }

  return { render, ui };
})();
