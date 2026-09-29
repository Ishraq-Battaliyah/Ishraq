/* إضافة موعد الجلسة إلى تطبيق التقويم: رابط Google Calendar، وملف .ics يعمل مع تقويم آبل وسامسونج وأوتلوك وغيرها */

const Cal = (() => {
  const TZ_HOURS = 3;   // توقيت مكة المكرمة (UTC+3) ثابت بلا توقيت صيفي، فتظهر الجلسة بوقتها الصحيح على أي جهاز

  const toUtc = (date, time) => {
    const [y, m, d] = String(date).split('-').map(Number), [h, mi] = String(time || '00:00').split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, h - TZ_HOURS, mi || 0));
  };
  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  function info(b, kind) {
    const other = Data.member(kind === 'mentor' ? b.menteeId : b.mentorId);
    const title = `${Data.bookingName(b)} — برنامج إشراق${other ? ` (${kind === 'mentor' ? 'المستفيد' : 'المرشد'}: ${other.name})` : ''}`;
    const lines = [`نوع الجلسة: ${MODES[b.mode] || ''}`, b.summary ? `المحتوى: ${b.summary}` : '', `برنامج إشراق — ${window.ISHRAQ_CONFIG.siteUrl || ''}`].filter(Boolean);
    return { title, details: lines.join('\n'), location: MODES[b.mode] || '', start: toUtc(b.date, b.start), end: toUtc(b.date, b.end) };
  }

  function googleUrl(b, kind) {
    const i = info(b, kind);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: i.title, dates: `${stamp(i.start)}/${stamp(i.end)}`, details: i.details, location: i.location });
    return `https://calendar.google.com/calendar/render?${q}`;
  }

  const esc_ = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // طي الأسطر الطويلة حسب معيار iCalendar (75 بايت)
  function fold(line) {
    const enc = new TextEncoder(), out = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > 73) { out.push(cur); cur = ' '; bytes = 1; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function ics(b, kind) {
    const i = info(b, kind);
    const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ishraq//Mentoring//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${b.id}@ishraq`, `DTSTAMP:${stamp(new Date())}`, `SEQUENCE:${(b.history || []).length}`,
      `DTSTART:${stamp(i.start)}`, `DTEND:${stamp(i.end)}`, `SUMMARY:${esc_(i.title)}`, `DESCRIPTION:${esc_(i.details)}`,
      ...(i.location ? [`LOCATION:${esc_(i.location)}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc_(i.title)}`, 'TRIGGER:-PT60M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    return rows.map(fold).join('\r\n') + '\r\n';
  }

  function saveIcs(b, kind) {
    const blob = new Blob([ics(b, kind)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ishraq-session.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  function open(bookingId, kind) {
    const b = Store.get(`bookings/${bookingId}`);
    if (!b) return;
    openModal({
      title: '<i class="fa-regular fa-calendar-plus"></i> إضافة الموعد إلى التقويم', size: 'sm',
      body: `<p class="confirm-msg"><b>${esc(Data.bookingName(b))}</b><br>${fmtDate(b.date)} · ${tRange(b.start, b.end)}</p>
        <div class="bulk-opts"><a class="bulk-opt" href="${esc(googleUrl(b, kind))}" target="_blank" rel="noopener"><i class="fa-brands fa-google"></i><b>Google Calendar</b><small>يفتح صفحة إضافة الحدث في تقويم جوجل</small></a>
        <button class="bulk-opt" data-ics><i class="fa-solid fa-calendar-days"></i><b>تقويم الجوال (آبل / سامسونج / أوتلوك)</b><small>ملف .ics يُفتح في تطبيق التقويم مباشرة، مع تذكير قبل الجلسة بساعة</small></button></div>`,
      actions: [{ label: 'إغلاق', cls: 'ghost' }],
      onOpen: m => m.body.addEventListener('click', e => { if (e.target.closest('[data-ics]')) { saveIcs(b, kind); toast('تم تنزيل ملف التقويم'); } })
    });
  }

  return { open, googleUrl, ics };
})();
