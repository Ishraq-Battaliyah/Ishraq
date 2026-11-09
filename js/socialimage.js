/* صور منشورات إنستغرام (1080×1350، نسبة 4:5) تُرسم على canvas بهوية إشراق */

const SocialImage = (() => {
  const W = 1080, H = 1350;
  const C = { ink: '#2E2563', ink2: '#4E4B63', muted: '#7C7A8E', p: '#8776C4', pd: '#5B4A9E', pl: '#EEEBF8' };
  const TAGLINE = 'إشراق | معك لمستقبل طموح';

  function canvas() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    return { cv, ctx };
  }

  const toBlob = cv => new Promise(r => cv.toBlob(r, 'image/png'));

  function gradient(ctx, role, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    if (role === 'mentor') { g.addColorStop(0, '#3E83B3'); g.addColorStop(1, '#7FB1D4'); }
    else { g.addColorStop(0, '#2E2563'); g.addColorStop(0.38, '#5B4A9E'); g.addColorStop(0.68, '#8776C4'); g.addColorStop(1, '#7FB1D4'); }
    return g;
  }

  function drawLogo(ctx, logo, h, rightX, y) {
    if (!logo) return;
    const w = h * logo.width / logo.height;
    ctx.drawImage(logo, rightX - w, y, w, h);
  }

  function pill(ctx, text, rightX, y, font) {
    ctx.font = font;
    const w = ctx.measureText(text).width + 56, h = 58;
    CardImage.roundRect(ctx, rightX - w, y, w, h, h / 2);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(text, rightX - w / 2, y + 39);
  }

  // يقلّص الخط حتى يتسع النص في الارتفاع المتاح، ثم يرسمه سطراً سطراً
  function fitText(ctx, text, fontOf, maxW, maxH, sizes, lineK) {
    for (const size of sizes) {
      ctx.font = fontOf(size);
      const lines = CardImage.wrap(ctx, text, maxW);
      if (lines.length * size * lineK <= maxH) return { lines, size };
    }
    const size = sizes[sizes.length - 1];
    ctx.font = fontOf(size);
    const max = Math.max(1, Math.floor(maxH / (size * lineK)));
    const lines = CardImage.wrap(ctx, text, maxW).slice(0, max);
    if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s،,؛;:\-–.]+$/, '') + '…';
    return { lines, size };
  }

  /* ===== صورة المرشد / المستفيد: بطاقته التعريفية ونص مختصر ===== */
  async function member(m) {
    const F = CardImage.fonts;
    await CardImage.ensureFonts();
    const [logo, photo] = await Promise.all([
      CardImage.loadImage('assets/ishraq-logo-white.png', false),
      CardImage.loadImage(CardImage.corsPhoto(m.photo), true)
    ]);
    const { cv, ctx } = canvas();
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#F1EEFA'); bg.addColorStop(1, '#E9F2F9');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const HEAD = 400;
    ctx.fillStyle = gradient(ctx, m.role, 0, 0, W, HEAD); ctx.fillRect(0, 0, W, HEAD);
    drawLogo(ctx, logo, 150, W - 60, 50);
    pill(ctx, m.role === 'mentor' ? 'مرشد' : 'مستفيد', 190, 70, `700 32px ${F.UI_FONT}`);

    const cx = W / 2, cy = HEAD, R = 190;
    ctx.save();
    ctx.shadowColor = 'rgba(46,37,99,.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
    ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    if (photo) {
      const s = Math.max(2 * R / photo.width, 2 * R / photo.height);
      const pw = photo.width * s, ph = photo.height * s;
      ctx.drawImage(photo, cx - pw / 2, cy - R - (ph - 2 * R) * 0.25, pw, ph);
    } else {
      const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      g.addColorStop(0, '#2E2563'); g.addColorStop(0.5, '#8776C4'); g.addColorStop(1, '#7FB1D4');
      ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      const tmp = document.createElement('div'); tmp.innerHTML = initials(m.name);
      ctx.fillStyle = '#fff'; ctx.font = `800 110px ${F.HEAD_FONT}`; ctx.textBaseline = 'middle';
      ctx.fillText(tmp.textContent, cx, cy + 8); ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();

    const innerW = W - 160, FOOT = 130;
    let y = cy + R + 100;
    ctx.fillStyle = C.ink; ctx.font = `800 68px ${F.HEAD_FONT}`;
    ctx.fillText(m.name || '', cx, y);

    if (m.tagline) {
      ctx.fillStyle = C.p; ctx.font = `600 38px ${F.BODY_FONT}`;
      CardImage.wrap(ctx, m.tagline, innerW).slice(0, 2).forEach(l => { y += 56; ctx.fillText(l, cx, y); });
    }

    // المجالات (حتى صفّين) تُحجز مساحتها أولاً، ثم تأخذ النبذة ما تبقى
    const areas = String(m.areas || '').split(/[،,\n]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
    ctx.font = `600 30px ${F.UI_FONT}`;
    const chipH = 56, gap = 14, rows = [];
    let row = [], rowW = 0;
    areas.forEach(a => {
      const w = ctx.measureText(a).width + 52;
      if (row.length && rowW + gap + w > innerW) { rows.push({ items: row, w: rowW }); row = []; rowW = 0; }
      if (rows.length >= 2) return;
      rowW += (row.length ? gap : 0) + w; row.push({ a, w });
    });
    if (row.length && rows.length < 2) rows.push({ items: row, w: rowW });
    const chipsH = rows.length ? 56 + rows.length * (chipH + gap) : 0;

    const bioTop = y + 36, bioMax = H - FOOT - chipsH - 30 - bioTop;
    if (m.bio && bioMax > 80) {
      ctx.fillStyle = C.ink2;
      const f = fitText(ctx, m.bio, s => `400 ${s}px ${F.BODY_FONT}`, innerW, bioMax, [36, 34, 32, 30], 1.6);
      ctx.font = `400 ${f.size}px ${F.BODY_FONT}`;
      f.lines.forEach((l, i) => ctx.fillText(l, cx, bioTop + f.size * 1.6 * (i + 1) - f.size * 0.4));
      y = bioTop + f.lines.length * f.size * 1.6;
    }

    if (rows.length) {
      y = H - FOOT - chipsH + 20;
      ctx.fillStyle = C.muted; ctx.font = `500 28px ${F.UI_FONT}`;
      ctx.fillText(m.role === 'mentor' ? 'مجالات الإرشاد' : 'مجالات الاهتمام', cx, y + 10);
      y += 36;
      ctx.font = `600 30px ${F.UI_FONT}`;
      rows.forEach(r => {
        let x = cx + r.w / 2;
        r.items.forEach(it => {
          CardImage.roundRect(ctx, x - it.w, y, it.w, chipH, chipH / 2);
          ctx.fillStyle = C.pl; ctx.fill();
          ctx.fillStyle = C.pd; ctx.fillText(it.a, x - it.w / 2, y + 38);
          x -= it.w + gap;
        });
        y += chipH + gap;
      });
    }

    ctx.fillStyle = '#FBFAFE'; ctx.fillRect(0, H - FOOT, W, FOOT);
    ctx.fillStyle = '#E6E3F0'; ctx.fillRect(0, H - FOOT, W, 2);
    const cohort = Data.cohort(m.cohort);
    ctx.fillStyle = C.muted; ctx.font = `600 32px ${F.UI_FONT}`;
    ctx.fillText(`${TAGLINE}${cohort ? ' · ' + cohort.name + ' ' + cohort.year : ''}`, cx, H - FOOT / 2 + 12);
    return { blob: await toBlob(cv), photoFailed: !!m.photo && !photo };
  }

  /* ===== صورة منشور عن مبادرة إشراق: تصميم بهوية إشراق ونص مختصر ===== */
  async function idea({ title, text, tag, url }) {
    const F = CardImage.fonts;
    await CardImage.ensureFonts();
    const logo = await CardImage.loadImage('assets/ishraq-logo-white.png', false);
    const { cv, ctx } = canvas();
    ctx.fillStyle = gradient(ctx, 'mentee', 0, 0, W, H); ctx.fillRect(0, 0, W, H);
    // دوائر زخرفية خفيفة
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.arc(W - 120, H - 260, 320, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, 420, 200, 0, Math.PI * 2); ctx.fill();

    drawLogo(ctx, logo, 150, W - 70, 60);
    if (tag) { ctx.font = `700 32px ${F.UI_FONT}`; pill(ctx, tag, 70 + ctx.measureText(tag).width + 56, 80, `700 32px ${F.UI_FONT}`); }

    // البطاقة البيضاء
    const px = 70, py = 270, pw = W - 140, ph = 780;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    CardImage.roundRect(ctx, px, py, pw, ph, 44); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    const cx = W / 2, innerW = pw - 120;
    ctx.fillStyle = C.pd;
    const t = fitText(ctx, title, s => `800 ${s}px ${F.HEAD_FONT}`, innerW, 170, [60, 54, 48], 1.35);
    ctx.font = `800 ${t.size}px ${F.HEAD_FONT}`;
    let y = py + 60;
    t.lines.forEach(l => { y += t.size * 1.35; ctx.fillText(l, cx, y - t.size * 0.3); });
    y += 26;
    ctx.fillStyle = C.p; CardImage.roundRect(ctx, cx - 60, y, 120, 8, 4); ctx.fill();
    y += 40;
    const bodyMax = py + ph - 50 - y;
    ctx.fillStyle = C.ink2;
    const b = fitText(ctx, text, s => `400 ${s}px ${F.BODY_FONT}`, innerW, bodyMax, [46, 42, 38, 34, 30], 1.65);
    ctx.font = `400 ${b.size}px ${F.BODY_FONT}`;
    // توسيط النص عمودياً في المساحة المتبقية
    const used = b.lines.length * b.size * 1.65;
    let by = y + Math.max(0, (bodyMax - used) / 2);
    b.lines.forEach(l => { by += b.size * 1.65; ctx.fillText(l, cx, by - b.size * 0.4); });

    ctx.fillStyle = '#fff'; ctx.font = `800 52px ${F.HEAD_FONT}`;
    ctx.fillText(TAGLINE, cx, py + ph + 125);
    if (url) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `500 32px ${F.UI_FONT}`;
      ctx.direction = 'ltr'; ctx.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), cx, py + ph + 185); ctx.direction = 'rtl';
    }
    return { blob: await toBlob(cv) };
  }

  return { member, idea, W, H };
})();
