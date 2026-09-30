/* الأخبار: شريط متحرك في الصفحة الرئيسية، وقسم «أخبار»، ومحرر الأخبار في لوحة الإدارة */

const News = (() => {
  /* ===== تنقية HTML: نسمح بقائمة محدودة من الوسوم والخصائص فقط، ويُطبَّق عند الحفظ وعند العرض ===== */
  const TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'P', 'DIV', 'SPAN', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'FONT']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'BUTTON', 'FORM', 'IMG', 'VIDEO', 'AUDIO']);
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;
  const SIZE = /^(xx-small|x-small|small|medium|large|x-large|xx-large|\d{1,3}(\.\d+)?(px|em|rem|%))$/i;
  const STYLE_RULES = {
    'color': COLOR, 'background-color': COLOR, 'font-size': SIZE,
    'font-weight': /^(normal|bold|[1-9]00)$/, 'font-style': /^(normal|italic)$/,
    'text-decoration': /^(none|underline|line-through)( (none|underline|line-through))*$/, 'text-decoration-line': /^(none|underline|line-through)( (none|underline|line-through))*$/,
    'text-align': /^(right|left|center|justify|start|end)$/
  };

  function cleanStyle(v) {
    return String(v || '').split(';').map(d => d.split(':')).filter(p => p.length === 2)
      .map(([k, val]) => [k.trim().toLowerCase(), val.trim()])
      .filter(([k, val]) => STYLE_RULES[k] && STYLE_RULES[k].test(val)).map(([k, val]) => `${k}: ${val}`).join('; ');
  }

  function clean(node, out) {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (DROP.has(tag)) return;
      if (!TAGS.has(tag)) { clean(n, out); return; }   // وسم غير مسموح: نُبقي نصه فقط
      const el = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const href = (n.getAttribute('href') || '').trim();
        if (/^(https?:\/\/|mailto:)/i.test(href)) { el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
      }
      if (tag === 'FONT') {
        const c = n.getAttribute('color');
        if (c && COLOR.test(c)) el.setAttribute('style', `color: ${c}`);
      } else {
        const st = cleanStyle(n.getAttribute('style'));
        if (st) el.setAttribute('style', st);
      }
      clean(n, el);
      out.appendChild(el);
    });
  }

  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
    const box = document.createElement('div');
    clean(doc.body, box);
    return box.innerHTML;
  }
  const plain = html => { const d = document.createElement('div'); d.innerHTML = sanitize(html); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };

  /* ===== البيانات ===== */
  const all = () => Store.list('news').filter(n => n.title).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const published = () => all().filter(n => n.published !== false);
  const ticker = () => published().filter(n => n.ticker);

  const imageLinks = n => Object.values(n.images || {}).filter(Boolean);
  function bigImg(url) {
    const u = driveImg(url);
    return u.replace(/sz=w\d+/, 'sz=w1400');
  }

  /* ===== الشريط المتحرك ===== */
  function tickerBar() {
    const items = ticker();
    if (!items.length) return '';
    const track = items.map(n => `<a class="tk-item" href="${esc(linkPath(n.id))}"><i class="fa-solid fa-bolt"></i>${esc(n.title)}</a>`).join('<span class="tk-sep" aria-hidden="true">◆</span>');
    // النسخة المكررة تصنع حلقة متصلة دون فراغ
    return `<div class="news-ticker" role="region" aria-label="آخر الأخبار">
      <span class="tk-label"><i class="fa-solid fa-newspaper"></i> آخر الأخبار</span>
      <div class="tk-viewport"><div class="tk-track" style="--tk-dur:${Math.max(18, items.length * 9)}s"><div class="tk-set">${track}</div><div class="tk-set" aria-hidden="true">${track}</div></div></div>
    </div>`;
  }

  /* ===== قسم الأخبار في الصفحة الرئيسية ===== */
  function section(s) {
    const list = published();
    const head = `<div class="sec-head reveal">
      ${s.kicker ? `<span class="kicker">${esc(s.kicker)}</span>` : ''}<h2>${esc(s.title || 'الأخبار')}</h2>${s.subtitle ? `<p class="sec-sub">${esc(s.subtitle)}</p>` : ''}</div>`;
    const card = n => {
      const img = imageLinks(n)[0];
      return `<a class="news-card reveal" href="${esc(linkPath(n.id))}">
        ${img ? `<div class="nc-img"><img src="${esc(driveImg(img))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ''}
        <div class="nc-body"><small><i class="fa-regular fa-calendar"></i> ${fmtTs(n.ts).split(' ')[0]}</small><h3>${esc(n.title)}</h3>
        <p>${esc(plain(n.html).slice(0, 140))}${plain(n.html).length > 140 ? '…' : ''}</p><span class="nc-more">اقرأ الخبر <i class="fa-solid fa-arrow-left"></i></span></div></a>`;
    };
    return `<section class="sec news-sec" id="sec-${esc(s.id)}"><div class="container">${head}
      ${list.length ? `<div class="news-grid">${list.map(card).join('')}</div>` : `<p class="muted center">لا توجد أخبار منشورة حالياً.</p>`}
    </div></section>`;
  }

  /* ===== رابط مباشر لكل خبر: #/news/{id} (يعمل خارج المنصة ويفتح صفحة الخبر مباشرة) ===== */
  const linkPath = id => `#/news/${encodeURIComponent(id)}`;
  const baseUrl = () => (window.ISHRAQ_CONFIG.siteUrl || (location.origin + location.pathname)).replace(/#.*$/, '');
  const shareUrl = id => baseUrl() + linkPath(id);

  function setMeta(title, desc) {
    document.title = `${title} | إشراق`;
    [['property', 'og:title', title], ['property', 'og:description', desc], ['name', 'description', desc]].forEach(([k, n, v]) => {
      let el = document.head.querySelector(`meta[${k}="${n}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(k, n); document.head.appendChild(el); }
      el.setAttribute('content', v);
    });
  }

  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط الخبر'); }
    catch { window.prompt('انسخ الرابط:', url); }
  }

  function shareBar(n) {
    const url = shareUrl(n.id), text = `${n.title}\n${url}`;
    return `<div class="news-share"><b><i class="fa-solid fa-share-nodes"></i> شارك الخبر</b>
      <a class="btn xs wa" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> واتساب</a>
      <a class="btn xs ghost" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(n.title)}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> تيليجرام</a>
      <a class="btn xs ghost" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(n.title)}" target="_blank" rel="noopener"><i class="fa-brands fa-x-twitter"></i> إكس</a>
      <button class="btn xs ghost" data-copy-link="${esc(url)}"><i class="fa-regular fa-copy"></i> نسخ الرابط</button>
      ${navigator.share ? `<button class="btn xs primary" data-native-share="${esc(n.id)}"><i class="fa-solid fa-arrow-up-from-bracket"></i> مشاركة</button>` : ''}</div>`;
  }

  // صفحة الخبر الكاملة
  function renderPage(root, id) {
    const n = id ? Store.get(`news/${id}`) : null;
    const isAdmin = Auth.current()?.kind === 'admin';
    const top = `<header class="news-top"><div class="container news-top-in"><a class="brand" href="#/"><img src="assets/ishraq-mark.png" alt=""><span><b>إشراق</b><small>معك لمستقبل طموح</small></span></a>
      <a class="btn ghost sm" href="#/"><i class="fa-solid fa-house"></i> الرئيسية</a></div></header>`;
    const foot = `<footer class="news-foot"><div class="container">برنامج إشراق — جمعية البطالية الخيرية · <a href="#/">الصفحة الرئيسية</a></div></footer>`;
    if (!n || !n.title || (n.published === false && !isAdmin)) {
      document.title = 'الخبر غير متاح | إشراق';
      root.innerHTML = `<div class="news-page">${top}<main class="container news-main">${emptyState('هذا الخبر غير متاح أو حُذف', 'fa-newspaper')}<p class="center"><a class="btn primary" href="#/"><i class="fa-solid fa-house"></i> العودة للرئيسية</a></p></main>${foot}</div>`;
      return;
    }
    setMeta(n.title, plain(n.html).slice(0, 160));
    const imgs = imageLinks(n);
    const others = published().filter(x => x.id !== n.id).slice(0, 3);
    root.innerHTML = `<div class="news-page">${top}<main class="container news-main"><article class="news-full">
      ${n.published === false ? '<p class="warn small"><i class="fa-solid fa-eye-slash"></i> مسودة: لا تظهر للزوار.</p>' : ''}
      <h1>${esc(n.title)}</h1>
      <small class="muted"><i class="fa-regular fa-calendar"></i> ${fmtTs(n.ts).split(' ')[0]}</small>
      <div class="news-content">${sanitize(n.html)}</div>
      ${imgs.length ? `<div class="news-gallery">${imgs.map(u => `<a href="${esc(bigImg(u))}" target="_blank" rel="noopener"><img src="${esc(driveImg(u))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></a>`).join('')}</div>` : ''}
      ${shareBar(n)}
    </article>
    ${others.length ? `<section class="news-more"><h2>أخبار أخرى</h2><div class="news-grid">${others.map(x => `<a class="news-card" href="${esc(linkPath(x.id))}"><div class="nc-body"><small><i class="fa-regular fa-calendar"></i> ${fmtTs(x.ts).split(' ')[0]}</small><h3>${esc(x.title)}</h3><span class="nc-more">اقرأ الخبر <i class="fa-solid fa-arrow-left"></i></span></div></a>`).join('')}</div></section>` : ''}
    </main>${foot}</div>`;
  }

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-copy-link]'); if (c) return copyLink(c.dataset.copyLink);
    const sh = e.target.closest('[data-native-share]');
    if (sh) { const n = Store.get(`news/${sh.dataset.nativeShare}`); n && navigator.share({ title: n.title, text: n.title, url: shareUrl(n.id) }).catch(() => {}); }
  });

  /* ===== لوحة الإدارة ===== */
  function adminPanel() {
    const list = all();
    return `<div class="panel" id="news-admin">
      <div class="panel-head"><h2><i class="fa-solid fa-newspaper"></i> الأخبار <span class="count">${list.length}</span></h2>
      <button class="btn primary" data-add-news><i class="fa-solid fa-plus"></i> إضافة خبر</button></div>
      <p class="muted small">تظهر الأخبار المنشورة في قسم «أخبار» بالصفحة الرئيسية (أضف القسم من «إضافة قسم» أعلاه)، والأخبار المحددة «في الشريط المتحرك» تظهر في شريط أعلى الصفحة.</p>
      ${list.length ? `<ul class="news-admin-list">${list.map(n => `<li class="${n.published === false ? 'is-hidden' : ''}">
        <div class="sec-info"><b>${esc(n.title)}</b><small>${fmtTs(n.ts)} · ${esc(plain(n.html).slice(0, 70))}</small>
          <span class="chips">${n.published === false ? '<span class="chip">مسودة</span>' : '<span class="chip st-done">منشور</span>'}${n.ticker ? '<span class="chip"><i class="fa-solid fa-bolt"></i> في الشريط</span>' : ''}${imageLinks(n).length ? `<span class="chip"><i class="fa-regular fa-image"></i> ${imageLinks(n).length}</span>` : ''}</span></div>
        <div class="sec-actions">
          <button class="icon-btn" data-copy-link="${esc(shareUrl(n.id))}" title="نسخ رابط الخبر"><i class="fa-solid fa-link"></i></button>
          <a class="icon-btn" href="${esc(linkPath(n.id))}" target="_blank" rel="noopener" title="فتح صفحة الخبر"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          <button class="icon-btn" data-toggle-news="${esc(n.id)}" title="${n.published === false ? 'نشر' : 'إخفاء'}"><i class="fa-solid ${n.published === false ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
          <button class="icon-btn" data-edit-news="${esc(n.id)}" title="تعديل"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn danger" data-del-news="${esc(n.id)}" title="حذف"><i class="fa-solid fa-trash"></i></button></div></li>`).join('')}</ul>` : emptyState('لا توجد أخبار بعد. اضغط «إضافة خبر».', 'fa-newspaper')}
    </div>`;
  }

  const TOOLS = [
    ['bold', 'fa-bold', 'غامق'], ['italic', 'fa-italic', 'مائل'], ['underline', 'fa-underline', 'تسطير'], ['strikeThrough', 'fa-strikethrough', 'يتوسطه خط'],
    ['justifyRight', 'fa-align-right', 'محاذاة لليمين'], ['justifyCenter', 'fa-align-center', 'توسيط'], ['justifyLeft', 'fa-align-left', 'محاذاة لليسار'],
    ['insertUnorderedList', 'fa-list-ul', 'قائمة نقطية'], ['insertOrderedList', 'fa-list-ol', 'قائمة مرقمة'], ['removeFormat', 'fa-eraser', 'إزالة التنسيق']
  ];
  const SIZES = [['1', 'صغير جداً'], ['2', 'صغير'], ['3', 'عادي'], ['5', 'كبير'], ['6', 'كبير جداً'], ['7', 'ضخم']];

  const COLORS = ['#25223A', '#C62828', '#E4A714', '#1E9E62', '#3E83B3', '#5B4A9E', '#C2560C', '#7C7A8E'];
  const HL = ['#FFF6DA', '#E3F6EC', '#E8F2F9', '#FDE7E7', '#EEEBF8'];

  function toolbar() {
    return `<div class="rt-toolbar" role="toolbar" aria-label="تنسيق النص">
      <select data-rt-size title="حجم الخط"><option value="">الحجم</option>${SIZES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <select data-rt-block title="نوع الفقرة"><option value="">الفقرة</option><option value="P">نص عادي</option><option value="H3">عنوان</option><option value="H4">عنوان فرعي</option><option value="BLOCKQUOTE">اقتباس</option></select>
      <span class="rt-swatches" title="لون النص" data-rt-colors>${COLORS.map(c => `<button type="button" data-rt-fore="${c}" style="background:${c}" aria-label="لون ${c}"></button>`).join('')}</span>
      <span class="rt-swatches hl" title="تمييز بلون الخلفية" data-rt-hls><i class="fa-solid fa-highlighter"></i>${HL.map(c => `<button type="button" data-rt-back="${c}" style="background:${c}" aria-label="خلفية ${c}"></button>`).join('')}</span>
      ${TOOLS.map(([c, i, t]) => `<button type="button" class="icon-btn" data-rt="${c}" title="${t}" aria-label="${t}"><i class="fa-solid ${i}"></i></button>`).join('')}
      <button type="button" class="icon-btn" data-rt-link title="رابط" aria-label="رابط"><i class="fa-solid fa-link"></i></button>
    </div>`;
  }

  function wireEditor(box) {
    const ed = $('.rt-editor', box);
    try { document.execCommand('styleWithCSS', false, true); } catch { /* ignore */ }
    const run = (cmd, val) => { ed.focus(); try { document.execCommand('styleWithCSS', false, true); } catch { /* ignore */ } document.execCommand(cmd, false, val); };
    // نحفظ التحديد عند الضغط على الأزرار حتى لا يضيع
    box.addEventListener('mousedown', e => { if (e.target.closest('.rt-toolbar button')) e.preventDefault(); });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-rt]'); if (b) return run(b.dataset.rt);
      if (e.target.closest('[data-rt-link]')) {
        const url = prompt('أدخل الرابط (https://...)');
        if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) run('createLink', url.trim()); else if (url) toast('الرابط يجب أن يبدأ بـ https://', 'error');
      }
    });
    $('[data-rt-size]', box).onchange = e => { if (e.target.value) run('fontSize', e.target.value); e.target.value = ''; };
    $('[data-rt-block]', box).onchange = e => { if (e.target.value) run('formatBlock', e.target.value); e.target.value = ''; };
    box.addEventListener('click', e => {
      const f = e.target.closest('[data-rt-fore]'); if (f) return run('foreColor', f.dataset.rtFore);
      const g = e.target.closest('[data-rt-back]'); if (g) return run('hiliteColor', g.dataset.rtBack);
    });
    // لصق كنص منسق مُنقّى
    ed.addEventListener('paste', e => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertHTML', false, html ? sanitize(html) : esc(text).replace(/\n/g, '<br>'));
    });
  }

  function editDialog(id) {
    const n = id ? Store.get(`news/${id}`) : null;
    openModal({
      title: `<i class="fa-solid fa-newspaper"></i> ${n ? 'تعديل الخبر' : 'إضافة خبر'}`, size: 'lg', dismissible: false,
      body: `<form class="form-grid one" data-news-form>
        <div class="field"><label>عنوان الخبر <em>*</em></label><input name="title" maxlength="200" value="${esc(n?.title || '')}" required></div>
        <div class="field"><label>محتوى الخبر</label>${toolbar()}<div class="rt-editor" contenteditable="true" dir="rtl" role="textbox" aria-multiline="true" data-placeholder="اكتب الخبر هنا...">${sanitize(n?.html || '')}</div></div>
        <div class="field"><label>صور الخبر (رابط في كل سطر، من Google Drive أو رابط مباشر)</label>
          <textarea name="images" rows="3" dir="ltr" placeholder="https://drive.google.com/file/d/.../view">${esc(imageLinks(n || {}).join('\n'))}</textarea>
          <small class="hint">تأكد أن مشاركة الصورة في Drive «أي شخص لديه الرابط». تظهر الصور في ختام الخبر.</small></div>
        <div class="check-row"><label class="check"><input type="checkbox" name="published" ${n?.published === false ? '' : 'checked'}><span>نشر الخبر في قسم الأخبار</span></label>
          <label class="check"><input type="checkbox" name="ticker" ${n?.ticker ? 'checked' : ''}><span>إظهاره في الشريط المتحرك</span></label></div>
      </form>`,
      onOpen: m => wireEditor(m.body),
      actions: [{
        label: 'حفظ الخبر', cls: 'primary', onClick: m => {
          const f = $('[data-news-form]', m.body);
          const title = f.title.value.trim();
          const html = sanitize($('.rt-editor', f).innerHTML);
          if (!title) { toast('اكتب عنوان الخبر', 'error'); return false; }
          if (!plain(html)) { toast('اكتب محتوى الخبر', 'error'); return false; }
          if (html.length > 20000) { toast('المحتوى طويل جداً', 'error'); return false; }
          const imgs = f.images.value.split('\n').map(x => x.trim()).filter(Boolean);
          if (imgs.some(u => !/^https?:\/\//i.test(u) || u.length > 500)) { toast('روابط الصور يجب أن تبدأ بـ https://', 'error'); return false; }
          const rec = { id: n?.id || Store.newId(), title, html, images: imgs.length ? Object.fromEntries(imgs.map((u, i) => [`i${i}`, u])) : null,
            published: f.published.checked, ticker: f.ticker.checked, ts: n?.ts || Date.now(), updatedAt: Date.now() };
          Store.set(`news/${rec.id}`, rec);
          Security.log(n ? 'تعديل خبر' : 'نشر خبر', title);
          toast('تم حفظ الخبر');
          if (rec.published) setTimeout(() => confirmDialog(`رابط الخبر المباشر:<br><b dir="ltr" class="num">${esc(shareUrl(rec.id))}</b>`, { ok: 'نسخ الرابط', cancel: 'إغلاق', title: 'تم نشر الخبر' }).then(ok => ok && copyLink(shareUrl(rec.id))), 300);
        }
      }, { label: 'إلغاء', cls: 'ghost' }]
    });
  }

  document.addEventListener('click', async e => {
    if (!$('#news-admin')) return;
    if (e.target.closest('[data-add-news]')) return editDialog();
    const ed = e.target.closest('[data-edit-news]'); if (ed) return editDialog(ed.dataset.editNews);
    const tg = e.target.closest('[data-toggle-news]');
    if (tg) { const n = Store.get(`news/${tg.dataset.toggleNews}`); return n && Store.update(`news/${n.id}`, { published: n.published === false }); }
    const dl = e.target.closest('[data-del-news]');
    if (dl) {
      const n = Store.get(`news/${dl.dataset.delNews}`);
      if (n && await confirmDialog(`حذف الخبر «${esc(n.title)}»؟`, { danger: true, ok: 'حذف' })) { Store.remove(`news/${n.id}`); Security.log('حذف خبر', n.title); }
    }
  });

  return { sanitize, plain, tickerBar, section, adminPanel, renderPage, shareUrl, all };
})();
