/* وسام الشكر الخاص للمرشدين الذين قدّموا جلسات إرشادية إضافية: صورة PNG قابلة للتحميل */

const Badge = (() => {
  const W = 540, H = 780, SCALE = 2;
  const F = { head: "'Cairo', 'Noto Sans Arabic', sans-serif", ui: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif", body: "'Noto Sans Arabic', 'IBM Plex Sans Arabic', sans-serif" };
  const C = { ink: '#2E2563', ink2: '#4E4B63', muted: '#7C7A8E', p: '#8776C4', pd: '#5B4A9E', b: '#7FB1D4', gold1: '#F6D365', gold2: '#E4A714', gold3: '#B07A0B' };

  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const ensureFonts = () => Promise.all([document.fonts.load(`800 30px ${F.head}`, 'إشراق'), document.fonts.load(`700 18px ${F.head}`, 'إشراق'), document.fonts.load(`500 17px ${F.body}`, 'إشراق'), document.fonts.load(`600 15px ${F.ui}`, 'إشراق')])
    .then(() => document.fonts.ready).catch(() => {});

  function star(ctx, cx, cy, r1, r2, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = (Math.PI * i) / n - Math.PI / 2; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath();
  }

  async function render(me) {
    await ensureFonts();
    const st = Data.extraStats(me.id);
    const mark = await load('assets/ishraq-mark.png');
    const cv = document.createElement('canvas'); cv.width = W * SCALE; cv.height = H * SCALE;
    const ctx = cv.getContext('2d'); ctx.scale(SCALE, SCALE); ctx.direction = 'rtl'; ctx.textAlign = 'center';
    // خلفية بيضاء وإطار
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, C.ink); bg.addColorStop(.5, C.p); bg.addColorStop(1, C.b);
    ctx.lineWidth = 5; ctx.strokeStyle = bg; ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.lineWidth = 1; ctx.strokeStyle = '#E6E3F0'; ctx.strokeRect(24, 24, W - 48, H - 48);

    // الوسام: نجمة ذهبية مسننة ثم حلقات ثم القرص الأبيض وشعار إشراق في القلب
    const cx = W / 2, cy = 215;
    const gold = ctx.createLinearGradient(cx - 150, cy - 150, cx + 150, cy + 150); gold.addColorStop(0, C.gold1); gold.addColorStop(.5, C.gold2); gold.addColorStop(1, C.gold3);
    ctx.save(); ctx.shadowColor = 'rgba(176,122,11,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    star(ctx, cx, cy, 158, 138, 24); ctx.fillStyle = gold; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, 128, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = gold; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 116, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.stroke();
    if (mark) { const mw = 150, mh = mw * mark.height / mark.width; ctx.drawImage(mark, cx - mw / 2, cy - mh / 2 - 6, mw, mh); }
    // شرائط الوسام
    const rib = (x, dir) => { ctx.beginPath(); ctx.moveTo(x, cy + 120); ctx.lineTo(x + dir * 40, cy + 190); ctx.lineTo(x + dir * 20, cy + 176); ctx.lineTo(x - dir * 4, cy + 190); ctx.closePath(); ctx.fillStyle = C.pd; ctx.fill(); };
    rib(cx - 46, -1); rib(cx + 46, 1);

    // نجوم صغيرة
    ctx.fillStyle = C.gold2;
    [[cx - 200, 120], [cx + 200, 120], [cx - 220, 260], [cx + 220, 260]].forEach(([x, y]) => { star(ctx, x, y, 10, 4, 4); ctx.fill(); });

    // النصوص
    let y = 520;
    ctx.fillStyle = C.ink; ctx.font = `900 44px ${F.head}`; ctx.fillText('وسام شكر خاص', cx, y);
    y += 40; ctx.fillStyle = C.ink2; ctx.font = `500 19px ${F.body}`; ctx.fillText('تقديراً للعطاء في الجلسات الإرشادية الإضافية', cx, y);
    y += 62; ctx.fillStyle = C.pd; ctx.font = `800 34px ${F.head}`;
    let size = 34; while (ctx.measureText(me.name).width > W - 100 && size > 20) { size -= 2; ctx.font = `800 ${size}px ${F.head}`; }
    ctx.fillText(me.name, cx, y);
    const pill = `${st.done} ${st.done === 1 ? 'جلسة إضافية' : 'جلسات إضافية'} · ${st.hours} ${st.hours === 1 ? 'ساعة' : 'ساعات'}`;
    y += 60; ctx.font = `700 18px ${F.ui}`;
    const pw = ctx.measureText(pill).width + 44;
    ctx.fillStyle = '#FFF6DA'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - pw / 2, y - 24, pw, 38, 19) : ctx.rect(cx - pw / 2, y - 24, pw, 38); ctx.fill();
    ctx.fillStyle = C.gold3; ctx.fillText(pill, cx, y + 1);
    ctx.fillStyle = C.muted; ctx.font = `500 14px ${F.ui}`; ctx.fillText('برنامج إشراق — جمعية البطالية الخيرية', cx, H - 54);
    ctx.fillStyle = bg; ctx.fillRect(W * .25, H - 38, W * .5, 3);
    return cv;
  }

  async function download(me) {
    try {
      const cv = await render(me);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `وسام الشكر - ${String(me.name).replace(/[\\/:*?"<>|]+/g, ' ')}.png`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    } catch (e) { console.error(e); toast('تعذّر إنشاء صورة الوسام', 'error'); }
  }

  return { render, download };
})();
