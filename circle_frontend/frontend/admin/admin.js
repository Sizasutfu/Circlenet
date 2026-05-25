// ============================================================
//  admin/admin.js  –  Shared utilities for all admin pages
// ============================================================

//const API = 'https://sizabeats:5000/api/admin';
//const API = window.location.origin;

const API = window.location.hostname === 'admin.circlenet.social'
  ? 'https://circleappapp-production.up.railway.app/api/admin'
  : 'https://sizabeats:5000/api/admin';

// ── Session helpers ────────────────────────────────────────
function getToken() { return localStorage.getItem('circle_admin_token'); }
function getAdmin() { return JSON.parse(localStorage.getItem('circle_admin') || 'null'); }

function saveSession(token, admin) {
  localStorage.setItem('circle_admin_token', token);
  localStorage.setItem('circle_admin', JSON.stringify(admin));
}

function clearSession() {
  localStorage.removeItem('circle_admin_token');
  localStorage.removeItem('circle_admin');
}

// Redirect to login if not authenticated — call at top of every protected page
function requireAdminAuth() {
  if (!getToken() || !getAdmin()) {
    clearSession();
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── API wrapper ────────────────────────────────────────────
async function adminApi(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(API + path, opts);
  const data = await res.json();

  // Token expired or invalid — force logout
  if (res.status === 401) {
    clearSession();
    window.location.href = 'index.html';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

// ── Toast ──────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = ''; }, 3000);
}

// ── Confirm modal ──────────────────────────────────────────
let _confirmResolve = null;

function showConfirm(title, message, btnLabel = 'Delete') {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    const m = document.getElementById('confirm-modal');
    if (!m) { resolve(false); return; }
    m.querySelector('.modal-title-text').textContent   = title;
    m.querySelector('.modal-body-text').textContent    = message;
    m.querySelector('.btn-confirm-danger').textContent = btnLabel;
    m.classList.add('open');
  });
}

function _closeConfirm(result) {
  document.getElementById('confirm-modal')?.classList.remove('open');
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

// ── Sidebar active link ────────────────────────────────────
function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

// ── Populate admin name in sidebar ────────────────────────
// Uses data saved to localStorage on login — no extra API call needed
function populateAdminInfo() {
  const admin = getAdmin();
  if (!admin) return;
  const nameEl = document.getElementById('admin-name');
  const avEl   = document.getElementById('admin-avatar');
  if (nameEl) nameEl.textContent = admin.name  || 'Admin';
  if (avEl)   avEl.textContent   = (admin.name || 'A').charAt(0).toUpperCase();
}

// ── Mobile sidebar toggle ──────────────────────────────────
function initMobileMenu() {
  const btn     = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && e.target !== btn)
      sidebar.classList.remove('open');
  });
}

// ── Logout ─────────────────────────────────────────────────
async function adminLogout() {
  try { await adminApi('POST', '/logout'); } catch (_) {}
  clearSession();
  window.location.href = 'index.html';
}

// ── Media Viewer ───────────────────────────────────────────
const MEDIA_VIEWER_HTML = `
<div id="media-viewer" onclick="closeMediaViewer(event)">
  <div class="media-viewer-inner" id="media-viewer-inner">
    <button class="media-viewer-close" onclick="event.stopPropagation();closeMediaViewer(null)" title="Close (Esc)">&#x2715;</button>
    <div id="media-viewer-content"></div>
    <div class="media-viewer-label" id="media-viewer-label"></div>
  </div>
</div>`;

function openMediaViewer(url, type, label) {
  if (!document.getElementById('media-viewer')) {
    document.body.insertAdjacentHTML('beforeend', MEDIA_VIEWER_HTML);
  }
  const content = document.getElementById('media-viewer-content');
  const lbl     = document.getElementById('media-viewer-label');
  if (type === 'video') {
    content.innerHTML = `<video src="${escHtml(url)}" controls autoplay playsinline></video>`;
  } else {
    content.innerHTML = `<img src="${escHtml(url)}" alt="Media preview"/>`;
  }
  lbl.textContent = label || '';
  document.getElementById('media-viewer').classList.add('open');
  document.addEventListener('keydown', _mvKeyHandler);
}

function closeMediaViewer(e) {
  if (e && e.target && e.target.id !== 'media-viewer') return;
  const mv = document.getElementById('media-viewer');
  if (!mv) return;
  mv.classList.remove('open');
  const vid = mv.querySelector('video');
  if (vid) { vid.pause(); vid.src = ''; }
  document.removeEventListener('keydown', _mvKeyHandler);
}

function _mvKeyHandler(e) {
  if (e.key === 'Escape') {
    const mv = document.getElementById('media-viewer');
    if (mv) { mv.classList.remove('open'); const v = mv.querySelector('video'); if(v){v.pause();v.src='';} }
    document.removeEventListener('keydown', _mvKeyHandler);
  }
}

// ── Helpers ────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatNumber(n) {
  if (n === undefined || n === null) return '0';
  return Number(n).toLocaleString();
}

function avatarHtml(picture, name, size = 34) {
  const initial = (name || '?').charAt(0).toUpperCase();
  if (picture) {
    return `<div class="user-cell-av" style="width:${size}px;height:${size}px">
      <img src="${escHtml(picture)}" alt="${escHtml(initial)}"
           onerror="this.parentElement.innerHTML='${initial}'"/>
    </div>`;
  }
  const colors = ['#6c63ff','#ff5f7a','#22d48f','#f5a623','#38bdf8','#e040fb'];
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = (name||'').charCodeAt(i) + ((h<<5)-h);
  const bg = colors[Math.abs(h) % colors.length];
  return `<div class="user-cell-av" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.floor(size*0.38)}px">${initial}</div>`;
}

// ── Pagination renderer ────────────────────────────────────
function renderPagination(containerId, current, total, perPage, onPageChange) {
  const totalPages = Math.ceil(total / perPage);
  const el = document.getElementById(containerId);
  if (!el) return;

  const from = total === 0 ? 0 : (current - 1) * perPage + 1;
  const to   = Math.min(current * perPage, total);

  el.innerHTML = `
    <span>Showing ${from}–${to} of ${formatNumber(total)}</span>
    <div class="pagination-btns">
      <button class="page-btn" onclick="(${onPageChange})(${current - 1})"
        ${current <= 1 ? 'disabled' : ''}>‹</button>
      ${Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => Math.abs(p - current) <= 2)
        .map(p => `<button class="page-btn ${p === current ? 'active' : ''}"
          onclick="(${onPageChange})(${p})">${p}</button>`).join('')}
      <button class="page-btn" onclick="(${onPageChange})(${current + 1})"
        ${current >= totalPages ? 'disabled' : ''}>›</button>
    </div>`;
}

// ── Confirm modal HTML (injected once per page) ────────────
const CONFIRM_MODAL_HTML = `
<div class="modal-backdrop" id="confirm-modal">
  <div class="modal">
    <h2 class="modal-title-text">Confirm Action</h2>
    <p  class="modal-body-text">Are you sure?</p>
    <div class="modal-actions">
      <button class="btn-cancel"         onclick="_closeConfirm(false)">Cancel</button>
      <button class="btn-confirm-danger" onclick="_closeConfirm(true)">Delete</button>
    </div>
  </div>
</div>
<div id="toast"></div>`;

// ── Init — call once at the top of every protected page ───
function initAdminPage(activePage) {
  // 1. Guard — redirect to login if no valid session
  if (!requireAdminAuth()) return;

  // 2. Inject modal + toast into DOM
  document.body.insertAdjacentHTML('beforeend', CONFIRM_MODAL_HTML);

  // 3. Set active nav link
  setActiveNav(activePage);

  // 4. Fill admin name/avatar from localStorage (no API call needed)
  populateAdminInfo();

  // 5. Mobile menu
  initMobileMenu();

  // 6. Escape key closes confirm modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeConfirm(false);
  });
}