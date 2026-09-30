/* الشهادات: شهادات المشاركة للمرشدين والمستفيدين وشهادات حضور الفعاليات
   تُرسم الشهادة على canvas ثم تُحوَّل إلى ملف PDF مباشرة في المتصفح (بدون خادم ولا مكتبات)،
   ويمكن حفظها أو إرسالها بالبريد (mailto) أو حفظ عدة شهادات دفعة واحدة في ملف ZIP. */

const Certs = (() => {
  const KINDS = {
    mentor: { label: 'المرشدين', single: 'مرشد', icon: 'fa-user-tie' },
    mentee: { label: 'المستفيدين', single: 'مستفيد', icon: 'fa-user-graduate' },
    event: { label: 'حضور الفعاليات', single: 'حاضر', icon: 'fa-person-chalkboard' }
  };
  // العناصر المتغيرة داخل النصوص: {name} {cohort} {year} {event} {date} {type}
  const DEFAULTS = {
    mentor: {
      title: 'شهادة شكر وتقدير', intro: 'تتقدّم جمعية البطالية الخيرية ممثلةً ببرنامج إشراق بخالص الشكر والتقدير إلى',
      body: 'على مشاركتهم مرشداً في برنامج إشراق الإرشادي ({cohort} {year})، وما بذلوه من وقتٍ وخبرةٍ ودعمٍ لمستفيدهم، سائلين الله لهم التوفيق والسداد.',
      org: 'جمعية البطالية الخيرية — برنامج إشراق', signerName: '', signerTitle: 'إدارة برنامج إشراق', signature: '', stamp: '', showSignature: true, showStamp: true, showDate: true, footer: '',
      emailSubject: 'شهادة شكر وتقدير من برنامج إشراق',
      emailBody: 'السلام عليكم ورحمة الله وبركاته،\n\nعزيزنا {name}،\nيسعدنا أن نرفق لكم {type} من برنامج إشراق التابع لجمعية البطالية الخيرية، تقديراً لمشاركتكم مرشداً في {cohort}.\n\nمع خالص الشكر والتقدير،\nإدارة برنامج إشراق'
    },
    mentee: {
      title: 'شهادة مشاركة', intro: 'تشهد جمعية البطالية الخيرية ممثلةً ببرنامج إشراق بأن',
      body: 'قد شارك في برنامج إشراق الإرشادي ({cohort} {year}) بصفة «مستفيد»، واستفاد من جلسات الإرشاد المقررة، متمنّين له دوام التوفيق والنجاح.',
      org: 'جمعية البطالية الخيرية — برنامج إشراق', signerName: '', signerTitle: 'إدارة برنامج إشراق', signature: '', stamp: '', showSignature: true, showStamp: true, showDate: true, footer: '',
      emailSubject: 'شهادة مشاركة في برنامج إشراق',
      emailBody: 'السلام عليكم ورحمة الله وبركاته،\n\nعزيزنا {name}،\nيسعدنا أن نرفق لكم {type} في برنامج إشراق التابع لجمعية البطالية الخيرية ({cohort}).\n\nمع أطيب التمنيات بدوام التوفيق،\nإدارة برنامج إشراق'
    },
    event: {
      title: 'شهادة حضور', intro: 'تشهد جمعية البطالية الخيرية ممثلةً ببرنامج إشراق بأن',
      body: 'قد حضر فعالية «{event}» التي أُقيمت بتاريخ {date}، وشارك فيها ضمن فعاليات برنامج إشراق.',
      org: 'جمعية البطالية الخيرية — برنامج إشراق', signerName: '', signerTitle: 'إدارة برنامج إشراق', signature: '', stamp: '', showSignature: true, showStamp: true, showDate: true, footer: '',
      emailSubject: 'شهادة حضور فعالية «{event}»',
      emailBody: 'السلام عليكم ورحمة الله وبركاته،\n\nعزيزنا {name}،\nشكراً لحضوركم فعالية «{event}». يسعدنا أن نرفق لكم {type} من برنامج إشراق التابع لجمعية البطالية الخيرية.\n\nمع خالص التقدير،\nإدارة برنامج إشراق'
    }
  };
  const TEXT_KEYS = ['title', 'intro', 'body', 'org', 'signerName', 'signerTitle', 'signature', 'stamp', 'footer', 'emailSubject', 'emailBody'];
  const BOOL_KEYS = ['showSignature', 'showStamp', 'showDate'];

  const template = kind => ({ ...DEFAULTS[kind], ...(Store.get(`certs/templates/${kind}`) || {}) });
  const fill = (text, v) => String(text || '').replace(/\{(name|cohort|year|event|date|type)\}/g, (_, k) => v[k] ?? '');

  /* ===== الحالة ===== */
  const ui = { kind: 'mentor', cohort: 'all', event: '', q: '', sel: new Set() };

  /* ===== المستلمون ===== */
  const nameOf = (id, fallback) => (Store.get(`certs/names/${id}`) || fallback || '').trim();
  const issuedOf = id => Store.get(`certs/issued/${id}`);
  const fmtLatin = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const events = () => Store.list('events').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const currentEvent = () => (ui.event && Store.get(`events/${ui.event}`)) || events()[0] || null;

  function recipients() {
    const q = ui.q.trim().toLowerCase();
    let list;
    if (ui.kind === 'event') {
      const ev = currentEvent();
      list = ev ? Store.list('eventRegs').filter(r => r.eventId === ev.id).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
        .map(r => ({ id: r.id, name: r.name || '', email: r.email || '', sub: r.phone || '', event: ev, cohortId: null })) : [];
    } else {
      list = Data.members(ui.kind).filter(m => ui.cohort === 'all' || m.cohort === ui.cohort)
        .map(m => ({ id: m.id, name: m.name || '', email: m.email || '', sub: m.code || '', cohortId: m.cohort, event: null }));
    }
    list = list.map(r => ({ ...r, cert: nameOf(r.id, r.name) })).filter(r => r.id && r.cert);
    return q ? list.filter(r => `${r.cert} ${r.name} ${r.email} ${r.sub}`.toLowerCase().includes(q)) : list;
  }

  const valuesFor = (kind, r, tpl) => {
    const c = r.cohortId ? Data.cohort(r.cohortId) : null;
    return { name: r.cert, cohort: c?.name || '', year: c?.year || '', event: r.event?.title || '', date: r.event?.date ? fmtLatin(parseISO(r.event.date)) : '', type: tpl.title };
  };
  const certNumber = (kind, id) => {
    let h = 0; for (const ch of `${kind}${id}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `ISH-${kind[0].toUpperCase()}-${h.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
  };

  /* ===== رسم الشهادة ===== */
  const SCALE = 2, W = 1123, H = 794;                    // A4 أفقي
  const F = { head: "'Cairo', 'Noto Sans Arabic', sans-serif", ui: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif", body: "'Noto Sans Arabic', 'IBM Plex Sans Arabic', sans-serif" };
  const C = { ink: '#2E2563', ink2: '#4E4B63', muted: '#7C7A8E', p: '#8776C4', pd: '#5B4A9E', b: '#7FB1D4', line: '#E6E3F0' };

  function loadImg(src, cors) {
    return new Promise(res => {
      if (!src) return res(null);
      const im = new Image();
      if (cors) im.crossOrigin = 'anonymous';
      im.referrerPolicy = 'no-referrer';
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = src;
    });
  }
  const remoteImg = url => {
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) return Promise.resolve(null);
    const m = url.match(/\/d\/([\w-]{10,})/) || url.match(/[?&]id=([\w-]{10,})/);
    return loadImg(m && /drive\.google|docs\.google|googleusercontent/.test(url) ? `https://lh3.googleusercontent.com/d/${m[1]}=w800` : url, true);
  };
  let fontsReady = null;
  const ensureFonts = () => fontsReady || (fontsReady = Promise.all([
    document.fonts.load(`800 30px ${F.head}`, 'إشراق'), document.fonts.load(`700 18px ${F.head}`, 'إشراق'),
    document.fonts.load(`400 17px ${F.body}`, 'إشراق'), document.fonts.load(`600 15px ${F.ui}`, 'إشراق')
  ]).then(() => document.fonts.ready).catch(() => {}));
  let logos = null;
  const loadLogos = () => logos || (logos = Promise.all([loadImg('assets/albatalia-logo.png'), loadImg('assets/ishraq-logo.png'), loadImg('assets/ishraq-mark.png')]));

  function wrapLines(ctx, text, maxW) {
    const lines = [];
    String(text || '').split('\n').forEach(par => {
      let line = '';
      par.split(/\s+/).filter(Boolean).forEach(word => {
        const t = line ? `${line} ${word}` : word;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
      });
      lines.push(line);
    });
    return lines;
  }

  function fitText(ctx, text, maxW, font, size, min = 24) {
    let s = size;
    do { ctx.font = font(s); s -= 2; } while (ctx.measureText(text).width > maxW && s >= min);
  }

  // يرسم الشهادة ويعيد {canvas, imgFailed}
  async function render(kind, r, tplOverride) {
    await ensureFonts();
    const tpl = tplOverride || template(kind);
    const v = valuesFor(kind, r, tpl);
    const [alb, ish, mark] = await loadLogos();
    const [sig, stamp] = await Promise.all([tpl.showSignature ? remoteImg(tpl.signature) : null, tpl.showStamp ? remoteImg(tpl.stamp) : null]);
    const imgFailed = (tpl.showSignature && tpl.signature && !sig) || (tpl.showStamp && tpl.stamp && !stamp);
    const cv = document.createElement('canvas'); cv.width = W * SCALE; cv.height = H * SCALE;
    const ctx = cv.getContext('2d'); ctx.scale(SCALE, SCALE);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic';

    // العلامة المائية
    if (mark) { ctx.save(); ctx.globalAlpha = .045; const mw = 470, mh = mw * mark.height / mark.width; ctx.drawImage(mark, (W - mw) / 2, (H - mh) / 2 + 20, mw, mh); ctx.restore(); }

    // الإطار
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.ink); g.addColorStop(.5, C.p); g.addColorStop(1, C.b);
    ctx.lineWidth = 5; ctx.strokeStyle = g; ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.line; ctx.strokeRect(34, 34, W - 68, H - 68);
    // زخارف الزوايا
    const corner = (x, y, sx, sy) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(74, 0); ctx.lineTo(0, 74); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(0, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(0, 30); ctx.stroke();
      ctx.restore();
    };
    corner(22, 22, 1, 1); corner(W - 22, 22, -1, 1); corner(22, H - 22, 1, -1); corner(W - 22, H - 22, -1, -1);

    // الشعارات أعلى اليمين: شعار الجمعية ثم خط ثم شعار إشراق
    const lh = 66; let x = W - 78;
    if (alb) { const w = lh * alb.width / alb.height; ctx.drawImage(alb, x - w, 58, w, lh); x -= w + 16; }
    ctx.strokeStyle = C.p; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 58 + lh); ctx.stroke(); x -= 16;
    if (ish) { const h2 = lh + 8, w = h2 * ish.width / ish.height; ctx.drawImage(ish, x - w, 54, w, h2); }
    // رقم الشهادة أعلى اليسار
    ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.fillStyle = C.muted; ctx.font = `600 12px ${F.ui}`;
    ctx.fillText(certNumber(kind, r.id), 84, 84);
    ctx.direction = 'rtl'; ctx.textAlign = 'center';

    // العنوان
    const cx = W / 2;
    fitText(ctx, tpl.title, 760, s => `900 ${s}px ${F.head}`, 60);
    const tg = ctx.createLinearGradient(cx - 260, 0, cx + 260, 0); tg.addColorStop(0, C.ink); tg.addColorStop(.6, C.pd); tg.addColorStop(1, C.p);
    ctx.fillStyle = tg; ctx.fillText(tpl.title, cx, 228);
    // فاصل زخرفي
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 150, 254); ctx.lineTo(cx - 14, 254); ctx.moveTo(cx + 14, 254); ctx.lineTo(cx + 150, 254); ctx.stroke();
    ctx.fillStyle = C.p; ctx.save(); ctx.translate(cx, 254); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();

    // الجملة التمهيدية
    ctx.fillStyle = C.ink2; ctx.font = `500 23px ${F.body}`;
    let y = 326;
    wrapLines(ctx, fill(tpl.intro, v), 820).forEach(l => { ctx.fillText(l, cx, y); y += 36; });

    // الاسم
    y += 40;
    fitText(ctx, v.name, 820, s => `800 ${s}px ${F.head}`, 60, 30);
    ctx.fillStyle = C.ink; ctx.fillText(v.name, cx, y);
    const nw = Math.min(ctx.measureText(v.name).width + 60, 860);
    const ng = ctx.createLinearGradient(cx - nw / 2, 0, cx + nw / 2, 0); ng.addColorStop(0, 'rgba(135,118,196,0)'); ng.addColorStop(.5, C.p); ng.addColorStop(1, 'rgba(127,177,212,0)');
    ctx.strokeStyle = ng; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - nw / 2, y + 16); ctx.lineTo(cx + nw / 2, y + 16); ctx.stroke();

    // النص
    y += 78;
    ctx.fillStyle = C.ink2; ctx.font = `400 24px ${F.body}`;
    wrapLines(ctx, fill(tpl.body, v), 800).forEach(l => { ctx.fillText(l, cx, y); y += 46; });

    // أسفل الشهادة: التاريخ (يسار)، الختم (وسط)، التوقيع (يمين)
    const by = H - 118;
    if (tpl.showDate) {
      ctx.fillStyle = C.ink2; ctx.font = `600 16px ${F.ui}`; ctx.textAlign = 'center';
      ctx.fillText('التاريخ', 200, by + 6);
      ctx.font = `700 18px ${F.head}`; ctx.fillStyle = C.ink; ctx.direction = 'ltr'; ctx.fillText(fmtLatin(new Date()), 200, by + 34); ctx.direction = 'rtl';
    }
    if (stamp) { const sh = 110, sw = sh * stamp.width / stamp.height; ctx.drawImage(stamp, cx - sw / 2, by - 72, Math.min(sw, 200), sh); }
    const sx = W - 220;
    if (sig) { const sh = 62, sw = Math.min(sh * sig.width / sig.height, 190); ctx.drawImage(sig, sx - sw / 2, by - 66, sw, sh); }
    if (tpl.signerName || tpl.signerTitle || sig) {
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 95, by - 2); ctx.lineTo(sx + 95, by - 2); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.font = `700 18px ${F.head}`; ctx.fillText(tpl.signerName || '', sx, by + 22);
      ctx.fillStyle = C.ink2; ctx.font = `500 14px ${F.ui}`; ctx.fillText(tpl.signerTitle || '', sx, by + 44);
    }
    // التذييل
    ctx.fillStyle = C.muted; ctx.font = `500 13px ${F.ui}`;
    ctx.fillText([tpl.org, tpl.footer].filter(Boolean).join('  •  '), cx, H - 50);
    ctx.fillStyle = g; ctx.fillRect(W * .2, H - 40, W * .6, 3);
    return { canvas: cv, imgFailed };
  }

  /* ===== PDF (صورة JPEG داخل صفحة A4 أفقية) ===== */
  const te = new TextEncoder();
  function buildPdf(jpeg, iw, ih) {
    const PW = 841.89, PH = 595.28;
    const parts = []; const offs = []; let len = 0;
    const add = data => { const b = typeof data === 'string' ? te.encode(data) : data; parts.push(b); len += b.length; };
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n`); add(body); add('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offs[4] = len; add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); add(jpeg); add('\nendstream\nendobj\n');
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    add(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => `${String(offs[n]).padStart(10, '0')} 00000 n \n`).join('')}`);
    add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function pdfBlob(kind, r, tpl) {
    const { canvas, imgFailed } = await render(kind, r, tpl);
    const jpeg = await new Promise(res => canvas.toBlob(res, 'image/jpeg', .93));
    return { blob: buildPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height), imgFailed };
  }

  /* ===== ZIP بسيط (بدون ضغط) ===== */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function buildZip(files) {   // files: [{name, data:Uint8Array}]
    const now = new Date();
    const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    const locals = [], central = []; let off = 0;
    files.forEach(f => {
      const name = te.encode(f.name), crc = crc32(f.data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      locals.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + f.data.length;
    });
    const csize = central.reduce((s, b) => s + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob([...locals, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  const safeName = s => String(s || '').replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'شهادة';
  const fileName = (kind, r) => `${safeName(template(kind).title)} - ${safeName(r.cert)}.pdf`;
  function saveBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const markIssued = (r, via) => Store.set(`certs/issued/${r.id}`, { ts: Date.now(), by: Security.adminName(), via });

  /* ===== الإرسال بالبريد (mailto) ===== */
  const mailText = (kind, r) => { const t = template(kind), v = valuesFor(kind, r, t); return { subject: fill(t.emailSubject, v), body: fill(t.emailBody, v) }; };
  /* طرق فتح رسالة البريد: Gmail أو Outlook في تبويب جديد من المتصفح نفسه (الأنسب للابتوب)،
     أو تطبيق البريد الافتراضي عبر mailto (الأنسب للجوال). عنوان المستلم وعنوان الرسالة ونصها تُعبَّأ آلياً في كل الحالات.
     المتصفحات لا تسمح بإرفاق ملف تلقائياً في رسالة جاهزة، لذلك يُنزَّل ملف الشهادة ويُرفق بسحبه أو بالمشبك. */
  const MAIL_KEY = 'ishraq-mail-provider';
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const PROVIDERS = { gmail: 'Gmail (في المتصفح)', outlook: 'Outlook (في المتصفح)', app: 'تطبيق البريد الافتراضي' };
  const getProvider = () => { let v = null; try { v = localStorage.getItem(MAIL_KEY); } catch { /* ignore */ } return PROVIDERS[v] ? v : (isMobile() ? 'app' : 'gmail'); };
  const setProvider = v => { try { localStorage.setItem(MAIL_KEY, v); } catch { /* ignore */ } };
  const enc = encodeURIComponent;
  function composeUrl(provider, to, subject, body) {
    if (body.length > 1200) body = body.slice(0, 1200);   // حدّ طول الرابط
    if (provider === 'gmail') return `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
    if (provider === 'outlook') return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
    return `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;
  }
  // نفتح تبويب البريد فور الضغط (قبل تجهيز الملف) حتى لا يحجبه المتصفح كنافذة منبثقة، ثم نوجّهه للرابط
  function preOpen() {
    if (getProvider() === 'app') return null;
    const w = window.open('', '_blank');
    try { w && (w.document.title = 'جارٍ فتح البريد...', w.document.body.innerHTML = '<p style="font-family:sans-serif;direction:rtl;padding:24px">جارٍ تجهيز الشهادة وفتح رسالة البريد...</p>'); } catch { /* ignore */ }
    return w;
  }
  function fallbackLink(url) {
    openModal({ title: 'فتح رسالة البريد', size: 'sm', body: '<p class="confirm-msg">منع المتصفح فتح تبويب البريد تلقائياً. اضغط الزر لفتحه.</p>',
      actions: [{ label: '<i class="fa-regular fa-envelope"></i> فتح رسالة البريد', cls: 'primary', onClick: () => { window.open(url, '_blank', 'noopener'); } }, { label: 'إغلاق', cls: 'ghost' }] });
  }
  async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }

  // mode: 'compose' فتح رسالة جاهزة بعنوان المستلم، أو 'share' مشاركة الملف مباشرة (جوال) مع نسخ عنوان المستلم
  async function sendMail(kind, r, subject, body, blob, win, mode = 'compose') {
    const file = new File([blob], fileName(kind, r), { type: 'application/pdf' });
    if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
      const copied = await copyText(r.email);
      try { await navigator.share({ files: [file], title: subject, text: body }); markIssued(r, 'share'); return copied ? 'share-copied' : 'share'; }
      catch (e) { if (e.name === 'AbortError') return 'cancel'; }
    }
    const provider = getProvider();
    saveBlob(blob, file.name);
    const note = `${body}\n\n(أرفق ملف الشهادة الذي نُزِّل على جهازك: ${file.name})`;
    const url = composeUrl(provider, r.email, subject, note);
    if (provider === 'app') { const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); a.remove(); }
    else if (win && !win.closed) win.location.href = url;
    else fallbackLink(url);
    markIssued(r, 'mail');
    return provider === 'app' ? 'mailto' : 'web';
  }
  const mailToast = res => (res === 'share' ? 'تمت المشاركة' : res === 'share-copied' ? 'تمت المشاركة، ونُسخ عنوان المستلم للصقه في خانة «إلى»'
    : res === 'web' ? 'فُتحت رسالة البريد جاهزة؛ أرفق ملف الشهادة المنزَّل (اسحبه إليها أو اضغط المشبك) ثم أرسل' : 'فُتحت رسالة البريد؛ أرفق ملف الشهادة المنزَّل ثم أرسل');

  /* ===== نوافذ الإصدار ===== */
  async function previewImg(kind, r) {
    const { canvas, imgFailed } = await render(kind, r);
    return { url: canvas.toDataURL('image/jpeg', .8), imgFailed };
  }

  async function issueDialog(id) {
    const kind = ui.kind, r = recipients().find(x => x.id === id);
    if (!r) return;
    const mt = mailText(kind, r);
    const m = openModal({
      title: `<i class="fa-solid fa-award"></i> ${esc(template(kind).title)} — ${esc(r.cert)}`, size: 'lg',
      body: `<div class="cert-preview"><div class="cert-loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ تجهيز الشهادة...</div></div>
        <div class="cert-mail"><h4><i class="fa-regular fa-envelope"></i> رسالة البريد ${r.email ? `<small dir="ltr">${esc(r.email)}</small>` : '<small class="muted">لا يوجد بريد مسجل لهذا الشخص</small>'}</h4>
          <div class="field"><label>العنوان</label><input name="subject" value="${esc(mt.subject)}"></div>
          <div class="field"><label>النص</label><textarea name="body" rows="6">${esc(mt.body)}</textarea></div>
          <div class="field mail-provider"><label>فتح الرسالة عبر</label><select name="provider">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${getProvider() === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <small class="hint">تُفتح رسالة جاهزة إلى ${r.email ? `<b dir="ltr">${esc(r.email)}</b>` : 'المستلم'} بالعنوان والنص أعلاه، ويُنزَّل ملف الشهادة لترفقه بها: اسحبه إلى الرسالة أو اضغط المشبك. (المتصفحات لا تسمح بإرفاق الملف تلقائياً.)</small></div>`,
      actions: [
        { label: '<i class="fa-solid fa-download"></i> حفظ الملف', cls: 'primary', onClick: async () => { const { blob } = await pdfBlob(kind, r); saveBlob(blob, fileName(kind, r)); markIssued(r, 'file'); toast('تم حفظ ملف الشهادة'); } },
        { label: '<i class="fa-regular fa-envelope"></i> إرسال بالبريد', cls: 'ghost', onClick: async mm => {
          if (!r.email) { toast('لا يوجد بريد إلكتروني مسجل لهذا الشخص', 'error'); return false; }
          setProvider($('[name=provider]', mm.body).value);
          const win = preOpen();
          const { blob } = await pdfBlob(kind, r);
          const res = await sendMail(kind, r, $('[name=subject]', mm.body).value, $('[name=body]', mm.body).value, blob, win);
          if (res === 'cancel') return false;
          toast(mailToast(res));
        } },
        ...(isMobile() && navigator.canShare ? [{ label: '<i class="fa-solid fa-share-nodes"></i> مشاركة الملف مباشرة (مرفق تلقائي)', cls: 'ghost', onClick: async mm => {
          if (!r.email) { toast('لا يوجد بريد إلكتروني مسجل لهذا الشخص', 'error'); return false; }
          const { blob } = await pdfBlob(kind, r);
          const res = await sendMail(kind, r, $('[name=subject]', mm.body).value, $('[name=body]', mm.body).value, blob, null, 'share');
          if (res === 'cancel') return false;
          toast(mailToast(res));
        } }] : []),
        { label: 'إغلاق', cls: 'ghost' }]
    });
    const pv = await previewImg(kind, r);
    const box = $('.cert-preview', m.body);
    if (box) box.innerHTML = `<img src="${pv.url}" alt="معاينة الشهادة">${pv.imgFailed ? '<p class="warn small"><i class="fa-solid fa-triangle-exclamation"></i> تعذّر تحميل صورة التوقيع أو الختم؛ تأكد أن مشاركة الصورة في Drive «أي شخص لديه الرابط».</p>' : ''}`;
  }

  function bulkDialog() {
    const kind = ui.kind;
    const list = recipients().filter(r => ui.sel.has(r.id));
    if (!list.length) return toast('حدّد اسماً واحداً على الأقل', 'error');
    const withMail = list.filter(r => r.email);
    openModal({
      title: `<i class="fa-solid fa-file-pdf"></i> إصدار ${list.length} ${list.length === 1 ? 'شهادة' : list.length <= 10 ? 'شهادات' : 'شهادة'}`, size: 'md',
      body: `<p>سيتم إصدار الشهادات للأسماء المحددة (${list.length}). اختر طريقة التسليم:</p>
        <div class="bulk-opts"><button class="bulk-opt" data-bulk="zip"><i class="fa-solid fa-file-zipper"></i><b>حفظ كل الملفات دفعة واحدة</b><small>ملف مضغوط (ZIP) يحتوي شهادة PDF لكل اسم</small></button>
        <button class="bulk-opt" data-bulk="mail"><i class="fa-regular fa-envelope"></i><b>إرسال بالبريد لكل شخص برسالة منفردة</b><small>${withMail.length} من ${list.length} لديهم بريد مسجل</small></button></div>`,
      actions: [{ label: 'إغلاق', cls: 'ghost' }],
      onOpen: m => m.body.addEventListener('click', e => {
        const b = e.target.closest('[data-bulk]'); if (!b) return;
        m.close();
        if (b.dataset.bulk === 'zip') setTimeout(() => zipAll(kind, list), 250); else setTimeout(() => mailQueue(kind, withMail, list.length), 250);
      })
    });
  }

  async function zipAll(kind, list) {
    const prog = openModal({ title: 'جارٍ إصدار الشهادات', size: 'sm', dismissible: false, body: '<div class="prog"><div class="prog-bar"><i data-prog-bar></i></div><p class="muted small" data-prog-txt></p></div>' });
    const files = []; const used = new Map(); let failedImg = false;
    try {
      for (let i = 0; i < list.length; i++) {
        $('[data-prog-bar]', prog.body).style.width = `${Math.round(i / list.length * 100)}%`;
        $('[data-prog-txt]', prog.body).textContent = `${i + 1} من ${list.length} — ${list[i].cert}`;
        const { blob, imgFailed } = await pdfBlob(kind, list[i]);
        failedImg = failedImg || imgFailed;
        let name = fileName(kind, list[i]); const n = (used.get(name) || 0) + 1; used.set(name, n); if (n > 1) name = name.replace(/\.pdf$/, ` (${n}).pdf`);
        files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        await new Promise(r => setTimeout(r, 0));
      }
      saveBlob(buildZip(files), `شهادات ${safeName(template(kind).title)}.zip`);
      list.forEach(r => markIssued(r, 'file'));
      Security.log('إصدار شهادات', `${KINDS[kind].label}`, `${list.length} شهادة (ملف مضغوط)`);
      toast(`تم حفظ ${list.length} شهادة في ملف واحد${failedImg ? ' — تعذّر تحميل التوقيع/الختم' : ''}`, failedImg ? 'error' : 'ok');
    } catch (e) { console.error(e); toast('تعذّر إصدار الشهادات', 'error'); }
    prog.close();
  }

  // طابور الإرسال: كل شخص برسالة منفردة، وكل رسالة تُفتح بضغطة من المشرف (حتى لا يحجبها المتصفح)
  function mailQueue(kind, list, total) {
    if (!list.length) return toast('لا يوجد بريد مسجل لأي من الأسماء المحددة', 'error');
    const done = new Set();
    const m = openModal({
      title: `<i class="fa-regular fa-envelope"></i> إرسال الشهادات بالبريد`, size: 'md',
      body: `<p class="muted small">اضغط «إرسال» أمام كل اسم: يُنزَّل ملف شهادته وتُفتح رسالة بريد جاهزة إليه وعنوانه في خانة «إلى»، أرفق الملف وأرسلها. ${total > list.length ? `<b>${total - list.length}</b> من المحددين بلا بريد مسجل وتم استبعادهم.` : ''}</p>
        <div class="field mail-provider"><label>فتح الرسائل عبر</label><select data-q-provider>${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${getProvider() === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <ul class="mail-queue">${list.map(r => `<li data-q="${esc(r.id)}"><span><b>${esc(r.cert)}</b><small dir="ltr">${esc(r.email)}</small></span><button class="btn xs primary" data-q-send="${esc(r.id)}"><i class="fa-regular fa-paper-plane"></i> إرسال</button></li>`).join('')}</ul>`,
      actions: [{ label: 'تم', cls: 'primary' }]
    });
    m.body.addEventListener('change', e => { if (e.target.matches('[data-q-provider]')) setProvider(e.target.value); });
    m.body.addEventListener('click', async e => {
      const b = e.target.closest('[data-q-send]'); if (!b) return;
      const r = list.find(x => x.id === b.dataset.qSend); if (!r) return;
      b.disabled = true;
      const win = preOpen();
      try {
        const { blob } = await pdfBlob(kind, r); const t = mailText(kind, r);
        const res = await sendMail(kind, r, t.subject, t.body, blob, win);
        if (res === 'cancel') { b.disabled = false; win && !win.closed && win.close(); return; }
        done.add(r.id); b.outerHTML = '<span class="pill st-done"><i class="fa-solid fa-check"></i> فُتحت</span>';
        if (done.size === list.length) Security.log('إرسال شهادات بالبريد', KINDS[kind].label, `${done.size} رسالة`);
      } catch (err) { console.error(err); b.disabled = false; win && !win.closed && win.close(); toast('تعذّر تجهيز الشهادة', 'error'); }
    });
  }

  function editName(id) {
    const r = recipients().find(x => x.id === id) || { id, cert: '', name: '' };
    openModal({
      title: '<i class="fa-solid fa-pen"></i> الاسم في الشهادة', size: 'sm',
      body: `<form class="form-grid one"><div class="field"><label>الاسم كما سيُكتب في الشهادة</label><input name="n" value="${esc(r.cert)}" maxlength="120" required></div>
        ${r.cert !== r.name ? `<small class="hint">الاسم المسجل في المنصة: ${esc(r.name)}</small>` : '<small class="hint">التعديل يخص الشهادة فقط ولا يغيّر بيانات العضو.</small>'}</form>`,
      actions: [{ label: 'حفظ', cls: 'primary', onClick: m => { const v = $('[name=n]', m.body).value.trim(); if (!v) return false; Store.set(`certs/names/${id}`, v === r.name ? null : v); } },
        ...(Store.get(`certs/names/${id}`) ? [{ label: 'استعادة الاسم الأصلي', cls: 'ghost', onClick: () => Store.remove(`certs/names/${id}`) }] : []),
        { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  /* ===== محرر القالب ===== */
  function templateDialog() {
    const drafts = {}; let cur = ui.kind;
    Object.keys(KINDS).forEach(k => { drafts[k] = template(k); });
    const sample = k => ({ id: 'sample', cert: k === 'event' ? 'اسم الحاضر' : k === 'mentor' ? 'اسم المرشد' : 'اسم المستفيد', name: '', email: '',
      cohortId: k === 'event' ? null : (Data.cohorts().slice(-1)[0]?.id || null), event: k === 'event' ? (currentEvent() || { title: 'عنوان الفعالية', date: todayISO() }) : null });
    const F_ = (k, label, type = 'text', hint = '') => type === 'textarea'
      ? `<div class="field wide"><label>${label}</label><textarea name="${k}" rows="${k === 'emailBody' ? 6 : 3}">${esc(drafts[cur][k] || '')}</textarea>${hint ? `<small class="hint">${hint}</small>` : ''}</div>`
      : `<div class="field"><label>${label}</label><input name="${k}" value="${esc(drafts[cur][k] || '')}" ${k === 'signature' || k === 'stamp' ? 'dir="ltr" placeholder="https://drive.google.com/..."' : ''}>${hint ? `<small class="hint">${hint}</small>` : ''}</div>`;
    const chk = (k, label) => `<label class="check"><input type="checkbox" name="${k}" ${drafts[cur][k] ? 'checked' : ''}><span>${label}</span></label>`;
    const formHtml = () => `<div class="form-grid">
        ${F_('title', 'عنوان الشهادة')}${F_('org', 'اسم الجهة (يظهر أسفل الشهادة)')}
        ${F_('intro', 'الجملة التمهيدية (قبل الاسم)', 'textarea')}
        ${F_('body', 'نص الشهادة (بعد الاسم)', 'textarea', 'يمكن استخدام: <code>{name}</code> الاسم، <code>{cohort}</code> الدفعة، <code>{year}</code> السنة، <code>{event}</code> عنوان الفعالية، <code>{date}</code> تاريخ الفعالية')}
        ${F_('signerName', 'اسم الموقِّع (الشخص الممثل للجهة)')}${F_('signerTitle', 'صفة الموقِّع')}
        ${F_('signature', 'رابط صورة التوقيع (اختياري)', 'text', 'صورة PNG بخلفية شفافة تعطي أفضل نتيجة')}${F_('stamp', 'رابط صورة الختم (اختياري)')}
        <div class="check-row wide">${chk('showSignature', 'إظهار التوقيع')}${chk('showStamp', 'إظهار الختم')}${chk('showDate', 'إظهار تاريخ الإصدار')}</div>
        ${F_('footer', 'سطر إضافي أسفل الشهادة (اختياري)')}
        <div class="field wide"><h4 class="sub"><i class="fa-regular fa-envelope"></i> قالب رسالة البريد</h4></div>
        ${F_('emailSubject', 'عنوان الرسالة')}
        ${F_('emailBody', 'نص الرسالة', 'textarea', 'يمكن استخدام: <code>{name}</code> <code>{type}</code> نوع الشهادة، <code>{cohort}</code> <code>{event}</code>')}
      </div>`;
    const m = openModal({
      title: '<i class="fa-solid fa-pen-ruler"></i> قوالب الشهادات', size: 'xl', cls: 'cert-tpl', dismissible: false,
      body: `<div class="cert-tpl-grid"><div class="cert-tpl-form">
          <div class="sub-tabs" data-kinds>${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="${k === cur ? 'active' : ''}" data-k="${k}"><i class="fa-solid ${v.icon}"></i> ${v.label}</button>`).join('')}</div>
          <div data-tpl-form>${formHtml()}</div></div>
          <div class="cert-tpl-prev"><h4>معاينة</h4><div class="cert-preview" data-prev><div class="cert-loading"><i class="fa-solid fa-spinner fa-spin"></i></div></div></div></div>`,
      actions: [{ label: 'حفظ القوالب', cls: 'primary', onClick: () => {
          collect();
          Object.keys(KINDS).forEach(k => {
            const diff = {}; TEXT_KEYS.forEach(f => { if ((drafts[k][f] || '') !== (DEFAULTS[k][f] || '')) diff[f] = drafts[k][f] || ''; });
            BOOL_KEYS.forEach(f => { if (!!drafts[k][f] !== !!DEFAULTS[k][f]) diff[f] = !!drafts[k][f]; });
            const saved = Store.get(`certs/templates/${k}`) || {};
            // نحفظ القالب كاملاً حتى لا يتأثر بأي تغيير مستقبلي في النصوص الافتراضية
            const full = {}; TEXT_KEYS.forEach(f => { full[f] = drafts[k][f] || ''; }); BOOL_KEYS.forEach(f => { full[f] = !!drafts[k][f]; });
            if (Object.keys(diff).length || Object.keys(saved).length) Store.set(`certs/templates/${k}`, full);
          });
          Security.log('تعديل قوالب الشهادات');
          toast('تم حفظ القوالب');
        } },
        { label: 'استعادة الافتراضي لهذه الشهادة', cls: 'ghost', onClick: () => { drafts[cur] = { ...DEFAULTS[cur] }; redraw(); return false; } },
        { label: 'إلغاء', cls: 'ghost' }]
    });
    function collect() {
      const box = $('[data-tpl-form]', m.body); if (!box) return;
      TEXT_KEYS.forEach(k => { const el = box.querySelector(`[name=${k}]`); if (el) drafts[cur][k] = el.value.trim(); });
      BOOL_KEYS.forEach(k => { const el = box.querySelector(`[name=${k}]`); if (el) drafts[cur][k] = el.checked; });
    }
    let timer = null;
    const preview = () => { clearTimeout(timer); timer = setTimeout(async () => {
      collect();
      const box = $('[data-prev]', m.body); if (!box) return;
      const { canvas } = await render(cur, sample(cur), { ...drafts[cur] });
      box.innerHTML = `<img src="${canvas.toDataURL('image/jpeg', .75)}" alt="معاينة">`;
    }, 350); };
    function redraw() { $('[data-tpl-form]', m.body).innerHTML = formHtml(); $$('[data-kinds] button', m.body).forEach(b => b.classList.toggle('active', b.dataset.k === cur)); preview(); }
    m.body.addEventListener('input', preview); m.body.addEventListener('change', preview);
    m.body.addEventListener('click', e => { const b = e.target.closest('[data-kinds] [data-k]'); if (b) { collect(); cur = b.dataset.k; redraw(); } });
    preview();
  }

  /* ===== التبويب ===== */
  function adminPanel() {
    const list = recipients();
    const sel = list.filter(r => ui.sel.has(r.id));
    const allSel = list.length && sel.length === list.length;
    const cohorts = Data.cohorts(), evs = events();
    const ev = currentEvent();
    const filter = ui.kind === 'event'
      ? (evs.length ? `<select data-cert-event>${evs.map(e => `<option value="${esc(e.id)}" ${ev?.id === e.id ? 'selected' : ''}>${esc(e.title)} — ${fmtDate(e.date)}</option>`).join('')}</select>` : '<span class="muted small">لا توجد فعاليات بعد</span>')
      : `<div class="chip-filter">${[{ id: 'all', name: 'كل الدفعات' }, ...cohorts].map(c => `<button class="${ui.cohort === c.id ? 'active' : ''}" data-cert-cohort="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>`;
    return `<div class="panel" id="certs-panel">
      <div class="panel-head"><h2><i class="fa-solid fa-award"></i> الشهادات</h2>
        <button class="btn ghost" data-cert-tpl><i class="fa-solid fa-pen-ruler"></i> تعديل قوالب الشهادات</button></div>
      <div class="sub-tabs">${Object.entries(KINDS).map(([k, v]) => `<button class="${ui.kind === k ? 'active' : ''}" data-cert-kind="${k}"><i class="fa-solid ${v.icon}"></i> ${v.label}</button>`).join('')}</div>
      <div class="cert-filters">${filter}<input class="search" data-cert-search placeholder="ابحث بالاسم أو البريد..." value="${esc(ui.q)}"></div>
      <div class="cert-bar">
        <label class="check"><input type="checkbox" data-cert-all ${allSel ? 'checked' : ''} ${list.length ? '' : 'disabled'}><span>تحديد الكل (${list.length})</span></label>
        <span class="muted small">${sel.length ? `محدد: <b>${sel.length}</b>` : ''}</span>
        <button class="btn primary" data-cert-bulk ${sel.length ? '' : 'disabled'}><i class="fa-solid fa-file-pdf"></i> PDF للمحددين</button>
      </div>
      ${list.length ? `<ul class="cert-list">${list.map(r => { const iss = issuedOf(r.id); return `<li class="${ui.sel.has(r.id) ? 'sel' : ''}">
        <label class="check"><input type="checkbox" data-cert-pick="${esc(r.id)}" ${ui.sel.has(r.id) ? 'checked' : ''}><span class="sr-only">تحديد</span></label>
        <div class="cert-who"><b>${esc(r.cert)}</b>${r.cert !== r.name ? `<small class="muted">الاسم المسجل: ${esc(r.name)}</small>` : ''}
          <small class="muted">${r.sub ? `<span class="num">${esc(r.sub)}</span> · ` : ''}${r.email ? `<span dir="ltr">${esc(r.email)}</span>` : '<span class="warn">بلا بريد</span>'}</small></div>
        ${iss ? `<span class="pill st-done" title="${fmtTs(iss.ts)}"><i class="fa-solid fa-check"></i> أُصدرت</span>` : ''}
        <button class="icon-btn" data-cert-edit="${esc(r.id)}" title="تعديل الاسم في الشهادة"><i class="fa-solid fa-pen"></i></button>
        <button class="btn xs primary" data-cert-pdf="${esc(r.id)}"><i class="fa-solid fa-file-pdf"></i> PDF</button></li>`; }).join('')}</ul>`
        : emptyState(ui.kind === 'event' ? 'لا يوجد مسجلون في هذه الفعالية' : 'لا توجد أسماء في هذه القائمة', 'fa-award')}
    </div>`;
  }

  const rerender = () => window.dispatchEvent(new Event('ishraq-rerender'));
  document.addEventListener('click', e => {
    if (!$('#certs-panel')) return;
    const t = e.target;
    const kind = t.closest('[data-cert-kind]'); if (kind) { ui.kind = kind.dataset.certKind; ui.sel.clear(); ui.q = ''; return rerender(); }
    const co = t.closest('[data-cert-cohort]'); if (co) { ui.cohort = co.dataset.certCohort; ui.sel.clear(); return rerender(); }
    if (t.closest('[data-cert-tpl]')) return templateDialog();
    if (t.closest('[data-cert-bulk]')) return bulkDialog();
    const ed = t.closest('[data-cert-edit]'); if (ed) return editName(ed.dataset.certEdit);
    const pdf = t.closest('[data-cert-pdf]'); if (pdf) return issueDialog(pdf.dataset.certPdf);
  });
  document.addEventListener('change', e => {
    if (!$('#certs-panel')) return;
    const t = e.target;
    if (t.matches('[data-cert-event]')) { ui.event = t.value; ui.sel.clear(); return rerender(); }
    if (t.matches('[data-cert-all]')) { const l = recipients(); if (t.checked) l.forEach(r => ui.sel.add(r.id)); else l.forEach(r => ui.sel.delete(r.id)); return rerender(); }
    if (t.matches('[data-cert-pick]')) { t.checked ? ui.sel.add(t.dataset.certPick) : ui.sel.delete(t.dataset.certPick); return rerender(); }
  });
  document.addEventListener('input', e => {
    if (!e.target.matches?.('[data-cert-search]')) return;
    ui.q = e.target.value; const pos = e.target.selectionStart;
    rerender();
    requestAnimationFrame(() => { const n = $('[data-cert-search]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
  });

  return { adminPanel, render, buildPdf, buildZip, template, DEFAULTS };
})();
