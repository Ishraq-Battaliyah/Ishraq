/* الدعم الفني والإداري: محادثات بين العضو (مرشد/مستفيد) والإدارة، وتبويب «مراسلات» في لوحة الإدارة */

const Support = (() => {
  const STATUS = { open: ['مفتوحة', 'st-upcoming'], answered: ['تم الرد', 'st-done'], closed: ['مغلقة', 'st-overdue'] };
  const all = () => Store.list('tickets').filter(t => t.subject).sort((a, b) => (b.updatedAt || b.ts || 0) - (a.updatedAt || a.ts || 0));
  const mine = id => all().filter(t => t.memberId === id);
  const msgsOf = t => Object.values(t.messages || {}).filter(Boolean).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const unreadFor = (viewer, t) => (viewer === 'admin' ? !!t.unreadAdmin : !!t.unreadMember);
  const unreadAdmin = () => all().filter(t => t.unreadAdmin && t.status !== 'closed').length;

  /* ===== لوحة المرشد / المستفيد ===== */
  function memberSection(me) {
    const list = mine(me.id);
    const unread = list.filter(t => t.unreadMember).length;
    return `<section class="panel support-panel" id="support-panel">
      <div class="panel-head"><h2><i class="fa-solid fa-headset"></i> الدعم الفني والإداري ${unread ? `<em class="badge">${unread}</em>` : ''}</h2>
        <button class="btn primary" data-support-new><i class="fa-solid fa-pen-to-square"></i> رسالة جديدة للإدارة</button></div>
      <p class="muted small">للتواصل مع إدارة البرنامج في أي استفسار أو مشكلة. تبقى رسائلك وردود الإدارة هنا في محادثة واحدة لكل موضوع.</p>
      ${list.length ? `<ul class="ticket-list">${list.map(t => ticketRow(t, 'member')).join('')}</ul>` : emptyState('لا توجد مراسلات بعد', 'fa-comments')}
    </section>`;
  }

  function ticketRow(t, viewer) {
    const ms = msgsOf(t), last = ms[ms.length - 1];
    const st = STATUS[t.status] || STATUS.open;
    return `<li class="ticket ${unreadFor(viewer, t) ? 'unread' : ''}" data-ticket="${esc(t.id)}" tabindex="0" role="button">
      <div class="tk-main"><b>${esc(t.subject)}</b>${viewer === 'admin' ? `<span class="chip ${esc(t.role)}">${t.role === 'mentor' ? 'مرشد' : 'مستفيد'} · ${esc(t.memberName || '')}</span>` : ''}
        <p>${esc((last?.text || '').slice(0, 110))}${(last?.text || '').length > 110 ? '…' : ''}</p></div>
      <div class="tk-side"><span class="pill ${st[1]}">${st[0]}</span><small>${fmtTs(t.updatedAt || t.ts)}</small>${unreadFor(viewer, t) ? '<i class="dot" title="جديد"></i>' : ''}</div></li>`;
  }

  function openNew(me) {
    openModal({
      title: '<i class="fa-solid fa-headset"></i> رسالة جديدة للإدارة', size: 'md',
      body: `<form class="form-grid one">
        <div class="field"><label>موضوع الرسالة <em>*</em></label><input name="subject" maxlength="150" required placeholder="مثال: استفسار عن موعد الجلسة الثانية"></div>
        <div class="field"><label>نص الرسالة <em>*</em></label><textarea name="text" rows="6" maxlength="3000" required></textarea></div></form>`,
      actions: [{
        label: 'إرسال', cls: 'primary', onClick: m => {
          const f = $('form', m.body);
          if (!validateForm(f)) return false;
          const v = readForm(f);
          const id = Store.newId(), mid = Store.newId(), now = Date.now();
          // الرسالة الأولى تُكتب بعد إنشاء المحادثة حتى تتحقق القواعد من أنها من العضو نفسه
          Store.set(`tickets/${id}`, { id, memberId: me.id, memberName: me.name, role: me.role, subject: v.subject.trim(), status: 'open', ts: now, updatedAt: now,
            lastFrom: 'member', unreadAdmin: true, unreadMember: false });
          Store.set(`tickets/${id}/messages/${mid}`, { id: mid, from: 'member', by: me.name, text: v.text.trim(), ts: now });
          Data.notify('admin', `رسالة جديدة من ${me.role === 'mentor' ? 'المرشد' : 'المستفيد'} ${me.name}: ${v.subject.trim().slice(0, 80)}`, { icon: 'fa-comments' });
          toast('وصلت رسالتك إلى الإدارة');
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  /* ===== نافذة المحادثة (للعضو وللإدارة) ===== */
  // اسم المشرف الذي ردّ محفوظ في مسار منفصل (ticketStaff) لا يقرؤه إلا المشرفون؛ العضو لا يرى إلا «الإدارة»
  const bubble = (m, viewer, staff = {}) => {
    const who = m.from === 'admin' ? `الإدارة${viewer === 'admin' && (staff[m.id] || m.by) ? ` · ${esc(staff[m.id] || m.by)}` : ''}` : esc(m.by || 'العضو');
    return `<div class="bubble ${m.from === viewer ? 'mine' : 'theirs'}"><small><b>${who}</b> · ${fmtTs(m.ts)}</small><p>${nl2br(m.text)}</p></div>`;
  };

  function openThread(tid, viewer, me) {
    const t0 = Store.get(`tickets/${tid}`);
    if (!t0) return;
    // نفتح المحادثة: نعلّم الرسائل كمقروءة لهذا الطرف
    if (unreadFor(viewer, t0)) Store.update(`tickets/${tid}`, viewer === 'admin' ? { unreadAdmin: false } : { unreadMember: false });
    const draw = () => {
      const t = Store.get(`tickets/${tid}`);
      const box = $('.thread-msgs', modal.body);
      if (!t || !box) return;
      const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      const staff = viewer === 'admin' ? (Store.get(`ticketStaff/${tid}`) || {}) : {};
      box.innerHTML = msgsOf(t).map(m => bubble(m, viewer, staff)).join('');
      const st = STATUS[t.status] || STATUS.open;
      $('.thread-status', modal.body).innerHTML = `<span class="pill ${st[1]}">${st[0]}</span>`;
      const closed = t.status === 'closed';
      $('[data-thread-form]', modal.body).hidden = closed && viewer !== 'admin' ? true : false;
      $('.thread-closed', modal.body).hidden = !(closed && viewer !== 'admin');
      const tg = $('[data-thread-toggle]', modal.body);
      if (tg) tg.innerHTML = closed ? '<i class="fa-solid fa-lock-open"></i> إعادة فتح المحادثة' : '<i class="fa-solid fa-lock"></i> إغلاق المحادثة';
      if (atEnd) box.scrollTop = box.scrollHeight;
      // رسالة وصلت أثناء فتح النافذة: لا نتركها غير مقروءة
      if (unreadFor(viewer, t)) Store.update(`tickets/${tid}`, viewer === 'admin' ? { unreadAdmin: false } : { unreadMember: false });
    };
    let off = () => {};
    const modal = openModal({
      title: `<i class="fa-solid fa-comments"></i> ${esc(t0.subject)}`, size: 'md', cls: 'thread-modal',
      body: `<div class="thread-head"><span class="thread-status"></span>${viewer === 'admin' ? `<span class="chip ${esc(t0.role)}">${t0.role === 'mentor' ? 'مرشد' : 'مستفيد'} · ${esc(t0.memberName || '')}</span>` : ''}
          ${viewer === 'admin' ? '<button class="btn xs ghost" data-thread-toggle></button><button class="btn xs ghost danger" data-thread-del><i class="fa-solid fa-trash"></i> حذف</button>' : ''}</div>
        <div class="thread-msgs" aria-live="polite"></div>
        <p class="thread-closed muted small" hidden><i class="fa-solid fa-lock"></i> أُغلقت هذه المحادثة. أرسل رسالة جديدة للإدارة إن احتجت.</p>
        <form class="thread-form" data-thread-form><textarea name="text" rows="3" maxlength="3000" placeholder="اكتب ${viewer === 'admin' ? 'ردك' : 'رسالتك'} هنا..."></textarea>
          <button class="btn primary" type="submit"><i class="fa-solid fa-paper-plane"></i> ${viewer === 'admin' ? 'إرسال الرد' : 'إرسال'}</button></form>`,
      onClose: () => off(),
      actions: []
    });
    modal.body.addEventListener('submit', e => {
      const f = e.target.closest('[data-thread-form]'); if (!f) return;
      e.preventDefault();
      const text = f.text.value.trim();
      const t = Store.get(`tickets/${tid}`);
      if (!text || !t) return;
      const mid = Store.newId(), now = Date.now();
      if (viewer === 'admin') {
        // اسم المشرف الفعلي يُحفظ للإدارة فقط، ولا يظهر في الرسالة التي يقرؤها العضو
        Store.set(`tickets/${tid}/messages/${mid}`, { id: mid, from: 'admin', text, ts: now });
        Store.set(`ticketStaff/${tid}/${mid}`, Security.adminName());
        Store.update(`tickets/${tid}`, { updatedAt: now, lastFrom: 'admin', status: t.status === 'closed' ? 'closed' : 'answered', unreadMember: true });
        Data.notify(t.memberId, `ردّت الإدارة على رسالتك: ${t.subject.slice(0, 80)}`, { icon: 'fa-comments' });
      } else {
        Store.set(`tickets/${tid}/messages/${mid}`, { id: mid, from: 'member', by: me?.name || '', text, ts: now });
        Store.update(`tickets/${tid}`, { updatedAt: now, lastFrom: 'member', status: 'open', unreadAdmin: true });
        Data.notify('admin', `رد جديد من ${t.memberName || 'عضو'} في «${t.subject.slice(0, 60)}»`, { icon: 'fa-comments' });
      }
      f.text.value = '';
    });
    modal.body.addEventListener('click', async e => {
      if (e.target.closest('[data-thread-toggle]')) {
        const t = Store.get(`tickets/${tid}`);
        Store.update(`tickets/${tid}`, { status: t.status === 'closed' ? 'open' : 'closed', updatedAt: Date.now() });
        Security.log(t.status === 'closed' ? 'إعادة فتح محادثة' : 'إغلاق محادثة', t.subject);
      }
      if (e.target.closest('[data-thread-del]') && await confirmDialog('حذف هذه المحادثة نهائياً؟', { danger: true, ok: 'حذف' })) {
        const t = Store.get(`tickets/${tid}`);
        Store.remove(`tickets/${tid}`); Store.remove(`ticketStaff/${tid}`); Security.log('حذف محادثة', t?.subject || ''); modal.close();
      }
    });
    off = Store.subscribe(draw);
    draw();
    const box = $('.thread-msgs', modal.body); box.scrollTop = box.scrollHeight;
  }

  /* ===== تبويب «مراسلات» في لوحة الإدارة ===== */
  const ui = { filter: 'all', q: '' };
  function adminPanel() {
    const list = all();
    const shown = list.filter(t => (ui.filter === 'all' || (ui.filter === 'new' ? t.unreadAdmin : t.status === ui.filter))
      && (!ui.q || `${t.subject} ${t.memberName} ${msgsOf(t).map(m => m.text).join(' ')}`.toLowerCase().includes(ui.q.toLowerCase())));
    const count = k => (k === 'all' ? list.length : k === 'new' ? list.filter(t => t.unreadAdmin).length : list.filter(t => t.status === k).length);
    const F = [['all', 'الكل'], ['new', 'غير مقروءة'], ['open', 'مفتوحة'], ['answered', 'تم الرد'], ['closed', 'مغلقة']];
    return `<div class="panel" id="support-admin">
      <div class="panel-head"><h2><i class="fa-solid fa-comments"></i> مراسلات الأعضاء مع الإدارة</h2></div>
      <p class="muted small">محادثات الدعم الفني والإداري من المرشدين والمستفيدين. اضغط على أي محادثة لعرضها والرد عليها، ويظهر ردك للعضو داخل نفس المحادثة ويصله إشعار.</p>
      <div class="chip-filter">${F.map(([k, l]) => `<button class="${ui.filter === k ? 'active' : ''}" data-tk-filter="${k}">${l} <span class="count">${count(k)}</span></button>`).join('')}</div>
      <input class="search" data-tk-search placeholder="ابحث في الموضوع أو اسم العضو أو نص الرسائل..." value="${esc(ui.q)}">
      ${shown.length ? `<ul class="ticket-list">${shown.map(t => ticketRow(t, 'admin')).join('')}</ul>` : emptyState(list.length ? 'لا توجد محادثات مطابقة' : 'لا توجد مراسلات بعد', 'fa-comments')}
    </div>`;
  }

  document.addEventListener('click', e => {
    const row = e.target.closest('[data-ticket]');
    if (row) {
      const auth = Auth.current();
      if (row.closest('#support-admin') && auth?.kind === 'admin') return openThread(row.dataset.ticket, 'admin');
      if (row.closest('#support-panel') && auth?.id) return openThread(row.dataset.ticket, 'member', Data.member(auth.id));
    }
    if (e.target.closest('[data-support-new]') && Auth.current()?.id) return openNew(Data.member(Auth.current().id));
    const f = e.target.closest('[data-tk-filter]');
    if (f) { ui.filter = f.dataset.tkFilter; window.dispatchEvent(new Event('ishraq-rerender')); }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-ticket]')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('input', e => {
    if (!e.target.matches?.('[data-tk-search]')) return;
    ui.q = e.target.value;
    const el = e.target, pos = el.selectionStart;
    window.dispatchEvent(new Event('ishraq-rerender'));
    requestAnimationFrame(() => { const n = $('[data-tk-search]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
  });

  // ينقل أسماء المشرفين من رسائل الرد القديمة إلى المسار الخاص بالإدارة
  function hideStaffNames() {
    all().forEach(t => msgsOf(t).forEach(m => {
      if (m.from === 'admin' && m.by) { Store.set(`ticketStaff/${t.id}/${m.id}`, m.by); Store.remove(`tickets/${t.id}/messages/${m.id}/by`); }
    }));
  }

  return { hideStaffNames, memberSection, openNew, openThread, adminPanel, unreadAdmin, all };
})();
