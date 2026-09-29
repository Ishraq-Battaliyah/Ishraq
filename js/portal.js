/* لوحات المرشد والمستفيد */

const Portal = (() => {
  const isDue = b => Date.now() >= dateTimeOf(b.date, b.start).getTime();
  const reviewStatus = { pending: ['بانتظار اعتماد الإدارة', 'st-upcoming'], approved: ['معتمد', 'st-done'], rejected: ['غير معتمد', 'st-absent-mentor'] };

  function render(root, kind, id) {
    const me = Data.member(id);
    if (!me || me.role !== kind) { Auth.logout(); return; }
    const other = kind === 'mentor' ? Data.menteeOf(me.id) : Data.mentorOf(me.id);
    // بيانات تواصل الطرف المرتبط تُقرأ من مسار خاص تسمح به القواعد لهذا العضو فقط
    if (other && String(Store.scope || '').startsWith('member:')) Store.watch(`contacts/${other.id}`);
    const otherLabel = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    const bookings = Data.bookings(kind === 'mentor' ? { mentorId: me.id } : { menteeId: me.id });
    const msgs = Data.messagesFor(me);

    root.innerHTML = `<div class="dash member-portal ${kind}">
      ${topbar(kind, me)}
      <main class="container dash-main">
        ${kind === 'mentor' ? mentorAlerts(me) : ''}
        <section class="dash-hello">
          <div>${avatar(me, 'lg')}</div>
          <div><small>${kind === 'mentor' ? 'لوحة تحكم المرشد' : 'لوحة تحكم المستفيد'} · ${esc(Data.cohort(me.cohort)?.name || '')}</small>
          <h1>أهلاً، ${esc(me.name)}</h1><span class="code-chip">${esc(me.code)}</span></div>
          <div class="hello-stats">${progressRing(Data.doneCount(kind === 'mentor' ? 'mentorId' : 'menteeId', me.id))}</div>
        </section>

        ${Events.portalSection(me)}

        ${Support.memberSection(me)}

        ${msgs.length ? `<section class="panel msgs"><h2><i class="fa-solid fa-envelope-open-text"></i> رسائل من الإدارة</h2>
          <ul class="msg-list">${msgs.map(x => `<li><i class="fa-solid fa-bullhorn"></i><div>${x.title ? `<b>${esc(x.title)}</b>` : ''}<p>${nl2br(x.body)}</p><small>${fmtTs(x.ts)}</small></div></li>`).join('')}</ul></section>` : ''}

        <section class="panel">
          <h2><i class="fa-solid fa-id-card"></i> البطاقات التعريفية</h2>
          <div class="pair-cards">
            <div><h3 class="sub">بطاقتي</h3>${memberCard(me, { actions: '<button class="btn sm primary" data-edit-me><i class="fa-solid fa-pen"></i> تعديل بياناتي</button><button class="btn sm ghost" data-download-card title="حفظ البطاقة كصورة PNG لمشاركتها"><i class="fa-solid fa-download"></i> حفظ البطاقة</button>' })}</div>
            <div class="pair-link"><i class="fa-solid fa-handshake"></i></div>
            <div><h3 class="sub">${otherLabel} المخصص لك</h3>${other ? memberCard(other, { showCode: false }) : emptyState(`لم يتم تعيين ${otherLabel} لك بعد من قبل الإدارة`, 'fa-user-clock')}</div>
          </div>
        </section>

        ${kind === 'mentor' ? slotsPanel(me) : bookingPanel(me, other)}
        ${scheduledPanel(kind, me, other, bookings)}
        ${reviewsPanel(kind, me, other, bookings)}
      </main>
    </div>`;
    wire(root, kind, me, other);
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

  function progressRing(done) {
    const p = Math.min(3, done) / 3;
    const c = 2 * Math.PI * 34;
    return `<div class="ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${esc(c)}" stroke-dashoffset="${c * (1 - p)}"/></svg>
      <div><b>${Math.min(3, done)}/3</b><small>جلسات منجزة</small></div></div>`;
  }

  /* ===== المرشد: المواعيد ===== */
  function slotsPanel(me) {
    const launched = !!Bands.launchedAt(me.cohort);
    const slots = Data.slots(me.id);
    const booked = new Set(Data.bookings({ mentorId: me.id }).filter(b => b.status !== 'absent_mentor' && b.status !== 'absent_mentee').map(b => b.slotId));
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

  function openAddSlot(me, sessionNum = 1) {
    openModal({
      title: '<i class="fa-solid fa-calendar-plus"></i> إضافة موعد جديد', size: 'md',
      body: `<form class="form-grid">
        ${fieldInput({ k: 'session', label: 'رقم الجلسة', type: 'select', required: true, options: ['الأولى', 'الثانية', 'الثالثة'] }, ['الأولى', 'الثانية', 'الثالثة'][sessionNum - 1] || 'الأولى')}
        <div class="field"><label>التاريخ <em>*</em></label><input type="date" name="date" min="${todayISO()}" required></div>
        <div class="field"><label>بداية الجلسة (24 ساعة)</label>${timeSelect('start', '18:00')}</div>
        <div class="field"><label>نهاية الجلسة (24 ساعة)</label>${timeSelect('end', '19:00')}</div>
        ${fieldInput({ k: 'mode', label: 'نوع الجلسة', type: 'radio', required: true, wide: true, options: [{ value: 'inperson', label: 'حضورية' }, { value: 'online', label: 'إلكترونية' }, { value: 'both', label: 'كلاهما (يختار المستفيد)' }] }, 'both')}
        ${fieldInput({ k: 'summary', label: 'موجز عن المحتوى المتوقع للجلسة', type: 'textarea', wide: true, rows: 3 })}
      </form>`,
      actions: [
        {
          label: 'حفظ الموعد', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            if (!validateForm(f)) return false;
            const v = readForm(f);
            const session = ['الأولى', 'الثانية', 'الثالثة'].indexOf(v.session) + 1;
            const start = readTime(f, 'start'), end = readTime(f, 'end');
            if (minutesBetween(start, end) <= 0) { toast('وقت النهاية يجب أن يكون بعد وقت البداية', 'error'); return false; }
            const slots = Data.slots(me.id).concat([{ session, date: v.date }]);
            const first = n => slots.filter(s => s.session === n).map(s => s.date).sort()[0];
            if (!Bands.launchedAt(me.cohort)) { toast('تُفتح إضافة المواعيد بعد إطلاق الدفعة', 'error'); return false; }
            if (session > 1 && !first(session - 1)) { toast(`أضف مواعيد ${sessionName(session - 1)} أولاً`, 'error'); return false; }
            Store.push('slots', { mentorId: me.id, session, date: v.date, start, end, mode: v.mode, summary: v.summary, ts: Date.now() });
            const mentee = Data.menteeOf(me.id);
            mentee && Data.notify(mentee.id, `أضاف مرشدك موعداً جديداً لـ${sessionName(session)}: ${fmtDate(v.date)} ${start}`, { icon: 'fa-calendar-plus' });
            toast('تمت إضافة الموعد');
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  /* ===== المستفيد: الحجز ===== */
  function bookingPanel(me, mentor) {
    if (!mentor) return `<section class="panel"><h2><i class="fa-solid fa-calendar-check"></i> المواعيد المتاحة</h2>${emptyState('ستظهر المواعيد هنا بعد تعيين مرشد لك', 'fa-calendar')}</section>`;
    const slots = Data.slots(mentor.id);
    const taken = new Set(Data.bookings({ mentorId: mentor.id }).filter(b => ['upcoming', 'done'].includes(b.status)).map(b => b.slotId));
    const group = n => {
      const active = Data.activeBooking(me.id, n);
      const prevDone = n === 1 || Data.bookings({ menteeId: me.id }).some(b => b.session === n - 1 && b.status === 'done');
      let inner;
      if (active) inner = `<div class="slot-state">${bookingPill(active, 'mentee')} <span>${fmtSlot(active)}</span></div>`;
      else if (!prevDone) inner = `<div class="slot-state locked"><i class="fa-solid fa-lock"></i> يُتاح الحجز بعد إنجاز ${sessionName(n - 1)}</div>`;
      else {
        const list = slots.filter(s => s.session === n && !taken.has(s.id) && dateTimeOf(s.date, s.start) > new Date());
        inner = list.length ? `<ul class="slot-list">${list.map(s => `<li>
          <div><b><i class="fa-regular fa-calendar"></i> ${fmtDate(s.date)}</b><span><i class="fa-regular fa-clock"></i> ${tRange(s.start, s.end)}</span>
          <span class="chip">${MODES[s.mode] || ''}</span>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}</div>
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
      title: `حجز ${sessionName(slot.session)}`, size: 'sm',
      body: `<form><p class="confirm-msg"><b>${fmtSlot(slot)}</b><br>مع المرشد: ${esc(mentor?.name || '')}</p>
        ${slot.summary ? `<p class="muted">${esc(slot.summary)}</p>` : ''}
        ${slot.mode === 'both' ? fieldInput({ k: 'mode', label: 'اختر نوع الجلسة', type: 'radio', required: true, options: [{ value: 'inperson', label: 'حضورية' }, { value: 'online', label: 'إلكترونية (افتراضية)' }] }, '') : `<p><span class="chip">${MODES[slot.mode]}</span></p>`}
      </form>`,
      actions: [
        {
          label: 'تأكيد الحجز', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            if (!validateForm(f)) return false;
            if (Data.activeBooking(me.id, slot.session)) { toast('هذه الجلسة محجوزة مسبقاً', 'error'); return; }
            const mode = slot.mode === 'both' ? readForm(f).mode : slot.mode;
            Store.push('bookings', {
              mentorId: slot.mentorId, menteeId: me.id, cohort: me.cohort, slotId: slot.id, session: slot.session,
              date: slot.date, start: slot.start, end: slot.end, mode, summary: slot.summary || '', status: 'upcoming', ts: Date.now()
            });
            Data.notify(slot.mentorId, `حجز المستفيد ${me.name} ${sessionName(slot.session)}: ${fmtSlot(slot)} (${MODES[mode]})`, { icon: 'fa-calendar-check' });
            toast('تم حجز الجلسة بنجاح');
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  /* ===== الجلسات المجدولة ===== */
  function scheduledPanel(kind, me, other, bookings) {
    const rows = bookings.map(b => {
      const due = isDue(b);
      let actions = '';
      if (b.status === 'upcoming') {
        const dis = due ? '' : 'disabled title="يتفعل عند حلول موعد الجلسة"';
        const confirmedByMe = kind === 'mentor' ? b.doneByMentor : b.doneByMentee;
        const anyConfirmed = b.doneByMentor || b.doneByMentee;
        const doneBtn = confirmedByMe ? '' : `<button class="btn xs success" data-bk="done" data-id="${esc(b.id)}" ${dis}><i class="fa-solid fa-check"></i> تم إنجاز الجلسة</button>`;
        if (kind === 'mentor') {
          actions = `${doneBtn}
            <button class="btn xs warn" data-bk="absent_mentee" data-id="${esc(b.id)}" ${dis}><i class="fa-solid fa-user-xmark"></i> ملغاة لغياب المستفيد</button>
            ${anyConfirmed ? '' : `<button class="btn xs ghost" data-bk="resched" data-id="${esc(b.id)}"><i class="fa-solid fa-clock-rotate-left"></i> تغيير الموعد</button>`}`;
        } else {
          actions = `${doneBtn}
            <button class="btn xs danger" data-bk="absent_mentor" data-id="${esc(b.id)}" ${dis}><i class="fa-solid fa-user-slash"></i> ملغاة لغياب المرشد</button>
            ${anyConfirmed ? '' : `<button class="btn xs ghost" data-bk="resched" data-id="${esc(b.id)}"><i class="fa-solid fa-pen"></i> تعديل الحجز</button>`}`;
        }
        if (b.changedBy === kind && other?.whatsapp) {
          actions += `<a class="btn xs wa" href="${esc(waLink(other.whatsapp, rescheduleText(kind, b)))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> إشعار ${kind === 'mentor' ? 'المستفيد' : 'المرشد'}</a>`;
        }
      }
      return `<tr>
        <td data-l="الجلسة"><b>${sessionName(b.session)}</b></td>
        <td data-l="الموعد">${fmtDate(b.date)}<br><small>${tRange(b.start, b.end)}</small>${b.changedBy ? `<br><small class="muted"><i class="fa-solid fa-rotate"></i> عُدّل الموعد</small>` : ''}</td>
        <td data-l="النوع">${MODES[b.mode] || ''}</td>
        <td data-l="المحتوى">${esc(b.summary || '—')}</td>
        <td data-l="الحالة">${bookingPill(b, kind)}</td>
        <td data-l="" class="row-actions">${actions}</td>
      </tr>`;
    }).join('');
    return `<section class="panel"><h2><i class="fa-solid fa-list-check"></i> الجلسات المجدولة</h2>
      ${bookings.length ? `<div class="table-wrap"><table class="table rtable"><thead><tr><th>الجلسة</th><th>الموعد</th><th>النوع</th><th>المحتوى</th><th>الحالة</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${statsBoxes(Data.stats(bookings))}` : emptyState(kind === 'mentor' ? 'لم يحجز المستفيد أي جلسة بعد' : 'لم تحجز أي جلسة بعد', 'fa-calendar-xmark')}
    </section>`;
  }

  function rescheduleText(kind, b) {
    const when = `${fmtDate(b.date)} الساعة ${tRange(b.start, b.end)}`;
    return kind === 'mentor'
      ? `عزيزي مستفيد الجلسة الإرشادية في إشراق، لظرف طارئ تم تغيير موعد الجلسة إلى "${when}" في حال كان مناسباً لك فضلاً التأكيد أو اقتراح موعد أنسب`
      : `عزيزي مرشد الجلسة الإرشادية في إشراق، لظرف طارئ تم تغيير موعد الجلسة إلى "${when}" في حال كان مناسباً لك فضلاً التأكيد أو اقتراح موعد أنسب`;
  }

  async function bookingAction(kind, me, other, id, act) {
    const b = Store.get(`bookings/${id}`);
    if (!b) return;
    if (act === 'resched') return openReschedule(kind, me, other, b);
    if (!isDue(b) || b.status !== 'upcoming') return;
    const otherRole = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    const myRole = kind === 'mentor' ? 'المرشد' : 'المستفيد';
    if (act === 'done') {
      // الإنجاز يحتاج تأكيد الطرفين
      if (!(await confirmDialog(`تأكيد إنجاز ${sessionName(b.session)}؟ ${b.doneByMentor || b.doneByMentee ? '' : `ستُحتسب منجزة بعد تأكيد ${otherRole} أيضاً.`}`))) return;
      const cur = Store.get(`bookings/${id}`) || b;
      const upd = { [kind === 'mentor' ? 'doneByMentor' : 'doneByMentee']: Date.now() };
      const otherConfirmed = kind === 'mentor' ? cur.doneByMentee : cur.doneByMentor;
      if (otherConfirmed) {
        Object.assign(upd, { status: 'done', statusTs: Date.now(), statusBy: 'both' });
        Store.update(`bookings/${id}`, upd);
        const txt = `تم إنجاز ${sessionName(b.session)} بتأكيد الطرفين: ${kind === 'mentor' ? me.name : other?.name || ''} و${kind === 'mentor' ? other?.name || '' : me.name}`;
        Data.notify('admin', txt, { icon: 'fa-circle-check' });
        other && Data.notify(other.id, txt, { icon: 'fa-circle-check' });
        toast('تم تأكيد الطرفين — الجلسة منجزة');
      } else {
        Store.update(`bookings/${id}`, upd);
        other && Data.notify(other.id, `أكّد ${myRole} ${me.name} إنجاز ${sessionName(b.session)}، فضلاً أكّد الإنجاز من صفحتك`, { icon: 'fa-circle-check' });
        toast(`تم تسجيل تأكيدك — بانتظار تأكيد ${otherRole}`);
      }
      return;
    }
    const msgs = {
      absent_mentee: ['تأكيد إلغاء الجلسة لغياب المستفيد؟', `أُلغيت ${sessionName(b.session)} لغياب المستفيد ${other?.name || ''}`, 'fa-user-xmark'],
      absent_mentor: ['تأكيد إلغاء الجلسة لغياب المرشد؟', `أُلغيت ${sessionName(b.session)} لغياب المرشد ${other?.name || ''}`, 'fa-user-slash']
    };
    if (!msgs[act]) return;
    if (!(await confirmDialog(msgs[act][0], { danger: true }))) return;
    Store.update(`bookings/${id}`, { status: act, statusTs: Date.now(), statusBy: kind });
    Data.notify('admin', msgs[act][1], { icon: msgs[act][2] });
    other && Data.notify(other.id, msgs[act][1], { icon: msgs[act][2] });
    toast('تم تحديث حالة الجلسة');
  }

  function openReschedule(kind, me, other, b) {
    const mentorId = b.mentorId;
    const taken = new Set(Data.bookings({ mentorId }).filter(x => ['upcoming', 'done'].includes(x.status)).map(x => x.slotId));
    const alt = kind === 'mentee' ? Data.slots(mentorId).filter(s => s.session === b.session && s.id !== b.slotId && !taken.has(s.id) && dateTimeOf(s.date, s.start) > new Date()) : [];
    openModal({
      title: kind === 'mentor' ? 'تغيير موعد الجلسة' : 'تعديل الحجز', size: 'md',
      body: `<form class="form-grid">
        <p class="wide muted">الموعد الحالي: <b>${fmtSlot(b)}</b></p>
        ${alt.length ? `<div class="field wide"><label>اختر موعداً آخر من المواعيد المتاحة</label><div class="radio-col">${alt.map(s => `<label class="radio"><input type="radio" name="alt" value="${esc(s.id)}"><span>${fmtSlot(s)} · ${MODES[s.mode]}</span></label>`).join('')}
          <label class="radio"><input type="radio" name="alt" value="custom" checked><span>اقتراح موعد آخر</span></label></div></div>` : ''}
        <div class="field custom-when"><label>التاريخ الجديد</label><input type="date" name="date" min="${todayISO()}" value="${esc(b.date)}"></div>
        <div class="field custom-when"><label>البداية (24 ساعة)</label>${timeSelect('start', b.start)}</div>
        <div class="field custom-when"><label>النهاية (24 ساعة)</label>${timeSelect('end', b.end)}</div>
      </form>`,
      actions: [
        {
          label: 'حفظ الموعد الجديد', cls: 'primary', onClick: m => {
            const f = $('form', m.body);
            const v = readForm(f);
            let upd;
            if (v.alt && v.alt !== 'custom' && Store.get(`slots/${v.alt}`)) {
              const s = Store.get(`slots/${v.alt}`);
              upd = { slotId: s.id, date: s.date, start: s.start, end: s.end, summary: s.summary || b.summary };
            } else {
              const start = readTime(f, 'start'), end = readTime(f, 'end');
              if (!v.date) { toast('اختر التاريخ', 'error'); return false; }
              if (minutesBetween(start, end) <= 0) { toast('وقت النهاية يجب أن يكون بعد البداية', 'error'); return false; }
              upd = { slotId: `custom_${b.id}`, date: v.date, start, end };
            }
            const history = (b.history || []).concat([{ date: b.date, start: b.start, end: b.end, by: kind, ts: Date.now() }]);
            Store.update(`bookings/${b.id}`, { ...upd, changedBy: kind, history });
            const nb = { ...b, ...upd };
            other && Data.notify(other.id, `قام ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} بتغيير موعد ${sessionName(b.session)} إلى ${fmtSlot(nb)}`, { icon: 'fa-clock-rotate-left' });
            setTimeout(() => openModal({
              title: 'تم تغيير الموعد', size: 'sm',
              body: `<div class="success-msg"><i class="fa-solid fa-circle-check"></i><p>الموعد الجديد: <b>${fmtSlot(nb)}</b></p></div>`,
              actions: other?.whatsapp
                ? [{ label: `<i class="fa-brands fa-whatsapp"></i> إشعار ${kind === 'mentor' ? 'المستفيد' : 'المرشد'}`, cls: 'wa', onClick: () => window.open(waLink(other.whatsapp, rescheduleText(kind, nb)), '_blank') }, { label: 'إغلاق', cls: 'ghost' }]
                : [{ label: 'إغلاق', cls: 'primary' }]
            }), 220);
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

  /* ===== التقييمات ===== */
  function reviewsPanel(kind, me, other, bookings) {
    const done = bookings.filter(b => b.status === 'done');
    const mine = Data.reviews({ authorId: me.id });
    const reviewedBookings = new Set(mine.filter(r => r.type === 'session').map(r => r.bookingId));
    const pendingDone = done.filter(b => !reviewedBookings.has(b.id));
    const received = Data.reviews({ targetId: me.id }).filter(r => r.status === 'approved');
    const finalDone = mine.some(r => r.type === 'final');
    const otherLabel = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    const revItem = (r, showStatus) => `<li class="review">
      <header><b>${r.type === 'final' ? 'التقييم الختامي' : r.type === 'program' ? 'تقييم البرنامج' : sessionName(r.session)}</b>
      ${showStatus ? `<span class="pill ${reviewStatus[r.status]?.[1] || ''}">${reviewStatus[r.status]?.[0] || ''}</span>` : ''}<small>${fmtTs(r.ts)}</small></header>
      <p>${nl2br(r.text)}</p>${r.extra ? `<p class="extra"><b>${r.from === 'mentor' ? 'التوصية' : 'المستفاد من الجلسة'}:</b> ${nl2br(r.extra)}</p>` : ''}</li>`;

    return `<section class="panel">
      <div class="panel-head"><h2><i class="fa-solid fa-star"></i> التقييمات ${kind === 'mentor' ? 'والتوصيات' : 'والانطباعات'}</h2>
      ${done.length >= 3 ? `<button class="btn ${finalDone ? 'ghost' : 'primary'}" data-final ${finalDone ? 'disabled' : ''}><i class="fa-solid fa-flag-checkered"></i> ${finalDone ? 'تم إرسال التقييم الختامي' : 'تقييم البرنامج والتقييم الختامي'}</button>` : ''}</div>
      <div class="review-grid">
        <div class="review-box">
          <h3>كتابة تقييم ${otherLabel}</h3>
          ${pendingDone.length ? `<form class="form-grid one" data-review-form>
            ${fieldInput({ k: 'booking', label: 'اختر الجلسة المنجزة', type: 'select', required: true, options: pendingDone.map(b => `${sessionName(b.session)} — ${fmtDate(b.date)}`) })}
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
    const b = list.find(x => `${sessionName(x.session)} — ${fmtDate(x.date)}` === v.booking);
    if (!b) return;
    Store.push('reviews', {
      type: 'session', from: kind, authorId: me.id, targetId: other?.id || '', mentorId: b.mentorId, menteeId: b.menteeId,
      bookingId: b.id, session: b.session, text: v.text, extra: v.extra, status: 'pending', ts: Date.now()
    });
    Data.notify('admin', `تقييم جديد من ${kind === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name} عن ${sessionName(b.session)} بانتظار الاعتماد`, { icon: 'fa-star' });
    toast('تم إرسال التقييم، وسيظهر بعد اعتماد الإدارة');
  }

  function openFinal(kind, me, other) {
    const otherLabel = kind === 'mentor' ? 'المستفيد' : 'المرشد';
    openModal({
      title: '<i class="fa-solid fa-flag-checkered"></i> ختام البرنامج', size: 'md',
      body: `<form class="form-grid one">
        <p class="muted">شكراً لإتمامك الجلسات الثلاث! شاركنا تقييمك الختامي.</p>
        ${fieldInput({ k: 'final', label: `التقييم العام لـ${otherLabel} (${esc(other?.name || '')})`, type: 'textarea', required: true, rows: 3 })}
        ${fieldInput({ k: 'program', label: 'تقييمك العام لبرنامج إشراق', type: 'textarea', required: true, rows: 3 })}
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
            Store.push('reviews', { ...base, type: 'program', targetId: 'admin', text: v.program, status: 'approved', featured: false });
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
    $('[data-edit-me]', root)?.addEventListener('click', () => editProfile(me));
    $('[data-download-card]', root)?.addEventListener('click', () => CardImage.download(Data.member(me.id)));
    $('[data-add-slot]', root)?.addEventListener('click', () => openAddSlot(me));
    $$('[data-add-slot-alert]', root).forEach(b => b.onclick = () => openAddSlot(me, +b.dataset.addSlotAlert));
    $$('[data-dismiss-rem]', root).forEach(b => b.onclick = () => Store.update(`notifications/${me.id}/${b.dataset.dismissRem}`, { dismissed: true, read: true }));
    $$('[data-del-slot]', root).forEach(b => b.onclick = async () => {
      if (await confirmDialog('حذف هذا الموعد؟', { danger: true, ok: 'حذف' })) Store.remove(`slots/${b.dataset.delSlot}`);
    });
    $$('[data-book]', root).forEach(b => b.onclick = () => { const sl = Store.get(`slots/${b.dataset.book}`); if (sl) openBook(me, sl); });
    $$('[data-bk]', root).forEach(b => b.onclick = () => bookingAction(kind, me, other, b.dataset.id, b.dataset.bk));
    const rf = $('[data-review-form]', root);
    rf && rf.addEventListener('submit', e => {
      e.preventDefault();
      const done = Data.bookings(kind === 'mentor' ? { mentorId: me.id } : { menteeId: me.id }).filter(b => b.status === 'done');
      submitReview(kind, me, other, rf, done);
    });
    $('[data-final]', root)?.addEventListener('click', () => openFinal(kind, me, other));
  }

  return { render, topbar, editProfile };
})();
