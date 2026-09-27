/* الصفحة الرئيسية، صفحة الأعضاء، نموذج الاهتمام، الإعلان، والدخول */

const Home = (() => {
  const sections = () => Store.list('content/sections').sort(byOrder);
  const visibleSections = () => sections().filter(s => s.visible !== false);
  const items = s => (s.items || []).filter(Boolean);

  function head(s) {
    return `<div class="sec-head reveal">
      ${s.kicker ? `<span class="kicker">${esc(s.kicker)}</span>` : ''}
      ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
      ${s.subtitle ? `<p class="sec-sub">${esc(s.subtitle)}</p>` : ''}
    </div>`;
  }
  const faIcon = ic => `<i class="fa-solid ${esc(ic || 'fa-star')}"></i>`;

  const R = {
    header(s) {
      const links = visibleSections().filter(x => x.nav).map(x => `<a href="#sec-${x.id}" data-scroll>${esc(x.nav)}</a>`).join('');
      return `<header class="site-header" id="sec-${s.id}">
        <div class="container hdr-in">
          <a class="brand" href="#/" data-top><img src="assets/ishraq-mark.png" alt=""><span><b>${esc(s.brand || 'إشراق')}</b><small>${esc(s.tagline || '')}</small></span></a>
          <nav class="main-nav">${links}</nav>
          <div class="hdr-actions">
            <button class="btn primary sm" data-open-form><i class="fa-solid fa-pen-to-square"></i> سجّل اهتمامك</button>
            <button class="icon-btn nav-toggle" aria-label="القائمة"><i class="fa-solid fa-bars"></i></button>
          </div>
        </div>
      </header>`;
    },
    hero(s) {
      return `<section class="hero" id="sec-${s.id}">
        <div class="hero-bg" aria-hidden="true">
          <div class="rays"></div><div class="glow g1"></div><div class="glow g2"></div>
          <svg class="net" viewBox="0 0 600 600">${heroNet()}</svg>
        </div>
        <div class="container hero-in">
          <div class="hero-text">
            ${s.badge ? `<span class="hero-badge"><i class="fa-solid fa-sun"></i> ${esc(s.badge)}</span>` : ''}
            <h1>${esc(s.title || 'إشراق')}</h1>
            ${s.subtitle ? `<p class="hero-sub">${esc(s.subtitle)}</p>` : ''}
            ${s.body ? `<p class="hero-body">${nl2br(s.body)}</p>` : ''}
            <div class="hero-cta">
              ${s.button ? `<button class="btn light lg" data-open-form><i class="fa-solid fa-pen-to-square"></i> ${esc(s.button)}</button>` : ''}
              ${s.button2 ? `<a class="btn outline-light lg" href="#/members"><i class="fa-solid fa-users"></i> ${esc(s.button2)}</a>` : ''}
            </div>
          </div>
          <div class="hero-logo"><div class="logo-orb"><img src="assets/ishraq-logo.png" alt="شعار إشراق"></div></div>
        </div>
        <a class="scroll-hint" href="#" data-scroll-next aria-label="التالي"><i class="fa-solid fa-chevron-down"></i></a>
      </section>`;
    },
    about(s) {
      return `<section class="sec about" id="sec-${s.id}"><div class="container about-grid">
        <div class="reveal">${s.kicker ? `<span class="kicker">${esc(s.kicker)}</span>` : ''}<h2>${esc(s.title || '')}</h2><p class="lead">${nl2br(s.body || '')}</p></div>
        <div class="about-items">${items(s).map((it, i) => `<div class="about-item reveal" style="--d:${i}">
          <span class="ic">${faIcon(it.icon)}</span><div><h3>${esc(it.title)}</h3><p>${nl2br(it.text)}</p></div></div>`).join('')}</div>
      </div></section>`;
    },
    cards(s) {
      return `<section class="sec" id="sec-${s.id}"><div class="container">${head(s)}
        <div class="feature-grid">${items(s).map((it, i) => `<div class="feature reveal" style="--d:${i}">
          <span class="ic">${faIcon(it.icon)}</span><h3>${esc(it.title)}</h3><p>${nl2br(it.text)}</p></div>`).join('')}</div>
      </div></section>`;
    },
    list(s) {
      return `<section class="sec tint" id="sec-${s.id}"><div class="container">${head(s)}
        <ul class="check-list">${items(s).map((it, i) => `<li class="reveal" style="--d:${i}"><i class="fa-solid fa-circle-check"></i><span>${esc(it.text)}</span></li>`).join('')}</ul>
      </div></section>`;
    },
    stats(s) {
      return `<section class="sec stats-sec" id="sec-${s.id}"><div class="container">${head(s)}
        <div class="stats-grid">${items(s).map((it, i) => `<div class="stat reveal" style="--d:${i}"><b data-count="${esc(it.value)}">${esc(it.value)}</b><span>${esc(it.label)}</span></div>`).join('')}</div>
      </div></section>`;
    },
    timeline(s) {
      return `<section class="sec" id="sec-${s.id}"><div class="container">${head(s)}
        <ol class="timeline">${items(s).map((it, i) => `<li class="reveal ${it.current ? 'current' : ''}" style="--d:${i}">
          <span class="tl-dot">${i + 1}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p>${it.current ? '<em>المرحلة الحالية</em>' : ''}</li>`).join('')}</ol>
        ${s.note ? `<p class="tl-note reveal"><i class="fa-solid fa-lightbulb"></i> ${esc(s.note)}</p>` : ''}
      </div></section>`;
    },
    steps(s) {
      return `<section class="sec tint" id="sec-${s.id}"><div class="container">${head(s)}
        <div class="steps">${items(s).map((it, i) => `<div class="step reveal" style="--d:${i}">
          <span class="step-n">${i + 1}</span><span class="ic">${faIcon(it.icon)}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div>`).join('')}</div>
      </div></section>`;
    },
    structure(s) {
      return `<section class="sec" id="sec-${s.id}"><div class="container">${head(s)}
        <div class="org-grid">${items(s).map((it, i) => {
          const ppl = String(it.people || '').split('\n').map(x => x.trim()).filter(Boolean);
          return `<div class="org-card reveal" style="--d:${i % 6}"><h3>${esc(it.title)}</h3><ul>${ppl.map((p, j) => `<li class="${j === 0 && ppl.length > 1 ? 'lead-p' : ''}">${esc(p)}</li>`).join('')}</ul></div>`;
        }).join('')}</div>
      </div></section>`;
    },
    register(s) {
      return `<section class="sec" id="sec-${s.id}"><div class="container">
        <div class="register-card reveal">
          <div class="rc-rays" aria-hidden="true"></div>
          <div class="rc-text">
            ${s.kicker ? `<span class="kicker light">${esc(s.kicker)}</span>` : ''}
            <h2>${esc(s.title || '')}</h2>
            <p>${nl2br(s.body || '')}</p>
            ${s.deadline ? `<p class="deadline"><i class="fa-regular fa-calendar"></i> ${esc(s.deadline)}</p>` : ''}
          </div>
          <div class="rc-cta">
            <div class="rc-roles"><span><i class="fa-solid fa-user-tie"></i> مرشد</span><span><i class="fa-solid fa-user-graduate"></i> مستفيد</span></div>
            <button class="btn light lg" data-open-form><i class="fa-solid fa-pen-to-square"></i> ${esc(s.button || 'سجّل اهتمامك')}</button>
          </div>
        </div>
      </div></section>`;
    },
    members(s) {
      const count = Store.list('members').length;
      return `<section class="sec tint" id="sec-${s.id}"><div class="container">
        <div class="members-cta reveal">
          <div class="avatars-stack">${Store.list('members').slice(0, 6).map(m => avatar(m)).join('')}</div>
          <div>${s.kicker ? `<span class="kicker">${esc(s.kicker)}</span>` : ''}<h2>${esc(s.title || '')}</h2><p>${esc(s.body || '')}</p>
          ${count ? `<small class="muted">${count} عضواً في دفعات إشراق</small>` : ''}</div>
          <a class="btn primary lg" href="#/members"><i class="fa-solid fa-users"></i> ${esc(s.button || 'استعرض الأعضاء')}</a>
        </div>
      </div></section>`;
    },
    testimonials(s) {
      const list = Data.reviews({ type: 'program' }).filter(r => r.featured);
      if (!list.length) return '';
      return `<section class="sec" id="sec-${s.id}"><div class="container">${head(s)}
        <div class="quotes">${list.map((r, i) => {
          const a = Data.member(r.authorId);
          return `<figure class="quote reveal" style="--d:${i}"><i class="fa-solid fa-quote-right"></i><blockquote>${nl2br(r.text)}</blockquote>
            <figcaption>${avatar(a, 'sm')}<span><b>${esc(a?.name || r.authorName || '')}</b><small>${a?.role === 'mentor' ? 'مرشد' : 'مستفيد'}${a ? ' · ' + esc(Data.cohort(a.cohort)?.name || '') : ''}</small></span></figcaption></figure>`;
        }).join('')}</div>
      </div></section>`;
    },
    events: s => Events.section(s),
    video(s) {
      const v = videoEmbed(s.video);
      const player = !v
        ? `<div class="video-frame empty"><i class="fa-solid fa-video-slash"></i><p>أضف رابط مقطع من YouTube أو Google Drive</p></div>`
        : v.kind === 'file'
          ? `<div class="video-frame"><video src="${esc(v.src)}" controls playsinline preload="metadata"></video></div>`
          : `<div class="video-frame" data-video-src="${esc(v.src)}" role="button" tabindex="0" aria-label="تشغيل المقطع">
              <img src="${esc(v.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">
              <span class="play-btn"><i class="fa-solid fa-play"></i></span></div>`;
      return `<section class="sec video-sec" id="sec-${s.id}"><div class="container">
        ${head(s)}
        ${s.body ? `<p class="lead video-lead reveal">${nl2br(s.body)}</p>` : ''}
        <div class="video-wrap reveal">${player}</div>
      </div></section>`;
    },
    custom(s) {
      const img = driveImg(s.image);
      const btn = s.button ? (s.buttonLink
        ? `<a class="btn primary" href="${esc(s.buttonLink)}" target="_blank" rel="noopener">${esc(s.button)}</a>`
        : `<button class="btn primary" data-open-form>${esc(s.button)}</button>`) : '';
      return `<section class="sec" id="sec-${s.id}"><div class="container custom-sec ${img ? 'has-img' : ''}">
        <div class="reveal">${head(s).replace('reveal', '')}${s.body ? `<p class="lead">${nl2br(s.body)}</p>` : ''}${btn}</div>
        ${img ? `<img class="reveal" src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : ''}
      </div></section>`;
    },
    portals(s) {
      return `<section class="sec portals" id="sec-${s.id}"><div class="container">
        <div class="sec-head reveal"><h2>${esc(s.title || 'بوابات المنصة')}</h2>${s.body ? `<p class="sec-sub">${esc(s.body)}</p>` : ''}</div>
        <div class="portal-grid">
          <button class="portal reveal" data-login="mentor"><i class="fa-solid fa-user-tie"></i><b>دخول المرشد</b><small>إدارة المواعيد والجلسات والتقييم</small></button>
          <button class="portal reveal" data-login="mentee" style="--d:1"><i class="fa-solid fa-user-graduate"></i><b>دخول المستفيد</b><small>حجز الجلسات والتقييم</small></button>
          <button class="portal reveal" data-login="admin" style="--d:2"><i class="fa-solid fa-shield-halved"></i><b>دخول الإدارة</b><small>لوحة التحكم الكاملة</small></button>
        </div>
      </div></section>`;
    },
    footer(s) {
      return `<footer class="site-footer" id="sec-${s.id}"><div class="container ftr-in">
        <div class="ftr-brand"><img src="assets/ishraq-logo.png" alt="إشراق" class="ftr-logo"><p>${nl2br(s.body || '')}</p></div>
        <div class="ftr-social">${socialLinks(s.social || {}, 'social')}</div>
        <div class="ftr-org"><small>برعاية</small><img src="assets/albatalia-logo.png" alt="جمعية البطالية الخيرية"></div>
      </div><div class="ftr-bottom">${esc(s.copyright || '')}</div></footer>`;
    }
  };

  function heroNet() {
    let out = '';
    const cx = 300, cy = 330;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i * Math.PI) / 8;
      const x1 = cx + Math.cos(a) * 150, y1 = cy + Math.sin(a) * 150;
      const x2 = cx + Math.cos(a) * 270, y2 = cy + Math.sin(a) * 270;
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="9"/><circle cx="${x1}" cy="${y1}" r="5"/>`;
    }
    return out + `<path d="M${cx - 200} ${cy} A200 200 0 0 1 ${cx + 200} ${cy}" fill="none"/>`;
  }

  function render(root, instant = false) {
    const html = visibleSections().map(s => (R[s.type] ? R[s.type](s) : '')).join('');
    root.innerHTML = `<div class="home">${html || emptyState('لا يوجد محتوى للعرض')}</div>`;
    if (instant) $$('.reveal', root).forEach(el => el.classList.add('in'));
    wire(root);
  }

  // تشغيل الفيديو داخل الصفحة نفسها
  function playVideo(frame) {
    if (frame.classList.contains('playing')) return;
    frame.classList.add('playing');
    frame.innerHTML = `<iframe src="${esc(frame.dataset.videoSrc)}" title="مقطع فيديو" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }

  function wire(root) {
    $$('[data-video-src]', root).forEach(f => {
      f.addEventListener('click', () => playVideo(f));
      f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playVideo(f); } });
    });
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      if (e.target.matches('[data-count]')) countUp(e.target);
      io.unobserve(e.target);
    }), { threshold: 0.12 });
    $$('.reveal', root).forEach(el => io.observe(el));
    $('.nav-toggle', root)?.addEventListener('click', () => $('.site-header', root).classList.toggle('open'));
    $$('[data-scroll]', root).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      $(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
      $('.site-header', root)?.classList.remove('open');
    }));
    $('[data-scroll-next]', root)?.addEventListener('click', e => {
      e.preventDefault();
      e.currentTarget.closest('section').nextElementSibling?.scrollIntoView({ behavior: 'smooth' });
    });
    const hdr = $('.site-header', root);
    if (hdr) {
      const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 30);
      window.onscroll = onScroll; onScroll();
    }
  }

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const raw = el.dataset.count;
    const m = raw.match(/^(\D*)(\d+)(.*)$/);
    if (!m) return;
    const target = +m[2], t0 = performance.now(), dur = 1400;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = m[1] + v + m[3];
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* صفحة أعضاء الدفعات */
  let membersCohort = null;
  function renderMembers(root) {
    const cohorts = Data.cohorts();
    if (!membersCohort || !cohorts.find(c => c.id === membersCohort)) membersCohort = cohorts[cohorts.length - 1]?.id;
    const cohort = Data.cohort(membersCohort);
    const tile = m => `<button type="button" class="m-tile reveal" data-member="${esc(m.id)}" title="عرض البطاقة التعريفية">${avatar(m, 'xl')}<b>${esc(m.name)}</b>${m.tagline ? `<small>${esc(m.tagline)}</small>` : ''}</button>`;
    const group = (role, title, icon) => {
      const list = cohort ? Data.members(role, cohort.id) : [];
      return `<div class="m-group"><h3><i class="fa-solid ${icon}"></i> ${title} <span class="count">${list.length}</span></h3>
        ${list.length ? `<div class="m-tiles">${list.map(tile).join('')}</div>` : emptyState('لم تتم إضافة أعضاء بعد', 'fa-user-plus')}</div>`;
    };
    root.innerHTML = `<div class="members-page">
      <header class="mp-hero"><div class="container">
        <a class="back" href="#/"><i class="fa-solid fa-arrow-right"></i> الرئيسية</a>
        <img src="assets/ishraq-mark.png" alt="" class="mp-mark">
        <h1>تعرّف على أعضاء دفعات إشراق</h1>
        <div class="cohort-switch">${cohorts.map(c => `<button class="${c.id === membersCohort ? 'active' : ''}" data-cohort="${c.id}">${esc(c.name)} <span>${c.year}</span></button>`).join('')}</div>
      </div></header>
      <div class="container mp-body">
        ${group('mentor', 'المرشدون', 'fa-user-tie')}
        ${group('mentee', 'المستفيدون', 'fa-user-graduate')}
      </div>
    </div>`;
    $$('[data-cohort]', root).forEach(b => b.onclick = () => { membersCohort = b.dataset.cohort; renderMembers(root); });
    // البطاقة التعريفية في نافذة منبثقة (بدون رقم العضوية وبيانات التواصل)
    $$('[data-member]', root).forEach(b => b.onclick = () => {
      const m = Data.member(b.dataset.member);
      if (!m) return;
      openModal({ title: '', size: 'sm', cls: 'member-modal', body: memberCard(m, { showCode: false, hideContacts: true }) });
    });
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')));
    $$('.reveal', root).forEach(el => io.observe(el));
  }

  /* نموذج تسجيل الاهتمام */
  function openInterestForm() {
    const fields = Store.list('form/fields').sort(byOrder);
    const body = `<form class="form-grid interest-form" novalidate>
      <p class="form-intro">سجّل اهتمامك بالالتحاق بالدفعة القادمة من إشراق، وسيتواصل معك فريق البرنامج.</p>
      ${fieldInput({ k: '__role', label: 'أرغب بالانضمام بصفتي', type: 'radio', required: true, options: [{ value: 'mentor', label: 'مرشد' }, { value: 'mentee', label: 'مستفيد' }], wide: true }, '')}
      ${fields.map(f => fieldInput({ ...f, k: f.id, options: String(f.options || '').split('\n').map(o => o.trim()).filter(Boolean), wide: f.type === 'textarea' })).join('')}
    </form>`;
    openModal({
      title: '<i class="fa-solid fa-pen-to-square"></i> تسجيل الاهتمام بالدفعة القادمة', size: 'md', body,
      actions: [
        {
          label: '<i class="fa-solid fa-paper-plane"></i> إرسال', cls: 'primary', onClick: m => {
            const form = $('form', m.body);
            if (!validateForm(form)) return false;
            const v = readForm(form);
            const answers = {};
            fields.forEach(f => { answers[f.id] = v[f.id] ?? ''; });
            const name = answers.f_name || Object.values(answers)[0] || '';
            Store.push('interests', { role: v.__role, answers, ts: Date.now() });
            Data.notify('admin', `تسجيل اهتمام جديد (${v.__role === 'mentor' ? 'مرشد' : 'مستفيد'}): ${name}`, { icon: 'fa-user-plus' });
            openModal({ title: 'شكراً لك!', size: 'sm', body: `<div class="success-msg"><i class="fa-solid fa-circle-check"></i><p>تم استلام تسجيلك بنجاح، وسيتواصل معك فريق إشراق قريباً.</p></div>`, actions: [{ label: 'حسناً', cls: 'primary' }] });
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  /* الإعلان المنبثق */
  function maybeAnnouncement() {
    const a = Store.get('announcement');
    if (!a || !a.enabled || !a.title) return;
    const key = 'ishraq-ann-' + (a.version || 0);
    try {
      if (a.frequency === 'session' && sessionStorage.getItem(key)) return;
      if (a.frequency === 'once' && localStorage.getItem(key)) return;
      sessionStorage.setItem(key, 1); localStorage.setItem(key, 1);
    } catch { /* ignore */ }
    const img = driveImg(a.image);
    openModal({
      title: '', size: 'md', cls: 'announce',
      body: `<div class="ann">${img ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : '<div class="ann-icon"><i class="fa-solid fa-bullhorn"></i></div>'}
        <h2>${esc(a.title)}</h2><p>${nl2br(a.body || '')}</p></div>`,
      actions: [
        ...(a.button ? [{
          label: esc(a.button), cls: 'primary', onClick: () => {
            if (a.link) window.open(a.link, '_blank'); else setTimeout(openInterestForm, 220);
          }
        }] : []),
        { label: 'إغلاق', cls: 'ghost' }
      ]
    });
  }

  /* الدخول */
  function openLogin(kind) {
    const labels = { admin: 'دخول الإدارة', mentor: 'دخول المرشد', mentee: 'دخول المستفيد' };
    const hint = kind === 'admin' ? 'أدخل الرمز السري للإدارة' : 'أدخل رقم العضوية';
    openModal({
      title: `<i class="fa-solid fa-lock"></i> ${labels[kind]}`, size: 'sm',
      body: `<form class="login-form"><p class="muted">${hint}</p>
        <input class="code-input" name="code" dir="ltr" autocomplete="off" inputmode="${kind === 'admin' ? 'numeric' : 'text'}" type="${kind === 'admin' ? 'password' : 'text'}" required>
        <p class="err" hidden></p></form>`,
      actions: [
        {
          label: 'دخول', cls: 'primary', onClick: m => {
            const input = $('[name=code]', m.body), err = $('.err', m.body);
            const code = toEnDigits(input.value).trim();
            const fail = t => { err.textContent = t; err.hidden = false; input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 500); return false; };
            if (!code) return fail('فضلاً أدخل الرمز');
            if (kind === 'admin') {
              if (code !== String(window.ISHRAQ_CONFIG.adminCode || '2026')) return fail('الرمز السري غير صحيح');
              Auth.login({ kind: 'admin' });
              location.hash = '#/admin';
              return;
            }
            const mem = Data.byCode(code);
            if (!mem || mem.role !== kind) return fail('رقم العضوية غير صحيح');
            setTimeout(() => confirmLogin(kind, mem), 220);
          }
        },
        { label: 'إلغاء', cls: 'ghost' }
      ],
      onOpen: m => $('form', m.body).addEventListener('submit', e => { e.preventDefault(); $('[data-act="0"]', m.el).click(); })
    });
  }

  function confirmLogin(kind, mem) {
    openModal({
      title: 'تأكيد الدخول', size: 'sm',
      body: `<div class="confirm-login">${avatar(mem, 'lg')}<p>ستدخل إلى لوحة تحكم ${kind === 'mentor' ? 'المرشد' : 'المستفيد'}</p><h3>${esc(mem.name)}</h3><span class="code-chip">${esc(mem.code)}</span></div>`,
      actions: [
        { label: 'تأكيد', cls: 'primary', onClick: () => { Auth.login({ kind, id: mem.id }); location.hash = `#/${kind}`; } },
        { label: 'إلغاء', cls: 'ghost' }
      ]
    });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-form]')) { e.preventDefault(); openInterestForm(); }
    const l = e.target.closest('[data-login]');
    if (l) openLogin(l.dataset.login);
  });

  return { render, renderMembers, maybeAnnouncement, openInterestForm };
})();

const Auth = {
  KEY: 'ishraq-auth',
  get() { try { return JSON.parse(sessionStorage.getItem(this.KEY) || 'null'); } catch { return null; } },
  login(v) { try { sessionStorage.setItem(this.KEY, JSON.stringify(v)); } catch { window.__auth = v; } },
  logout() { try { sessionStorage.removeItem(this.KEY); } catch { /* ignore */ } window.__auth = null; location.hash = '#/'; },
  current() { return this.get() || window.__auth || null; }
};
