/* إعلان دفعة جديدة: اختيار الدفعة وإطلاق التسجيل، نموذج التسجيل، المسجلون وقبولهم، ورسائل القبول والاعتذار بالبريد.
   منفصل تماماً عن «المهتمين»: نموذجه regform/fields ونتائجه registrations، بينما نموذج المهتمين form/fields ونتائجه interests. */

const Enroll = (() => {
  const ui = { regCohort: '', sel: new Set() };
  const fieldsList = () => Store.list('regform/fields').sort(byOrder);
  const answerFields = () => fieldsList().filter(f => f.type !== 'info');
  const announced = () => Data.cohort(Store.get('announcement/cohort'));
  const siteUrl = () => window.ISHRAQ_CONFIG.siteUrl || location.href.replace(/#.*$/, '');
  const roleLabel = r => (r === 'mentor' ? 'مرشد' : 'مستفيد');
  const FIELD_TYPES = [['text', 'نص قصير'], ['textarea', 'نص طويل'], ['tel', 'رقم جوال'], ['email', 'بريد إلكتروني'], ['url', 'رابط (سيرة ذاتية، ملف، مصدر...)'], ['select', 'قائمة اختيار'], ['number', 'رقم'], ['date', 'تاريخ'], ['info', 'فقرة نصية (للقراءة فقط، بلا إدخال)']];

  // نموذج الإعلان المنبثق يحتفظ بقيمه عند إعادة رسم الصفحة؛ بعد الإطلاق أو الإيقاف نحدّثه ليعكس ما حُفظ فعلاً
  function syncAnnForm() {
    setTimeout(() => {
      const f = $('[data-ann-form]'), a = Store.get('announcement') || {};
      if (!f) return;
      ['title', 'body', 'button', 'link', 'frequency'].forEach(k => { if (f[k]) f[k].value = a[k] ?? (k === 'frequency' ? 'session' : ''); });
      if (f.enabled) f.enabled.checked = !!a.enabled;
    }, 250);
  }

  /* ===== الدفعات المقترحة: الثالثة 2027 ... العاشرة 2034 (السنة = 2024 + رقم الدفعة) ===== */
  const STD = n => ({ id: `c${n}`, num: n, name: `الدفعة ${ORDINALS[n - 1]}`, year: 2024 + n });
  const stdList = () => [3, 4, 5, 6, 7, 8, 9, 10].map(STD);

  function cohortPanel() {
    const cur = announced(), cohorts = Data.cohorts();
    const std = stdList(), stdIds = new Set(std.map(c => c.id));
    const extra = cohorts.filter(c => !stdIds.has(c.id) && c.num > 2);
    const pre = cur?.id || '';
    return `<div class="panel" id="enroll-cohort">
      <div class="panel-head"><h2><i class="fa-solid fa-bullhorn"></i> إعلان دفعة جديدة</h2>
        <div class="head-actions"><button class="btn ghost" data-enroll-form><i class="fa-solid fa-clipboard-list"></i> نموذج التسجيل</button></div></div>
      ${cur ? `<div class="enroll-current"><span class="pill st-done"><i class="fa-solid fa-door-open"></i> التسجيل مفتوح</span> <b>${esc(cur.name)} ${esc(cur.year)}</b>
        <button class="btn xs ghost danger" data-enroll-close><i class="fa-solid fa-circle-stop"></i> إيقاف التسجيل</button></div>` : '<p class="muted small"><i class="fa-solid fa-circle-info"></i> لا توجد دفعة معلنة حالياً. اختر الدفعة ثم «إطلاق التسجيل».</p>'}
      <div class="form-grid enroll-pick">
        <div class="field"><label>الدفعة</label><select data-enroll-pick>
          ${std.map(c => `<option value="${esc(c.id)}" ${pre === c.id ? 'selected' : ''}>${esc(c.name)} ${c.year}${Data.cohort(c.id) ? ' (مضافة)' : ''}</option>`).join('')}
          ${extra.map(c => `<option value="${esc(c.id)}" ${pre === c.id ? 'selected' : ''}>${esc(c.name)} ${esc(c.year)} (مضافة)</option>`).join('')}
          <option value="__custom">دفعة خاصة بمسمى جديد...</option></select></div>
        <div class="field" data-enroll-custom hidden><label>مسمى الدفعة</label><input name="cname" placeholder="مثال: دفعة الخريجين"></div>
        <div class="field" data-enroll-custom hidden><label>السنة</label><input name="cyear" inputmode="numeric" value="${new Date().getFullYear()}"></div>
        <div class="field enroll-go"><button class="btn primary" data-enroll-launch><i class="fa-solid fa-rocket"></i> إطلاق التسجيل</button></div>
      </div>
      <p class="muted small">عند إطلاق التسجيل: تُضاف الدفعة إلى كل قوائم المنصة (الدفعات، الجلسات والإحصاءات، الشهادات...)، ويظهر الإعلان المنبثق لكل زائر مع زر التسجيل، ويظهر قسم «التسجيل في الدفعة الجديدة» تحت الواجهة الرئيسية بزر يفتح النموذج نفسه، ويصل كل مسجَّل إلى القسم أدناه. وأثناء التسجيل يتحول زر «سجّل اهتمامك» في الأعلى إلى «سجّل الآن». أخفِ قسم «تسجيل الاهتمام» من «محتوى الصفحة» إن أردت (نموذجه ونتائجه منفصلان في تبويب «المهتمون»). و«إيقاف التسجيل» يُخفي الإعلان والقسم معاً.</p>
    </div>`;
  }

  function launchRegistration(root) {
    const sel = $('[data-enroll-pick]', root).value;
    let c;
    if (sel === '__custom') {
      const name = $('[name=cname]', root).value.trim(), year = +toEnDigits($('[name=cyear]', root).value);
      if (!name) return toast('اكتب مسمى الدفعة', 'error');
      if (!year) return toast('اكتب سنة الدفعة', 'error');
      const num = Math.max(2, ...Data.cohorts().map(x => x.num || 0)) + 1;
      c = { id: `c${num}`, num, name, year };
    } else c = Data.cohort(sel) || stdList().find(x => x.id === sel) || null;
    if (!c) return toast('اختر الدفعة', 'error');
    confirmDialog(`إطلاق التسجيل في «${esc(c.name)} ${esc(c.year)}»؟ ${Data.cohort(c.id) ? '' : 'ستُضاف الدفعة إلى قوائم المنصة. '}يُربط نموذج التسجيل بها وتصل إليها تسجيلات الزوار، ويظهر الإعلان المنبثق وقسم التسجيل في الصفحة الرئيسية بنصوص تلقائية يمكنك تعديلها بعد ذلك.`, { ok: 'إطلاق التسجيل' }).then(ok => {
      if (!ok) return;
      if (!Data.cohort(c.id)) Store.set(`cohorts/${c.id}`, { id: c.id, num: c.num, name: c.name, year: c.year });
      // يظهر الإعلان المنبثق لكل زائر وقسم التسجيل تحت الواجهة الرئيسية؛ تُولَّد نصوص الإعلان تلقائياً ويعدّلها المشرف بعد ذلك من النموذج أدناه
      const a = Store.get('announcement') || {};
      Store.update('announcement', {
        cohort: c.id, enabled: true, version: Date.now(), frequency: a.frequency || 'session',
        title: `التسجيل مفتوح في ${c.name} ${c.year}`, body: `سجّل الآن مرشداً أو مستفيداً في ${c.name} من برنامج إشراق.`, button: 'سجّل الآن', link: ''
      });
      Security.log('إطلاق التسجيل في دفعة', c.name);
      toast(`فُتح التسجيل في ${c.name}: الإعلان المنبثق وقسم التسجيل ظاهران الآن`);
      syncAnnForm();
    });
  }

  /* ===== نافذة تعديل نموذج التسجيل (عائمة) ===== */
  function editField(f, done) {
    f = f || {};
    openModal({
      title: f.id ? 'تعديل عنصر في النموذج' : 'إضافة عنصر إلى النموذج', size: 'sm',
      body: `<form class="form-grid one">
        ${fieldInput({ k: 'label', label: 'العنوان أو نص الفقرة', required: true, type: f.type === 'info' ? 'textarea' : 'text' }, f.label || '')}
        <div class="field"><label>النوع</label><select name="type">${FIELD_TYPES.map(([v, l]) => `<option value="${esc(v)}" ${(f.type || 'text') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${fieldInput({ k: 'options', label: 'الخيارات (سطر لكل خيار) — لقائمة الاختيار', type: 'textarea', rows: 3 }, f.options || '')}
        ${fieldInput({ k: 'placeholder', label: 'نص إرشادي داخل الحقل (اختياري)' }, f.placeholder || '')}
        ${fieldInput({ k: 'required', label: 'حقل إلزامي', type: 'checkbox' }, f.required)}
      </form>`,
      actions: [{
        label: 'حفظ', cls: 'primary', onClick: m => {
          const form = $('form', m.body);
          if (!validateForm(form)) return false;
          const v = readForm(form);
          if (v.type === 'info') v.required = false;
          if (f.id) Store.update(`regform/fields/${f.id}`, v);
          else { const max = Math.max(0, ...Store.list('regform/fields').map(x => x.order || 0)); Store.push('regform/fields', { ...v, order: max + 1 }); }
          done && done();
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  function formEditorHtml() {
    const fields = fieldsList(), types = Object.fromEntries(FIELD_TYPES);
    const row = (f, i) => `<li data-id="${esc(f.id)}"><span class="drag"><i class="fa-solid ${f.type === 'info' ? 'fa-align-right' : 'fa-grip-lines'}"></i></span>
      <div class="sec-info"><b>${f.type === 'info' ? esc(String(f.label).slice(0, 90)) : `${esc(f.label)} ${f.required ? '<em class="req">*</em>' : ''}`}</b><small>${types[f.type] || f.type}</small></div>
      <div class="sec-actions"><button class="icon-btn" data-ff-move="-1" ${i === 0 ? 'disabled' : ''} title="أعلى"><i class="fa-solid fa-arrow-up"></i></button>
      <button class="icon-btn" data-ff-move="1" ${i === fields.length - 1 ? 'disabled' : ''} title="أسفل"><i class="fa-solid fa-arrow-down"></i></button>
      <button class="icon-btn" data-ff-edit title="تعديل"><i class="fa-solid fa-pen"></i></button>
      <button class="icon-btn danger" data-ff-del title="حذف"><i class="fa-solid fa-trash"></i></button></div></li>`;
    return `<p class="muted small">يظهر هذا النموذج لكل من يضغط «تسجيل» في الإعلان (إلا إن حدّدت رابطاً آخر للزر). أضف أو احذف الأسئلة والفقرات، ورتّبها بالأسهم.</p>
      <ul class="sortable fields enroll-fields">
        <li class="locked"><span class="drag"><i class="fa-solid fa-lock"></i></span><div class="sec-info"><b>مرشد أو مستفيد</b><small>اختيار إلزامي دائماً</small></div></li>
        <li class="locked"><span class="drag"><i class="fa-solid fa-lock"></i></span><div class="sec-info"><b>هل سبق لك التسجيل في إشراق؟ (نعم / لا)</b><small>إن اختار «نعم» يُطلب منه رقم عضويته السابق</small></div></li>
        ${fields.map(row).join('')}
      </ul>
      <div class="form-actions"><button class="btn primary" data-ff-add><i class="fa-solid fa-plus"></i> إضافة سؤال أو فقرة</button>
      <button class="btn ghost" data-ff-preview><i class="fa-solid fa-eye"></i> معاينة النموذج</button></div>`;
  }

  function openFormEditor() {
    const m = openModal({
      title: '<i class="fa-solid fa-clipboard-list"></i> نموذج التسجيل', size: 'lg', cls: 'enroll-form-modal',
      body: `<div data-ff-body>${formEditorHtml()}</div>`,
      actions: [{ label: 'تم', cls: 'primary' }],
      onClose: () => unsub()
    });
    const redraw = () => { const b = $('[data-ff-body]', m.el); if (b) b.innerHTML = formEditorHtml(); };
    const unsub = Store.subscribe(redraw);
    m.el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-ff-add]')) return editField(null);
      if (t.closest('[data-ff-preview]')) return Home.openRegistrationForm({ preview: true });
      const li = t.closest('li[data-id]'); if (!li) return;
      const f = Store.get(`regform/fields/${li.dataset.id}`); if (!f) return;
      if (t.closest('[data-ff-edit]')) return editField(f);
      if (t.closest('[data-ff-del]')) return confirmDialog(`حذف «${esc(String(f.label).slice(0, 60))}» من النموذج؟`, { danger: true, ok: 'حذف' }).then(ok => ok && Store.remove(`regform/fields/${f.id}`));
      const mv = t.closest('[data-ff-move]');
      if (mv) {
        const list = fieldsList(), i = list.findIndex(x => x.id === f.id), j = i + Number(mv.dataset.ffMove);
        if (j < 0 || j >= list.length) return;
        const a = list[i], b = list[j], upd = {};
        const oa = a.order ?? i + 1, ob = b.order ?? j + 1;
        upd[`${a.id}/order`] = oa === ob ? ob + (j > i ? 1 : -1) : ob; upd[`${b.id}/order`] = oa === ob ? oa : oa;
        Store.update('regform/fields', upd);
      }
    });
  }

  /* ===== المسجلون ===== */
  const nameOf = x => String(x.answers?.f_name || Object.values(x.answers || {}).find(Boolean) || 'مسجّل').trim();
  const emailOf = x => { const f = answerFields().find(f => f.id === 'f_email' || f.type === 'email'); return String(x.answers?.[f?.id] || '').trim(); };
  const answerHtml = (f, v) => {
    v = String(v ?? '');
    if (!v) return '<span class="muted">—</span>';
    if (f.type === 'url' || /^https?:\/\//.test(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> فتح الرابط</a>`;
    if (f.type === 'email') return `<a href="mailto:${esc(v)}" dir="ltr">${esc(v)}</a>`;
    if (f.type === 'tel') return `<a href="${esc(waLink(v))}" target="_blank" rel="noopener" dir="ltr"><i class="fa-brands fa-whatsapp"></i> ${esc(v)}</a>`;
    return nl2br(v);
  };

  function regList(role) {
    const cur = announced();
    const cf = ui.regCohort || (cur ? cur.id : 'all');
    return Store.list('registrations').filter(x => x.role === role && (cf === 'all' || (x.cohort || '') === cf)).sort((a, b) => b.ts - a.ts);
  }

  function regCard(x, h) {
    const st = x.status === 'accepted' ? '<span class="pill st-done">مقبول</span>' : x.status === 'declined' ? '<span class="pill st-absent-mentor">معتذَر</span>' : '<span class="pill st-upcoming">جديد</span>';
    const m = x.memberId && Data.member(x.memberId);
    const c = x.cohort && Data.cohort(x.cohort);
    return `<article class="reg-card ${x.status || ''} ${x.seen ? '' : 'new'}" data-reg="${esc(x.id)}">
      <header><label class="check"><input type="checkbox" data-reg-pick="${esc(x.id)}" ${ui.sel.has(x.id) ? 'checked' : ''}><span class="sr-only">تحديد</span></label>
        <div><b>${esc(nameOf(x))}</b><small class="muted">${fmtTs(x.ts)}${c ? ` · ${esc(c.name)}` : ''}${emailOf(x) ? ` · <span dir="ltr">${esc(emailOf(x))}</span>` : ''}</small></div>
        <span class="reg-badges">${x.prev ? `<span class="chip" title="مسجّل سابقاً"><i class="fa-solid fa-clock-rotate-left"></i> سبق التسجيل ${x.prevCode ? `<span dir="ltr">${esc(x.prevCode)}</span>` : ''}</span>` : ''}${st}</span></header>
      <dl class="reg-answers">${answerFields().map(f => `<div><dt>${esc(f.label)}</dt><dd>${answerHtml(f, x.answers?.[f.id])}</dd></div>`).join('')}</dl>
      <footer>${m ? `<span class="muted small"><i class="fa-solid fa-id-card"></i> ${esc(m.name)} — رقم العضوية <b class="num">${esc(m.code)}</b></span>` : ''}
        ${x.status === 'accepted' ? '' : `<button class="btn xs success" data-reg-accept="${esc(x.id)}" ${Security.can('cohorts') ? '' : 'disabled title="يتطلب صلاحية الدفعات"'}><i class="fa-solid fa-check"></i> قبول</button>`}
        ${x.status === 'declined' ? '' : `<button class="btn xs warn" data-reg-decline="${esc(x.id)}"><i class="fa-solid fa-xmark"></i> اعتذار</button>`}
        <button class="icon-btn danger" data-reg-del="${esc(x.id)}" title="حذف"><i class="fa-solid fa-trash"></i></button></footer>
    </article>`;
  }

  function regsPanel(h) {
    if (!Security.can('announce')) return '';
    const all = Store.list('registrations'), cur = announced();
    const cf = ui.regCohort || (cur ? cur.id : 'all');
    const used = new Set(all.map(x => x.cohort || '').filter(Boolean));
    const chips = [...(cur ? [{ id: cur.id, name: `${cur.name} (المعلنة)` }] : []), { id: 'all', name: 'كل الدفعات' },
      ...Data.cohorts().filter(c => used.has(c.id) && c.id !== cur?.id)];
    setTimeout(() => regList('mentor').concat(regList('mentee')).filter(x => !x.seen).forEach(x => Store.set(`registrations/${x.id}/seen`, true)), 1500);
    const section = role => {
      const list = regList(role);
      return `<section class="reg-section"><div class="block-head"><h3><i class="fa-solid ${role === 'mentor' ? 'fa-user-tie' : 'fa-user-graduate'}"></i> ${role === 'mentor' ? 'المرشدون' : 'المستفيدون'} <span class="count">${list.length}</span></h3>
        ${list.length ? `<label class="check"><input type="checkbox" data-reg-all="${role}" ${list.every(x => ui.sel.has(x.id)) ? 'checked' : ''}><span>تحديد الكل</span></label>` : ''}</div>
        ${list.length ? `<div class="reg-grid">${list.map(x => regCard(x, h)).join('')}</div>` : emptyState(`لا يوجد ${role === 'mentor' ? 'مرشدون' : 'مستفيدون'} مسجلون`, 'fa-user-plus')}</section>`;
    };
    const nSel = [...ui.sel].filter(id => Store.get(`registrations/${id}`)).length;
    return `<div class="panel" id="enroll-regs">
      <div class="panel-head"><h2><i class="fa-solid fa-user-plus"></i> المسجلون في النموذج <span class="count">${all.length}</span></h2>
        <div class="head-actions">${h.exportBar('registrations')}</div></div>
      <div class="chip-filter">${chips.map(c => `<button class="${cf === c.id ? 'active' : ''}" data-reg-cohort="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>
      <div class="reg-bar"><span class="muted small">${nSel ? `محدد: <b>${nSel}</b>` : 'حدّد مسجلين لإرسال رسالة لهم دفعة واحدة'}</span>
        <button class="btn sm primary" data-reg-mail="accept" ${nSel ? '' : 'disabled'}><i class="fa-regular fa-envelope"></i> إرسال إشعار القبول عبر الإيميل</button>
        <button class="btn sm ghost" data-reg-mail="decline" ${nSel ? '' : 'disabled'}><i class="fa-regular fa-envelope"></i> إرسال إشعار الاعتذار عبر الإيميل</button></div>
      ${section('mentor')}${section('mentee')}
    </div>`;
  }

  /* ===== بيانات البطاقة من إجابات التسجيل ===== */
  function profileFrom(x) {
    const out = {}, setIf = (k, v) => { v = String(v ?? '').trim(); if (v && !out[k]) out[k] = v; };
    answerFields().forEach(f => {
      const v = x.answers?.[f.id], L = String(f.label || '');
      if (!v) return;
      if (f.id === 'f_name' || /^(الاسم|اسم)/.test(L)) setIf('name', v);
      else if (f.id === 'f_bio' || /نبذ/.test(L)) setIf('bio', v);
      else if (f.id === 'f_email' || f.type === 'email') setIf('email', v);
      else if (f.id === 'f_phone' || f.type === 'tel' || /جوال|واتس|هاتف/.test(L)) setIf('whatsapp', toEnDigits(String(v)));
      else if (/لينكد|linkedin/i.test(L)) setIf('linkedin', v);
      else if (/تويتر|twitter/i.test(L)) setIf('twitter', v);
      else if (/انستقرام|أنستقرام|instagram/i.test(L)) setIf('instagram', v);
      else if (/موقع|website/i.test(L)) setIf('website', v);
      else if (/صورة|photo/i.test(L)) setIf('photo', v);
      else if (/سطر|مسمى|وظيف|منصب|تخصص|مهنة/.test(L)) setIf('tagline', v);
      else if (/مجال|خبر|اهتمام/.test(L)) setIf('areas', v);
    });
    if (!out.name) out.name = nameOf(x);
    return out;
  }

  const findPrev = x => {
    const code = toEnDigits(String(x.prevCode || '')).trim().toUpperCase().replace(/\s+/g, '');
    return code ? Store.list('members').find(m => String(m.code).toUpperCase() === code && m.role === x.role) || null : null;
  };

  function acceptDialog(x, h) {
    const cohorts = Data.cohorts(), cur = announced();
    const pre = x.cohort && Data.cohort(x.cohort) ? x.cohort : (cur?.id || cohorts[cohorts.length - 1]?.id || '');
    const prev = x.prev ? findPrev(x) : null;
    const data = profileFrom(x);
    const fields = PROFILE_FIELDS.map(f => ({ ...f, label: typeof f.label === 'object' ? f.label[x.role] : f.label, wide: f.type === 'textarea' || f.k === 'photo' }));
    openModal({
      title: `<i class="fa-solid fa-user-check"></i> قبول ${roleLabel(x.role)}: ${esc(data.name)}`, size: 'lg',
      body: `<form class="form-grid">
        <div class="field wide"><label>الدفعة</label><select name="__cohort">${cohorts.map(c => `<option value="${esc(c.id)}" ${c.id === pre ? 'selected' : ''}>${esc(c.name)} ${esc(c.year)}</option>`).join('')}</select></div>
        <p class="wide ${x.prev ? (prev ? 'ok-note' : 'warn-note') : 'muted'} small">${x.prev
          ? (prev ? `<i class="fa-solid fa-clock-rotate-left"></i> مسجّل سابقاً برقم العضوية <b dir="ltr">${esc(prev.code)}</b> (${esc(prev.name)}): يُعتمد رقم عضويته نفسه برمز دخول جديد، وتُؤرشف دفعته الماضية في صفحته.`
            : `<i class="fa-solid fa-triangle-exclamation"></i> ذكر أنه مسجّل سابقاً برقم «${esc(x.prevCode || '')}» لكن لم يوجد عضو بهذا الرقم وصفته؛ سيُنشأ له رقم عضوية جديد.`)
          : 'سيُنشأ رقم عضوية جديد ورمز دخول في الخطوة نفسها.'}</p>
        ${fields.map(f => fieldInput(f, data[f.k] || '')).join('')}</form>`,
      actions: [{
        label: '<i class="fa-solid fa-check"></i> قبول وإضافة للدفعة', cls: 'primary', onClick: async m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const v = readForm(f), cohortId = v.__cohort; delete v.__cohort;
          if (!cohortId) { toast('اختر الدفعة', 'error'); return false; }
          const btn = $('[data-act="0"]', m.el); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ القبول...';
          try { await accept(x, cohortId, v, prev, h); } catch (e) { console.error(e); toast('تعذّر القبول: ' + (e.message || e), 'error'); btn.disabled = false; btn.innerHTML = 'قبول وإضافة للدفعة'; return false; }
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  async function accept(x, cohortId, data, prev, h) {
    let member, secret, error = null, returning = false;
    if (prev) {
      if (prev.cohort === cohortId) throw new Error('هذا العضو مسجّل في الدفعة نفسها أصلاً');
      returning = true;
      const prevCohorts = [...new Set([...(prev.prevCohorts || []), prev.cohort].filter(Boolean))];
      Store.update(`members/${prev.id}`, { cohort: cohortId, prevCohorts, cohortSince: Date.now(), credSentAt: null });
      if (Store.get(`pairs/${prev.id}`) != null) Store.remove(`pairs/${prev.id}`);   // ارتباطه بشريكه في الدفعة الماضية انتهى
      Data.saveMember(prev.id, Object.fromEntries(Object.entries(data).filter(([, val]) => String(val ?? '').trim())));
      try { secret = await Security.regenerateCode(Data.member(prev.id)); } catch (e) { console.error(e); error = Security.authMsg(e); }
      member = Data.member(prev.id);
    } else {
      const r = await Data.addMember(x.role, cohortId, data);
      member = r; secret = r.secret; error = r.error;
    }
    Store.update(`registrations/${x.id}`, { status: 'accepted', memberId: member.id, cohort: cohortId, decidedAt: Date.now() });
    Security.log(returning ? 'قبول مسجّل سابق برمز جديد' : 'قبول مسجّل', member.name, `${roleLabel(x.role)} ${member.code} — ${Data.cohort(cohortId)?.name || cohortId}`);
    openModal({
      title: '<i class="fa-solid fa-circle-check"></i> تم القبول', size: 'sm',
      body: `<div class="success-msg"><i class="fa-solid fa-circle-check"></i><p><b>${esc(member.name)}</b> أُضيف إلى ${esc(Data.cohort(cohortId)?.name || '')}.<br>رقم العضوية: <b class="num">${esc(member.code)}</b>${secret ? `<br>رمز الدخول: <b class="num" dir="ltr">${esc(secret)}</b>` : ''}</p>
        ${returning ? '<p class="muted small">اعتُمد رقم عضويته السابق برمز دخول جديد، وتظهر دفعته الماضية مؤرشفة في صفحته.</p>' : ''}
        ${error ? `<p class="warn-note small">تعذّر إنشاء رمز الدخول: ${esc(error)}. استخدم «رمز جديد» على بطاقته في صفحة الدفعات.</p>` : ''}</div>`,
      actions: [{ label: '<i class="fa-solid fa-share-nodes"></i> مشاركة البطاقة ومعلومات الدخول', cls: 'primary', onClick: () => { setTimeout(() => h.sendCredentials(Data.member(member.id)), 220); } }, { label: 'إغلاق', cls: 'ghost' }]
    });
  }

  /* ===== رسائل القبول والاعتذار بالبريد: لأكثر من شخص بضغطة واحدة ===== */
  const MAIL_KEY = 'ishraq-mail-provider';
  const mailer = () => { const m = Store.get('certs/mailer'); return m && /^https:\/\/script\.google(usercontent)?\.com\//.test(m.url || '') && m.secret ? m : null; };
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const providers = () => ({ ...(mailer() ? { direct: 'إرسال مباشر من بريد الجمعية (لكل شخص رسالة)' } : {}), gmail: 'Gmail (في المتصفح)', outlook: 'Outlook (في المتصفح)', app: 'تطبيق البريد في جهازي (mailto)' });
  const getProvider = () => { let v = null; try { v = localStorage.getItem(MAIL_KEY); } catch { /* ignore */ } const P = providers(); return P[v] ? v : (mailer() ? 'direct' : isMobile() ? 'app' : 'gmail'); };
  const enc = encodeURIComponent;
  function composeUrl(p, { to = '', bcc = '', subject, body }) {
    if (body.length > 1500) body = body.slice(0, 1500);
    if (p === 'gmail') return `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${enc(to)}${bcc ? `&bcc=${enc(bcc)}` : ''}&su=${enc(subject)}&body=${enc(body)}`;
    if (p === 'outlook') return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}${bcc ? `&bcc=${enc(bcc)}` : ''}&subject=${enc(subject)}&body=${enc(body)}`;
    return `mailto:${to}?${bcc ? `bcc=${enc(bcc)}&` : ''}subject=${enc(subject)}&body=${enc(body)}`;
  }
  const NET_HELP = 'تعذّر الاتصال برابط سكربت البريد. تأكد أن الرابط هو رابط «تطبيق الويب» وينتهي بـ /exec، وأن النشر «من يملك الوصول: أي شخص»، وأنك أعدت نشره كنسخة جديدة بعد أي تعديل، ثم جرّب زر «اختبار الاتصال» في نافذة الإعداد';
  async function ping(m = mailer()) {
    let res; try { res = await fetch(m.url, { method: 'POST', body: JSON.stringify({ secret: m.secret, to: 'x', ping: 1 }) }); } catch { throw new Error(NET_HELP); }
    let j = null; try { j = await res.json(); } catch { throw new Error('ردّ الرابط ليس من سكربت البريد؛ تأكد من نشره كتطبيق ويب (أي شخص) وأن الرابط ينتهي بـ /exec'); }
    if (j?.error === 'auth') throw new Error('السر المحفوظ في المنصة لا يطابق SECRET داخل السكربت');
  }
  async function sendDirect(to, subject, body, m = mailer()) {
    let res;
    try { res = await fetch(m.url, { method: 'POST', body: JSON.stringify({ secret: m.secret, to, subject, body, senderName: m.name || '' }) }); }
    catch { throw new Error(NET_HELP); }
    let j = null; try { j = await res.json(); } catch { /* ignore */ }
    if (!j?.ok) throw new Error(j?.error === 'auth' ? 'السر غير مطابق للسكربت' : (j?.error || 'تعذّر الإرسال (حدّث سكربت البريد ليدعم الرسائل بلا مرفق)'));
  }

  const DEFAULT_MAIL = {
    accept: {
      subject: 'قبولك في برنامج إشراق — {cohort}',
      body: 'السلام عليكم ورحمة الله وبركاته،\n\nعزيزنا {name}،\nيسرّ إدارة برنامج إشراق إبلاغكم بقبولكم {role} في {cohort}.\n\nبيانات الدخول إلى المنصة:\nرقم العضوية: {code}\nرمز الدخول: {secret}\nرابط المنصة: {site}\n\nنتطلع لانطلاقة موفقة، ومع أطيب التمنيات،\nإدارة برنامج إشراق'
    },
    decline: {
      subject: 'بخصوص تسجيلكم في برنامج إشراق',
      body: 'السلام عليكم ورحمة الله وبركاته،\n\nعزيزنا {name}،\nنشكر لكم اهتمامكم بالتسجيل في برنامج إشراق ({cohort})، ونأسف لإبلاغكم بتعذّر قبولكم في هذه الدفعة لاكتمال العدد المطلوب.\nندعوكم للتسجيل في الدفعات القادمة، ونتمنى لكم التوفيق.\n\nمع خالص التقدير،\nإدارة برنامج إشراق'
    }
  };
  const PERSONAL = /\{(name|code|secret)\}/;
  const fillMail = (t, x) => {
    const mem = x.memberId && Data.member(x.memberId), c = Data.cohort(x.cohort) || announced();
    const v = { name: nameOf(x), role: x.role === 'mentor' ? 'مرشداً' : 'مستفيداً', cohort: c ? `${c.name} ${c.year}` : 'الدفعة القادمة', code: mem?.code || '', secret: (mem && Store.get(`secrets/codes/${mem.id}`)) || '', site: siteUrl() };
    return String(t).replace(/\{(name|role|cohort|code|secret|site)\}/g, (_, k) => v[k]);
  };

  function mailDialog(kind) {
    const list = [...ui.sel].map(id => Store.get(`registrations/${id}`)).filter(Boolean);
    if (!list.length) return toast('حدّد مسجلاً واحداً على الأقل', 'error');
    const withMail = list.filter(emailOf), without = list.length - withMail.length;
    if (!withMail.length) return toast('لا يوجد بريد مسجل لأي من المحددين', 'error');
    const T = DEFAULT_MAIL[kind];
    const m = openModal({
      title: `<i class="fa-regular fa-envelope"></i> ${kind === 'accept' ? 'إشعار القبول' : 'إشعار الاعتذار'} — ${withMail.length} ${withMail.length === 1 ? 'شخص' : 'أشخاص'}`, size: 'lg',
      body: `<div class="mail-rcpt">${withMail.map(x => `<span class="chip">${esc(nameOf(x))} <small dir="ltr">${esc(emailOf(x))}</small></span>`).join('')}</div>
        ${without ? `<p class="warn-note small">${without} من المحددين بلا بريد مسجل ولن تصلهم الرسالة.</p>` : ''}
        <form class="form-grid one">
          <div class="field"><label>العنوان</label><input name="subject" value="${esc(T.subject)}"></div>
          <div class="field"><label>نص الرسالة (يمكنك تعديله)</label><textarea name="body" rows="11">${esc(T.body)}</textarea>
            <small class="hint">المتغيرات: <code>{name}</code> الاسم، <code>{role}</code> الصفة، <code>{cohort}</code> الدفعة، <code>{code}</code> رقم العضوية، <code>{secret}</code> رمز الدخول، <code>{site}</code> رابط المنصة. تُستبدل لكل شخص على حدة.</small></div>
          <div class="field mail-provider"><label>طريقة الإرسال</label><select name="provider">${Object.entries(providers()).map(([k, l]) => `<option value="${k}" ${getProvider() === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" name="bcc"><span>رسالة واحدة للجميع بنسخة مخفية (BCC) — متاحة لغير الإرسال المباشر عندما لا تحتوي الرسالة على متغيرات خاصة بكل شخص</span></label>
        </form>`,
      actions: [{
        label: '<i class="fa-solid fa-paper-plane"></i> إرسال', cls: 'primary', onClick: async mm => {
          const f = $('form', mm.body), subject = f.subject.value.trim(), body = f.body.value, provider = f.provider.value, bcc = f.bcc.checked;
          if (!subject || !body.trim()) { toast('اكتب العنوان والنص', 'error'); return false; }
          try { localStorage.setItem(MAIL_KEY, provider); } catch { /* ignore */ }
          const btn = $('[data-act="0"]', mm.el); btn.disabled = true;
          const stamp = xs => xs.forEach(x => Store.update(`registrations/${x.id}`, { mailedAt: Date.now() }));
          if (provider === 'direct') {
            let ok = 0, fail = [];
            for (const x of withMail) {
              try { await sendDirect(emailOf(x), fillMail(subject, x), fillMail(body, x)); ok++; stamp([x]); } catch (e) { fail.push(`${nameOf(x)}: ${e.message}`); }
            }
            Security.log(kind === 'accept' ? 'إرسال إشعار قبول' : 'إرسال إشعار اعتذار', `${ok} رسالة`);
            if (fail.length) { toast(`أُرسلت ${ok} وتعذّر ${fail.length}: ${fail[0]}`, 'error'); btn.disabled = false; return false; }
            toast(`أُرسلت ${ok} رسالة مباشرة`); return;
          }
          if (bcc && !PERSONAL.test(subject + body) && !/\{(code|secret)\}/.test(body)) {
            const all = withMail.map(emailOf).join(',');
            window.open(composeUrl(provider, { bcc: all, subject: fillMail(subject, withMail[0]), body: fillMail(body, withMail[0]) }), '_blank', 'noopener');
            stamp(withMail); toast('فُتحت رسالة واحدة لكل المحددين (نسخة مخفية)'); return;
          }
          // لكل شخص رسالته: تُفتح بضغطة على اسمه (حتى لا يحجب المتصفح النوافذ)
          mm.close();
          queueDialog(withMail, subject, body, provider, stamp);
          return false;
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
    return m;
  }

  function queueDialog(list, subject, body, provider, stamp) {
    openModal({
      title: '<i class="fa-regular fa-envelope"></i> رسائل القبول والاعتذار', size: 'md',
      body: `<p class="muted small">اضغط «إرسال» أمام كل اسم لفتح رسالته جاهزة بعنوانه ونصه.</p>
        <ul class="mail-queue">${list.map(x => `<li><span><b>${esc(nameOf(x))}</b><small dir="ltr">${esc(emailOf(x))}</small></span><button class="btn xs primary" data-q="${esc(x.id)}"><i class="fa-regular fa-paper-plane"></i> إرسال</button></li>`).join('')}</ul>`,
      actions: [{ label: 'تم', cls: 'primary' }],
      onOpen: m => m.body.addEventListener('click', e => {
        const b = e.target.closest('[data-q]'); if (!b) return;
        const x = list.find(y => y.id === b.dataset.q); if (!x) return;
        const url = composeUrl(provider, { to: emailOf(x), subject: fillMail(subject, x), body: fillMail(body, x) });
        if (provider === 'app') { const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); a.remove(); } else window.open(url, '_blank', 'noopener');
        stamp([x]); b.outerHTML = '<span class="pill st-done"><i class="fa-solid fa-check"></i> فُتحت</span>';
      })
    });
  }

  /* ===== الربط ===== */
  const rerender = () => window.dispatchEvent(new Event('ishraq-rerender'));
  let H = {};   // دوال من لوحة الإدارة: التصدير، مشاركة بيانات الدخول، نموذج نافذة الإعلان
  function panel(h) {
    H = h;
    // أول استخدام: نبدأ نموذج التسجيل بالحقول الأساسية (الاسم والجوال والإيميل والنبذة) ثم يعدّلها المشرف
    if (Security.can('announce') && !Store.list('regform/fields').length && !Store.get('regform/seeded')) {
      DEFAULT_FORM_FIELDS.forEach(f => Store.set(`regform/fields/${f.id}`, { ...f }));
      Store.set('regform/seeded', true);
    }
    return `<div id="enroll-root">${cohortPanel()}${h.announcementForm()}${regsPanel(h)}</div>`;
  }

  document.addEventListener('click', e => {
    const root = $('#enroll-root'); if (!root) return;
    const t = e.target, h = H;
    if (t.closest('[data-enroll-form]')) return openFormEditor();
    if (t.closest('[data-enroll-launch]')) return launchRegistration(root);
    if (t.closest('[data-enroll-close]')) return confirmDialog('إيقاف التسجيل؟ يختفي الإعلان المنبثق وقسم التسجيل من الصفحة الرئيسية، ويرجع زر التسجيل في الأعلى إلى «سجّل اهتمامك».', { danger: true, ok: 'إيقاف التسجيل' }).then(ok => { if (ok) { Store.update('announcement', { cohort: null, enabled: false }); Security.log('إيقاف التسجيل'); toast('أُوقف التسجيل'); syncAnnForm(); } });
    const cc = t.closest('[data-reg-cohort]'); if (cc) { ui.regCohort = cc.dataset.regCohort; ui.sel.clear(); return rerender(); }
    const acc = t.closest('[data-reg-accept]'); if (acc) return acceptDialog(Store.get(`registrations/${acc.dataset.regAccept}`), h);
    const dec = t.closest('[data-reg-decline]');
    if (dec) return confirmDialog('تسجيل الاعتذار لهذا المسجّل؟ (لا تُرسل له رسالة إلا بزر الإيميل)', { ok: 'اعتذار' }).then(ok => ok && Store.update(`registrations/${dec.dataset.regDecline}`, { status: 'declined', decidedAt: Date.now() }));
    const del = t.closest('[data-reg-del]');
    if (del) return confirmDialog('حذف هذا التسجيل؟', { danger: true, ok: 'حذف' }).then(ok => { if (ok) { ui.sel.delete(del.dataset.regDel); Store.remove(`registrations/${del.dataset.regDel}`); } });
    const ml = t.closest('[data-reg-mail]'); if (ml && !ml.disabled) return mailDialog(ml.dataset.regMail);
  });
  document.addEventListener('change', e => {
    const root = $('#enroll-root'); if (!root) return;
    const t = e.target;
    if (t.matches('[data-enroll-pick]')) return $$('[data-enroll-custom]', root).forEach(el => { el.hidden = t.value !== '__custom'; });
    if (t.matches('[data-reg-pick]')) { t.checked ? ui.sel.add(t.dataset.regPick) : ui.sel.delete(t.dataset.regPick); return rerender(); }
    if (t.matches('[data-reg-all]')) { regList(t.dataset.regAll).forEach(x => (t.checked ? ui.sel.add(x.id) : ui.sel.delete(x.id))); return rerender(); }
  });

  return { panel, openFormEditor, announced, mailer, sendDirect, ping };
})();
