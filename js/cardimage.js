/* تصدير البطاقة التعريفية كصورة PNG عالية الدقة (بدون رقم العضوية وأيقونات التواصل) */

const CardImage = (() => {
  const SCALE = 3;            // دقة التصدير (3x)
  const W = 540;              // عرض البطاقة بالوحدات المنطقية
  const PAD = 28;             // هامش شفاف حول البطاقة للظل
  const HEAD = 150;           // ارتفاع الترويسة
  const AV = 176;             // قطر الصورة
  const C = {
    ink: '#2E2563', ink2: '#4E4B63', muted: '#7C7A8E', p: '#8776C4', pd: '#5B4A9E', pl: '#EEEBF8', line: '#E6E3F0'
  };
  const HEAD_FONT = "'Cairo', 'Noto Sans Arabic', sans-serif";              // العناوين والأسماء
  const UI_FONT = "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif";  // الشارات والوسوم والسطور الصغيرة
  const BODY_FONT = "'Noto Sans Arabic', 'IBM Plex Sans Arabic', sans-serif"; // النص المقروء

  function loadImage(src, cors) {
    return new Promise(res => {
      if (!src) return res(null);
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  // رابط صورة Google Drive بصيغة تسمح بالرسم على اللوحة
  function corsPhoto(url) {
    url = String(url || '').trim();
    if (!url) return '';
    const m = url.match(/\/d\/([\w-]{10,})/) || url.match(/[?&]id=([\w-]{10,})/);
    if (m && /drive\.google|docs\.google|googleusercontent/.test(url)) return `https://lh3.googleusercontent.com/d/${m[1]}=w1000`;
    return url;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = typeof r === 'number' ? [r, r, r, r] : r;
    ctx.beginPath();
    ctx.moveTo(x + rr[0], y);
    ctx.lineTo(x + w - rr[1], y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr[1]);
    ctx.lineTo(x + w, y + h - rr[2]); ctx.quadraticCurveTo(x + w, y + h, x + w - rr[2], y + h);
    ctx.lineTo(x + rr[3], y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr[3]);
    ctx.lineTo(x, y + rr[0]); ctx.quadraticCurveTo(x, y, x + rr[0], y);
    ctx.closePath();
  }

  function wrap(ctx, text, maxW) {
    const lines = [];
    String(text || '').split('\n').forEach(par => {
      let line = '';
      par.split(/\s+/).filter(Boolean).forEach(word => {
        const t = line ? line + ' ' + word : word;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
      });
      if (line) lines.push(line);
    });
    return lines;
  }

  function headerGradient(ctx, role, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    if (role === 'mentor') { g.addColorStop(0, '#3E83B3'); g.addColorStop(1, '#7FB1D4'); }
    else { g.addColorStop(0, '#2E2563'); g.addColorStop(0.38, '#5B4A9E'); g.addColorStop(0.68, '#8776C4'); g.addColorStop(1, '#7FB1D4'); }
    return g;
  }

  async function ensureFonts() {
    try {
      await Promise.all([
        document.fonts.load(`800 30px ${HEAD_FONT}`, 'إشراق'),
        document.fonts.load(`700 18px ${HEAD_FONT}`, 'إشراق'),
        document.fonts.load(`400 17px ${BODY_FONT}`, 'إشراق'),
        document.fonts.load(`600 15px ${UI_FONT}`, 'إشراق'),
        document.fonts.load(`700 16px ${UI_FONT}`, 'إشراق')
      ]);
      await document.fonts.ready;
    } catch { /* ignore */ }
  }

  async function render(m) {
    await ensureFonts();
    const [logo, photo] = await Promise.all([
      loadImage('assets/ishraq-logo-white.png', false),
      loadImage(corsPhoto(m.photo), true)
    ]);

    // قياس المحتوى لحساب الارتفاع
    const meas = document.createElement('canvas').getContext('2d');
    meas.direction = 'rtl';
    const innerW = W - 72;
    meas.font = `400 17px ${BODY_FONT}`;
    const bioLines = wrap(meas, m.bio, innerW);
    const areas = String(m.areas || '').split(/[،,\n]/).map(s => s.trim()).filter(Boolean);
    meas.font = `600 15px ${UI_FONT}`;
    const chipH = 34, chipGap = 8, chipPad = 16;
    const rows = [];
    let row = [], rowW = 0;
    areas.forEach(a => {
      const w = meas.measureText(a).width + chipPad * 2;
      if (row.length && rowW + chipGap + w > innerW) { rows.push({ items: row, w: rowW }); row = []; rowW = 0; }
      rowW += (row.length ? chipGap : 0) + w; row.push({ a, w });
    });
    if (row.length) rows.push({ items: row, w: rowW });
    meas.font = `600 20px ${BODY_FONT}`;
    const tagLines = m.tagline ? wrap(meas, m.tagline, innerW).slice(0, 2) : [];

    let h = HEAD + AV / 2 + 26;             // الصورة
    h += 42;                                 // الاسم
    h += tagLines.length * 30 + (tagLines.length ? 8 : 0);
    h += bioLines.length ? bioLines.length * 29 + 18 : 0;
    h += rows.length ? 26 + rows.length * (chipH + chipGap) + 10 : 0;
    h += 70;                                 // التذييل
    const H = Math.max(h, 520);

    const cv = document.createElement('canvas');
    cv.width = (W + PAD * 2) * SCALE;
    cv.height = (H + PAD * 2) * SCALE;
    const ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);
    // خلفية فاتحة بدل الشفافية (بعض المنصات تعرض الشفافية باللون الأسود)
    const bg = ctx.createLinearGradient(0, 0, W + PAD * 2, H + PAD * 2);
    bg.addColorStop(0, '#F1EEFA'); bg.addColorStop(1, '#E9F2F9');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W + PAD * 2, H + PAD * 2);
    ctx.translate(PAD, PAD);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // جسم البطاقة مع الظل
    ctx.save();
    ctx.shadowColor = 'rgba(46,37,99,.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    roundRect(ctx, 0, 0, W, H, 30); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();

    // الترويسة
    ctx.fillStyle = headerGradient(ctx, m.role, 0, 0, W, HEAD);
    ctx.fillRect(0, 0, W, HEAD);

    // الشعار (يمين)
    if (logo) {
      const lh = 78, lw = lh * logo.width / logo.height;
      ctx.drawImage(logo, W - 22 - lw, 18, lw, lh);
    }
    // الصفة (يسار) بإطار أبيض مفرغ
    const role = m.role === 'mentor' ? 'مرشد' : 'مستفيد';
    ctx.font = `700 16px ${UI_FONT}`;
    const rw = ctx.measureText(role).width + 32;
    roundRect(ctx, 22, 22, rw, 34, 17);
    ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(role, 22 + rw / 2, 45);

    // الصورة
    const cx = W / 2, cy = HEAD;
    ctx.save();
    ctx.shadowColor = 'rgba(46,37,99,.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
    ctx.beginPath(); ctx.arc(cx, cy, AV / 2 + 7, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, AV / 2, 0, Math.PI * 2); ctx.clip();
    if (photo) {
      const s = Math.max(AV / photo.width, AV / photo.height);
      const pw = photo.width * s, ph = photo.height * s;
      ctx.drawImage(photo, cx - pw / 2, cy - AV / 2 - (ph - AV) * 0.25, pw, ph);
    } else {
      const g = ctx.createLinearGradient(cx - AV / 2, cy - AV / 2, cx + AV / 2, cy + AV / 2);
      g.addColorStop(0, '#2E2563'); g.addColorStop(0.5, '#8776C4'); g.addColorStop(1, '#7FB1D4');
      ctx.fillStyle = g; ctx.fillRect(cx - AV / 2, cy - AV / 2, AV, AV);
      const tmp = document.createElement('div'); tmp.innerHTML = initials(m.name);
      ctx.fillStyle = '#fff'; ctx.font = `800 54px ${HEAD_FONT}`; ctx.textBaseline = 'middle';
      ctx.fillText(tmp.textContent, cx, cy + 4);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();

    // الاسم والسطر التعريفي
    let y = HEAD + AV / 2 + 26 + 32;
    ctx.fillStyle = C.ink; ctx.font = `800 30px ${HEAD_FONT}`;
    ctx.fillText(m.name || '', cx, y);
    y += 10;
    ctx.fillStyle = C.p; ctx.font = `600 20px ${BODY_FONT}`;
    tagLines.forEach(l => { y += 30; ctx.fillText(l, cx, y); });
    if (tagLines.length) y += 8;

    // النبذة
    if (bioLines.length) {
      y += 14;
      ctx.fillStyle = C.ink2; ctx.font = `400 17px ${BODY_FONT}`;
      bioLines.forEach(l => { y += 29; ctx.fillText(l, cx, y); });
      y += 4;
    }

    // المجالات
    if (rows.length) {
      y += 30;
      ctx.fillStyle = C.muted; ctx.font = `500 14px ${UI_FONT}`;
      ctx.fillText(m.role === 'mentor' ? 'مجالات الإرشاد' : 'مجالات الاهتمام', cx, y);
      y += 12;
      ctx.font = `600 15px ${UI_FONT}`;
      rows.forEach(r => {
        let x = cx + r.w / 2;                // من اليمين إلى اليسار
        r.items.forEach(it => {
          roundRect(ctx, x - it.w, y, it.w, chipH, chipH / 2);
          ctx.fillStyle = C.pl; ctx.fill();
          ctx.fillStyle = C.pd; ctx.fillText(it.a, x - it.w / 2, y + 23);
          x -= it.w + chipGap;
        });
        y += chipH + chipGap;
      });
    }

    // التذييل
    const fy = H - 52;
    ctx.fillStyle = '#FBFAFE'; ctx.fillRect(0, fy, W, 52);
    ctx.fillStyle = C.line; ctx.fillRect(0, fy, W, 1);
    const cohort = Data.cohort(m.cohort);
    ctx.fillStyle = C.muted; ctx.font = `600 14px ${UI_FONT}`;
    ctx.fillText(`إشراق | معك لمستقبل طموح${cohort ? ' · ' + cohort.name + ' ' + cohort.year : ''}`, cx, fy + 32);

    ctx.restore();
    return { canvas: cv, photoFailed: !!m.photo && !photo };
  }

  async function download(m) {
    toast('جارٍ تجهيز البطاقة...');
    try {
      const { canvas, photoFailed } = await render(m);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      // اسم ملف بحروف لاتينية لضمان حفظه بشكل صحيح في جميع المتصفحات
      window.download(`ishraq-${m.role === 'mentor' ? 'mentor' : 'mentee'}-card.png`, blob);
      if (photoFailed) toast('تعذّر تضمين الصورة الشخصية؛ تأكد أن رابط Google Drive متاح لأي شخص لديه الرابط', 'error');
      else toast('تم حفظ البطاقة');
    } catch (e) {
      console.error(e);
      toast('تعذّر إنشاء صورة البطاقة', 'error');
    }
  }

  async function toBlob(m) {
    const { canvas, photoFailed } = await render(m);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return { blob, photoFailed };
  }

  return { render, download, toBlob };
})();
