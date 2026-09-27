/* الفعاليات وورش العمل: إعلانات الصفحة الرئيسية وتسجيل الحضور وإدارتها */

const Events = (() => {
  const DURATIONS = [[30, '30 دقيقة'], [45, '45 دقيقة'], [60, 'ساعة'], [90, 'ساعة ونصف'], [120, 'ساعتان'], [150, 'ساعتان ونصف'], [180, '3 ساعات'], [240, '4 ساعات'], [300, '5 ساعات'], [360, '6 ساعات']];
  const durLabel = m => (DURATIONS.find(d => d[0] === +m) || [0, `${m} دقيقة`])[1];
  const INTEREST = {
    mentor: { label: 'مرشد', icon: 'fa-user-tie', desc: 'من ذوي الخبرة المهنية أو الأكاديمية، ويرغب بمشاركة خبرته وتوجيه الطلاب والخريجين عبر جلسات إرشادية فردية.' },
    mentee: { label: 'مستفيد', icon: 'fa-user-graduate', desc: 'طالب جامعي أو خريج أو مبتعث، يبحث عن توجيه أكاديمي ومهني يساعده على بناء مساره وتطوير مهاراته.' }
  };
  const ui = { open: new Set(), openGeneral: false };

  const pad2 = n => String(n).padStart(2, '0');
  function endTime(e) {
    const [h, m] = String(e.start || '00:00').split(':').map(Number);
    const t = h * 60 + m + (+e.duration || 60);
    return `${pad2(Math.floor(t / 60) % 24)}:${pad2(t % 60)}`;
  }
  const endsAt = e => dateTimeOf(e.date, e.start).getTime() + (+e.duration || 60) * 60000;
  const isOver = e => Date.now() > endsAt(e);
  const all = () => Store.list('events').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const upcomingPublished = () => all().filter(e => e.published !== false && !isOver(e));
  const regs = eventId => Store.list('eventRegs').filter(r => r.eventId === eventId).sort((a, b) => b.ts - a.ts);

  function speakerOf(e) {
    if (e.speakerType === 'mentor') {
      const m = Data.member(e.speakerId);
      return m ? { name: m.name, tagline: m.tagline, bio: m.bio, photo: m.photo, mentor: true } : null;
    }
    if (e.speakerType === 'other' && e.speaker?.name) return e.speaker;
    return null;
  }

  /* ================= الصفحة الرئيسية ================= */
  function regForm(eventId) {
    const choice = k => `<button type="button" class="ev-choice" data-ev-interest="${k}" aria-pressed="false">
      <i class="fa-solid ${INTEREST[k].icon}"></i><b>${INTEREST[k].label}</b><small>${INTEREST[k].desc}</small></button>`;
    return `<form class="ev-form" data-event-form="${esc(eventId)}" novalidate>
      <div class="ev-fields">
        ${fieldInput({ k: 'name', label: 'الاسم', required: true })}
        ${fieldInput({ k: 'phone', label: 'الجوال', type: 'tel', required: true })}
        ${fieldInput({ k: 'email', label: 'الإيميل', type: 'email', required: true })}
      </div>
      <div class="ev-q"><p>هل أنت مهتم بالمشاركة في الدفعات القادمة من إشراق؟ <small>(اختياري)</small></p>
        <input type="hidden" name="interest" value="">
        <div class="ev-choices">${choice('mentor')}${choice('mentee')}</div></div>
      <button class="btn primary lg ev-submit" type="submit"><i class="fa-solid fa-paper-plane"></i> سجّل اهتمامي</button>
      <div class="ev-done" hidden><i class="fa-solid fa-circle-check"></i> تم تسجيلك بنجاح، شكراً لاهتمامك!</div>
    </form>`;
  }

  function eventCard(e) {
    const sp = speakerOf(e);
    const locUrl = String(e.locationUrl || '').trim();
    return `<article class="ev-card reveal">
      <div class="ev-info">
        <span class="ev-badge"><i class="fa-solid fa-person-chalkboard"></i> ${esc(e.kind || 'ورشة عمل')}</span>
        <h3 class="ev-title">${esc(e.title)}</h3>
        ${e.about ? `<p class="ev-about">${nl2br(e.about)}</p>` : ''}
        <ul class="ev-meta">
          <li><i class="fa-regular fa-calendar"></i><span><small>اليوم والتاريخ</small><b>${fmtDate(e.date)}</b></span></li>
          <li><i class="fa-regular fa-clock"></i><span><small>الوقت</small><b>${tRange(e.start, endTime(e))}</b></span></li>
          <li><i class="fa-solid fa-hourglass-half"></i><span><small>المدة</small><b>${durLabel(e.duration)}</b></span></li>
          ${e.location ? `<li><i class="fa-solid fa-location-dot"></i><span><small>الموقع</small><b>${locUrl ? `<a href="${esc(locUrl)}" target="_blank" rel="noopener">${esc(e.location)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : esc(e.location)}</b></span></li>` : ''}
        </ul>
        ${sp ? `<div class="ev-speaker"><small class="ev-label">المتحدث</small>
          <div class="ev-sp-head">${avatar(sp, 'lg')}<div><b>${esc(sp.name)}</b>${sp.tagline ? `<span>${esc(sp.tagline)}</span>` : ''}${sp.mentor ? '<em class="chip">من مرشدي إشراق</em>' : ''}</div></div>
          ${sp.bio ? `<p class="ev-sp-bio">${nl2br(sp.bio)}</p>` : ''}</div>` : ''}
      </div>
      <div class="ev-reg"><h4><i class="fa-solid fa-ticket"></i> سجّل حضورك</h4>${regForm(e.id)}</div>
    </article>`;
  }

  function section(s) {
    const list = upcomingPublished();
    const body = list.length
      ? `<div class="ev-list">${list.map(eventCard).join('')}</div>`
      : `<div class="ev-card ev-empty reveal">
          <div class="ev-info ev-teaser"><span class="ev-teaser-ic"><i class="fa-solid fa-bell"></i></span>
            <h3 class="ev-title">${esc(s.emptyTitle || 'ترقبونا')}</h3>
            <p class="ev-about">${nl2br(s.emptyBody || 'كن أول من يعلم عن الفعالية القادمة، سجّل بياناتك وسنرسل لك التفاصيل فور الإعلان عنها.')}</p></div>
          <div class="ev-reg"><h4><i class="fa-solid fa-bell"></i> أعلمني بالفعالية القادمة</h4>${regForm('general')}</div>
        </div>`;
    return `<section class="sec events-sec" id="sec-${s.id}"><div class="container">
      <div class="sec-head reveal">${s.kicker ? `<span class="kicker">${esc(s.kicker)}</span>` : ''}<h2>${esc(s.title || 'فعالية قادمة')}</h2>${s.subtitle ? `<p class="sec-sub">${esc(s.subtitle)}</p>` : ''}</div>
      ${body}
    </div></section>`;
  }

  function submit(form) {
    if (!validateForm(form)) return;
    const v = readForm(form);
    const eventId = form.dataset.eventForm;
    const ev = eventId === 'general' ? null : Store.get(`events/${eventId}`);
    if (ev && (ev.published === false || isOver(ev))) return toast('انتهى التسجيل في هذه الفعالية', 'error');
    Store.push('eventRegs', { eventId, name: v.name, phone: v.phone, email: v.email, interest: v.interest || '', ts: Date.now() });
    // المهتمون بالانضمام يُضافون إلى تبويب «المهتمون»
    if (v.interest === 'mentor' || v.interest === 'mentee') {
      Store.push('interests', {
        role: v.interest, ts: Date.now(),
        answers: { f_name: v.name, f_phone: v.phone, f_email: v.email },
        source: ev ? `فعالية: ${ev.title}` : 'تسجيل الفعاليات العام'
      });
    }
    Data.notify('admin', ev ? `تسجيل جديد في فعالية «${ev.title}»: ${v.name}` : `تسجيل اهتمام عام بالفعاليات: ${v.name}`, { icon: 'fa-ticket' });
    form.reset();
    $$('.ev-choice', form).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    $('[name=interest]', form).value = '';
    const done = $('.ev-done', form);
    done.hidden = false;
    setTimeout(() => { done.hidden = true; }, 6000);
    toast('تم تسجيلك بنجاح');
  }

  document.addEventListener('click', e => {
    const c = e.target.closest('.ev-choice');
    if (!c) return;
    const form = c.closest('form');
    const on = !c.classList.contains('on');
    $$('.ev-choice', form).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    if (on) { c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); }
    $('[name=interest]', form).value = on ? c.dataset.evInterest : '';
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-event-form]');
    if (!f) return;
    e.preventDefault();
    submit(f);
  });

  /* ================= لوحة الإدارة ================= */
  const rerender = () => { const r = document.getElementById('app'); if (Auth.current()?.kind === 'admin') Admin.render(r); };

  function regsTable(list, key) {
    if (!list.length) return emptyState('لا توجد تسجيلات بعد', 'fa-ticket');
    return `<div class="table-wrap"><table class="table rtable"><thead><tr><th>الاسم</th><th>الجوال</th><th>الإيميل</th><th>مهتم بالانضمام</th><th>تاريخ التسجيل</th><th></th></tr></thead><tbody>
      ${list.map(r => `<tr class="${r.seen ? '' : 'new'}"><td data-l="الاسم"><b>${esc(r.name)}</b></td>
        <td data-l="الجوال"><a href="${esc(waLink(r.phone))}" target="_blank" rel="noopener" dir="ltr"><i class="fa-brands fa-whatsapp"></i> ${esc(r.phone)}</a></td>
        <td data-l="الإيميل"><a href="mailto:${esc(r.email)}" dir="ltr">${esc(r.email)}</a></td>
        <td data-l="مهتم بالانضمام">${r.interest ? `<span class="chip ${r.interest}">${INTEREST[r.interest].label}</span>` : '—'}</td>
        <td data-l="تاريخ التسجيل"><small>${fmtTs(r.ts)}</small></td>
        <td><button class="icon-btn danger" data-ev-delreg="${r.id}" title="حذف"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function panel() {
    const list = all().slice().reverse();
    const general = regs('general');
    // تعليم التسجيلات كمقروءة بعد فتح التبويب
    setTimeout(() => Store.list('eventRegs').filter(r => !r.seen).forEach(r => Store.set(`eventRegs/${r.id}/seen`, true)), 1500);
    const status = e => e.published === false ? '<span class="pill st-overdue">مخفي</span>'
      : isOver(e) ? '<span class="pill st-absent-mentee">انتهت</span>' : '<span class="pill st-done">منشور</span>';
    return `<div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-person-chalkboard"></i> الفعاليات وورش العمل</h2>
        <div class="head-actions">${exportBar('events')}<button class="btn primary" data-ev-add><i class="fa-solid fa-plus"></i> إضافة فعالية</button></div></div>
      <p class="muted small">تظهر الفعاليات المنشورة القادمة في قسم «فعالية قادمة» بالصفحة الرئيسية مع نموذج تسجيل الحضور. «إخفاء الإعلان» يوقف ظهوره والتسجيل فيه دون حذفه، والفعالية التي انتهى موعدها تختفي من الصفحة الرئيسية تلقائياً.</p>
      ${list.length ? `<div class="ev-admin-list">${list.map(e => {
        const sp = speakerOf(e);
        const r = regs(e.id);
        const open = ui.open.has(e.id);
        return `<div class="ev-admin ${open ? 'open' : ''} ${e.published === false ? 'is-hidden' : ''}">
          <div class="ev-admin-head">
            <div class="ev-admin-info"><div class="ev-admin-title"><b>${esc(e.title)}</b> ${status(e)}</div>
              <small><i class="fa-regular fa-calendar"></i> ${fmtDate(e.date)} · ${tRange(e.start, endTime(e))} · ${durLabel(e.duration)}${e.location ? ` · <i class="fa-solid fa-location-dot"></i> ${esc(e.location)}` : ''}</small>
              ${sp ? `<div class="ev-admin-sp">${miniMember(sp)}</div>` : ''}</div>
            <div class="ev-admin-actions">
              <button class="btn sm ${open ? 'primary' : 'ghost'}" data-ev-toggle="${e.id}"><i class="fa-solid fa-users"></i> المسجلون <span class="count">${r.length}</span></button>
              <button class="btn sm ghost" data-ev-vis="${e.id}"><i class="fa-solid ${e.published === false ? 'fa-eye' : 'fa-eye-slash'}"></i> ${e.published === false ? 'إظهار الإعلان' : 'إخفاء الإعلان'}</button>
              <button class="icon-btn" data-ev-edit="${e.id}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
              <button class="icon-btn danger" data-ev-del="${e.id}" title="حذف"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          ${open ? `<div class="ev-regs"><div class="block-head"><h3>المسجلون في «${esc(e.title)}» <span class="count">${r.length}</span></h3>${exportBar(`event:${e.id}`)}</div>${regsTable(r)}</div>` : ''}
        </div>`;
      }).join('')}</div>` : emptyState('لم تتم إضافة فعاليات بعد', 'fa-person-chalkboard')}
    </div>
    <div class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-bell"></i> التسجيل العام <span class="count">${general.length}</span></h2>${exportBar('event:general')}</div>
      <p class="muted small">المسجلون من قسم «فعالية قادمة» عندما لا يوجد إعلان منشور، ليُبلَّغوا بالفعالية القادمة.</p>
      ${regsTable(general)}
    </div>`;
  }

  function speakerPicker(e) {
    const mentors = Data.members('mentor');
    const cur = e.speakerType === 'mentor' ? Data.member(e.speakerId) : null;
    const label = cur ? miniMember(cur) : e.speakerType === 'other' ? '<span><i class="fa-solid fa-user-pen"></i> آخر (من خارج المرشدين)</span>' : '<span class="muted">— اختر المتحدث —</span>';
    return `<div class="field wide"><label>المتحدث</label>
      <div class="sp-picker">
        <input type="hidden" name="speakerType" value="${esc(e.speakerType || '')}"><input type="hidden" name="speakerId" value="${esc(e.speakerId || '')}">
        <button type="button" class="sp-current">${label}<i class="fa-solid fa-chevron-down"></i></button>
        <div class="sp-panel" hidden>
          <div class="sp-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="ابحث باسم المرشد أو مجاله..." autocomplete="off"></div>
          <ul class="sp-list">
            ${mentors.map(m => `<li data-sp-id="${m.id}" data-q="${esc((m.name + ' ' + (m.tagline || '') + ' ' + (m.areas || '')).toLowerCase())}">${miniMember(m)}<small class="sp-cohort">${esc(Data.cohort(m.cohort)?.name || '')}</small></li>`).join('')}
            ${mentors.length ? '' : '<li class="sp-empty">لا يوجد مرشدون مسجلون بعد</li>'}
            <li data-sp-other class="sp-other-opt"><i class="fa-solid fa-user-pen"></i> <b>آخر</b> <small>متحدث من خارج مرشدي المنصة</small></li>
            <li data-sp-none class="sp-none-opt"><i class="fa-solid fa-ban"></i> بدون متحدث</li>
          </ul>
        </div>
      </div></div>
      <fieldset class="sp-other wide" ${e.speakerType === 'other' ? '' : 'hidden'}><legend>بيانات المتحدث</legend><div class="form-grid">
        ${fieldInput({ k: 'sp_name', label: 'الاسم' }, e.speaker?.name || '')}
        ${fieldInput({ k: 'sp_tagline', label: 'السطر التعريفي' }, e.speaker?.tagline || '')}
        ${fieldInput({ k: 'sp_photo', label: 'رابط الصورة من Google Drive', type: 'url', wide: true }, e.speaker?.photo || '')}
        ${fieldInput({ k: 'sp_bio', label: 'النبذة التعريفية', type: 'textarea', rows: 3, wide: true }, e.speaker?.bio || '')}
      </div></fieldset>`;
  }

  function wirePicker(root) {
    const pk = $('.sp-picker', root);
    const panel = $('.sp-panel', pk), search = $('.sp-search input', pk);
    const set = (type, id, html) => {
      $('[name=speakerType]', pk).value = type; $('[name=speakerId]', pk).value = id;
      $('.sp-current', pk).innerHTML = html + '<i class="fa-solid fa-chevron-down"></i>';
      $('.sp-other', root).hidden = type !== 'other';
      panel.hidden = true;
    };
    $('.sp-current', pk).onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) { search.value = ''; search.dispatchEvent(new Event('input')); search.focus(); } };
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      $$('[data-sp-id]', pk).forEach(li => { li.hidden = q && !li.dataset.q.includes(q); });
    };
    pk.addEventListener('click', ev => {
      const li = ev.target.closest('[data-sp-id]');
      if (li) return set('mentor', li.dataset.spId, miniMember(Data.member(li.dataset.spId)));
      if (ev.target.closest('[data-sp-other]')) { set('other', '', '<span><i class="fa-solid fa-user-pen"></i> آخر (من خارج المرشدين)</span>'); $('[name=sp_name]', root).focus(); return; }
      if (ev.target.closest('[data-sp-none]')) set('', '', '<span class="muted">بدون متحدث</span>');
    });
    root.addEventListener('mousedown', ev => { if (!pk.contains(ev.target)) panel.hidden = true; });
  }

  function edit(e) {
    e = e || { published: true, duration: 90, start: '19:00' };
    openModal({
      title: `<i class="fa-solid fa-person-chalkboard"></i> ${e.id ? 'تعديل الفعالية' : 'إضافة فعالية'}`, size: 'lg',
      body: `<form class="form-grid ev-editor">
        ${fieldInput({ k: 'title', label: 'عنوان الورشة / الفعالية', required: true, wide: true }, e.title || '')}
        ${fieldInput({ k: 'kind', label: 'نوع الفعالية', placeholder: 'ورشة عمل، لقاء، محاضرة...' }, e.kind || 'ورشة عمل')}
        <label class="switch"><input type="checkbox" name="published" ${e.published !== false ? 'checked' : ''}><span></span> نشر الإعلان في الصفحة الرئيسية</label>
        ${fieldInput({ k: 'about', label: 'نبذة عن الفعالية', type: 'textarea', rows: 4, wide: true }, e.about || '')}
        <div class="field"><label>التاريخ <em>*</em></label><input type="date" name="date" value="${esc(e.date || '')}" required></div>
        <div class="field"><label>ساعة البداية (24 ساعة)</label>${timeSelect('start', e.start || '19:00')}</div>
        <div class="field"><label>المدة</label><select name="duration">${DURATIONS.map(([v, l]) => `<option value="${v}" ${+e.duration === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${fieldInput({ k: 'location', label: 'الموقع', placeholder: 'مثال: قاعة الجمعية، أو عن بُعد عبر Zoom' }, e.location || '')}
        ${fieldInput({ k: 'locationUrl', label: 'رابط الموقع أو الاجتماع (اختياري)', type: 'url', wide: true }, e.locationUrl || '')}
        ${speakerPicker(e)}
      </form>`,
      actions: [{
        label: 'حفظ الفعالية', cls: 'primary', onClick: m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const v = readForm(f);
          const data = {
            title: v.title, kind: v.kind, about: v.about, date: v.date, start: readTime(f, 'start'), duration: +v.duration,
            location: v.location, locationUrl: v.locationUrl, published: !!v.published,
            speakerType: v.speakerType || '', speakerId: v.speakerType === 'mentor' ? v.speakerId : '',
            speaker: v.speakerType === 'other' ? { name: v.sp_name, tagline: v.sp_tagline, bio: v.sp_bio, photo: v.sp_photo } : null
          };
          if (data.speakerType === 'other' && !data.speaker.name) { toast('اكتب اسم المتحدث', 'error'); return false; }
          if (e.id) Store.update(`events/${e.id}`, data);
          else Store.push('events', { ...data, ts: Date.now() });
          toast('تم حفظ الفعالية');
        }
      }, { label: 'إلغاء', cls: 'ghost' }],
      onOpen: m => wirePicker(m.body)
    });
  }

  document.addEventListener('click', async ev => {
    const t = ev.target;
    if (!t.closest('.dash.admin')) return;
    if (t.closest('[data-ev-add]')) return edit();
    const ed = t.closest('[data-ev-edit]'); if (ed) return edit(Store.get(`events/${ed.dataset.evEdit}`));
    const vis = t.closest('[data-ev-vis]');
    if (vis) { const e = Store.get(`events/${vis.dataset.evVis}`); Store.set(`events/${e.id}/published`, e.published === false); return toast(e.published === false ? 'تم إظهار الإعلان' : 'تم إخفاء الإعلان وإيقاف التسجيل'); }
    const tg = t.closest('[data-ev-toggle]');
    if (tg) { const id = tg.dataset.evToggle; ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id); return rerender(); }
    const del = t.closest('[data-ev-del]');
    if (del) {
      const e = Store.get(`events/${del.dataset.evDel}`);
      const n = regs(e.id).length;
      if (!(await confirmDialog(`حذف فعالية «${esc(e.title)}»${n ? ` وبيانات ${n} مسجلاً فيها` : ''} نهائياً؟`, { danger: true, ok: 'حذف' }))) return;
      regs(e.id).forEach(r => Store.remove(`eventRegs/${r.id}`));
      return Store.remove(`events/${e.id}`);
    }
    const dr = t.closest('[data-ev-delreg]');
    if (dr && await confirmDialog('حذف هذا التسجيل؟', { danger: true, ok: 'حذف' })) Store.remove(`eventRegs/${dr.dataset.evDelreg}`);
  });

  function exportData(key) {
    const [, id] = key.split(':');
    const headers = ['الاسم', 'الجوال', 'الإيميل', 'مهتم بالانضمام', 'تاريخ التسجيل'];
    const rows = list => list.map(r => [r.name, r.phone, r.email, r.interest ? INTEREST[r.interest].label : '', fmtTs(r.ts)]);
    if (key === 'events') {
      return {
        title: 'الفعاليات وورش العمل',
        headers: ['العنوان', 'النوع', 'التاريخ', 'الوقت', 'المدة', 'الموقع', 'المتحدث', 'الحالة', 'عدد المسجلين'],
        rows: all().map(e => [e.title, e.kind, fmtDate(e.date), `${e.start} - ${endTime(e)}`, durLabel(e.duration), e.location, speakerOf(e)?.name || '',
          e.published === false ? 'مخفي' : isOver(e) ? 'انتهت' : 'منشور', regs(e.id).length])
      };
    }
    if (id === 'general') return { title: 'التسجيل العام في الفعاليات', headers, rows: rows(regs('general')) };
    const e = Store.get(`events/${id}`);
    return { title: `المسجلون في «${e?.title || ''}»`, headers, rows: rows(regs(id)) };
  }

  const unseen = () => Store.list('eventRegs').filter(r => !r.seen).length;

  return { section, panel, exportData, unseen };
})();
