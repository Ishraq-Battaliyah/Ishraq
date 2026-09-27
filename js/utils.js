/* أدوات مشتركة: عرض، تواريخ، نوافذ، تصدير، ومنطق البرنامج */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');
// أيقونة Font Awesome من البيانات: تُقبل فقط بصيغة fa-xxx وإلا تُستبدل بأيقونة افتراضية
const safeIcon = (v, d = 'fa-circle-info') => (/^fa-[a-z0-9-]{1,40}$/.test(String(v || '')) ? v : d);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/* الأرقام إنجليزية دائماً */
function toEnDigits(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const dateTimeOf = (date, time) => new Date(`${date}T${time || '00:00'}:00`);
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
function minutesBetween(start, end) {
  const [h1, m1] = String(start).split(':').map(Number);
  const [h2, m2] = String(end).split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}
// نطاق الوقت يُعرض من اليسار لليمين (18:00 - 19:00) حتى داخل النص العربي
const tRange = (a, b) => `\u2066${esc(a)} - ${esc(b)}\u2069`;
const fmtSlot = x => `${fmtDate(x.date)} · ${tRange(x.start, x.end)}`;

function timeSelect(name, value = '') {
  const [hv, mv] = String(value || '').split(':');
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const mins = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  return `<div class="time-select" data-time="${esc(name)}">
    <select data-part="h">${hours.map(h => `<option ${h === hv ? 'selected' : ''}>${h}</option>`).join('')}</select>
    <span>:</span>
    <select data-part="m">${mins.map(m => `<option ${m === mv ? 'selected' : ''}>${m}</option>`).join('')}</select>
  </div>`;
}
const readTime = (root, name) => {
  const w = root.querySelector(`[data-time="${esc(name)}"]`);
  return `${w.querySelector('[data-part=h]').value}:${w.querySelector('[data-part=m]').value}`;
};

/* روابط الصور والتواصل */
function driveImg(url) {
  url = String(url || '').trim();
  if (!url) return '';
  const m = url.match(/\/d\/([\w-]{10,})/) || url.match(/[?&]id=([\w-]{10,})/);
  if (m && /drive\.google|docs\.google|googleusercontent/.test(url)) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600`;
  return url;
}
/* روابط الفيديو: YouTube أو Google Drive -> رابط تضمين يعمل داخل الصفحة */
function videoEmbed(url) {
  url = String(url || '').trim();
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/);
  if (m) {
    const t = url.match(/[?&](?:t|start)=(\d+)/);
    return { kind: 'youtube', id: m[1], thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`,
      src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1&modestbranding=1${t ? '&start=' + t[1] : ''}` };
  }
  m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/);
  if (m) return { kind: 'drive', id: m[1], thumb: `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1280`, src: `https://drive.google.com/file/d/${m[1]}/preview` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: 'file', src: url };
  return null;
}

function normPhone(p) {
  let d = toEnDigits(p).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('05') && d.length === 10) d = '966' + d.slice(1);
  else if (d.startsWith('5') && d.length === 9) d = '966' + d;
  return d;
}
const waLink = (phone, text = '') => `https://wa.me/${normPhone(phone)}${text ? '?text=' + encodeURIComponent(text) : ''}`;

function contactHref(k, v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (k === 'whatsapp') return /^https?:/.test(v) ? v : waLink(v);
  if (k === 'email') return v.startsWith('mailto:') ? v : `mailto:${v}`;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '');
  const bases = { twitter: 'https://x.com/', instagram: 'https://instagram.com/', tiktok: 'https://www.tiktok.com/@', snapchat: 'https://www.snapchat.com/add/', linkedin: 'https://www.linkedin.com/in/' };
  return bases[k] && !v.includes('.') ? bases[k] + handle : 'https://' + v;
}

function socialLinks(obj, cls = 'social') {
  const out = SOCIALS.filter(s => obj && String(obj[s.k] || '').trim())
    .map(s => `<a class="${cls}-link" href="${esc(contactHref(s.k, obj[s.k]))}" target="_blank" rel="noopener" title="${esc(s.label)}" aria-label="${esc(s.label)}"><i class="${esc(s.icon)}"></i></a>`);
  return out.length ? `<div class="${esc(cls)}">${out.join('')}</div>` : '';
}

function initials(name) {
  const w = String(name || '').replace(/^(م|أ|د|المهندس|الأستاذ|الدكتور)\s*[./]?\s*/, '').trim().split(/\s+/)
    .map(x => x.replace(/^ال(?=..)/, '')).filter(Boolean);
  return esc((w[0]?.[0] || '؟') + (w[1]?.[0] ? ' ' + w[1][0] : ''));
}
function avatar(m, size = '') {
  const src = driveImg(m?.photo);
  return `<span class="avatar ${size}"><span class="avatar-fallback">${initials(m?.name)}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}

/* بطاقة العضو الموحدة */
function memberCard(m, opts = {}) {
  if (!m) return '';
  const areasLabel = m.role === 'mentor' ? 'مجالات الإرشاد' : 'مجالات الاهتمام';
  const areas = String(m.areas || '').split(/[،,\n]/).map(s => s.trim()).filter(Boolean);
  return `<article class="member-card ${esc(m.role)}" data-id="${esc(m.id)}">
    <header class="mc-head">
      <img class="mc-logo" src="assets/ishraq-logo-white.png" alt="إشراق">
      <div class="mc-meta">
        ${opts.showCode !== false && !opts.secret ? `<span class="code-chip" title="رقم العضوية">${esc(m.code)}</span>` : ''}
        ${opts.secret ? `<span class="code-chip secret-code" data-secret="${esc(opts.secret)}" title="رمز الدخول (لا يظهر إلا للإدارة)">
          <span class="sv">${esc(m.code)}-••••</span>
          <button type="button" class="chip-btn" data-reveal-code title="إظهار / إخفاء"><i class="fa-solid fa-eye"></i></button>
          <button type="button" class="chip-btn" data-copy-code title="نسخ الرمز"><i class="fa-solid fa-copy"></i></button></span>` : ''}
        <span class="role-chip">${m.role === 'mentor' ? 'مرشد' : 'مستفيد'}</span>
      </div>
    </header>
    <div class="mc-body">
      ${avatar(m, 'xl')}
      <h4 class="mc-name">${esc(m.name)}</h4>
      ${m.tagline ? `<p class="mc-tag">${esc(m.tagline)}</p>` : ''}
      ${m.bio ? `<p class="mc-bio">${nl2br(m.bio)}</p>` : ''}
      ${areas.length ? `<div class="mc-areas"><small>${areasLabel}</small><div>${areas.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>` : ''}
      ${opts.hideContacts ? '' : socialLinks(m, 'mc-social')}
    </div>
    ${opts.actions ? `<footer class="mc-actions">${opts.actions}</footer>` : ''}
  </article>`;
}

function miniMember(m) {
  if (!m) return '<span class="muted">غير محدد</span>';
  return `<span class="mini-member">${avatar(m, 'sm')}<span><b>${esc(m.name)}</b>${m.tagline ? `<small>${esc(m.tagline)}</small>` : ''}</span></span>`;
}

/* الإشعارات السريعة */
function toast(msg, type = 'ok') {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${esc(msg)}</span>`;
  host.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

/* النوافذ المنبثقة */
function openModal({ title = '', body = '', actions = [], size = '', onOpen, onClose, dismissible = true, cls = '' }) {
  const wrap = document.createElement('div');
  wrap.className = `modal-wrap ${cls}`;
  wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true">
    <header class="modal-head"><h3>${title}</h3>${dismissible ? '<button class="icon-btn modal-x" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>' : ''}</header>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<footer class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-act="${esc(i)}">${a.label}</button>`).join('')}</footer>` : ''}
  </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => wrap.classList.add('show'));
  const api = {
    el: wrap,
    body: $('.modal-body', wrap),
    close() {
      wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); if (!$('.modal-wrap')) document.body.classList.remove('modal-open'); }, 200);
      document.removeEventListener('keydown', onKey);
      onClose && onClose();
    }
  };
  const onKey = e => { if (e.key === 'Escape' && dismissible && wrap === $$('.modal-wrap').pop()) api.close(); };
  document.addEventListener('keydown', onKey);
  if (dismissible) {
    $('.modal-x', wrap).onclick = api.close;
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) api.close(); });
  }
  $$('[data-act]', wrap).forEach(b => {
    b.onclick = async () => {
      const a = actions[+b.dataset.act];
      if (!a.onClick) return api.close();
      const r = await a.onClick(api);
      if (r !== false) api.close();
    };
  });
  onOpen && onOpen(api);
  setTimeout(() => { const f = $('input:not([type=hidden]),textarea,select', api.body); f && !('ontouchstart' in window) && f.focus(); }, 60);
  return api;
}

function confirmDialog(msg, { ok = 'تأكيد', cancel = 'إلغاء', danger = false, title = 'تأكيد' } = {}) {
  return new Promise(res => {
    openModal({
      title, size: 'sm', body: `<p class="confirm-msg">${msg}</p>`,
      actions: [
        { label: ok, cls: danger ? 'danger' : 'primary', onClick: () => res(true) },
        { label: cancel, cls: 'ghost', onClick: () => res(false) }
      ],
      onClose: () => res(false)
    });
  });
}

/* نماذج عامة */
function fieldInput(f, value = '') {
  const id = 'fi_' + Math.random().toString(36).slice(2, 8);
  const req = f.required ? 'required' : '';
  const lbl = `<label for="${esc(id)}">${esc(f.label)}${f.required ? ' <em>*</em>' : ''}</label>`;
  let input;
  switch (f.type) {
    case 'textarea': input = `<textarea id="${esc(id)}" name="${esc(f.k)}" rows="${f.rows || 4}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(value)}</textarea>`; break;
    case 'select': input = `<select id="${esc(id)}" name="${esc(f.k)}" ${req}><option value="">— اختر —</option>${(f.options || []).map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
    case 'radio': return `<div class="field">${lbl}<div class="radio-row">${(f.options || []).map((o, i) => `<label class="radio"><input type="radio" name="${esc(f.k)}" value="${esc(o.value ?? o)}" ${(o.value ?? o) === value ? 'checked' : ''} ${req}><span>${esc(o.label ?? o)}</span></label>`).join('')}</div></div>`;
    case 'checkbox': return `<label class="check"><input type="checkbox" name="${esc(f.k)}" ${value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
    default: input = `<input id="${esc(id)}" name="${esc(f.k)}" type="${f.type || 'text'}" value="${esc(value)}" ${req} placeholder="${esc(f.placeholder || '')}" ${f.type === 'tel' ? 'inputmode="tel" dir="ltr"' : ''} ${['email', 'url'].includes(f.type) ? 'dir="ltr"' : ''}>`;
  }
  return `<div class="field ${f.wide ? 'wide' : ''}">${lbl}${input}${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}</div>`;
}

function readForm(root) {
  const out = {};
  $$('input,textarea,select', root).forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.type === 'tel' ? toEnDigits(el.value).trim() : el.value.trim();
  });
  return out;
}
function validateForm(root) {
  const bad = $$('input,textarea,select', root).find(el => !el.checkValidity());
  if (bad) { bad.reportValidity(); return false; }
  return true;
}

/* تصدير CSV و PDF */
function csvCell(v) {
  v = String(v ?? '');
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function toCSV(headers, rows) {
  return '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}
function download(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// فاصل الأعمدة يُكتشف من سطر العناوين: فاصلة أو فاصلة منقوطة (Excel العربي) أو Tab
function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = ch => firstLine.split(ch).length - 1;
  const sep = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

// قراءة ملف نصي: UTF-8 إن كان صالحاً، وإلا Windows-1256 (ترميز Excel العربي الافتراضي)
async function readTextFile(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { try { return new TextDecoder('windows-1256').decode(buf); } catch { return new TextDecoder().decode(buf); } }
}

function exportPDF(title, html) {
  const w = window.open('', '_blank');
  if (!w) return toast('اسمح بالنوافذ المنبثقة لتصدير PDF', 'error');
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <base href="${esc(base)}">
    <link rel="stylesheet" href="vendor/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="css/style.css"></head>
    <body class="print-doc"><header class="print-head"><img src="assets/ishraq-logo.png" alt=""><div><h1>${esc(title)}</h1><small>${fmtTs(Date.now())}</small></div></header>${html}
    <script>window.addEventListener('load',()=>{const go=()=>setTimeout(()=>window.print(),150);(document.fonts&&document.fonts.ready?Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,4000))]):Promise.resolve()).then(go);});<\/script></body></html>`);
  w.document.close();
}

function exportBar(key) {
  return `<span class="export-bar">
    <button class="icon-btn" data-export="${esc(key)}" data-fmt="pdf" title="تصدير PDF"><i class="fa-solid fa-file-pdf"></i></button>
    <button class="icon-btn" data-export="${esc(key)}" data-fmt="csv" title="تصدير CSV"><i class="fa-solid fa-file-csv"></i></button>
  </span>`;
}

/* ============ منطق البرنامج ============ */
const STATUS = {
  upcoming: { label: 'قادمة', cls: 'st-upcoming' },
  done: { label: 'منجزة', cls: 'st-done' },
  absent_mentor: { label: 'ملغاة لغياب المرشد', cls: 'st-absent-mentor' },
  absent_mentee: { label: 'ملغاة لغياب المستفيد', cls: 'st-absent-mentee' },
  // حالات معروضة (لا تُحفظ): تأكيد الإنجاز من طرف واحد، وجلسة انقضى وقتها دون تحديث
  await_mentor: { label: 'بانتظار تأكيد المرشد', cls: 'st-await' },
  await_mentee: { label: 'بانتظار تأكيد المستفيد', cls: 'st-await' },
  overdue: { label: 'انقضاء الوقت', cls: 'st-overdue' }
};
const statusPill = s => `<span class="pill ${STATUS[s]?.cls || ''}">${STATUS[s]?.label || esc(s)}</span>`;
// شارة حالة الحجز كما يراها المرشد أو المستفيد أو الإدارة
function bookingPill(b, viewer) {
  const ds = Data.displayStatus(b);
  if (viewer && ds === `await_${viewer}`) return `<span class="pill st-await mine">بانتظار تأكيدك</span>`;
  return statusPill(ds);
}
const MODES = { inperson: 'حضوري', online: 'إلكتروني', both: 'حضوري أو إلكتروني' };
const sessionName = n => `الجلسة ${ORDINALS[n - 1] || esc(n)}`;

const Data = {
  cohorts: () => Store.list('cohorts').sort((a, b) => a.num - b.num),
  cohort: id => Store.get(`cohorts/${id}`),
  // بيانات التواصل محفوظة في مسار خاص (contacts) وتُدمج مع البطاقة عند توفرها لهذا المستخدم
  withContacts: m => (m ? { ...m, ...(Store.get(`contacts/${m.id}`) || {}) } : null),
  members: (role, cohortId) => Store.list('members')
    .filter(m => (!role || m.role === role) && (!cohortId || m.cohort === cohortId))
    .map(m => Data.withContacts(m))
    .sort((a, b) => (a.cohort === b.cohort ? (a.seq - b.seq) : String(a.cohort).localeCompare(b.cohort))),
  member: id => (id ? Data.withContacts(Store.get(`members/${id}`)) : null),
  // حفظ بيانات العضو: الحقول العامة في members وبيانات التواصل في contacts
  saveMember(id, values) {
    const pub = {}, priv = {};
    Object.entries(values).forEach(([k, v]) => { (CONTACT_KEYS.includes(k) ? priv : pub)[k] = v; });
    ['code', 'role', 'cohort', 'seq', 'uid', 'id'].forEach(k => delete pub[k]);
    if (Object.keys(pub).length) Store.update(`members/${id}`, pub);
    if (Object.keys(priv).length) Store.update(`contacts/${id}`, priv);
  },
  // الشبكة يقرؤها المشرفون فقط؛ العضو يعرف طرفه من pairs/{id}
  menteeOf(mentorId) {
    const m = Data.member(mentorId);
    if (!m) return null;
    const net = Store.get(`network/${m.cohort}`);
    return Data.member(net ? net[mentorId] : Store.get(`pairs/${mentorId}`));
  },
  mentorOf(menteeId) {
    const m = Data.member(menteeId);
    if (!m) return null;
    const net = Store.get(`network/${m.cohort}`);
    return Data.member(net ? Object.keys(net).find(k => net[k] === menteeId) : Store.get(`pairs/${menteeId}`));
  },
  // مزامنة pairs مع الشبكة لكل أعضاء الدفعة
  syncPairs(cohortId) {
    const net = Store.get(`network/${cohortId}`) || {};
    const upd = {};
    Data.members(null, cohortId).forEach(m => {
      const partner = m.role === 'mentor' ? (net[m.id] || null) : (Object.keys(net).find(k => net[k] === m.id) || null);
      if ((Store.get(`pairs/${m.id}`) || null) !== partner) upd[m.id] = partner;
    });
    if (Object.keys(upd).length) Store.update('pairs', upd);
  },
  // نسخة التقييم المعتمد تُحفظ لدى الطرف المستهدف ليقرأها وحده
  publishReview(r) {
    if (!r || !r.id || !r.targetId || r.targetId === 'admin') return;
    if (r.status === 'approved') Store.set(`approvedReviews/${r.targetId}/${r.id}`, r);
    else if (Store.get(`approvedReviews/${r.targetId}/${r.id}`) != null) Store.remove(`approvedReviews/${r.targetId}/${r.id}`);
  },
  unpublishReview(r) { if (r?.targetId && r.id && Store.get(`approvedReviews/${r.targetId}/${r.id}`) != null) Store.remove(`approvedReviews/${r.targetId}/${r.id}`); },
  // جمهور الرسالة: all | mentor | mentee | رقم العضو (تستعلم به القواعد)
  messageAud: x => (x.target === 'member' ? x.memberId : x.target === 'all_mentors' ? 'mentor' : x.target === 'all_mentees' ? 'mentee' : 'all'),
  // ترقية البيانات القائمة للبنية الجديدة (يشغّلها مشرف بصلاحية كاملة بعد نشر القواعد)
  backfill() {
    Data.cohorts().forEach(c => Data.syncPairs(c.id));
    Store.list('messages').forEach(x => { if (x.id && x.aud !== Data.messageAud(x)) Store.set(`messages/${x.id}/aud`, Data.messageAud(x)); });
    Store.list('reviews').forEach(r => {
      if (r.status === 'approved' && r.targetId && r.targetId !== 'admin' && Store.get(`approvedReviews/${r.targetId}/${r.id}`) == null) Data.publishReview(r);
    });
  },
  slots: mentorId => Store.list('slots').filter(s => s.mentorId === mentorId)
    .sort((a, b) => a.session - b.session || (a.date + a.start).localeCompare(b.date + b.start)),
  bookings: filter => Store.list('bookings').filter(b => !filter || Object.entries(filter).every(([k, v]) => b[k] === v))
    .sort((a, b) => a.session - b.session || (a.date + a.start).localeCompare(b.date + b.start)),
  reviews: filter => Object.values(Object.assign({}, ...Object.values(Store.get('approvedReviews') || {}), Store.get('reviews') || {})).filter(Boolean).filter(r => !filter || Object.entries(filter).every(([k, v]) => r[k] === v))
    .sort((a, b) => (a.session || 9) - (b.session || 9) || a.ts - b.ts),
  // الحالة المعروضة: المنجزة تحتاج تأكيد الطرفين، والقادمة التي انتهى وقتها تصبح «انقضاء الوقت»
  displayStatus(b) {
    if (b.status !== 'upcoming') return b.status;
    if (b.doneByMentor && !b.doneByMentee) return 'await_mentee';
    if (b.doneByMentee && !b.doneByMentor) return 'await_mentor';
    if (Date.now() > dateTimeOf(b.date, b.end).getTime()) return 'overdue';
    return 'upcoming';
  },
  // تصنيف الإحصاءات: كل ما انقضى وقته ولم يُحسم يدخل في «بانتظار التحديث»
  category(b) {
    const ds = Data.displayStatus(b);
    return ['overdue', 'await_mentor', 'await_mentee'].includes(ds) ? 'pending' : ds;
  },
  stats(bookings) {
    const s = { total: bookings.length, upcoming: 0, pending: 0, done: 0, absent_mentor: 0, absent_mentee: 0, minutes: 0 };
    bookings.forEach(b => { const c = Data.category(b); s[c] = (s[c] || 0) + 1; if (c === 'done') s.minutes += minutesBetween(b.start, b.end); });
    s.hours = Math.round(s.minutes / 6) / 10;
    return s;
  },
  activeBooking(menteeId, session) {
    return Data.bookings({ menteeId }).find(b => b.session === session && ['upcoming', 'done'].includes(b.status));
  },
  doneCount: (key, id) => Data.bookings({ [key]: id }).filter(b => b.status === 'done').length,
  notify(to, text, extra = {}) {
    if (!to) return;
    Store.push(`notifications/${to}`, { to, text, ts: Date.now(), read: false, ...extra });
  },
  notifications: to => Store.list(`notifications/${to}`).filter(n => n && n.text).sort((a, b) => b.ts - a.ts),
  messagesFor(m) {
    return Store.list('messages').filter(x =>
      (x.target === 'member' && x.memberId === m.id) ||
      x.target === 'all' ||
      (x.target === 'all_mentors' && m.role === 'mentor') ||
      (x.target === 'all_mentees' && m.role === 'mentee')
    ).sort((a, b) => b.ts - a.ts);
  },
  nextCode(role, cohortId) {
    const c = Data.cohort(cohortId);
    const key = `counters/${role}_${cohortId}`;
    const existing = Data.members(role, cohortId).map(m => m.seq || 0);
    const seq = Math.max(10, Store.get(key) || 0, ...existing) + 1;
    return { seq, code: `${role === 'mentor' ? 'M' : 'B'}${c.num}${seq}`, key };
  },
  // يحجز رقم العضوية التالي ذرّياً على العدّاد حتى لا يحصل مشرفان على الرقم نفسه
  async reserveCode(role, cohortId) {
    const c = Data.cohort(cohortId);
    const key = `counters/${role}_${cohortId}`;
    const floor = Math.max(10, ...Data.members(role, cohortId).map(m => m.seq || 0));
    const seq = await Store.transaction(key, cur => Math.max(floor, Number(cur) || 0) + 1);
    return { seq, code: `${role === 'mentor' ? 'M' : 'B'}${c.num}${seq}`, key };
  },
  // يضيف العضو ويُنشئ له حساب دخول برمز سري (مثل M211-7K4Q9P)
  async addMember(role, cohortId, data) {
    const { seq, code } = await Data.reserveCode(role, cohortId);
    const id = Store.newId();
    Store.set(`members/${id}`, { id, role, cohort: cohortId, seq, code, createdAt: Date.now() });
    Data.saveMember(id, data);
    let secret = null, error = null;
    try { secret = await Security.createMemberAccount(Store.get(`members/${id}`)); }
    catch (e) { console.error(e); error = Security.authMsg(e); }
    return { ...Data.member(id), secret, error };
  },
  removeMember(id) {
    const m = Data.member(id);
    if (!m) return;
    const net = Store.get(`network/${m.cohort}`) || {};
    if (m.role === 'mentor') Store.remove(`network/${m.cohort}/${id}`);
    else Object.keys(net).forEach(k => net[k] === id && Store.remove(`network/${m.cohort}/${k}`));
    const partner = Store.get(`pairs/${id}`);
    if (partner) Store.remove(`pairs/${partner}`);
    if (Store.get(`pairs/${id}`) != null) Store.remove(`pairs/${id}`);
    if (Store.get(`approvedReviews/${id}`) != null) Store.remove(`approvedReviews/${id}`);
    Security.deleteMemberAccount(m);
    Store.remove(`members/${id}`);
    Store.remove(`contacts/${id}`);
    Store.remove(`secrets/codes/${id}`);
    Store.remove(`myRegs/${id}`);
    Store.remove(`notifications/${id}`);
  }
};

const STAT_LABELS = {
  total: 'إجمالي الجلسات', upcoming: 'الجلسات القادمة', pending: 'بانتظار التحديث', done: 'الجلسات المنجزة',
  absent_mentor: 'ملغاة لغياب المرشد', absent_mentee: 'ملغاة لغياب المستفيد', hours: 'ساعات إرشادية منجزة'
};
// clickable: تجعل المربعات قابلة للضغط لعرض الجلسات المندرجة تحتها
function statsBoxes(s, withHours = false, { clickable = false, active = null } = {}) {
  const box = (key, cls, icon) => `<${clickable ? 'button type="button"' : 'div'} class="stat-box ${cls} ${active === key ? 'active' : ''}" ${clickable ? `data-stat="${esc(key)}"` : ''}>
    <i class="fa-solid ${icon}"></i><b>${s[key]}</b><span>${STAT_LABELS[key]}</span></${clickable ? 'button' : 'div'}>`;
  return `<div class="stat-boxes">
    ${box('total', 'st-total', 'fa-layer-group')}
    ${box('upcoming', 'st-upcoming', 'fa-hourglass-half')}
    ${box('pending', 'st-pending', 'fa-hourglass-end')}
    ${box('done', 'st-done', 'fa-circle-check')}
    ${box('absent_mentor', 'st-absent-mentor', 'fa-user-slash')}
    ${box('absent_mentee', 'st-absent-mentee', 'fa-user-xmark')}
    ${withHours ? box('hours', 'st-hours', 'fa-clock') : ''}
  </div>`;
}

function emptyState(text, icon = 'fa-inbox') {
  return `<div class="empty"><i class="fa-solid ${icon}"></i><p>${text}</p></div>`;
}

/* قائمة الإشعارات في اللوحات */
function bellButton(to) {
  const unread = Data.notifications(to).filter(n => !n.read).length;
  return `<button class="icon-btn bell" data-bell="${esc(to)}" title="الإشعارات"><i class="fa-solid fa-bell"></i>${unread ? `<span class="badge">${unread}</span>` : ''}</button>`;
}
function openNotifications(to) {
  const list = Data.notifications(to);
  openModal({
    title: '<i class="fa-solid fa-bell"></i> الإشعارات',
    body: list.length ? `<ul class="notif-list">${list.map(n => `<li class="${n.read ? '' : 'unread'}"><i class="fa-solid ${safeIcon(n.icon)}"></i><div><p>${esc(n.text)}</p><small>${fmtTs(n.ts)}</small></div></li>`).join('')}</ul>` : emptyState('لا توجد إشعارات بعد', 'fa-bell-slash'),
    actions: list.length ? [
      { label: 'مسح الكل', cls: 'ghost', onClick: () => list.forEach(n => Store.remove(`notifications/${to}/${n.id}`)) },
      { label: 'إغلاق', cls: 'primary' }
    ] : [],
    onOpen: () => list.filter(n => !n.read).forEach(n => Store.set(`notifications/${to}/${n.id}/read`, true))
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-bell]');
  if (b) openNotifications(b.dataset.bell);
});

/* رمز الدخول في بطاقات لوحة الإدارة: مخفي افتراضياً مع إظهار ونسخ */
document.addEventListener('click', async e => {
  const chip = e.target.closest('.secret-code');
  if (!chip) return;
  const code = chip.dataset.secret;
  if (e.target.closest('[data-reveal-code]')) {
    const shown = chip.classList.toggle('shown');
    $('.sv', chip).textContent = shown ? code : code.replace(/-.*/, '-••••');
    $('[data-reveal-code] i', chip).className = `fa-solid ${shown ? 'fa-eye-slash' : 'fa-eye'}`;
  }
  if (e.target.closest('[data-copy-code]')) {
    try { await navigator.clipboard.writeText(code); toast('تم نسخ رمز الدخول'); } catch { toast('تعذّر النسخ — أظهر الرمز وانسخه يدوياً', 'error'); }
  }
});
