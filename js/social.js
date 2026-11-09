/* تبويب «النشر الاجتماعي» في لوحة الإدارة: توليد منشورات تويتر (X) ولينكدإن وإنستغرام عن المرشدين والمستفيدين */

const Social = (() => {
  const LIMITS = { x: 280, linkedin: 3000, instagram: 2200 };
  const URL_WEIGHT = 23;              // تويتر يحسب أي رابط 23 حرفاً مهما طال
  const LINKEDIN_TARGET = 1300;       // طول مناسب للقراءة دون "عرض المزيد" الطويل
  const PLATFORMS = {
    x: { label: 'X (تويتر)', icon: 'fa-brands fa-x-twitter', intent: t => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
    instagram: { label: 'إنستغرام', icon: 'fa-brands fa-instagram', intent: null },   // لا يدعم النشر عبر رابط
    linkedin: { label: 'لينكدإن', icon: 'fa-brands fa-linkedin-in', intent: t => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(t)}` }
  };
  const INSTAGRAM_TARGET = 1000;      // كابشن مقروء قبل «المزيد»
  const IG_TAGS = '#إشراق #الإرشاد_المهني #تطوير_المهارات #جمعية_البطالية';
  const IG_NOTE = 'إنستغرام لا يدعم النشر عبر رابط: نزّل الصورة وانسخ الكابشن ثم ارفعهما يدوياً من تطبيق إنستغرام (+ ← منشور).';
  const ui = { cohort: 'all', idea: 'all' };

  const siteUrl = () => window.ISHRAQ_CONFIG.siteUrl || location.href.replace(/#.*$/, '');
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  // طول المنشور كما تحسبه المنصة (الروابط 23 حرفاً في تويتر)
  function weightedLen(text, platform) {
    if (platform !== 'x') return [...text].length;
    const url = siteUrl();
    return [...text.split(url).join('')].length + (text.split(url).length - 1) * URL_WEIGHT;
  }

  // اقتطاع عند نهاية جملة أو كلمة مع «…»
  function fit(text, max) {
    text = clean(text);
    if (max <= 0) return '';
    if ([...text].length <= max) return text;
    const cut = [...text].slice(0, max - 1).join('');
    const sentence = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('۔'), cut.lastIndexOf('؟'), cut.lastIndexOf('!'));
    if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
    const sp = cut.lastIndexOf(' ');
    return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s،,؛;:\-–]+$/, '') + '…';
  }

  function areasList(m) {
    return String(m.areas || '').split(/[،,\n]/).map(s => s.trim()).filter(Boolean);
  }

  // يبني المنشور ثم يملأ المساحة المتبقية بالنبذة التعريفية
  function composeInstagram(m) {
    const mentor = m.role === 'mentor', tag = clean(m.tagline), name = clean(m.name), areas = areasList(m);
    const areasLine = areas.length ? `${mentor ? 'مجالات الإرشاد' : 'مجالات الاهتمام'}: ${areas.slice(0, 6).join('، ')}` : '';
    const head = mentor ? `✨ تعرّفوا على المرشد ${name} من برنامج إشراق` : `🌱 تعرّفوا على ${name} أحد مستفيدي برنامج إشراق`;
    const lines = [head];
    if (tag) lines.push(tag);
    const tail = [areasLine, `منصة إشراق: ${siteUrl()}`, IG_TAGS].filter(Boolean);
    const build = bio => [...lines, ...(bio ? [bio] : []), ...tail].join('\n\n');
    const bioSrc = clean(m.bio);
    if (!bioSrc) return build('');
    const room = INSTAGRAM_TARGET - [...build('')].length - 2;
    return build(room > 20 ? fit(bioSrc, room) : '');
  }

  function compose(m, platform) {
    if (platform === 'instagram') return composeInstagram(m);
    const mentor = m.role === 'mentor';
    const tag = clean(m.tagline);
    const name = clean(m.name);
    const hashtags = platform === 'x' ? '#إشراق #الإرشاد_المهني' : '#إشراق #الإرشاد_المهني #تطوير_المهارات #جمعية_البطالية';
    const head = platform === 'x'
      ? (mentor ? `🌟 تعرّف على المرشد ${name} من برنامج #إشراق` : `🌱 تعرّف على ${name} أحد مستفيدي برنامج #إشراق`)
      : (mentor ? `🌟 تعرّفوا على المرشد ${name} من برنامج إشراق الإرشادي` : `🌱 تعرّفوا على ${name} أحد مستفيدي برنامج إشراق الإرشادي`);
    const lines = [head];
    if (tag) lines.push(tag);
    const areas = areasList(m);
    const tail = [];
    if (platform !== 'x' && areas.length) tail.push(`${mentor ? 'مجالات الإرشاد' : 'مجالات الاهتمام'}: ${areas.slice(0, 6).join('، ')}`);
    if (platform === 'x') tail.push(siteUrl(), hashtags);
    else tail.push(mentor ? 'ندعوكم للتعرف على المرشدين والانضمام إلى رحلة إشراق 👇' : 'ندعوكم للتعرف على رحلة إشراق والانضمام إليها 👇', siteUrl(), hashtags);

    const compose2 = bio => [...lines, ...(bio ? [bio] : []), ...tail].join('\n\n');
    const bioSrc = clean(m.bio) || (areas.length ? `${mentor ? 'مجالات الإرشاد' : 'مجالات الاهتمام'}: ${areas.slice(0, 6).join('، ')}` : '');
    if (!bioSrc) return compose2('');
    const target = platform === 'x' ? LIMITS.x : LINKEDIN_TARGET;
    const base = weightedLen(compose2(''), platform) + 2;      // الفاصل بين الفقرات
    const room = target - base;
    return compose2(room > 20 ? fit(bioSrc, room) : '');
  }

  /* ===== اللوحة ===== */
  function table(role) {
    const list = Data.members(role).filter(m => ui.cohort === 'all' || m.cohort === ui.cohort)
      .sort((a, b) => String(a.name).localeCompare(b.name, 'ar'));
    const title = role === 'mentor' ? 'منشورات المرشدين' : 'منشورات المستفيدين';
    const icon = role === 'mentor' ? 'fa-user-tie' : 'fa-user-graduate';
    return `<div class="panel social-block">
      <div class="panel-head"><h2><i class="fa-solid ${icon}"></i> ${title} <span class="count">${list.length}</span></h2></div>
      ${list.length ? `<div class="table-wrap"><table class="table rtable social-table"><thead><tr><th>${role === 'mentor' ? 'اسم المرشد' : 'اسم المستفيد'}</th><th class="social-col">النشر</th></tr></thead><tbody>
        ${list.map(m => `<tr><td data-l="الاسم"><span class="mini-member">${avatar(m, 'sm')}<span><b>${esc(m.name)}</b><small>${esc(m.tagline || '')}${m.tagline && Data.cohort(m.cohort) ? ' · ' : ''}${esc(Data.cohort(m.cohort)?.name || '')}</small></span></span></td>
          <td class="social-col"><div class="social-btns">${Object.entries(PLATFORMS).map(([k, p]) => `<button class="icon-btn social-btn ${k}" data-social="${esc(k)}" data-id="${esc(m.id)}" title="منشور ${esc(p.label)} عن ${esc(m.name)}" aria-label="منشور ${esc(p.label)} عن ${esc(m.name)}"><i class="${p.icon}"></i></button>`).join('')}</div></td></tr>`).join('')}
      </tbody></table></div>` : emptyState(role === 'mentor' ? 'لا يوجد مرشدون بعد' : 'لا يوجد مستفيدون بعد', icon)}
    </div>`;
  }

  function panel() {
    bind();
    const cohorts = Store.list('cohorts');
    return `<div class="panel-intro"><p class="muted small"><i class="fa-solid fa-circle-info"></i> اضغط أيقونة المنصة أمام أي اسم لتوليد منشور جاهز من نبذته التعريفية بما يناسب حد الحروف (تويتر ${LIMITS.x} حرفاً شاملةً الرابط)، مع صورة قريبة من بطاقته التعريفية لإرفاقها بالمنشور. أما إنستغرام فيولّد كابشن (${LIMITS.instagram} حرفاً) وصورة بمقاس 1080×1350، وتُرفع يدوياً لأن إنستغرام لا يدعم النشر عبر رابط.</p>
      ${cohorts.length > 1 ? `<div class="chip-filter">${[{ id: 'all', name: 'كل الدفعات' }, ...cohorts.sort((a, b) => (a.year || 0) - (b.year || 0))].map(c => `<button class="${ui.cohort === c.id ? 'active' : ''}" data-social-cohort="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>` : ''}</div>
      ${ideas()}${table('mentor')}${table('mentee')}`;
  }

  /* ===== منشورات مقترحة عن إشراق نفسها ===== */
  function counter(n, limit) {
    return `<span class="${n > limit ? 'over' : n > limit * 0.92 ? 'near' : ''}">${n} / ${limit} حرفاً</span>`;
  }

  // نص إنستغرام لفكرة مقترحة: مأخوذ من نسخة تويتر بنبرتها الخفيفة، دون الرابط والوسوم الملصقة، ثم الوسوم بنهايته
  function ideaParts(p, s) {
    const url = siteUrl(), x = SocialIdeas.resolve(p.x(s), url), li = SocialIdeas.resolve(p.li(s), url);
    const lines = x.split('\n');
    const isTags = l => /^(#\S+\s*)+$/.test(l.trim());
    const body = lines.filter(l => l.trim() !== url && !isTags(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const tags = [...new Set([...(x.match(/#[^\s#]+/g) || []), ...(li.match(/#[^\s#]+/g) || [])])].slice(0, 8);
    return { body, tags: tags.length ? tags.join(' ') : IG_TAGS };
  }

  function ideaInstagramCol(p, s) {
    const { body, tags } = ideaParts(p, s);
    const text = `${body}\n\nمنصة إشراق: ${siteUrl()}\n\n${tags}`;
    return `<div class="idea-col instagram"><div class="idea-plat"><i class="${PLATFORMS.instagram.icon}"></i> ${PLATFORMS.instagram.label}</div>
      <textarea data-idea-text="instagram" rows="9" aria-label="كابشن إنستغرام">${esc(text)}</textarea>
      <div class="social-count"><span data-idea-count="instagram">${counter(weightedLen(text, 'instagram'), LIMITS.instagram)}</span>
        <span class="idea-btns"><button type="button" class="btn ghost sm" data-idea-copy="instagram"><i class="fa-regular fa-copy"></i> نسخ الكابشن</button>
        <button type="button" class="btn primary sm" data-idea-image><i class="fa-solid fa-download"></i> تنزيل الصورة</button></span></div>
      <p class="hint"><i class="fa-solid fa-circle-info"></i> ${IG_NOTE}</p></div>`;
  }

  function ideaCard(p, i, s) {
    const T = SocialIdeas.TYPES[p.type];
    const cols = Object.entries(PLATFORMS).filter(([k]) => k !== 'instagram').map(([k, pl]) => {
      const text = SocialIdeas.resolve((k === 'x' ? p.x : p.li)(s), siteUrl());
      return `<div class="idea-col ${k}"><div class="idea-plat"><i class="${pl.icon}"></i> ${pl.label}</div>
        <textarea data-idea-text="${k}" rows="${k === 'x' ? 7 : 11}" aria-label="نص منشور ${esc(pl.label)}">${esc(text)}</textarea>
        <div class="social-count"><span data-idea-count="${k}">${counter(weightedLen(text, k), LIMITS[k])}</span>
          <span class="idea-btns"><button type="button" class="btn ghost sm" data-idea-copy="${k}"><i class="fa-regular fa-copy"></i> نسخ</button>
          <button type="button" class="btn primary sm" data-idea-post="${k}"><i class="${pl.icon}"></i> نشر في المنصة</button></span></div></div>`;
    }).join('') + ideaInstagramCol(p, s);
    return `<article class="idea-card" data-idea="${i}"><div class="idea-head"><span class="idea-no">${i + 1}</span><b>${esc(p.title)}</b>
      <span class="idea-tag t-${esc(p.type)}"><i class="fa-solid ${T.icon}"></i> ${T.label}</span>${p.live ? '<span class="idea-live" title="الأرقام من بيانات المنصة الفعلية"><i class="fa-solid fa-bolt"></i> أرقام حيّة</span>' : ''}</div>
      <div class="idea-cols">${cols}</div></article>`;
  }

  function ideas() {
    const s = SocialIdeas.stats();
    const types = [['all', 'الكل'], ...Object.entries(SocialIdeas.TYPES).map(([k, t]) => [k, t.label])];
    const list = SocialIdeas.POSTS.map((p, i) => [p, i]).filter(([p]) => ui.idea === 'all' || p.type === ui.idea);
    return `<div class="panel social-block"><div class="panel-head"><h2><i class="fa-solid fa-lightbulb"></i> منشورات مقترحة عن إشراق <span class="count">${list.length}</span></h2></div>
      <p class="muted small"><i class="fa-solid fa-circle-info"></i> ${SocialIdeas.POSTS.length} فكرة لبناء السمعة والصورة الذهنية للمبادرة، لكل منها نسخة لتويتر وأخرى للينكدإن وثالثة لإنستغرام (كابشن مع صورة بمقاس 1080×1350). النصوص قابلة للتعديل قبل النسخ أو النشر، والأرقام الحيّة تُسحب من بيانات المنصة وتتحول لصيغة عامة إن لم تتوفر.</p>
      <div class="chip-filter">${types.map(([k, l]) => `<button class="${ui.idea === k ? 'active' : ''}" data-idea-type="${esc(k)}">${esc(l)}</button>`).join('')}</div>
      <div class="idea-list">${list.map(([p, i]) => ideaCard(p, i, s)).join('')}</div></div>`;
  }

  async function ideaImage(btn) {
    const i = +btn.closest('[data-idea]').dataset.idea, p = SocialIdeas.POSTS[i];
    const { body } = ideaParts(p, SocialIdeas.stats());
    btn.disabled = true;
    try {
      const { blob } = await SocialImage.idea({ title: p.title, text: body, tag: SocialIdeas.TYPES[p.type].label, url: siteUrl() });
      download(`ishraq-instagram-${String(i + 1).padStart(2, '0')}.png`, blob);
      toast('تم تنزيل صورة المنشور — ارفعها مع الكابشن في إنستغرام');
    } catch (e) { console.error(e); toast('تعذّر إنشاء الصورة', 'error'); }
    btn.disabled = false;
  }

  // مستمعات عامة تُربط مرة واحدة (اللوحة تُعاد رسمها كاملة عند كل تحديث)
  let bound = false;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('input', e => {
      const ta = e.target.closest?.('[data-idea-text]'); if (!ta) return;
      const k = ta.dataset.ideaText;
      $(`[data-idea-count="${k}"]`, ta.closest('.idea-col')).innerHTML = counter(weightedLen(ta.value, k), LIMITS[k]);
    });
    document.addEventListener('click', async e => {
      const im = e.target.closest?.('[data-idea-image]');
      if (im) return ideaImage(im);
      const cp = e.target.closest?.('[data-idea-copy]'), po = e.target.closest?.('[data-idea-post]');
      if (!cp && !po) return;
      const k = (cp || po).dataset.ideaCopy || (cp || po).dataset.ideaPost, text = $('textarea', (cp || po).closest('.idea-col')).value;
      if (po && !PLATFORMS[k].intent) return;
      if (po && weightedLen(text, k) > LIMITS[k]) return toast(`المنشور أطول من حد ${PLATFORMS[k].label} (${LIMITS[k]} حرفاً)`, 'error');
      try { await navigator.clipboard.writeText(text); if (cp) toast('تم نسخ نص المنشور'); } catch { if (cp) toast('تعذّر النسخ — حدد النص وانسخه يدوياً', 'error'); }
      if (po) { window.open(PLATFORMS[k].intent(text), '_blank', 'noopener'); toast('فُتحت نافذة النشر، ونُسخ النص احتياطاً'); }
    });
  }

  /* ===== نافذة المنشور ===== */
  async function open(platform, id) {
    const m = Data.member(id), p = PLATFORMS[platform];
    if (!m || !p) return;
    const limit = LIMITS[platform], ig = platform === 'instagram';
    let blob = null;
    const file = `ishraq-${ig ? 'instagram-' : ''}${m.role === 'mentor' ? 'mentor' : 'mentee'}-${String(m.code || m.id).replace(/[^\w-]/g, '')}.png`;
    const modal = openModal({
      title: `<i class="${p.icon}"></i> منشور ${esc(p.label)} — ${esc(m.name)}`, size: 'md', cls: 'social-modal',
      body: `<div class="cred">
        <div class="cred-preview"><div class="cred-loading"><i class="fa-solid fa-spinner fa-spin"></i> ${ig ? 'جارٍ تجهيز صورة المنشور...' : 'جارٍ تجهيز صورة البطاقة...'}</div></div>
        <div class="field"><label>${ig ? 'كابشن إنستغرام' : 'نص المنشور'}</label><textarea name="post" rows="9">${esc(compose(m, platform))}</textarea>
          <div class="social-count"><span data-count></span> <button type="button" class="btn ghost sm" data-regen-post><i class="fa-solid fa-rotate"></i> إعادة التوليد</button></div></div>
        <p class="hint cred-hint"><i class="fa-solid fa-circle-info"></i> ${ig ? IG_NOTE : 'الروابط لا تُرفق بها الصور تلقائياً: نزّل الصورة ثم أرفقها في نافذة النشر.'}</p>
      </div>`,
      actions: [
        ...(ig ? [] : [{ label: `<i class="${p.icon}"></i> فتح نافذة النشر`, cls: 'primary', onClick: async md => {
          const text = $('[name=post]', md.body).value;
          if (weightedLen(text, platform) > limit) { toast(`المنشور أطول من حد ${p.label} (${limit} حرفاً)`, 'error'); return false; }
          try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
          window.open(p.intent(text), '_blank', 'noopener');
          toast('فُتحت نافذة النشر، ونُسخ النص احتياطاً. أرفق صورة البطاقة بعد تنزيلها');
          return false;
        } }]),
        { label: `<i class="fa-regular fa-copy"></i> ${ig ? 'نسخ الكابشن' : 'نسخ النص'}`, cls: 'ghost', onClick: async md => {
          try { await navigator.clipboard.writeText($('[name=post]', md.body).value); toast(ig ? 'تم نسخ الكابشن' : 'تم نسخ نص المنشور'); } catch { toast('تعذّر النسخ — حدد النص وانسخه يدوياً', 'error'); }
          return false;
        } },
        { label: '<i class="fa-solid fa-download"></i> تنزيل الصورة', cls: 'ghost', onClick: () => { if (blob) download(file, blob); else toast('انتظر حتى تجهز صورة البطاقة', 'error'); return false; } }
      ]
    });
    const ta = $('[name=post]', modal.body), cnt = $('[data-count]', modal.body);
    const update = () => {
      const n = weightedLen(ta.value, platform);
      cnt.textContent = `${n} / ${limit} حرفاً`;
      cnt.className = n > limit ? 'over' : n > limit * 0.92 ? 'near' : '';
    };
    ta.addEventListener('input', update); update();
    $('[data-regen-post]', modal.body).onclick = () => { ta.value = compose(Data.member(id) || m, platform); update(); };
    try {
      const r = ig ? await SocialImage.member(m) : await CardImage.toBlob(m);
      blob = r.blob;
      const prev = $('.cred-preview', modal.el);
      if (prev) prev.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="${ig ? 'صورة منشور' : 'بطاقة'} ${esc(m.name)}">${r.photoFailed ? '<p class="hint err-hint">تعذّر تضمين الصورة الشخصية من Google Drive، وظهرت الأحرف الأولى بدلاً منها.</p>' : ''}`;
    } catch (e) {
      console.error(e);
      const prev = $('.cred-preview', modal.el);
      if (prev) prev.innerHTML = '<p class="hint err-hint">تعذّر إنشاء صورة البطاقة.</p>';
    }
  }

  return { panel, open, compose, weightedLen, setCohort: c => { ui.cohort = c; }, setIdeaType: t => { ui.idea = t; } };
})();
