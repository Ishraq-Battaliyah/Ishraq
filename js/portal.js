/* لوحات المرشد والمستفيد */

const Portal = (() => {
  const isDue = b => Date.now() >= dateTimeOf(b.date, b.start).getTime();
  const reviewStatus = { pending: ['بانتظار اعتماد الإدارة', 'st-upcoming'], approved: ['معتمد', 'st-done'], rejected: ['غير معتمد', 'st-absent-mentor'] };

  function render(root, kind, id) {
    const me = Data.member(id);
    if (!me || me.role !== kind) { Auth.logout(); return; }
    // المرشد قد يكون له عدة مستفيدين، والمستفيد له مرشد واحد
    const others = kind === 'mentor' ? Data.menteesOf(me.id) : [Data.mentorOf(me.id)].filter(Boolean);
    const other = others[0] || null;
    // بيانات تواصل الطرف المرتبط تُقرأ من مسار خاص تسمح به القواعد لهذا العضو فقط
    if (String(Store.scope || '').startsWith('member:')) others.forEach(o => Store.watch(`contacts/${o.id}`));
    const otherLabel = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    const bookings = Data.bookings({ ...(kind === 'mentor' ? { mentorId: me.id } : { menteeId: me.id }), cohort: me.cohort });
    const cstate = Bands.state(me.cohort);   // prelaunch | live | archived
    const msgs = Data.messagesFor(me);

    root.innerHTML = `<div class="dash member-portal ${kind}">
      ${topbar(kind, me)}
      <main class="container dash-main">
        ${kind === 'mentor' ? mentorAlerts(me) : ''}
        <section class="dash-hello">
          <div>${avatar(me, 'lg')}</div>
          <div><small>${kind === 'mentor' ? 'لوحة تحكم المرشد' : 'لوحة تحكم المستفيد'} · ${esc(Data.cohort(me.cohort)?.name || '')}</small>
          <h1>أهلاً، ${esc(me.name)}</h1><span class="code-chip">${esc(me.code)}</span></div>
          <div class="hello-stats">${(me.prevCohorts || []).length ? '<button class="btn light sm" data-open-archive><i class="fa-solid fa-box-archive"></i> الدفعات السابقة</button>' : ''}${progressRing(bookings.filter(b => b.status === 'done').length, others.length)}</div>
        </section>

        ${notifyPrefPanel(me)}

        ${cohortBanner(me, cstate)}

        ${Certs.memberSection(me)}

        ${Events.portalSection(me)}

        ${Support.memberSection(me)}

        ${msgs.length ? `<section class="panel msgs"><h2><i class="fa-solid fa-envelope-open-text"></i> رسائل من الإدارة</h2>
          <ul class="msg-list">${msgs.map(x => `<li><i class="fa-solid fa-bullhorn"></i><div>${x.title ? `<b>${esc(x.title)}</b>` : ''}<p>${nl2br(x.body)}</p><small>${fmtTs(x.ts)}</small></div></li>`).join('')}</ul></section>` : ''}

        <section class="panel">
          <h2><i class="fa-solid fa-id-card"></i> البطاقات التعريفية</h2>
          <div class="pair-cards">
            <div><h3 class="sub">بطاقتي</h3>${memberCard(me, { actions: '<button class="btn sm primary" data-edit-me><i class="fa-solid fa-pen"></i> تعديل بياناتي</button><button class="btn sm ghost" data-download-card title="حفظ البطاقة كصورة PNG لمشاركتها"><i class="fa-solid fa-download"></i> حفظ البطاقة</button>' })}</div>
            <div class="pair-link"><i class="fa-solid fa-handshake"></i></div>
            <div><h3 class="sub">${others.length > 1 ? 'المستفيدون المخصصون لك' : `${otherLabel} المخصص لك`} ${others.length > 1 ? `<span class="count">${others.length}</span>` : ''}</h3>${others.length ? `<div class="others-stack">${others.map(o => memberCard(o, { showCode: false })).join('')}</div>` : emptyState(`لم يتم تعيين ${otherLabel} لك بعد من قبل الإدارة`, 'fa-user-clock')}</div>
          </div>
        </section>

        ${kind === 'mentor' ? slotsPanel(me) : bookingPanel(me, other)}
        ${kind === 'mentor' ? mentorWishesPanel(me) : menteeWishesPanel(me, other)}
        ${scheduledPanel(kind, me, other, bookings)}
        ${kind === 'mentor' ? extraMentorPanel(me) : extraMenteePanel(me)}
        ${reviewsPanel(kind, me, other, bookings)}
      </main>
    </div>`;
    wire(root, kind, me, other);
  }

  // حالة دفعة العضو: قبل الإطلاق أو بعد الأرشفة يبقى الدخول وقراءة البيانات وتعديل البطاقة فقط
  function cohortBanner(me, st) {
    if (st === 'live') return '';
    return `<div class="cohort-banner ${st}"><i class="fa-solid ${st === 'archived' ? 'fa-box-archive' : 'fa-hourglass-start'}"></i><div><b>${st === 'archived' ? 'دفعتك مؤرشفة' : 'لم تُطلق دفعتك رسمياً بعد'}</b>
      <p>${st === 'archived' ? 'يمكنك الدخول لعرض بطاقتك وجلساتك وتقييماتك وشهادتك، ولا يمكن إضافة مواعيد أو جلسات أو تعديل الجلسات السابقة.' : 'يمكنك تعديل بطاقتك الآن، وتُفتح إضافة المواعيد وحجز الجلسات وتحديثها وكتابة التقييمات بعد الإطلاق الرسمي للدفعة.'}</p></div></div>`;
  }
  const LOCKED_SEL = '[data-book],[data-bk],[data-add-slot],[data-add-extra-slot],[data-del-slot],[data-add-wish],[data-add-extra-wish],[data-wish-withdraw],[data-wish-accept],[data-wish-decline],[data-final],[data-review-form] button,[data-add-slot-alert]';

  // الدفعات السابقة للعضو (سبق تسجيله ثم أُعيد تسجيله في دفعة أحدث): جلساته وتقييماته للعرض فقط
  function openArchive(kind, me) {
    const key = kind === 'mentor' ? 'mentorId' : 'menteeId', since = me.cohortSince || 0;
    const blocks = (me.prevCohorts || []).map(cid => {
      const c = Data.cohort(cid), bks = Data.bookings({ [key]: me.id }).filter(b => b.cohort === cid).concat(Data.bookings({ [key]: me.id, extra: true }).filter(b => b.cohort === cid));
      return `<h3 class="sub"><i class="fa-solid fa-box-archive"></i> ${esc(c?.name || cid)} <small class="muted">${esc(c?.year || '')}</small></h3>
        ${bks.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>الجلسة</th><th>الموعد</th><th>الحالة</th></tr></thead><tbody>${bks.map(b => `<tr><td data-l="الجلسة">${esc(Data.bookingName(b))}</td><td data-l="الموعد">${fmtDate(b.date)}<br><small>${tRange(b.start, b.end)}</small></td><td data-l="الحالة">${bookingPill(b, kind)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">لا توجد جلسات مسجلة.</p>'}`;
    }).join('');
    const revs = Data.reviews({ authorId: me.id }).filter(r => (r.ts || 0) < since);
    openModal({
      title: '<i class="fa-solid fa-box-archive"></i> الدفعات السابقة', size: 'lg',
      body: `${blocks}${revs.length ? `<h3 class="sub"><i class="fa-solid fa-star"></i> تقييماتي السابقة</h3><ul class="review-list">${revs.map(r => `<li class="review"><header><b>${r.type === 'final' ? 'التقييم الختامي' : r.type === 'program' ? 'تقييم البرنامج' : r.extraSession ? 'جلسة إضافية' : sessionName(r.session)}</b><small>${fmtTs(r.ts)}</small></header><p>${nl2br(r.text)}</p></li>`).join('')}</ul>` : ''}`,
      actions: [{ label: 'إغلاق', cls: 'primary' }]
    });
  }

  function topbar(kind, me) {
    return `<header class="dash-top"><div class="container dash-top-in">
      <a class="brand" href="#/"><img src="assets/ishraq-mark.png" alt=""><span><b>إشراق</b><small>${kind === 'admin' ? 'لوحة الإدارة' : kind === 'mentor' ? 'بوابة المرشد' : 'بوابة المستفيد'}</small></span></a>
      <div class="dash-top-actions">${bellButton(kind === 'admin' ? 'admin' : me.id)}
      <button class="btn ghost sm" data-logout><i class="fa-solid fa-right-from-bracket"></i> خروج</button></div>
    </div></header>`;
  }

  /* ===== تنبيهات المرشد: إطلاق الدفعة والتأخر في إضافة المواعيد وتذكيرات الإدارة ===== */
  function mentorAlerts(me) {
    if (!Bands.launchedAt(me.cohort)) return '';
    const out = [];
    Bands.SESSIONS.map(n => Bands.status(me, n)).forEach(st => {
      if (!st || st.added || st.notStarted) return;
      if (st.week === 1) {
        out.push(`<div class="band-alert band-1"><i class="fa-solid fa-rocket"></i><div><b>${st.n === 1 ? 'تم إطلاق الدفعة رسمياً، سارع بتحديد مواعيد الجلسات' : `بدأت هذا الأسبوع فترة إضافة موعد ${sessionName(st.n)}`}</b>
          <p>أضف موعد ${sessionName(st.n)} خلال هذا الأسبوع ليحجزه المستفيد.</p></div></div>`);
      } else {
        out.push(`<div class="band-alert ${st.level.cls}"><i class="fa-solid ${st.level.icon}"></i><div><b>${sessionName(st.n)} — الأسبوع ${st.week} من فترتها</b><p>${Bands.mentorAlertText(st)}</p></div>
          <button class="btn sm" data-add-slot-alert="${esc(st.n)}"><i class="fa-solid fa-plus"></i> إضافة الموعد</button></div>`);
      }
    });
    Data.notifications(me.id).filter(x => x.kind === 'reminder' && !x.dismissed && Bands.addedAt(me.id, x.session) == null).slice(0, 3).forEach(x => {
      const lv = Bands.LEVELS[(x.band || 1) - 1] || Bands.LEVELS[0];
      out.push(`<div class="band-alert ${lv.cls} from-admin"><i class="fa-solid fa-envelope-open-text"></i><div><b>تذكير من إدارة البرنامج — ${sessionName(x.session)}</b><p>${nl2br(x.text)}</p><small>${fmtTs(x.ts)}</small></div>
        <button class="icon-btn" data-dismiss-rem="${esc(x.id)}" title="إخفاء"><i class="fa-solid fa-xmark"></i></button></div>`);
    });
    return out.length ? `<div class="band-alerts">${out.join('')}</div>` : '';
  }

  function progressRing(done, partners = 1) {
    const total = 3 * Math.max(1, partners);   // لكل مستفيد ثلاث جلسات
    const p = Math.min(total, done) / total;
    const c = 2 * Math.PI * 34;
    return `<div class="ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${esc(c)}" stroke-dashoffset="${c * (1 - p)}"/></svg>
      <div><b>${Math.min(total, done)}/${total}</b><small>جلسات منجزة</small></div></div>`;
  }

  /* ===== المرشد: المواعيد ===== */
  function slotsPanel(me) {
    const launched = !!Bands.launchedAt(me.cohort);
    const slots = Data.slots(me.id);
    const booked = new Set(Data.bookings({ mentorId: me.id, cohort: me.cohort }).filter(b => b.status !== 'absent_mentor' && b.status !== 'absent_mentee').map(b => b.slotId));
    const group = n => {
      const list = slots.filter(s => s.session === n);
      return `<div class="slot-group"><h3>${sessionName(n)} <span class="count">${list.length}</span></h3>
        ${list.length ? `<ul class="slot-list">${list.map(s => `<li class="${booked.has(s.id) ? 'booked' : ''}">
          <div><b><i class="fa-regular fa-calendar"></i> ${fmtDate(s.date)}</b><span><i class="fa-regular fa-clock"></i> ${tRange(s.start, s.end)}</span>
          <span class="chip">${MODES[s.mode] || ''}</span>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}</div>
          ${booked.has(s.id) ? '<span class="pill st-done">محجوز</span>' : `<button class="icon-btn danger" data-del-slot="${esc(s.id)}" title="حذف"><i class="fa-solid fa-trash"></i></button>`}
        </li>`).join('')}</ul>` : '<p class="muted small">لا توجد مواعيد مقترحة</p>'}</div>`;
    };
    return `<section class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-calendar-plus"></i> المواعيد</h2>
      <button class="btn primary" data-add-slot ${launched ? '' : 'disabled'}><i class="fa-solid fa-plus"></i> إضافة موعد جديد</button></div>
      ${launched ? `<p class="muted small">حدّد عدة مواعيد لكل جلسة ليختار المستفيد أحدها. فترة إضافة موعد الجلسة الأولى الأسابيع 1-4 من إطلاق الدفعة، والثانية 5-8، والثالثة 9-12، ويُفضَّل إضافته في الأسبوع الأول من فترته.</p>`
        : '<p class="slot-state locked"><i class="fa-solid fa-lock"></i> تُفتح إضافة المواعيد بعد إطلاق الدفعة رسمياً من إدارة البرنامج.</p>'}
      <div class="slot-groups">${[1, 2, 3].map(group).join('')}</div>
    </section>`;
  }

  function openAddSlot(me, sessionNum = 1, extra = false) {
    openModal({
      title: `<i class="fa-solid fa-calendar-plus"></i> ${extra ? 'إضافة موعد لجلسة إضافية' : 'إضافة موعد جديد'}`, size: 'md',
      body: `<form class="form-grid">
        ${extra ? '' : fieldInput({ k: 'session', label: 'رقم الجلسة', type: 'select', required: true, options: ['الأولى', 'الثانية', 'الثالثة'] }, ['الأولى', 'الثانية', 'الثالثة'][sessionNum - 1] || 'الأولى')}
        <div class="field"><label>التاريخ <em>*</em></label><input type="date" name="date" ${extra ? `min="${todayISO()}"` : ''} required></div>
        <div class="field"><label>بداية الجلسة (24 ساعة)</label>${timeSelect('start', '18:00')}</div>
        <div class="field"><label>نهاية الجلسة (24 ساعة)</label>${timeSelect('end', '19:00')}</div>
        ${extra ? '' : '<p class="retro-note warn-note wide" hidden><i class="fa-solid fa-clock-rotate-left"></i> موعد سابق: تُوثّق به جلسة عُقدت خارج المنصة. بعد أن يحجزه المستفيد تُصنَّف «بانتظار التحديث» فوراً ليؤكد الطرفان إتمامها بالطريقة المعتادة.</p>'}
        ${fieldInput({ k: 'mode', label: 'نوع الجلسة', type: 'radio', required: true, wide: true, options: [{ value: 'inperson', label: 'حضورية' }, { value: 'online', label: 'إلكترونية' }, { value: 'both', label: 'كلاهما (يختار المستفيد)' }] }, 'both')}
        ${fieldInput({ k: 'summary', label: 'موجز عن المحتوى المتوقع للجلسة', type: 'textarea', wide: true, rows: 3 })}
      </form>`,
      actions: [
        {
          label: 'حفظ الموعد', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            if (!validateForm(f)) return false;
            const v = readForm(f);
            const start = readTime(f, 'start'), end = readTime(f, 'end');
            if (minutesBetween(start, end) <= 0) { toast('وقت النهاية يجب أن يكون بعد وقت البداية', 'error'); return false; }
            if (extra) {
              if (!Data.extraOn()) { toast('الجلسات الإضافية غير مفعّلة من الإدارة حالياً', 'error'); return false; }
              Store.push('slots', { mentorId: me.id, extra: true, date: v.date, start, end, mode: v.mode, summary: v.summary, ts: Date.now() });
              toast('تمت إضافة الموعد');
              return;
            }
            const session = ['الأولى', 'الثانية', 'الثالثة'].indexOf(v.session) + 1;
            const slots = Data.slots(me.id).concat([{ session, date: v.date }]);
            const first = n => slots.filter(s => s.session === n).map(s => s.date).sort()[0];
            if (!Bands.launchedAt(me.cohort)) { toast('تُفتح إضافة المواعيد بعد إطلاق الدفعة', 'error'); return false; }
            if (session > 1 && !first(session - 1)) { toast(`أضف مواعيد ${sessionName(session - 1)} أولاً`, 'error'); return false; }
            Store.push('slots', { mentorId: me.id, session, date: v.date, start, end, mode: v.mode, summary: v.summary, ts: Date.now() });
            const retro = dateTimeOf(v.date, start) < new Date();
            Data.menteesOf(me.id).forEach(mentee => Data.notify(mentee.id, retro ? `وثّق مرشدك جلسة سابقة لـ${sessionName(session)} بتاريخ ${fmtDate(v.date)} ${start}؛ احجزها من «المواعيد المتاحة» ليؤكد الطرفان إتمامها` : `أضاف مرشدك موعداً جديداً لـ${sessionName(session)}: ${fmtDate(v.date)} ${start}`, { icon: retro ? 'fa-clock-rotate-left' : 'fa-calendar-plus' }));
            toast(retro ? 'أُضيف الموعد السابق؛ بعد حجز المستفيد له يؤكد الطرفان إتمامه' : 'تمت إضافة الموعد');
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ],
      onOpen: m => {
        const f = $('form', m.body), note = $('.retro-note', m.body);
        const upd = () => { if (note) note.hidden = !(f.date.value && dateTimeOf(f.date.value, readTime(f, 'start')) < new Date()); };
        f.addEventListener('change', upd);
      }
    });
  }

  /* ===== المستفيد: الحجز ===== */
  function bookingPanel(me, mentor) {
    if (!mentor) return `<section class="panel"><h2><i class="fa-solid fa-calendar-check"></i> المواعيد المتاحة</h2>${emptyState('ستظهر المواعيد هنا بعد تعيين مرشد لك', 'fa-calendar')}</section>`;
    const slots = Data.slots(mentor.id);
    const taken = new Set(Data.bookings({ mentorId: mentor.id, cohort: me.cohort }).filter(b => ['upcoming', 'done'].includes(b.status)).map(b => b.slotId));
    const group = n => {
      const active = Data.activeBooking(me.id, n);
      const prevDone = n === 1 || Data.bookings({ menteeId: me.id, cohort: me.cohort }).some(b => b.session === n - 1 && b.status === 'done');
      const prevActive = n > 1 && !!Data.activeBooking(me.id, n - 1);
      let inner;
      if (active) inner = `<div class="slot-state">${bookingPill(active, 'mentee')} <span>${fmtSlot(active)}</span></div>`;
      else if (!prevDone && !(prevActive && slots.some(s => s.session === n && !taken.has(s.id) && Data.isRetroSlot(s)))) inner = `<div class="slot-state locked"><i class="fa-solid fa-lock"></i> يُتاح الحجز بعد إنجاز ${sessionName(n - 1)}</div>`;
      else {
        // المواعيد السابقة الموثّقة (جلسات عُقدت خارج المنصة) تُحجز حتى قبل إنجاز الجلسة السابقة
        const list = slots.filter(s => s.session === n && !taken.has(s.id) && (dateTimeOf(s.date, s.start) > new Date() ? prevDone : Data.isRetroSlot(s)))
          .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
        inner = list.length ? `<ul class="slot-list">${list.map(s => `<li>
          <div><b><i class="fa-regular fa-calendar"></i> ${fmtDate(s.date)}</b><span><i class="fa-regular fa-clock"></i> ${tRange(s.start, s.end)}</span>
          <span class="chip">${MODES[s.mode] || ''}</span>${Data.isRetroSlot(s) ? '<span class="chip warn"><i class="fa-solid fa-clock-rotate-left"></i> جلسة سابقة (توثيق)</span>' : ''}${s.summary ? `<p>${esc(s.summary)}</p>` : ''}</div>
          <button class="btn sm primary" data-book="${esc(s.id)}"><i class="fa-solid fa-check"></i> احجز</button></li>`).join('')}</ul>`
          : '<p class="muted small">لا توجد مواعيد متاحة حالياً لهذه الجلسة</p>';
      }
      return `<div class="slot-group ${active ? 'is-booked' : ''}"><h3>${sessionName(n)}</h3>${inner}</div>`;
    };
    return `<section class="panel"><h2><i class="fa-solid fa-calendar-check"></i> المواعيد المتاحة للحجز</h2>
      <p class="muted small">اختر موعداً من المواعيد التي أتاحها مرشدك. لا يمكن حجز الجلسة التالية قبل إنجاز الجلسة السابقة.</p>
      <div class="slot-groups">${[1, 2, 3].map(group).join('')}</div></section>`;
  }

  function openBook(me, slot) {
    const mentor = Data.member(slot.mentorId);
    openModal({
      title: slot.extra ? 'حجز جلسة إضافية' : `حجز ${sessionName(slot.session)}`, size: 'sm',
      body: `<form><p class="confirm-msg"><b>${fmtSlot(slot)}</b><br>مع المرشد: ${esc(mentor?.name || '')}</p>
        ${slot.summary ? `<p class="muted">${esc(slot.summary)}</p>` : ''}
        ${Data.isRetroSlot(slot) ? '<p class="warn-note small"><i class="fa-solid fa-clock-rotate-left"></i> هذه جلسة سابقة عُقدت خارج المنصة: ستُسجَّل «بانتظار التحديث» ليؤكد كل من المرشد والمستفيد إتمامها.</p>' : ''}
        ${slot.mode === 'both' ? fieldInput({ k: 'mode', label: 'اختر نوع الجلسة', type: 'radio', required: true, options: [{ value: 'inperson', label: 'حضورية' }, { value: 'online', label: 'إلكترونية (افتراضية)' }] }, '') : `<p><span class="chip">${MODES[slot.mode]}</span></p>`}
      </form>`,
      actions: [
        {
          label: 'تأكيد الحجز', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            if (!validateForm(f)) return false;
            if (!slot.extra && Data.activeBooking(me.id, slot.session)) { toast('هذه الجلسة محجوزة مسبقاً', 'error'); return; }
            const mode = slot.mode === 'both' ? readForm(f).mode : slot.mode;
            let bid = slot.extra ? `x_${slot.id}` : null;
            const bk = {
              mentorId: slot.mentorId, menteeId: me.id, cohort: me.cohort, slotId: slot.id, ...(slot.extra ? { extra: true } : { session: slot.session }),
              date: slot.date, start: slot.start, end: slot.end, mode, summary: slot.summary || '', status: 'upcoming', ts: Date.now()
            };
            // الجلسة الإضافية برقم ثابت من رقم الموعد: لا يستطيع مستفيدان حجز الموعد نفسه
            if (slot.extra) {
              Store.set(`bookings/x_${slot.id}`, { id: `x_${slot.id}`, ...bk });
              Store.set(`extraPairs/${me.id}_${slot.mentorId}`, true);
              Store.set(`extraTaken/${slot.id}`, true);
            } else bid = Store.push('bookings', bk);
            Data.notify(slot.mentorId, `حجز المستفيد ${me.name} ${slot.extra ? 'جلسة إضافية' : sessionName(slot.session)}: ${fmtSlot(slot)} (${MODES[mode]})`, { icon: 'fa-calendar-check' });
            toast('تم حجز الجلسة بنجاح');
            setTimeout(() => Cal.open(bid, 'mentee'), 350);
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  /* ===== ساعات إرشادية إضافية ===== */
  const slotLi = (s, booked, mine, cancelled = false) => `<li class="${booked ? 'booked' : ''}">
    <div><b><i class="fa-regular fa-calendar"></i> ${fmtDate(s.date)}</b><span><i class="fa-regular fa-clock"></i> ${tRange(s.start, s.end)}</span>
    <span class="chip">${MODES[s.mode] || ''}</span>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}</div>
    ${mine ? (booked ? '<span class="pill st-done">محجوز</span>' : `${cancelled ? '<span class="pill st-cancelled">حُجز ثم أُلغي</span>' : ''}<button class="icon-btn danger" data-del-slot="${esc(s.id)}" title="حذف"><i class="fa-solid fa-trash"></i></button>`)
      : `<button class="btn sm primary" data-book="${esc(s.id)}"><i class="fa-solid fa-check"></i> احجز</button>`}</li>`;

  // عدّاد الجلسات الإضافية المنفصل + الوسام (بعد إنجاز جلسة إضافية واحدة على الأقل)
  function extraCounter(me) {
    const st = Data.extraStats(me.id);
    return `<div class="extra-counter"><div><b>${st.done}</b><span>جلسة إضافية منجزة</span></div><div><b>${st.hours}</b><span>ساعة إضافية</span></div></div>`;
  }

  function extraMentorPanel(me) {
    if (!Data.extraOn()) return '';
    const slots = Data.slots(me.id, true);
    const bks = Data.bookings({ mentorId: me.id, extra: true, cohort: me.cohort });
    const booked = new Set(bks.filter(b => ['upcoming', 'done'].includes(b.status)).map(b => b.slotId));
    const st = Data.extraStats(me.id);
    const takenAll = new Set(Object.keys(Store.get('extraTaken') || {}));
    return `<section class="panel extra-panel" id="extra-panel">
      <div class="panel-head"><h2><i class="fa-solid fa-hand-holding-heart"></i> جلسات إرشادية إضافية</h2>
        <button class="btn primary" data-add-extra-slot><i class="fa-solid fa-plus"></i> إضافة موعد</button></div>
      <p class="muted small">فعّلت الإدارة الجلسات الإضافية. أضف مواعيد لساعات إرشادية إضافية، ويحجز منها أي مستفيد من صفحته، ويمكنك متابعة الجلسة وتحديثها كالجلسات الأساسية. هذه الجلسات لها عدّاد وتقييمات منفصلة.</p>
      ${extraCounter(me)}
      ${st.done >= 1 ? `<div class="badge-card"><div class="badge-img"><img data-badge-img alt="وسام الشكر"></div><div><h3><i class="fa-solid fa-medal"></i> وسام شكر خاص</h3>
        <p class="muted small">شكراً لعطائك في الجلسات الإرشادية الإضافية. يمكنك حفظ الوسام كصورة ومشاركته.</p>
        <button class="btn primary sm" data-badge-download><i class="fa-solid fa-download"></i> حفظ الوسام كصورة</button></div></div>` : ''}
      <div class="slot-group"><h3>مواعيدي للجلسات الإضافية <span class="count">${slots.length}</span></h3>
        ${slots.length ? `<ul class="slot-list">${slots.map(x => slotLi(x, booked.has(x.id), true, !booked.has(x.id) && takenAll.has(x.id))).join('')}</ul>` : '<p class="muted small">لم تضف مواعيد بعد</p>'}</div>
    </section>
    ${bks.length ? scheduledPanel('mentor', me, null, bks, true) : ''}`;
  }

  function extraMenteePanel(me) {
    if (!Data.extraOn()) return '';
    const taken = new Set(Object.keys(Store.get('extraTaken') || {}));
    const bks = Data.bookings({ menteeId: me.id, extra: true, cohort: me.cohort });
    const mine = new Set(bks.filter(b => ['upcoming', 'done'].includes(b.status)).map(b => b.slotId));
    const open = Store.list('slots').filter(x => x.extra && !taken.has(x.id) && !mine.has(x.id) && dateTimeOf(x.date, x.start) > new Date())
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const byMentor = new Map();
    open.forEach(x => { if (!byMentor.has(x.mentorId)) byMentor.set(x.mentorId, []); byMentor.get(x.mentorId).push(x); });
    const rows = [...byMentor.entries()].map(([mid, list]) => ({ m: Data.member(mid), list })).filter(r => r.m)
      .sort((a, b) => String(a.m.name).localeCompare(String(b.m.name), 'ar'));
    return `<section class="panel extra-panel" id="extra-panel"><h2><i class="fa-solid fa-hand-holding-heart"></i> جلسات إضافية</h2>
      <p class="muted small">مواعيد جلسات إرشادية إضافية أتاحها المرشدون. اختر موعداً من أي مرشد لتحجزه، وستظهر الجلسة في «الجلسات الإضافية المجدولة».</p>
      ${rows.length ? `<div class="table-wrap"><table class="table rtable extra-table"><thead><tr><th>المرشد</th><th>المواعيد المتاحة</th></tr></thead><tbody>
        ${rows.map(({ m, list }) => `<tr><td data-l="المرشد"><span class="bp">${avatar(m, 'md')}<b>${esc(m.name)}</b></span>${m.tagline ? `<small class="muted">${esc(m.tagline)}</small>` : ''}</td>
          <td data-l="المواعيد المتاحة"><ul class="slot-list">${list.map(x => slotLi(x, false, false)).join('')}</ul></td></tr>`).join('')}</tbody></table></div>`
        : emptyState('لا توجد مواعيد إضافية متاحة حالياً', 'fa-calendar')}
      ${extraWishesBlock(me)}
    </section>
    ${bks.length ? scheduledPanel('mentee', me, null, bks, true) : ''}`;
  }

  /* ===== الجلسات المجدولة ===== */
  function scheduledPanel(kind, me, other0, bookings, extra = false) {
    const multi = kind === 'mentor' && Data.menteesOf(me.id).length > 1;   // أكثر من مستفيد: نذكر اسم المستفيد في كل صف
    const rows = bookings.map(b => {
      const other = Data.member(kind === 'mentor' ? b.menteeId : b.mentorId) || other0;
      const due = isDue(b);
      let actions = '';
      const prop = b.proposal;
      if (b.status === 'upcoming') {
        const dis = due ? '' : 'disabled title="يتفعل عند حلول موعد الجلسة"';
        const confirmedByMe = kind === 'mentor' ? b.doneByMentor : b.doneByMentee;
        const anyConfirmed = b.doneByMentor || b.doneByMentee;
        const doneBtn = confirmedByMe ? '' : `<button class="btn xs success" data-bk="done" data-id="${esc(b.id)}" ${dis}><i class="fa-solid fa-check"></i> تم إنجاز الجلسة</button>`;
        if (prop) {
          // موعد بديل معلّق: لا تُحدَّث الجلسة قبل أن يوافق الطرف الآخر أو يُسحب الاقتراح
          actions = prop.by === kind
            ? `<button class="btn xs ghost" data-bk="withdraw_prop" data-id="${esc(b.id)}"><i class="fa-solid fa-rotate-left"></i> سحب الاقتراح</button>
               <a class="btn xs wa" href="${esc(waTo(other, proposalText(kind, b, prop)))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> إشعار ${kind === 'mentor' ? 'المستفيد' : 'المرشد'}</a>`
            : `<button class="btn xs success" data-bk="accept_prop" data-id="${esc(b.id)}"><i class="fa-solid fa-check"></i> قبول الموعد البديل</button>
               <button class="btn xs warn" data-bk="reject_prop" data-id="${esc(b.id)}"><i class="fa-solid fa-xmark"></i> رفض (إبقاء الموعد الحالي)</button>
               <button class="btn xs ghost" data-bk="resched" data-id="${esc(b.id)}"><i class="fa-solid fa-pen"></i> اقتراح موعد آخر</button>`;
        } else if (kind === 'mentor') {
          actions = `${doneBtn}
            <button class="btn xs warn" data-bk="absent_mentee" data-id="${esc(b.id)}" ${dis}><i class="fa-solid fa-user-xmark"></i> ملغاة لغياب المستفيد</button>
            ${anyConfirmed ? '' : `<button class="btn xs ghost" data-bk="resched" data-id="${esc(b.id)}"><i class="fa-solid fa-clock-rotate-left"></i> تعديل الموعد</button>`}`;
        } else {
          actions = `${doneBtn}
            <button class="btn xs danger" data-bk="absent_mentor" data-id="${esc(b.id)}" ${dis}><i class="fa-solid fa-user-slash"></i> ملغاة لغياب المرشد</button>
            ${anyConfirmed ? '' : `<button class="btn xs ghost" data-bk="resched" data-id="${esc(b.id)}"><i class="fa-solid fa-pen"></i> تعديل الموعد</button>`}`;
        }
        if (!anyConfirmed) actions += `<button class="btn xs danger-ghost" data-bk="cancel" data-id="${esc(b.id)}"><i class="fa-solid fa-calendar-xmark"></i> إلغاء الموعد</button>`;
        actions += `<button class="btn xs ghost" data-cal="${esc(b.id)}"><i class="fa-regular fa-calendar-plus"></i> إضافة للتقويم</button>`;
      } else if (b.status === 'cancelled' && b.cancelledBy === kind) {
        actions = `<a class="btn xs wa" href="${esc(waTo(other, cancelText(kind, b)))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> إشعار ${kind === 'mentor' ? 'المستفيد' : 'المرشد'}</a>`;
      }
      return `<tr>
        <td data-l="الجلسة"><b>${extra ? esc(other?.name || 'جلسة إضافية') : sessionName(b.session)}</b>${!extra && multi ? `<br><small class="muted"><i class="fa-solid fa-user-graduate"></i> ${esc(other?.name || '')}</small>` : ''}</td>
        <td data-l="الموعد">${fmtDate(b.date)}<br><small>${tRange(b.start, b.end)}</small>${b.changedBy ? `<br><small class="muted"><i class="fa-solid fa-rotate"></i> عُدّل الموعد</small>` : ''}
          ${prop ? `<span class="prop-note"><i class="fa-solid fa-calendar-day"></i> موعد مقترح من ${prop.by === 'mentor' ? 'المرشد' : 'المستفيد'}: ${fmtDate(prop.date)} · ${tRange(prop.start, prop.end)}</span>` : ''}
          ${b.status === 'cancelled' && b.cancelReason ? `<span class="prop-note">سبب الإلغاء: ${esc(b.cancelReason)}</span>` : ''}</td>
        <td data-l="النوع">${MODES[b.mode] || ''}</td>
        <td data-l="المحتوى">${esc(b.summary || '—')}</td>
        <td data-l="الحالة">${bookingPill(b, kind)}</td>
        <td data-l="" class="row-actions">${actions}</td>
      </tr>`;
    }).join('');
    return `<section class="panel"><h2><i class="fa-solid fa-list-check"></i> ${extra ? 'الجلسات الإضافية المجدولة' : 'الجلسات المجدولة'}</h2>
      ${bookings.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>${extra ? (kind === 'mentor' ? 'المستفيد' : 'المرشد') : 'الجلسة'}</th><th>الموعد</th><th>النوع</th><th>المحتوى</th><th>الحالة</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${statsBoxes(Data.stats(bookings))}` : emptyState(kind === 'mentor' ? 'لم يحجز المستفيد أي جلسة بعد' : 'لم تحجز أي جلسة بعد', 'fa-calendar-xmark')}
    </section>`;
  }

  const siteLink = () => (window.ISHRAQ_CONFIG && window.ISHRAQ_CONFIG.siteUrl) || location.origin + '/';
  // رابط واتساب جاهز: برقم الطرف الآخر إن توفر، وإلا يفتح واتساب لاختيار جهة الاتصال
  const waTo = (other, text) => waLink(other?.whatsapp || '', text);
  const partyWord = kind => (kind === 'mentor' ? 'مستفيد' : 'مرشد');
  const whenOf = x => `${fmtDate(x.date)} الساعة ${tRange(x.start, x.end)}`;

  function cancelText(kind, b) {
    const who = kind === 'mentor' ? 'المرشد' : 'المستفيد';
    return `عزيزي ${partyWord(kind)} الجلسة الإرشادية في إشراق، نأسف لإبلاغك بأن ${who} ألغى موعد ${Data.bookingName(b)} المقرر في "${whenOf(b)}"${b.cancelReason ? ` (السبب: ${b.cancelReason})` : ''}. يمكنك الدخول للمنصة لاختيار موعد آخر أو اقتراح موعد مناسب: ${siteLink()}`;
  }

  function proposalText(kind, b, p) {
    return `عزيزي ${partyWord(kind)} الجلسة الإرشادية في إشراق، أقترح تعديل موعد ${Data.bookingName(b)} من "${whenOf(b)}" إلى "${whenOf(p)}". فضلاً ادخل المنصة للموافقة على الموعد البديل أو اقتراح موعد أنسب: ${siteLink()}`;
  }

  function waDialog(title, msg, kind, other, text) {
    openModal({
      title, size: 'sm',
      body: `<div class="success-msg"><i class="fa-solid fa-circle-check"></i><p>${msg}</p></div><p class="muted small">أرسل الإشعار للطرف الآخر عبر واتساب ليدخل المنصة${other?.whatsapp ? '' : ' (اختر جهة الاتصال بنفسك لعدم توفر رقمه)'}.</p>`,
      actions: [{ label: `<i class="fa-brands fa-whatsapp"></i> إشعار ${kind === 'mentor' ? 'المستفيد' : 'المرشد'} عبر واتساب`, cls: 'wa', onClick: () => window.open(waTo(other, text), '_blank') }, { label: 'إغلاق', cls: 'ghost' }]
    });
  }

  async function bookingAction(kind, me, other, id, act) {
    const b = Store.get(`bookings/${id}`);
    if (!b) return;
    other = Data.member(kind === 'mentor' ? b.menteeId : b.mentorId) || other;   // طرف هذه الجلسة بالذات
    if (b.status !== 'upcoming') return;
    if (act === 'resched') return openReschedule(kind, me, other, b);
    if (act === 'cancel') return openCancel(kind, me, other, b);
    if (act === 'accept_prop') return acceptProposal(kind, me, other, b);
    if (act === 'reject_prop' || act === 'withdraw_prop') return dropProposal(kind, me, other, b, act);
    if (!isDue(b) || b.proposal) return;
    const otherRole = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    const myRole = kind === 'mentor' ? 'المرشد' : 'المستفيد';
    if (act === 'done') {
      // الإنجاز يحتاج تأكيد الطرفين
      if (!(await confirmDialog(`تأكيد إنجاز ${Data.bookingName(b)}؟ ${b.doneByMentor || b.doneByMentee ? '' : `ستُحتسب منجزة بعد تأكيد ${otherRole} أيضاً.`}`))) return;
      const cur = Store.get(`bookings/${id}`) || b;
      const upd = { [kind === 'mentor' ? 'doneByMentor' : 'doneByMentee']: Date.now() };
      const otherConfirmed = kind === 'mentor' ? cur.doneByMentee : cur.doneByMentor;
      if (otherConfirmed) {
        Object.assign(upd, { status: 'done', statusTs: Date.now(), statusBy: 'both' });
        Store.update(`bookings/${id}`, upd);
        const txt = `تم إنجاز ${Data.bookingName(b)} بتأكيد الطرفين: ${kind === 'mentor' ? me.name : other?.name || ''} و${kind === 'mentor' ? other?.name || '' : me.name}`;
        Data.notify('admin', txt, { icon: 'fa-circle-check' });
        other && Data.notify(other.id, txt, { icon: 'fa-circle-check' });
        toast('تم تأكيد الطرفين — الجلسة منجزة');
      } else {
        Store.update(`bookings/${id}`, upd);
        other && Data.notify(other.id, `أكّد ${myRole} ${me.name} إنجاز ${Data.bookingName(b)}، فضلاً أكّد الإنجاز من صفحتك`, { icon: 'fa-circle-check' });
        toast(`تم تسجيل تأكيدك — بانتظار تأكيد ${otherRole}`);
      }
      return;
    }
    const msgs = {
      absent_mentee: ['تأكيد إلغاء الجلسة لغياب المستفيد؟', `أُلغيت ${Data.bookingName(b)} لغياب المستفيد ${other?.name || ''}`, 'fa-user-xmark'],
      absent_mentor: ['تأكيد إلغاء الجلسة لغياب المرشد؟', `أُلغيت ${Data.bookingName(b)} لغياب المرشد ${other?.name || ''}`, 'fa-user-slash']
    };
    if (!msgs[act]) return;
    if (!(await confirmDialog(msgs[act][0], { danger: true }))) return;
    Store.update(`bookings/${id}`, { status: act, statusTs: Date.now(), statusBy: kind });
    Data.notify('admin', msgs[act][1], { icon: msgs[act][2] });
    other && Data.notify(other.id, msgs[act][1], { icon: msgs[act][2] });
    toast('تم تحديث حالة الجلسة');
  }

  /* ===== إلغاء الموعد بعد الحجز (ما لم يُؤكَّد إنجازه) ===== */
  function openCancel(kind, me, other, b) {
    if (b.doneByMentor || b.doneByMentee) { toast('لا يمكن إلغاء جلسة أكّد أحد الطرفين إنجازها', 'error'); return; }
    openModal({
      title: '<i class="fa-solid fa-calendar-xmark"></i> إلغاء الموعد', size: 'sm',
      body: `<form class="form-grid one"><p class="confirm-msg">إلغاء <b>${esc(Data.bookingName(b))}</b><br>${fmtSlot(b)}</p>
        ${fieldInput({ k: 'reason', label: 'سبب الإلغاء (اختياري، يظهر في رسالة الإشعار)', type: 'textarea', rows: 2 })}
        <p class="muted small">بعد الإلغاء يمكنك إرسال رسالة جاهزة عبر واتساب إلى ${kind === 'mentor' ? 'المستفيد' : 'المرشد'}.</p></form>`,
      actions: [
        {
          label: 'تأكيد الإلغاء', cls: 'danger', onClick: m => {
            const cur = Store.get(`bookings/${b.id}`);
            if (!cur || cur.status !== 'upcoming' || cur.doneByMentor || cur.doneByMentee) { toast('تعذّر الإلغاء: تغيّرت حالة الجلسة', 'error'); return; }
            const reason = (readForm($('form', m.body)).reason || '').trim().slice(0, 300);
            const upd = { status: 'cancelled', cancelledBy: kind, cancelTs: Date.now(), statusTs: Date.now(), statusBy: kind, proposal: null, ...(reason ? { cancelReason: reason } : {}) };
            Store.update(`bookings/${b.id}`, upd);
            const nb = { ...cur, ...upd };
            const txt = `ألغى ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} موعد ${Data.bookingName(b)} (${fmtSlot(b)})${reason ? ` — السبب: ${reason}` : ''}`;
            other && Data.notify(other.id, txt, { icon: 'fa-calendar-xmark' });
            Data.notify('admin', txt, { icon: 'fa-calendar-xmark' });
            setTimeout(() => waDialog('تم إلغاء الموعد', 'أُلغي الموعد، وأُبلغ الطرف الآخر داخل المنصة.', kind, other, cancelText(kind, nb)), 220);
          }
        },
        { label: 'رجوع', cls: 'ghost' }
      ]
    });
  }

  /* ===== تعديل الموعد: اقتراح موعد بديل بانتظار موافقة الطرف الآخر ===== */
  function openReschedule(kind, me, other, b) {
    const mentorId = b.mentorId;
    const takenExtra = new Set(Object.keys(Store.get('extraTaken') || {}));
    const taken = new Set(Data.bookings({ mentorId, extra: !!b.extra }).filter(x => ['upcoming', 'done'].includes(x.status)).map(x => x.slotId));
    const alt = Data.slots(mentorId, !!b.extra).filter(s => (b.extra || s.session === b.session) && s.id !== b.slotId && !taken.has(s.id) && !(b.extra && takenExtra.has(s.id)) && dateTimeOf(s.date, s.start) > new Date());
    openModal({
      title: 'اقتراح موعد بديل', size: 'md',
      body: `<form class="form-grid">
        <p class="wide muted">الموعد الحالي: <b>${fmtSlot(b)}</b><br><small>يبقى الموعد الحالي ساري المفعول حتى يوافق ${kind === 'mentor' ? 'المستفيد' : 'المرشد'} على الموعد البديل.</small></p>
        ${alt.length ? `<div class="field wide"><label>اختر من المواعيد المعلنة مسبقاً</label><div class="radio-col">${alt.map(s => `<label class="radio"><input type="radio" name="alt" value="${esc(s.id)}"><span>${fmtSlot(s)} · ${MODES[s.mode] || ''}</span></label>`).join('')}
          <label class="radio"><input type="radio" name="alt" value="custom" checked><span>اقتراح موعد إضافي</span></label></div></div>` : ''}
        <div class="field custom-when"><label>التاريخ المقترح</label><input type="date" name="date" min="${todayISO()}" value="${esc(b.date)}"></div>
        <div class="field custom-when"><label>البداية (24 ساعة)</label>${timeSelect('start', b.start)}</div>
        <div class="field custom-when"><label>النهاية (24 ساعة)</label>${timeSelect('end', b.end)}</div>
      </form>`,
      actions: [
        {
          label: 'إرسال الاقتراح', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            const v = readForm(f);
            const cur = Store.get(`bookings/${b.id}`);
            if (!cur || cur.status !== 'upcoming' || cur.doneByMentor || cur.doneByMentee) { toast('تعذّر التعديل: تغيّرت حالة الجلسة', 'error'); return false; }
            let prop;
            const s = v.alt && v.alt !== 'custom' ? Store.get(`slots/${v.alt}`) : null;
            if (s) prop = { date: s.date, start: s.start, end: s.end, slotId: s.id, by: kind, ts: Date.now() };
            else {
              const start = readTime(f, 'start'), end = readTime(f, 'end');
              if (!v.date) { toast('اختر التاريخ', 'error'); return false; }
              if (minutesBetween(start, end) <= 0) { toast('وقت النهاية يجب أن يكون بعد البداية', 'error'); return false; }
              prop = { date: v.date, start, end, slotId: `custom_${b.id}`, by: kind, ts: Date.now() };
            }
            if (prop.date === cur.date && prop.start === cur.start && prop.end === cur.end) { toast('اختر موعداً مختلفاً عن الموعد الحالي', 'error'); return false; }
            Store.update(`bookings/${b.id}`, { proposal: prop });
            other && Data.notify(other.id, `اقترح ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} تعديل موعد ${Data.bookingName(b)} إلى ${fmtSlot(prop)}، ادخل المنصة للموافقة أو الرفض`, { icon: 'fa-clock-rotate-left' });
            setTimeout(() => waDialog('تم إرسال الاقتراح', `الموعد البديل المقترح: <b>${fmtSlot(prop)}</b><br>الجلسة بانتظار موافقة ${kind === 'mentor' ? 'المستفيد' : 'المرشد'}.`, kind, other, proposalText(kind, cur, prop)), 220);
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ],
      onOpen: m => {
        const sync = () => {
          const v = $('input[name=alt]:checked', m.body)?.value;
          $$('.custom-when', m.body).forEach(el => { el.hidden = v && v !== 'custom'; });
        };
        $$('input[name=alt]', m.body).forEach(r => r.onchange = sync); sync();
      }
    });
  }

  async function acceptProposal(kind, me, other, b) {
    const p = b.proposal;
    if (!p || p.by === kind) return;
    if (!(await confirmDialog(`قبول الموعد البديل: ${fmtSlot(p)}؟ سيحلّ محل الموعد الحالي (${fmtSlot(b)}).`, { ok: 'قبول' }))) return;
    const history = (b.history || []).concat([{ date: b.date, start: b.start, end: b.end, by: p.by, ts: Date.now() }]);
    Store.update(`bookings/${b.id}`, { date: p.date, start: p.start, end: p.end, ...(p.slotId ? { slotId: p.slotId } : {}), changedBy: p.by, history, proposal: null });
    // الموعد الإضافي المعلن الذي انتقلت إليه الجلسة يصبح محجوزاً لبقية المستفيدين
    if (b.extra && p.slotId && Store.get(`slots/${p.slotId}`)?.extra && !Store.get(`extraTaken/${p.slotId}`)) Store.set(`extraTaken/${p.slotId}`, true);
    const txt = `وافق ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} على الموعد البديل لـ${Data.bookingName(b)}: ${fmtSlot(p)}`;
    other && Data.notify(other.id, txt, { icon: 'fa-calendar-check' });
    Data.notify('admin', txt, { icon: 'fa-calendar-check' });
    toast('تم اعتماد الموعد الجديد، والجلسة قادمة بالموعد المعدّل');
  }

  async function dropProposal(kind, me, other, b, act) {
    if (!b.proposal) return;
    const reject = act === 'reject_prop';
    if (!(await confirmDialog(reject ? 'رفض الموعد البديل وإبقاء الموعد الحالي؟' : 'سحب اقتراح الموعد البديل؟', { danger: reject, ok: reject ? 'رفض' : 'سحب' }))) return;
    Store.update(`bookings/${b.id}`, { proposal: null });
    other && Data.notify(other.id, reject
      ? `رفض ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} الموعد البديل المقترح لـ${Data.bookingName(b)}، ويبقى الموعد الحالي: ${fmtSlot(b)}`
      : `سحب ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} اقتراح تعديل موعد ${Data.bookingName(b)}، ويبقى الموعد: ${fmtSlot(b)}`, { icon: 'fa-clock-rotate-left' });
    toast(reject ? 'تم رفض الموعد البديل' : 'تم سحب الاقتراح');
  }

  /* ===== مواعيد يقترحها المستفيد: يعتمد المرشد أحدها فتُجدول للطرفين ===== */
  const wishPill = w => ({ open: '<span class="pill st-await">بانتظار المرشد</span>', accepted: '<span class="pill st-done">اعتمده المرشد</span>', declined: '<span class="pill st-absent-mentor">لم يناسب المرشد</span>', withdrawn: '<span class="pill st-cancelled">مسحوب</span>' }[w.status] || '');
  const wishDesc = w => `<b><i class="fa-regular fa-calendar"></i> ${fmtDate(w.date)}</b><span><i class="fa-regular fa-clock"></i> ${tRange(w.start, w.end)}</span><span class="chip">${MODES[w.mode] || ''}</span>${w.note ? `<small class="muted">${esc(w.note)}</small>` : ''}`;
  const wishWhen = () => `<div class="field"><label>التاريخ <em>*</em></label><input type="date" name="date" min="${todayISO()}" required></div>
    <div class="field"><label>البداية (24 ساعة)</label>${timeSelect('start', '18:00')}</div><div class="field"><label>النهاية (24 ساعة)</label>${timeSelect('end', '19:00')}</div>
    ${fieldInput({ k: 'mode', label: 'نوع الجلسة', type: 'radio', required: true, wide: true, options: [{ value: 'inperson', label: 'حضورية' }, { value: 'online', label: 'إلكترونية' }] }, 'online')}
    ${fieldInput({ k: 'note', label: 'ملاحظة للمرشد (اختياري)', type: 'textarea', wide: true, rows: 2 })}`;

  function readWish(f) {
    if (!validateForm(f)) return null;
    const v = readForm(f), start = readTime(f, 'start'), end = readTime(f, 'end');
    if (minutesBetween(start, end) <= 0) { toast('وقت النهاية يجب أن يكون بعد البداية', 'error'); return null; }
    if (dateTimeOf(v.date, start) <= new Date()) { toast('اختر موعداً في المستقبل', 'error'); return null; }
    return { date: v.date, start, end, mode: v.mode, ...(v.note && v.note.trim() ? { note: v.note.trim().slice(0, 500) } : {}) };
  }

  function menteeWishesPanel(me, mentor) {
    if (!mentor) return '';
    const mine = Store.list('wishes').filter(w => w.menteeId === me.id && !w.extra && w.status !== 'withdrawn').sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const group = n => {
      const active = Data.activeBooking(me.id, n);
      const prevDone = n === 1 || Data.bookings({ menteeId: me.id, cohort: me.cohort }).some(x => x.session === n - 1 && x.status === 'done');
      const list = mine.filter(w => w.session === n);
      let inner;
      if (active) inner = `<p class="muted small">${sessionName(n)} مجدولة: ${fmtSlot(active)}</p>`;
      else if (!prevDone) inner = `<div class="slot-state locked"><i class="fa-solid fa-lock"></i> يُتاح الاقتراح بعد إنجاز ${sessionName(n - 1)}</div>`;
      else inner = `${list.length ? `<ul class="wish-list">${list.map(w => `<li class="is-${w.status}"><div>${wishDesc(w)}</div><div class="wish-actions">${wishPill(w)}${w.status === 'open' ? `<button class="icon-btn danger" data-wish-withdraw="${esc(w.id)}" title="سحب الاقتراح"><i class="fa-solid fa-trash"></i></button>` : ''}</div></li>`).join('')}</ul>` : '<p class="muted small">لم تقترح مواعيد لهذه الجلسة بعد</p>'}
        <p><button class="btn sm primary" data-add-wish="${n}"><i class="fa-solid fa-calendar-plus"></i> اقترح موعداً مناسباً لي</button></p>`;
      return `<div class="slot-group ${active ? 'is-booked' : ''}"><h3>${sessionName(n)}</h3>${inner}</div>`;
    };
    return `<section class="panel"><h2><i class="fa-solid fa-calendar-day"></i> اقتراح مواعيد مناسبة لي</h2>
      <p class="muted small">لا تناسبك المواعيد التي أتاحها المرشد؟ اقترح مواعيد تناسبك لكل جلسة، فإذا وافق المرشد على أحدها تُجدول الجلسة للطرفين تلقائياً.</p>
      <div class="slot-groups">${[1, 2, 3].map(group).join('')}</div></section>`;
  }

  function openAddWish(me, mentor, session) {
    openModal({
      title: `<i class="fa-solid fa-calendar-day"></i> اقتراح موعد لـ${sessionName(session)}`, size: 'md',
      body: `<form class="form-grid">${wishWhen()}</form>`,
      actions: [
        {
          label: 'إرسال الاقتراح للمرشد', cls: 'primary', onClick: m => {
            const w = readWish($('form', m.body));
            if (!w) return false;
            if (Data.activeBooking(me.id, session)) { toast('هذه الجلسة مجدولة مسبقاً', 'error'); return false; }
            Store.push('wishes', { menteeId: me.id, mentorId: mentor.id, session, ...w, status: 'open', ts: Date.now() });
            Data.notify(mentor.id, `اقترح المستفيد ${me.name} موعداً لـ${sessionName(session)}: ${fmtSlot(w)} (${MODES[w.mode]})، ادخل المنصة للموافقة عليه`, { icon: 'fa-calendar-day' });
            toast('تم إرسال الاقتراح للمرشد');
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  // جلسة إضافية: يختار المستفيد المرشد ثم يقترح موعداً
  function extraWishesBlock(me) {
    const mine = Store.list('wishes').filter(w => w.menteeId === me.id && w.extra && w.status !== 'withdrawn').sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return `<div class="slot-group"><h3>اقتراح موعد لجلسة إضافية <span class="count">${mine.length}</span></h3>
      <p class="muted small">اختر مرشداً واقترح موعداً يناسبك؛ وإذا وافق المرشد تُجدول جلسة إضافية للطرفين.</p>
      ${mine.length ? `<ul class="wish-list">${mine.map(w => `<li class="is-${w.status}"><div><span class="bp">${avatar(Data.member(w.mentorId) || {}, 'sm')}<b>${esc(Data.member(w.mentorId)?.name || 'مرشد')}</b></span>${wishDesc(w)}</div>
        <div class="wish-actions">${wishPill(w)}${w.status === 'open' ? `<button class="icon-btn danger" data-wish-withdraw="${esc(w.id)}" title="سحب الاقتراح"><i class="fa-solid fa-trash"></i></button>` : ''}</div></li>`).join('')}</ul>` : ''}
      <p><button class="btn sm primary" data-add-extra-wish><i class="fa-solid fa-calendar-plus"></i> اقترح موعداً لجلسة إضافية</button></p></div>`;
  }

  function openAddExtraWish(me) {
    const mentors = Data.members('mentor').sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
    if (!mentors.length) { toast('لا يوجد مرشدون حالياً', 'error'); return; }
    openModal({
      title: '<i class="fa-solid fa-hand-holding-heart"></i> اقتراح موعد لجلسة إضافية', size: 'md',
      body: `<form class="form-grid">${fieldInput({ k: 'mentor', label: 'المرشد', type: 'select', required: true, wide: true, options: mentors.map(m => `${m.name} (${m.code})`) }, '')}${wishWhen()}</form>`,
      actions: [
        {
          label: 'إرسال الاقتراح للمرشد', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            const w = readWish(f);
            if (!w) return false;
            const mentor = mentors.find(x => `${x.name} (${x.code})` === readForm(f).mentor);
            if (!mentor) { toast('اختر المرشد', 'error'); return false; }
            if (!Data.extraOn()) { toast('الجلسات الإضافية غير مفعّلة من الإدارة حالياً', 'error'); return false; }
            // تسجيل العلاقة يسمح بتبادل الإشعارات مع المرشد
            Store.set(`extraPairs/${me.id}_${mentor.id}`, true);
            Store.push('wishes', { menteeId: me.id, mentorId: mentor.id, extra: true, ...w, status: 'open', ts: Date.now() });
            Data.notify(mentor.id, `اقترح المستفيد ${me.name} موعداً لجلسة إضافية: ${fmtSlot(w)} (${MODES[w.mode]})، ادخل المنصة للموافقة عليه`, { icon: 'fa-calendar-day' });
            toast('تم إرسال الاقتراح للمرشد');
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  function mentorWishesPanel(me) {
    const open = Store.list('wishes').filter(w => w.mentorId === me.id && w.status === 'open' && (!w.extra || Data.extraOn()))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const row = w => {
      const mentee = Data.member(w.menteeId);
      return `<li><div><span class="bp">${avatar(mentee || {}, 'sm')}<b>${esc(mentee?.name || 'مستفيد')}</b></span>
        ${w.extra ? '<span class="chip extra-chip"><i class="fa-solid fa-hand-holding-heart"></i> جلسة إضافية</span>' : `<span class="chip">${sessionName(w.session)}</span>`}${wishDesc(w)}</div>
        <div class="wish-actions"><button class="btn xs success" data-wish-accept="${esc(w.id)}"><i class="fa-solid fa-check"></i> اعتماد وجدولة</button>
        <button class="btn xs ghost" data-wish-decline="${esc(w.id)}"><i class="fa-solid fa-xmark"></i> اعتذار</button></div></li>`;
    };
    return `<section class="panel" id="wishes-panel"><div class="panel-head"><h2><i class="fa-solid fa-calendar-day"></i> مواعيد مقترحة من المستفيدين <span class="count">${open.length}</span></h2></div>
      <p class="muted small">مواعيد يقترحها المستفيد لتناسبه. عند اعتماد أحدها تُجدول الجلسة للطرفين وتظهر في الجلسات المجدولة (أساسية أو إضافية حسب نوعها).</p>
      ${open.length ? `<ul class="wish-list">${open.map(row).join('')}</ul>` : '<p class="muted small">لا توجد مواعيد مقترحة حالياً</p>'}</section>`;
  }

  async function acceptWish(me, w) {
    if (!w || w.status !== 'open' || w.mentorId !== me.id) return;
    const mentee = Data.member(w.menteeId);
    if (!w.extra && Data.activeBooking(w.menteeId, w.session)) { toast(`${sessionName(w.session)} مجدولة مسبقاً لهذا المستفيد`, 'error'); return; }
    if (dateTimeOf(w.date, w.start) <= new Date()) { toast('الموعد المقترح فات، اعتذر عنه', 'error'); return; }
    if (!(await confirmDialog(`اعتماد الموعد ${fmtSlot(w)} (${MODES[w.mode]}) مع ${mentee?.name || 'المستفيد'} كـ${w.extra ? 'جلسة إضافية' : sessionName(w.session)}؟`, { ok: 'اعتماد' }))) return;
    const bk = { mentorId: me.id, menteeId: w.menteeId, cohort: mentee?.cohort || me.cohort, wishId: w.id, ...(w.extra ? { extra: true } : { session: w.session }),
      date: w.date, start: w.start, end: w.end, mode: w.mode, status: 'upcoming', ts: Date.now() };
    let bid;
    if (w.extra) { bid = `xw_${w.id}`; Store.set(`bookings/${bid}`, { id: bid, ...bk }); } else bid = Store.push('bookings', bk);
    Store.update(`wishes/${w.id}`, { status: 'accepted', decidedAt: Date.now(), bookingId: bid });
    // اعتماد موعد لجلسة أساسية يغلق بقية مقترحات المستفيد لها
    if (!w.extra) Store.list('wishes').filter(x => x.menteeId === w.menteeId && x.mentorId === me.id && !x.extra && x.session === w.session && x.status === 'open' && x.id !== w.id)
      .forEach(x => Store.update(`wishes/${x.id}`, { status: 'declined', decidedAt: Date.now() }));
    Data.notify(w.menteeId, `اعتمد المرشد ${me.name} موعدك المقترح، وجُدولت ${w.extra ? 'الجلسة الإضافية' : sessionName(w.session)}: ${fmtSlot(w)} (${MODES[w.mode]})`, { icon: 'fa-calendar-check' });
    toast('تم اعتماد الموعد وجدولة الجلسة للطرفين');
  }

  async function declineWish(me, w) {
    if (!w || w.status !== 'open' || w.mentorId !== me.id) return;
    if (!(await confirmDialog('الاعتذار عن هذا الموعد المقترح؟', { danger: true, ok: 'اعتذار' }))) return;
    Store.update(`wishes/${w.id}`, { status: 'declined', decidedAt: Date.now() });
    Data.notify(w.menteeId, `اعتذر المرشد ${me.name} عن الموعد الذي اقترحته (${fmtSlot(w)})، يمكنك اقتراح موعد آخر أو الحجز من مواعيده المتاحة`, { icon: 'fa-calendar-xmark' });
    toast('تم الاعتذار عن الموعد');
  }

  /* ===== إشعارات البريد الإلكتروني (تفعّلها الإدارة، ويعطّلها العضو لنفسه) ===== */
  function notifyPrefPanel(me) {
    if (Store.get('notifyMail/enabled') !== true) return '';
    const on = me.emailNotify !== false;
    return `<section class="panel notify-pref"><div><h2><i class="fa-solid fa-envelope-circle-check"></i> إشعارات البريد الإلكتروني</h2>
      <p class="muted small">تصلك تحديثات جلساتك (حجز، تعديل، إلغاء، تقييم...) على بريدك ${me.email ? `<b dir="ltr">${esc(me.email)}</b>` : '— <b>لم تُضف بريداً في بطاقتك بعد</b>، اضغط «تعديل بياناتي» لإضافته'}.</p></div>
      <label class="switch"><input type="checkbox" data-email-notify ${on ? 'checked' : ''}><span></span> ${on ? 'مفعّلة' : 'معطّلة'}</label></section>`;
  }

  /* ===== التقييمات ===== */
  const reviewLabel = b => {
    const a = Auth.current(), who = Data.member(a?.kind === 'mentor' ? b.menteeId : b.mentorId)?.name;   // اسم الطرف الآخر يميّز جلسات المستفيدين المتعددين
    return `${Data.bookingName(b)} — ${fmtDate(b.date)}${b.extra ? ` ${b.start}` : ''}${who ? ` — ${who}` : ''}`;
  };

  function reviewsPanel(kind, me, other, bookings) {
    const done = bookings.filter(b => b.status === 'done');
    // الجلسات الإضافية المنجزة تدخل في التقييمات أيضاً (وتُميَّز بشارة)
    const extraDone = Data.bookings({ [kind === 'mentor' ? 'mentorId' : 'menteeId']: me.id, extra: true, cohort: me.cohort }).filter(b => b.status === 'done');
    const since = me.cohortSince || 0;   // تقييمات الدفعات السابقة في زر «الدفعات السابقة»
    const mine = Data.reviews({ authorId: me.id }).filter(r => (r.ts || 0) >= since);
    const reviewedBookings = new Set(mine.filter(r => r.type === 'session').map(r => r.bookingId));
    const pendingDone = done.concat(extraDone).filter(b => !reviewedBookings.has(b.id));
    const received = Data.reviews({ targetId: me.id }).filter(r => r.status === 'approved' && (r.ts || 0) >= since);
    // التقييم الختامي لكل طرف أنجز معه ثلاث جلسات (المرشد قد يكون له عدة مستفيدين)
    const partnerOf = b => (kind === 'mentor' ? b.menteeId : b.mentorId), doneBy = {};
    done.forEach(b => { (doneBy[partnerOf(b)] = doneBy[partnerOf(b)] || []).push(b); });
    const finished = Object.keys(doneBy).filter(id => doneBy[id].length >= 3);
    const pendingFinal = finished.filter(id => !mine.some(r => r.type === 'final' && r.targetId === id));
    const otherLabel = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    const revItem = (r, showStatus) => `<li class="review">
      <header><b>${r.type === 'final' ? 'التقييم الختامي' : r.type === 'program' ? 'تقييم البرنامج' : r.extraSession ? 'جلسة إضافية' : sessionName(r.session)}</b>${r.extraSession ? '<span class="chip extra-chip"><i class="fa-solid fa-hand-holding-heart"></i> جلسة إضافية</span>' : ''}
      ${showStatus ? `<span class="pill ${reviewStatus[r.status]?.[1] || ''}">${reviewStatus[r.status]?.[0] || ''}</span>` : ''}<small>${fmtTs(r.ts)}</small></header>
      <p>${nl2br(r.text)}</p>${r.extra ? `<p class="extra"><b>${r.from === 'mentor' ? 'التوصية' : 'المستفاد من الجلسة'}:</b> ${nl2br(r.extra)}</p>` : ''}</li>`;

    return `<section class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-star"></i> التقييمات ${kind === 'mentor' ? 'والتوصيات' : 'والانطباعات'}</h2>
      ${pendingFinal.map(id => `<button class="btn primary" data-final="${esc(id)}"><i class="fa-solid fa-flag-checkered"></i> ${finished.length > 1 ? `التقييم الختامي — ${esc(Data.member(id)?.name || '')}` : 'تقييم البرنامج والتقييم الختامي'}</button>`).join('')}${!pendingFinal.length && finished.length ? '<button class="btn ghost" disabled><i class="fa-solid fa-flag-checkered"></i> تم إرسال التقييم الختامي</button>' : ''}</div>
      <div class="review-grid">
        <div class="review-box">
          <h3>كتابة تقييم ${otherLabel}</h3>
          ${pendingDone.length ? `<form class="form-grid one" data-review-form>
            ${fieldInput({ k: 'booking', label: 'اختر الجلسة المنجزة', type: 'select', required: true, options: pendingDone.map(reviewLabel) })}
            ${fieldInput({ k: 'text', label: `تقييمك لـ${otherLabel}`, type: 'textarea', required: true, rows: 3 })}
            ${fieldInput({ k: 'extra', label: kind === 'mentor' ? 'توصية للمستفيد كنتيجة للجلسة' : 'انطباعك والمستفاد من الجلسة', type: 'textarea', rows: 3 })}
            <button class="btn primary" type="submit"><i class="fa-solid fa-paper-plane"></i> إرسال التقييم</button>
            <small class="hint">يظهر التقييم لـ${otherLabel} بعد اعتماده من الإدارة.</small>
          </form>` : `<p class="muted small">${done.length ? 'قيّمت جميع الجلسات المنجزة.' : 'يمكنك كتابة التقييم بعد إنجاز الجلسة.'}</p>`}
          ${mine.length ? `<h4>تقييماتي المرسلة</h4><ul class="review-list">${mine.map(r => revItem(r, r.type !== 'program')).join('')}</ul>` : ''}
        </div>
        <div class="review-box">
          <h3>تقييمات ${otherLabel} لك</h3>
          ${received.length ? `<ul class="review-list">${received.map(r => revItem(r, false)).join('')}</ul>` : '<p class="muted small">لا توجد تقييمات معتمدة بعد.</p>'}
        </div>
      </div>
    </section>`;
  }

  function submitReview(kind, me, other, form, done) {
    if (!validateForm(form)) return;
    const v = readForm(form);
    const reviewed = new Set(Data.reviews({ authorId: me.id, type: 'session' }).map(r => r.bookingId));
    const list = done.filter(b => !reviewed.has(b.id));
    const b = list.find(x => reviewLabel(x) === v.booking);
    if (!b) return;
    Store.push('reviews', {
      type: 'session', from: kind, authorId: me.id, targetId: kind === 'mentor' ? b.menteeId : b.mentorId, mentorId: b.mentorId, menteeId: b.menteeId,
      bookingId: b.id, ...(b.extra ? { extraSession: true } : { session: b.session }), text: v.text, extra: v.extra, status: 'pending', ts: Date.now()
    });
    Data.notify('admin', `تقييم جديد من ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} عن ${Data.bookingName(b)} بانتظار الاعتماد`, { icon: 'fa-star' });
    toast('تم إرسال التقييم، وسيظهر بعد اعتماد الإدارة');
  }

  function openFinal(kind, me, other) {
    const otherLabel = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    // تقييم البرنامج مرة واحدة لكل عضو في الدفعة (حتى لو أنهى عدة مستفيدين)
    const hasProgram = Data.reviews({ authorId: me.id, type: 'program' }).some(r => (r.ts || 0) >= (me.cohortSince || 0));
    openModal({
      title: '<i class="fa-solid fa-flag-checkered"></i> ختام البرنامج', size: 'md',
      body: `<form class="form-grid one">
        <p class="muted">شكراً لإتمامك الجلسات الثلاث! شاركنا تقييمك الختامي.</p>
        ${fieldInput({ k: 'final', label: `التقييم العام لـ${otherLabel} (${esc(other?.name || '')})`, type: 'textarea', required: true, rows: 3 })}
        ${hasProgram ? '' : fieldInput({ k: 'program', label: 'تقييمك العام لبرنامج إشراق', type: 'textarea', required: true, rows: 3 })}
        ${fieldInput({ k: 'message', label: 'رسالة للإدارة (اختياري)', type: 'textarea', rows: 3 })}
      </form>`,
      actions: [
        {
          label: 'إرسال', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            if (!validateForm(f)) return false;
            const v = readForm(f);
            const base = { from: kind, authorId: me.id, authorName: me.name, mentorId: kind === 'mentor' ? me.id : other?.id, menteeId: kind === 'mentee' ? me.id : other?.id, ts: Date.now() };
            Store.push('reviews', { ...base, type: 'final', targetId: other?.id || '', text: v.final, status: 'pending' });
            if (!hasProgram) Store.push('reviews', { ...base, type: 'program', targetId: 'admin', text: v.program, status: 'approved', featured: false });
            if (v.message) Store.push('inbox', { fromId: me.id, fromName: me.name, role: kind, body: v.message, ts: Date.now() });
            Data.notify('admin', `أرسل ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} التقييم الختامي وتقييم البرنامج`, { icon: 'fa-flag-checkered' });
            toast('شكراً لك! تم إرسال التقييم الختامي');
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  function editProfile(member, onSaved) {
    const fields = PROFILE_FIELDS.map(f => ({ ...f, label: typeof f.label === 'object' ? f.label[member.role] : f.label, wide: f.type === 'textarea' || f.k === 'photo' }));
    openModal({
      title: `<i class="fa-solid fa-pen"></i> تعديل البطاقة التعريفية <span class="code-chip">${esc(member.code)}</span>`, size: 'lg',
      body: `<form class="form-grid">${fields.map(f => fieldInput(f, member[f.k] || '')).join('')}
        <div class="field wide photo-preview">${avatar(member, 'xl')}<small class="hint">شارك الصورة في Google Drive بخيار «أي شخص لديه الرابط» ثم الصق الرابط.</small></div></form>`,
      actions: [
        {
          label: 'حفظ', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            if (!validateForm(f)) return false;
            Data.saveMember(member.id, readForm(f));
            toast('تم حفظ البيانات');
            onSaved && onSaved();
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ],
      onOpen: m => {
        const inp = $('[name=photo]', m.body);
        inp.addEventListener('input', () => { $('.photo-preview .avatar', m.body).outerHTML = avatar({ ...member, photo: inp.value, name: $('[name=name]', m.body).value }, 'xl'); });
      }
    });
  }

  function wire(root, kind, me, other) {
    $('[data-logout]', root).onclick = () => Auth.logout();
    $('[data-open-archive]', root)?.addEventListener('click', () => openArchive(kind, me));
    // قبل إطلاق الدفعة أو بعد أرشفتها: تُمنع إجراءات الجلسات (والقواعد تمنعها في قاعدة البيانات أيضاً)
    const st = Bands.state(me.cohort);
    if (st !== 'live') {
      const block = e => { if (e.target.closest?.(LOCKED_SEL)) { e.stopImmediatePropagation(); e.preventDefault(); toast(st === 'archived' ? 'دفعتك مؤرشفة؛ لا يمكن إضافة أو تعديل الجلسات' : 'تُفتح هذه الإجراءات بعد الإطلاق الرسمي لدفعتك', 'error'); } };
      root.addEventListener('click', block, true); root.addEventListener('submit', block, true);
      root.classList.add('cohort-locked');
    }
    $('[data-edit-me]', root)?.addEventListener('click', () => editProfile(me));
    $('[data-download-card]', root)?.addEventListener('click', () => CardImage.download(Data.member(me.id)));
    $('[data-add-slot]', root)?.addEventListener('click', () => openAddSlot(me));
    $('[data-add-extra-slot]', root)?.addEventListener('click', () => openAddSlot(me, 1, true));
    $('[data-badge-download]', root)?.addEventListener('click', () => Badge.download(me));
    const bimg = $('[data-badge-img]', root); if (bimg) Badge.render(me).then(c => { bimg.src = c.toDataURL('image/png'); });
    $$('[data-add-slot-alert]', root).forEach(b => b.onclick = () => openAddSlot(me, +b.dataset.addSlotAlert));
    $$('[data-dismiss-rem]', root).forEach(b => b.onclick = () => Store.update(`notifications/${me.id}/${b.dataset.dismissRem}`, { dismissed: true, read: true }));
    $$('[data-del-slot]', root).forEach(b => b.onclick = async () => {
      if (await confirmDialog('حذف هذا الموعد؟', { danger: true, ok: 'حذف' })) Store.remove(`slots/${b.dataset.delSlot}`);
    });
    $$('[data-book]', root).forEach(b => b.onclick = () => { const sl = Store.get(`slots/${b.dataset.book}`); if (sl) openBook(me, sl); });
    $$('[data-cal]', root).forEach(b => b.onclick = () => Cal.open(b.dataset.cal, kind));
    $$('[data-bk]', root).forEach(b => b.onclick = () => bookingAction(kind, me, other, b.dataset.id, b.dataset.bk));
    const rf = $('[data-review-form]', root);
    rf && rf.addEventListener('submit', e => {
      e.preventDefault();
      const own = { ...(kind === 'mentor' ? { mentorId: me.id } : { menteeId: me.id }), cohort: me.cohort };
      const done = Data.bookings(own).concat(Data.bookings({ ...own, extra: true })).filter(b => b.status === 'done');
      submitReview(kind, me, other, rf, done);
    });
    $$('[data-final]', root).forEach(b => b.onclick = () => openFinal(kind, me, Data.member(b.dataset.final) || other));
    $$('[data-add-wish]', root).forEach(b => b.onclick = () => other && openAddWish(me, other, +b.dataset.addWish));
    $('[data-add-extra-wish]', root)?.addEventListener('click', () => openAddExtraWish(me));
    $$('[data-wish-withdraw]', root).forEach(b => b.onclick = async () => {
      if (await confirmDialog('سحب هذا الاقتراح؟', { danger: true, ok: 'سحب' })) Store.update(`wishes/${b.dataset.wishWithdraw}`, { status: 'withdrawn', decidedAt: Date.now() });
    });
    $$('[data-wish-accept]', root).forEach(b => b.onclick = () => acceptWish(me, Store.get(`wishes/${b.dataset.wishAccept}`)));
    $$('[data-wish-decline]', root).forEach(b => b.onclick = () => declineWish(me, Store.get(`wishes/${b.dataset.wishDecline}`)));
    $('[data-email-notify]', root)?.addEventListener('change', e => {
      Store.update(`contacts/${me.id}`, { emailNotify: e.target.checked });
      toast(e.target.checked ? 'تم تفعيل إشعارات البريد' : 'تم تعطيل إشعارات البريد');
    });
  }

  return { render, topbar, editProfile };
})();
