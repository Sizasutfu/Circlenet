/*  API  */
async function api(method, path, body = null, signal = undefined) {
  const opts = { method, headers: {} };
  // Send X-User-Id for all existing backend routes that still rely on it
  if (currentUser) opts.headers["X-User-Id"] = currentUser.id;
  // Also send JWT Bearer token for routes that have been upgraded to use it
  const token = localStorage.getItem("circle_token");
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body instanceof FormData) {
    // Let the browser set Content-Type with the correct multipart boundary
    opts.body = body;
  } else if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (signal) opts.signal = signal;
  const res = await fetch(API + path, opts);
  let data;
  try {
    data = await res.json();
  } catch (_) {
    data = {};
  }
  if (res.status === 401) {
    // Token expired or invalid — clear session and redirect to login
    localStorage.removeItem("circle_token");
    localStorage.removeItem("circle_user");
    PostCache.clear();
    Feed.reset();
    // Redirect without calling logout() to avoid re-entering api()
    setTimeout(() => goTo("login"), 0);
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) { const err = new Error(data.message || "Something went wrong."); if (data.unverified) err.unverified = true; throw err; }
  return data;
}

/*  THEME */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("circle_theme", theme);
  const isLight = theme === "light";
  const cb = document.getElementById("theme-toggle");
  if (cb) cb.checked = isLight;
  const icon = document.getElementById("theme-icon-top");
  if (icon)
    icon.innerHTML = isLight
      ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}
function toggleTheme() {
  applyTheme(
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark",
  );
}

/*NAV */
// Internal flag — prevents popstate handler from pushing duplicate entries
let _historyNavigating = false;

// Views that should never create a history entry (auth guards / redirects)
const _noHistoryViews = new Set(["login", "register", "reset", "new-password"]);

// ── Navigation stack for back button ────────────────────────────
// Tracks the sequence of views visited so goBack() can return to the previous one.
// Feed is the root — back from any view goes at least to feed.
const _navStack = ["feed"];

function goBack() {
  // Pop current view, then navigate to the one before it
  if (_navStack.length > 1) {
    _navStack.pop(); // remove current
    const prev = _navStack[_navStack.length - 1];
    // Navigate without pushing to the stack again
    _historyNavigating = true;
    goTo(prev);
    _historyNavigating = false;
  } else {
    // Already at root — just go to feed
    _historyNavigating = true;
    goTo("feed");
    _historyNavigating = false;
  }
}

function _updateBackButtons(view) {
  // Show back button on every view except feed (the root)
  const showBack = view !== "feed" && !_noHistoryViews.has(view);
  document.querySelectorAll(".back-btn").forEach((btn) => {
    btn.style.display = showBack ? "" : "none";
  });
}

// ═══════════════════════════════════════════════════════════
//  CIRCLE ROUTER  — advanced client-side routing engine
// ═══════════════════════════════════════════════════════════

// ── Route table ──────────────────────────────────────────────
// Each entry: { path, view, params?, meta? }
//   path    — express-style pattern  (segments starting with : are params)
//   view    — the view id used by goTo / view-<id> elements
//   auth    — true = redirect to /login if not logged in
//   noAuth  — true = redirect to /  if already logged in
//   title   — static title string OR function(params, query) → string
const _routes = [
  { path: "/", view: "feed", title: "Circle" },
  { path: "/explore", view: "explore", title: "Explore · Circle" },
  {
    path: "/search",
    view: "search",
    title: (_, q) => (q.q ? `"${q.q}" · Search · Circle` : "Search · Circle"),
  },
  {
    path: "/notifications",
    view: "notifications",
    title: "Notifications · Circle",
    auth: true,
  },
  {
    path: "/messages",
    view: "messages",
    title: "Messages · Circle",
    auth: true,
  },
  {
    path: "/settings",
    view: "settings",
    title: "Settings · Circle",
    auth: true,
  },
  { path: "/groups", view: "groups", title: "Groups · Circle" },
  { path: "/groups/:groupId", view: "group-detail", title: "Group · Circle" },
  { path: "/profile", view: "profile", title: "Profile · Circle", auth: true },
  {
    path: "/profile/:userId",
    view: "profile",
    title: "Profile · Circle",
    auth: true,
  },
  { path: "/post/:postId", view: "post-detail", title: "Post · Circle" },
  { path: "/login", view: "login", title: "Log in · Circle", noAuth: true },
  {
    path: "/register",
    view: "register",
    title: "Sign up · Circle",
    noAuth: true,
  },
];

// ── Route matching ───────────────────────────────────────────
function _matchRoute(pathname) {
  const clean = pathname.replace(/\/$/, "") || "/";
  for (const route of _routes) {
    const keys = [];
    const pattern = route.path.replace(/:([^/]+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    });
    const rx = new RegExp(`^${pattern}$`);
    const m = clean.match(rx);
    if (m) {
      const params = {};
      keys.forEach((k, i) => {
        params[k] = isNaN(m[i + 1]) ? m[i + 1] : parseInt(m[i + 1], 10);
      });
      return { route, params };
    }
  }
  return null;
}

// ── URL builder ──────────────────────────────────────────────
function _viewToPath(view, opts = {}) {
  // Build the canonical URL for a given view + options
  if (view === "feed") return "/";
  if (view === "profile")
    return opts.userId ? `/profile/${opts.userId}` : "/profile";
  if (view === "post-detail")
    return opts.postId ? `/post/${opts.postId}` : "/post";
  if (view === "group-detail")
    return opts.groupId ? `/groups/${opts.groupId}` : "/groups";
  if (view === "search" && opts.q)
    return `/search?q=${encodeURIComponent(opts.q)}&type=${opts.type || "posts"}`;
  return `/${view}`;
}

// ── Parse pathname → router state ───────────────────────────
function _pathToState(pathname, search = "") {
  const matched = _matchRoute(pathname);
  if (!matched) return { view: "feed", _notFound: true };
  const query = Object.fromEntries(new URLSearchParams(search));
  return { view: matched.route.view, ...matched.params, ...query };
}

// ── Page title + og:url updater ──────────────────────────────
function _updateMeta(route, params = {}, query = {}) {
  let title =
    typeof route.title === "function"
      ? route.title(params, query)
      : route.title || "Circle";
  document.title = title;
  // og:url — always reflects the canonical URL
  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement("meta");
    ogUrl.setAttribute("property", "og:url");
    document.head.appendChild(ogUrl);
  }
  ogUrl.setAttribute("content", window.location.href);
  // og:title
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", title);
}

// Update title dynamically after async data loads (e.g. once profile name is known)
function _setPageTitle(title) {
  document.title = title + " · Circle";
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", document.title);
}

// ── Route guard middleware ───────────────────────────────────
// Returns { allow: true } or { allow: false, redirect: '/path' }
function _runGuards(route) {
  if (route.auth && !currentUser) return { allow: false, redirect: "/login" };
  if (route.noAuth && currentUser) return { allow: false, redirect: "/" };
  return { allow: true };
}

// ── 404 / not-found handler ──────────────────────────────────
function _show404() {
  // Inject a 404 view if it doesn't already exist
  let el = document.getElementById("view-404");
  if (!el) {
    el = document.createElement("div");
    el.id = "view-404";
    el.className = "view";
    el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;text-align:center;padding:32px">
              <div style="font-size:72px;line-height:1">🔍</div>
              <div style="font-family:var(--font-head);font-size:28px;font-weight:800;color:var(--txt)">Page not found</div>
              <div style="color:var(--txt2);font-size:15px;max-width:320px">The link you followed may be broken, or this page may have been removed.</div>
              <button onclick="goTo('feed')" style="margin-top:8px;padding:10px 24px;background:var(--accent);color:#fff;border-radius:var(--radius-sm);font-size:14px;font-weight:600;border:none;cursor:pointer">Go home</button>
            </div>`;
    document.querySelector(".content")?.appendChild(el);
  }
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  el.classList.add("active");
  document.title = "Not Found · Circle";
  history.replaceState({ view: "404" }, "", window.location.pathname);
}

// ── View transition animation ────────────────────────────────
// Inject transition CSS once, then apply on every navigation
(function _injectTransitionCSS() {
  if (document.getElementById("_router-transitions")) return;
  const s = document.createElement("style");
  s.id = "_router-transitions";
  s.textContent = `
          .view { opacity: 1; transform: translateY(0); transition: opacity 0.18s ease, transform 0.18s ease; }
          .view.view-entering { opacity: 0; transform: translateY(8px); }
          .view.view-entered  { opacity: 1; transform: translateY(0); }
        `;
  document.head.appendChild(s);
})();

function _animateViewIn(viewEl) {
  if (!viewEl) return;
  viewEl.classList.add("view-entering");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      viewEl.classList.remove("view-entering");
      viewEl.classList.add("view-entered");
      setTimeout(() => viewEl.classList.remove("view-entered"), 220);
    });
  });
}

// ── Copy-link utility ────────────────────────────────────────
function copyCurrentLink() {
  const url = window.location.href;
  navigator.clipboard
    ?.writeText(url)
    .then(() => showToast("Link copied!"))
    .catch(() => {
      // Fallback for older browsers / HTTP contexts
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("Link copied!");
      } catch (_) {
        showToast(url);
      }
      document.body.removeChild(ta);
    });
}
window.copyCurrentLink = copyCurrentLink;

// ── Share a specific post ─────────────────────────────────────
function sharePostLink(postId) {
  const url = `${location.origin}/post/${postId}`;
  if (navigator.share) {
    navigator.share({ url, title: "Check out this post on Circle" }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url)
      .then(() => showToast("Link copied!"))
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); showToast("Link copied!"); }
        catch (_) { showToast(url); }
        document.body.removeChild(ta);
      });
  }
}
window.sharePostLink = sharePostLink;

// ── Share-link button injector ───────────────────────────────
// Adds a copy-link button to post-detail and profile headers if not already there
function _ensureCopyLinkBtn(containerId, label = "Copy link") {
  const container = document.getElementById(containerId);
  if (!container || container.querySelector(".copy-link-btn")) return;
  const btn = document.createElement("button");
  btn.className = "copy-link-btn";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;
  btn.style.cssText =
    "display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:500;color:var(--txt2);background:var(--card);border:1px solid var(--border);cursor:pointer;transition:all 0.15s";
  btn.onmouseenter = () => {
    btn.style.color = "var(--accent)";
    btn.style.borderColor = "var(--accent)";
  };
  btn.onmouseleave = () => {
    btn.style.color = "var(--txt2)";
    btn.style.borderColor = "var(--border)";
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    copyCurrentLink();
  };
  container.appendChild(btn);
}
window._ensureCopyLinkBtn = _ensureCopyLinkBtn;

window.goTo = function goTo(view, _opts = {}) {
  // ── Route guard ──────────────────────────────────────────
  const matched = _routes.find((r) => r.view === view);
  if (matched) {
    const guard = _runGuards(matched);
    if (!guard.allow) {
      // Redirect — store the intended destination so login can return here
      if (matched.auth)
        sessionStorage.setItem(
          "_redirectAfterLogin",
          window.location.pathname + window.location.search,
        );
      history.replaceState(
        { view: matched.noAuth ? "feed" : "login" },
        "",
        guard.redirect,
      );
      view = guard.redirect === "/" ? "feed" : "login";
      _opts = {};
    }
  }

  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  const viewEl = document.getElementById("view-" + view);
  if (!viewEl) {
    _show404();
    return;
  }
  viewEl.classList.add("active");
  _animateViewIn(viewEl);

  // Widen content only on feed (for aside panel)
  const contentEl = document.querySelector(".content");
  if (contentEl) contentEl.classList.toggle("feed-active", view === "feed");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const sn = document.getElementById("snav-" + view);
  if (sn) sn.classList.add("active");
  document
    .querySelectorAll(".mnav-item")
    .forEach((n) => n.classList.remove("active"));
  const mn = document.getElementById("mnav-" + view);
  if (mn) mn.classList.add("active");

  // Topbar: only visible on feed, always reset hidden state on tab switch
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    topbar.classList.remove("topbar-hidden");
    topbar.style.display = view === "feed" ? "" : "none";
  }

  // Mobile nav: hidden on post-detail and compose (they have their own bottom bars)
  const mobileNav = document.querySelector(".mobile-nav");
  const fabBtn = document.getElementById("fab-create-btn");
  const noNav = view === "post-detail" || view === "compose";
  if (mobileNav) {
    mobileNav.style.display = noNav ? "none" : "";
    mobileNav.classList.remove("nav-hidden");
  }
  if (fabBtn) fabBtn.classList.toggle("fab-hidden", noNav);

  // Save scroll position when navigating AWAY from feed
  const _leavingView = document.querySelector(".view.active");
  const _leavingName = _leavingView
    ? _leavingView.id.replace("view-", "")
    : null;
  if (_leavingName === "feed") {
    _feedScrollY = window.scrollY;
    Feed.saveScroll();
  }

  if (_leavingName === "messages") {
    DM.stopHeartbeat(); // stop presence heartbeat when leaving DM view
  }
  if (view === "messages") {
    if (!currentUser) {
      goTo("login");
      return;
    }
    DM.init(); // reload inbox from backend
    DM.clearDMBadge(); // clear notification badge on open
    DM.startHeartbeat(); // mark user as online as soon as they open Messages
  }
  if (view === "feed") resumeFeed();
  if (view !== "feed") _stopLivePolling();
  if (view === "profile") renderProfile();
  if (view === "feed" && currentUser && !_suggestionsLoaded) loadSuggestions();
  if (view === "feed" && currentUser && !_newMembersLoaded) loadNewMembers();
  if (view === "feed") loadTrending();
  if (view === "feed" && !currentUser) {
    const sw = document.getElementById("suggestions-widget");
    if (sw) sw.style.display = "none";
    // Show feed tabs for guests too (Following tab will redirect to login)
    const ft = document.getElementById("feed-tabs");
    if (ft) ft.style.display = "flex";
    // Hide the Following tab label hint for guests
    const ftFollowing = document.getElementById("ftab-following");
    if (ftFollowing) ftFollowing.style.opacity = "0.5";
  }
  if (view === "settings") populateSettings();
  if (view === "explore") loadExplore();
  if (view === "groups") loadGroups();
  if (view === "articles") { window.location.href = "https://www.circlenet.social/articles"; return; }
  if (view === "group-detail") {
    /* data already loaded by openGroup() */
  }
  if (view === "search") {
    searchTab = "posts";
    document.getElementById("search-input").value = "";
    renderSearchHint();
    var stSection = document.getElementById("search-trending-section");
    if (stSection) stSection.style.display = "block";
    loadTrending();
  }
  // Don't reset scroll when going to feed — resumeFeed handles position restore
  if (view !== "feed") window.scrollTo(0, 0);

  // ── Navigation stack: push current view (unless we're going back) ──
  if (!_historyNavigating) {
    // Avoid consecutive duplicates (e.g. clicking same tab twice)
    if (_navStack[_navStack.length - 1] !== view) {
      // Cap stack at 20 entries to avoid unbounded growth
      if (_navStack.length >= 20) _navStack.shift();
      _navStack.push(view);
    }
  }

  // Show/hide back buttons based on whether there's somewhere to go back to
  _updateBackButtons(view);

  // ── History API: push a state so Android back stays in-app ───
  if (!_historyNavigating && !_noHistoryViews.has(view)) {
    const state = { view, ..._opts };
    const url = _viewToPath(view, _opts);
    history.pushState(state, "", url);
  }

  // ── Update page title + og meta ──────────────────────────
  if (matched) {
    const query = Object.fromEntries(
      new URLSearchParams(window.location.search),
    );
    _updateMeta(matched, _opts, query);
  }

  // ── Inject copy-link button on shareable views ───────────
  if (view === "post-detail") {
    requestAnimationFrame(() => _ensureCopyLinkBtn("post-detail-actions-row"));
  }
  if (view === "profile") {
    requestAnimationFrame(() => _ensureCopyLinkBtn("profile-actions-row"));
  }
  if (view === "group-detail") {
    requestAnimationFrame(() =>
      _ensureCopyLinkBtn("group-detail-header-actions"),
    );
  }
};

/*AUTH  */
// Stores the newly registered user data while waiting for email verification
let _pendingVerifyUser = null;
let _pendingVerifyEmail = null;

async function registerUser() {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const dialCode = document.getElementById("reg-dial-code").value;
  const phoneRaw = document.getElementById("reg-phone").value.trim();
  const phone = phoneRaw ? dialCode + phoneRaw.replace(/\D/g, "") : undefined;
  const el = document.getElementById("register-alert");
  el.className = "alert";
  const confirmPassword = document.getElementById(
    "reg-confirm-password",
  )?.value;
  if (!name || !email || !password)
    return showAlert(el, "All fields are required.", "error");
  if (name.trim().length < 2)
    return showAlert(el, "Name must be at least 2 characters.", "error");
  const _emailInput = document.getElementById("reg-email");
  if (!_emailInput.checkValidity())
    return showAlert(el, "Please enter a valid email address.", "error");
  if (password.length < 6)
    return showAlert(el, "Password must be at least 6 characters.", "error");
  if (confirmPassword !== undefined && password !== confirmPassword)
    return showAlert(el, "Passwords do not match.", "error");
  const btn = document.getElementById("reg-email-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  }
  try {
    const res = await api("POST", "/api/users/register", {
      name,
      email,
      password,
      phone: phone || undefined,
    });
    // Account created — now send a verification email and show the OTP step
    _pendingVerifyUser = res.data;
    // Ask the backend to send a verification code to the email
    try {
      await api("POST", "/api/users/email/send-verification", { email });
    } catch (_) {
      // Non-fatal: backend might send automatically on register
    }
    // Show the verify step
    document.getElementById("reg-email-step1").classList.remove("active");
    document.getElementById("reg-email-step2").classList.add("active");
    document.getElementById("reg-email-display").textContent = email;
    _clearOtpDigits("email-verify");
    el.className = "alert";
    _startEmailVerifyTimer();
    setTimeout(() => {
      const firstDigit = document.querySelector("#email-verify-otp-group .otp-digit");
      if (firstDigit) firstDigit.focus();
    }, 120);
  } catch (e) {
    showAlert(el, e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  }
}

/* ── EMAIL VERIFICATION ─────────────────────────────────────── */
let _emailVerifyTimerInterval = null;

function _startEmailVerifyTimer() {
  if (_emailVerifyTimerInterval) clearTimeout(_emailVerifyTimerInterval);
  let secs = 60;
  const timerEl = document.getElementById("email-verify-otp-timer");
  const resendBtn = document.getElementById("email-verify-resend-btn");
  if (resendBtn) resendBtn.disabled = true;
  const tick = () => {
    if (timerEl) timerEl.textContent = `(${secs}s)`;
    if (secs <= 0) {
      if (_emailVerifyTimerInterval) clearTimeout(_emailVerifyTimerInterval);
      _emailVerifyTimerInterval = null;
      if (resendBtn) resendBtn.disabled = false;
      if (timerEl) timerEl.textContent = "";
      return;
    }
    secs--;
    _emailVerifyTimerInterval = setTimeout(tick, 1000);
  };
  tick();
}

async function emailVerifyOtp() {
  const code = _getOtpValue("email-verify");
  const el = document.getElementById("register-alert");
  el.className = "alert";
  if (code.length < 6) return showAlert(el, "Enter the full 6-digit code.", "error");
  const email = document.getElementById("reg-email-display").textContent || _pendingVerifyEmail;
  const btn = document.getElementById("email-verify-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  try {
    await api("POST", "/api/users/email/verify", { email, code });
    if (_pendingVerifyUser) {
      // Coming from registration — user data already in memory
      setCurrentUser(_pendingVerifyUser);
      _pendingVerifyUser = null;
      showAlert(el, "Email verified! Welcome to Circle 🎉", "success");
      setTimeout(() => goTo("feed"), 900);
    } else if (_pendingVerifyEmail) {
      // Coming from login — redirect back to login
      _pendingVerifyEmail = null;
      showAlert(el, "Email verified! Please log in to continue.", "success");
      setTimeout(() => goTo("login"), 1200);
    } else {
      showAlert(el, "Email verified! Welcome to Circle 🎉", "success");
      setTimeout(() => goTo("feed"), 900);
    }
  } catch (e) {
    showAlert(el, e.message || "Invalid code. Please try again.", "error");
    _shakeOtpGroup("email-verify");
    if (btn) { btn.disabled = false; btn.textContent = "Verify Email"; }
  }
}

async function emailResendCode() {
  const email = document.getElementById("reg-email-display").textContent || _pendingVerifyEmail;
  const el = document.getElementById("register-alert");
  el.className = "alert";
  try {
    await api("POST", "/api/users/email/send-verification", { email });
    showAlert(el, "New code sent! Check your inbox.", "success");
    _clearOtpDigits("email-verify");
    _startEmailVerifyTimer();
    setTimeout(() => {
      const firstDigit = document.querySelector("#email-verify-otp-group .otp-digit");
      if (firstDigit) firstDigit.focus();
    }, 120);
  } catch (e) {
    showAlert(el, e.message || "Could not resend. Try again shortly.", "error");
  }
}

function emailVerifyBack() {
  _pendingVerifyUser = null;
  document.getElementById("reg-email-step2").classList.remove("active");
  document.getElementById("reg-email-step1").classList.add("active");
  const btn = document.getElementById("reg-email-submit-btn");
  if (btn) { btn.disabled = false; btn.textContent = "Create Account"; }
  document.getElementById("register-alert").className = "alert";
  if (_emailVerifyTimerInterval) {
    clearTimeout(_emailVerifyTimerInterval);
    _emailVerifyTimerInterval = null;
  }
}

async function loginUser() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const el = document.getElementById("login-alert");
  el.className = "alert";
  if (!email || !password)
    return showAlert(el, "Email and password are required.", "error");
  const btn = document.querySelector("#view-login .btn-primary");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  }
  try {
    const res = await api("POST", "/api/users/login", { email, password });
    // Store the JWT for authenticated requests
    if (res.token) localStorage.setItem("circle_token", res.token);
    setCurrentUser(res.data);
    showToast("Welcome back, " + (res.data?.name ?? "there").split(" ")[0] + "! 👋");
    const _postLoginRedir = sessionStorage.getItem("_redirectAfterLogin");
    if (_postLoginRedir && _postLoginRedir.startsWith("/articles")) {
      sessionStorage.removeItem("_redirectAfterLogin");
      setTimeout(() => { location.href = "https://www.circlenet.social/articles"; }, 400);
    } else {
      setTimeout(() => goTo("feed"), 400);
    }
  } catch (e) {
    // Unverified account — send them to the OTP screen
    if (e.unverified) {
      _pendingVerifyEmail = email;
      try {
        await api("POST", "/api/users/email/send-verification", { email });
      } catch (sendErr) {
        showAlert(el, "Could not send verification code. Try again.", "error");
        if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
        return;
      }
      goTo("register");
      document.getElementById("reg-email-display").textContent = email;
      document.getElementById("reg-email-step1").classList.remove("active");
      document.getElementById("reg-email-step2").classList.add("active");
      _clearOtpDigits("email-verify");
      _startEmailVerifyTimer();
      setTimeout(() => {
        const firstDigit = document.querySelector("#email-verify-otp-group .otp-digit");
        if (firstDigit) firstDigit.focus();
      }, 120);
      return;
    }
    showAlert(el, e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  }
}


/* ── PHONE / OTP AUTH ─────────────────────────────────────────── */
let _otpTimerInterval = null;

function switchLoginMethod(method) {
  const isPhone = method === "phone";
  document
    .getElementById("login-tab-email")
    .classList.toggle("active", !isPhone);
  document
    .getElementById("login-tab-phone")
    .classList.toggle("active", isPhone);
  document.getElementById("login-email-method").style.display = isPhone
    ? "none"
    : "block";
  document.getElementById("login-phone-method").style.display = isPhone
    ? "block"
    : "none";
  document.getElementById("login-alert").className = "alert";
  if (isPhone) {
    // Reset to step 1
    phoneLoginBack();
    setTimeout(() => document.getElementById("login-phone-number").focus(), 80);
  }
}

function phoneLoginBack() {
  document.getElementById("login-phone-step1").classList.add("active");
  document.getElementById("login-phone-step2").classList.remove("active");
  _clearOtpTimer();
  _clearOtpDigits("login");
}

async function phoneLoginSendOtp(isResend = false) {
  const dialCode = document.getElementById("login-dial-code").value;
  const raw = document.getElementById("login-phone-number").value.trim();
  const el = document.getElementById("login-alert");
  el.className = "alert";

  if (!raw) return showAlert(el, "Please enter your phone number.", "error");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5)
    return showAlert(el, "Please enter a valid phone number.", "error");

  const phone = dialCode + digits;
  const btn = document.getElementById("login-send-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending…";
  }

  try {
    await api("POST", "/api/auth/phone/send-otp", { phone });
    document.getElementById("login-otp-phone-display").textContent =
      dialCode + " " + raw;
    document.getElementById("login-phone-step1").classList.remove("active");
    document.getElementById("login-phone-step2").classList.add("active");
    _clearOtpDigits("login");
    setTimeout(
      () => document.querySelector("#login-otp-group .otp-digit").focus(),
      80,
    );
    _startOtpTimer("login");
    if (isResend) showToast("New code sent! 📱");
  } catch (e) {
    showAlert(
      el,
      e.message || "Failed to send code. Please try again.",
      "error",
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Send Code";
    }
  }
}

async function phoneLoginVerifyOtp() {
  const dialCode = document.getElementById("login-dial-code").value;
  const raw = document
    .getElementById("login-phone-number")
    .value.trim()
    .replace(/\D/g, "");
  const phone = dialCode + raw;
  const code = _getOtpValue("login");
  const el = document.getElementById("login-alert");
  el.className = "alert";

  if (code.length < 6)
    return showAlert(el, "Please enter the full 6-digit code.", "error");

  const btn = document.getElementById("login-verify-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Verifying…";
  }

  try {
    const res = await api("POST", "/api/auth/phone/verify-otp", {
      phone,
      code,
    });
    _clearOtpTimer();
    setCurrentUser(res.data);
    showToast(
      "Welcome back, " + (res.data?.name ?? "there").split(" ")[0] + "! 👋",
    );
    setTimeout(() => goTo("feed"), 400);
  } catch (e) {
    showAlert(el, e.message || "Invalid code. Please try again.", "error");
    _shakeOtpGroup("login");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify & Sign In";
    }
  }
}

// ── Phone Registration ─────────────────────────────────────────

function switchRegisterMethod(method) {
  const isPhone = method === "phone";
  document.getElementById("reg-tab-email").classList.toggle("active", !isPhone);
  document.getElementById("reg-tab-phone").classList.toggle("active", isPhone);
  document.getElementById("reg-email-method").style.display = isPhone
    ? "none"
    : "block";
  document.getElementById("reg-phone-method").style.display = isPhone
    ? "block"
    : "none";
  document.getElementById("register-alert").className = "alert";
  if (isPhone) {
    phoneRegisterBack();
    // Seed dial code dropdown if not yet populated
    const dial = document.getElementById("reg-phone-dial-code");
    if (dial && !dial.options.length) {
      const src = document.getElementById("reg-dial-code");
      if (src) dial.innerHTML = src.innerHTML;
    }
    setTimeout(() => document.getElementById("reg-phone-name").focus(), 80);
  }
}

function phoneRegisterBack() {
  document.getElementById("reg-phone-step1").classList.add("active");
  document.getElementById("reg-phone-step2").classList.remove("active");
  _clearOtpTimer();
  _clearOtpDigits("reg");
}

async function phoneRegisterSendOtp(isResend = false) {
  const name = document.getElementById("reg-phone-name").value.trim();
  const dialCode = document.getElementById("reg-phone-dial-code").value;
  const raw = document.getElementById("reg-phone-number").value.trim();
  const el = document.getElementById("register-alert");
  el.className = "alert";

  if (!name) return showAlert(el, "Please enter your name.", "error");
  if (name.length < 2)
    return showAlert(el, "Name must be at least 2 characters.", "error");
  if (!raw) return showAlert(el, "Please enter your phone number.", "error");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5)
    return showAlert(el, "Please enter a valid phone number.", "error");

  const phone = dialCode + digits;
  const btn = document.getElementById("reg-send-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending…";
  }

  try {
    await api("POST", "/api/auth/phone/register/send-otp", { phone, name });
    document.getElementById("reg-otp-phone-display").textContent =
      dialCode + " " + raw;
    document.getElementById("reg-phone-step1").classList.remove("active");
    document.getElementById("reg-phone-step2").classList.add("active");
    _clearOtpDigits("reg");
    setTimeout(
      () => document.querySelector("#reg-otp-group .otp-digit").focus(),
      80,
    );
    _startOtpTimer("reg");
    if (isResend) showToast("New code sent! 📱");
  } catch (e) {
    showAlert(
      el,
      e.message || "Failed to send code. Please try again.",
      "error",
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Send Code";
    }
  }
}

async function phoneRegisterVerifyOtp() {
  const name = document.getElementById("reg-phone-name").value.trim();
  const dialCode = document.getElementById("reg-phone-dial-code").value;
  const raw = document
    .getElementById("reg-phone-number")
    .value.trim()
    .replace(/\D/g, "");
  const phone = dialCode + raw;
  const code = _getOtpValue("reg");
  const el = document.getElementById("register-alert");
  el.className = "alert";

  if (code.length < 6)
    return showAlert(el, "Please enter the full 6-digit code.", "error");

  const btn = document.getElementById("reg-verify-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating account…";
  }

  try {
    const res = await api("POST", "/api/auth/phone/register/verify-otp", {
      phone,
      code,
      name,
    });
    _clearOtpTimer();
    setCurrentUser(res.data);
    showToast(
      "Welcome to Circle, " +
        (res.data?.name ?? "friend").split(" ")[0] +
        "! 🎉",
    );
    setTimeout(() => goTo("feed"), 600);
  } catch (e) {
    showAlert(el, e.message || "Invalid code. Please try again.", "error");
    _shakeOtpGroup("reg");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify & Create Account";
    }
  }
}

// ── OTP input helpers ─────────────────────────────────────────
function _otpAutoSubmit(prefix) {
  if (prefix === "login") phoneLoginVerifyOtp();
  else if (prefix === "reg") phoneRegisterVerifyOtp();
  else if (prefix === "email-verify") emailVerifyOtp();
}

function otpInput(el, prefix) {
  el.value = el.value.replace(/\D/g, "").slice(-1);
  el.classList.toggle("filled", !!el.value);
  if (el.value) {
    const next = el.nextElementSibling;
    if (next && next.classList.contains("otp-digit")) next.focus();
    else _otpAutoSubmit(prefix); // all 6 filled
  }
}

function otpKeydown(e, el, prefix) {
  if (e.key === "Backspace" && !el.value) {
    const prev = el.previousElementSibling;
    if (prev && prev.classList.contains("otp-digit")) {
      prev.value = "";
      prev.classList.remove("filled");
      prev.focus();
    }
  }
  if (e.key === "ArrowLeft") {
    const prev = el.previousElementSibling;
    if (prev && prev.classList.contains("otp-digit")) prev.focus();
  }
  if (e.key === "ArrowRight") {
    const next = el.nextElementSibling;
    if (next && next.classList.contains("otp-digit")) next.focus();
  }
  if (e.key === "Enter") _otpAutoSubmit(prefix);
}

function otpPaste(e, prefix) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData)
    .getData("text")
    .replace(/\D/g, "")
    .slice(0, 6);
  const digits = document.querySelectorAll(`#${prefix}-otp-group .otp-digit`);
  text.split("").forEach((ch, i) => {
    if (digits[i]) {
      digits[i].value = ch;
      digits[i].classList.add("filled");
    }
  });
  const lastFilled = Math.min(text.length, 5);
  if (digits[lastFilled]) digits[lastFilled].focus();
  if (text.length === 6) setTimeout(() => _otpAutoSubmit(prefix), 120);
}

function _getOtpValue(prefix) {
  return [...document.querySelectorAll(`#${prefix}-otp-group .otp-digit`)]
    .map((d) => d.value)
    .join("");
}

function _clearOtpDigits(prefix) {
  document.querySelectorAll(`#${prefix}-otp-group .otp-digit`).forEach((d) => {
    d.value = "";
    d.classList.remove("filled");
  });
}

function _shakeOtpGroup(prefix) {
  const g = document.getElementById(`${prefix}-otp-group`);
  if (!g) return;
  g.style.animation = "none";
  g.offsetHeight; // reflow
  g.style.animation = "otpShake 0.4s ease";
  setTimeout(() => {
    g.style.animation = "";
    _clearOtpDigits(prefix);
    document.querySelector(`#${prefix}-otp-group .otp-digit`).focus();
  }, 420);
}

function _startOtpTimer(prefix) {
  _clearOtpTimer();
  let secs = 30;
  const timerEl = document.getElementById(`${prefix}-otp-timer`);
  const resendBtn = document.getElementById(`${prefix}-resend-btn`);
  if (resendBtn) resendBtn.disabled = true;
  const tick = () => {
    if (timerEl) timerEl.textContent = `(${secs}s)`;
    if (secs <= 0) {
      _clearOtpTimer();
      if (resendBtn) {
        resendBtn.disabled = false;
      }
      if (timerEl) timerEl.textContent = "";
      return;
    }
    secs--;
    _otpTimerInterval = setTimeout(tick, 1000);
  };
  tick();
}

function _clearOtpTimer() {
  if (_otpTimerInterval) {
    clearTimeout(_otpTimerInterval);
    _otpTimerInterval = null;
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("circle_user");
  localStorage.removeItem("circle_token");
  // ── Cache: clear all cached data on logout ──────────────────
  PostCache.clear();
  Feed.reset();     // wipes all feed state atomically
  _trendingLoaded = false;
  _trendingWords = [];
  _activeFilter = null;
  document.getElementById("trending-filter-bar").style.display = "none";
  document.getElementById("sidebar-user-area").style.display = "none";
  document.getElementById("login-nudge").style.display = "flex";
  document.getElementById("feed-tabs").style.display = "none";
  const hint = document.getElementById("feed-personalised-hint");
  if (hint) hint.style.display = "none";

  const ta = document.getElementById("topbar-avatar");
  if (ta) {
    ta.style.background = "var(--border2)";
    ta.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }
  stopNotifPolling();
  updateNotifBadge(0);
  E2E.clearCache();
  // Disconnect WebSocket on logout
  if (typeof CircleWS !== "undefined") CircleWS.disconnect();
  showToast("Logged out successfully.");
  goTo("feed");
}

function setCurrentUser(user) {
  _suggestionsLoaded = false;
  _feedSugDismissed = false;
  _feedSugUsers = [];
  _newMembersLoaded = false;
  _feedNewDismissed = !!localStorage.getItem("circle_new_dismissed");
  _feedNewIndex = 0;
  _newMembers = [];
  _trendingLoaded = false;
  _trendingWords = [];
  _activeFilter = null;
  if (
    user &&
    document.getElementById("view-feed").classList.contains("active")
  ) {
    setTimeout(loadSuggestions, 700);
  }
  currentUser = user;
  localStorage.setItem("circle_user", JSON.stringify(user));
  if (!user) return;
  if (user) Feed.loadFollowingSet();
  const initial = (user.name || "?").charAt(0).toUpperCase(),
    color = stringToColor(user.name || "");
  const pic = resolveMediaUrl(user.picture) || null;

  function applyAv(el) {
    if (!el) return;
    if (pic) {
      el.style.background = "transparent";
      el.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block" onerror="this.parentElement.innerHTML=defaultAvatar();this.parentElement.style.background='${color}'"/>`;
    } else {
      el.style.background = color;
      el.innerHTML = defaultAvatar();
    }
  }

  document.getElementById("sidebar-user-area").style.display = "block";
  const ca = document.getElementById("compose-av");
  applyAv(ca);
  const ta = document.getElementById("topbar-avatar");
  if (ta) {
    ta.style.display = "grid";
    if (pic) {
      ta.style.background = "transparent";
      ta.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML=defaultAvatar();this.parentElement.style.background='${color}'"/>`;
    } else {
      ta.style.background = color;
      ta.innerHTML = defaultAvatar();
    }
  }
  document.getElementById("login-nudge").style.display = "none";
  document.getElementById("feed-tabs").style.display = "flex";
  const hint = document.getElementById("feed-personalised-hint");
  if (hint) hint.style.display = "block";
  startNotifPolling();
  loadSuggestions();
  // Generate / load E2E key-pair and publish public key to server
  E2E.publishMyPublicKey().catch(() => {});
  // Connect WebSocket for real-time DMs and notifications
  if (typeof CircleWS !== "undefined") CircleWS.connect();
  // Reload live feed cards now that we're authenticated (issue #9)
  if (typeof Live !== "undefined") Live.loadActiveSessions();
}

async function sendResetEmail() {
  const email = document.getElementById("reset-email").value.trim();
  const el = document.getElementById("reset-alert");
  el.className = "alert";
  if (!email) return showAlert(el, "Please enter your email.", "error");
  try {
    await api("POST", "/api/users/reset-password", { email });
    showAlert(
      el,
      "If that email exists, a reset link has been sent.",
      "success",
    );
  } catch (e) {
    showAlert(el, e.message, "error");
  }
}

async function setNewPassword() {
  const pw = document.getElementById("newpw-password").value;
  const cfm = document.getElementById("newpw-confirm").value;
  const el = document.getElementById("newpw-alert");
  el.className = "alert";

  if (!pw || pw.length < 6)
    return showAlert(el, "Password must be at least 6 characters.", "error");
  if (pw !== cfm) return showAlert(el, "Passwords do not match.", "error");

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) return showAlert(el, "Invalid or expired reset link.", "error");

  try {
    await api("POST", "/api/users/reset-password/confirm", {
      token,
      password: pw,
    });
    showAlert(el, "Password updated! Redirecting to login…", "success");
    history.replaceState({}, "", window.location.pathname); // strip ?token from URL
    setTimeout(() => goTo("login"), 1400);
  } catch (e) {
    showAlert(el, e.message, "error");
  }
}

/* SETTINGS */
function populateSettings() {
  if (!currentUser) {
    goTo("login");
    return;
  }
  document.getElementById("settings-name").value = currentUser.name || "";
  document.getElementById("settings-username").value = currentUser.username || "";
  document.getElementById("settings-email").value = currentUser.email || "";
  document.getElementById("settings-bio").value = currentUser.bio || "";
  document.getElementById("settings-password").value = "";
  document.getElementById("settings-location").value =
    currentUser.location || "";
  document.getElementById("settings-school").value = currentUser.school || "";
  document.getElementById("settings-occupation").value =
    currentUser.occupation || "";
  document.getElementById("settings-website").value = currentUser.website || "";
  document.getElementById("settings-dob").value = currentUser.dateOfBirth
    ? currentUser.dateOfBirth.split("T")[0]
    : "";
  document.getElementById("settings-gender").value = currentUser.gender || "";

  // Phone — stored as "dialCode|digits", e.g. "+254|712345678"
  const phoneRaw = currentUser.phone || "";
  const phoneParts = phoneRaw.split("|");
  if (phoneParts.length === 2) {
    // Populate dial-code dropdown first if not yet seeded
    const settingsDial = document.getElementById("settings-dial-code");
    if (settingsDial && !settingsDial.options.length) {
      const src = document.getElementById("reg-dial-code");
      if (src) settingsDial.innerHTML = src.innerHTML;
    }
    if (settingsDial) {
      for (const o of settingsDial.options) {
        if (o.value === phoneParts[0]) {
          o.selected = true;
          break;
        }
      }
    }
    document.getElementById("settings-phone").value = phoneParts[1];
  } else {
    document.getElementById("settings-phone").value = phoneRaw;
  }

  const sav = document.getElementById("settings-av");
  if (sav) {
    const pic = resolveMediaUrl(currentUser.picture) || null,
      initial = (currentUser.name || "?").charAt(0).toUpperCase(),
      color = stringToColor(currentUser.name || "");
    if (pic) {
      sav.style.background = "transparent";
      sav.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block" onerror="this.parentElement.innerHTML=defaultAvatar();this.parentElement.style.background='${color}'"/>`;
    } else {
      sav.style.background = color;
      sav.innerHTML = defaultAvatar();
    }
  }
  const p = JSON.parse(localStorage.getItem("circle_notif_prefs") || "{}");
  [
    "likes",
    "comments",
    "reposts",
    "push",
    "new_post",
    "profile_pic",
    "mention",
    "milestone",
  ].forEach((k) => {
    const el = document.getElementById("notif-" + k);
    if (el && p[k] !== undefined) el.checked = p[k];
  });
  ["account", "activity"].forEach((k) => {
    const el = document.getElementById("priv-" + k);
    if (el && p[k] !== undefined) el.checked = p[k];
  });
}

async function saveProfile() {
  if (!currentUser) return;
  const name = document.getElementById("settings-name").value.trim();
  const email = document.getElementById("settings-email").value.trim();
  const bio = document.getElementById("settings-bio").value.trim();
  const password = document.getElementById("settings-password").value;
  const username = document.getElementById("settings-username").value.trim().toLowerCase();

  // Validate username if changed
  if (username && username !== (currentUser.username || "")) {
    if (!/^[a-z0-9_]{3,25}$/.test(username)) {
      showToast("Username must be 3–25 characters: letters, numbers, underscores only.");
      return;
    }
  }

  // Extra fields
  const dialCode = document.getElementById("settings-dial-code").value;
  const phoneRaw = document
    .getElementById("settings-phone")
    .value.trim()
    .replace(/\D/g, "");
  const phone = phoneRaw ? `${dialCode}|${phoneRaw}` : null;
  const location =
    document.getElementById("settings-location").value.trim() || null;
  const school =
    document.getElementById("settings-school").value.trim() || null;
  const occupation =
    document.getElementById("settings-occupation").value.trim() || null;
  const website =
    document.getElementById("settings-website").value.trim() || null;
  const dob = document.getElementById("settings-dob").value || null;
  const gender = document.getElementById("settings-gender").value || null;

  if (!name || !email) {
    showToast("Name and email are required.");
    return;
  }
  const prefs = {
    likes: document.getElementById("notif-likes").checked,
    comments: document.getElementById("notif-comments").checked,
    reposts: document.getElementById("notif-reposts").checked,
    push: document.getElementById("notif-push").checked,
    new_post: document.getElementById("notif-new_post").checked,
    profile_pic: document.getElementById("notif-profile_pic").checked,
    mention: document.getElementById("notif-mention").checked,
    milestone: document.getElementById("notif-milestone").checked,
    account: document.getElementById("priv-account").checked,
    activity: document.getElementById("priv-activity").checked,
  };
  localStorage.setItem("circle_notif_prefs", JSON.stringify(prefs));
  try {
    const res = await api("PUT", `/api/users/${currentUser.id}`, {
      name,
      email,
      bio: bio || undefined,
      password: password || undefined,
      phone: phone || undefined,
      location: location || undefined,
      school: school || undefined,
      occupation: occupation || undefined,
      website: website || undefined,
      dateOfBirth: dob || undefined,
      gender: gender || undefined,
    });
    const updatedUser = {
      ...res.data,
      username: username || res.data.username || currentUser.username || null,
      bio: bio || res.data.bio || "",
      picture: resolveMediaUrl(res.data.picture || currentUser.picture) || null,
      phone: phone ?? res.data.phone ?? currentUser.phone ?? null,
      location: location ?? res.data.location ?? currentUser.location ?? null,
      school: school ?? res.data.school ?? currentUser.school ?? null,
      occupation:
        occupation ?? res.data.occupation ?? currentUser.occupation ?? null,
      website: website ?? res.data.website ?? currentUser.website ?? null,
      dateOfBirth:
        dob ?? res.data.dateOfBirth ?? currentUser.dateOfBirth ?? null,
      gender: gender ?? res.data.gender ?? currentUser.gender ?? null,
    };
    localStorage.setItem("circle_user", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);

    // Save username separately if it changed
    if (username && username !== (currentUser.username || "")) {
      try {
        await api("PUT", `/api/users/${currentUser.id}/username`, { username });
      } catch (e) {
        showToast("Profile saved but username error: " + e.message);
        return;
      }
    }

    showToast("Profile updated! ✅");
    // Post a profile_update activity to the feed
    try {
      await api("POST", "/api/posts", {
        type: "profile_update",
        text: bio || "",
      });
      PostCache.invalidateFeed("global");
      PostCache.invalidateFeed("following");
    } catch (_) {}
    setTimeout(() => goTo("profile"), 600);
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

/* FEED TABS */
/* FEED TABS */
// switchFeedTab — thin wrapper; all logic lives in Feed.switchTab().
function switchFeedTab(tab) {
  Feed.switchTab(tab);
}

/* POSTS */

/**
 * Called by goTo('feed') — restores the feed without wiping it.
 * If posts are already in memory, just re-render and do a silent
 * background refresh. Only falls through to a full loadPosts()
 * when the feed is genuinely empty (first load / after logout).
 */
/* POSTS */

// resumeFeed — called by goTo('feed').
// Restores the feed without wiping it if posts are already loaded.
function resumeFeed() {
  Feed.resume();
}

// loadPosts — full reload from scratch.
function loadPosts() {
  Feed.load();
}

// fetchMorePosts — called by legacy scroll/sentinel code.
function fetchMorePosts(isFirstPage = false) {
  if (isFirstPage) Feed.load();
  else Feed.fetchMore();
}

// updateScrollSentinel — delegates to Feed.
function updateScrollSentinel() {
  Feed.updateSentinel();
}

// _backgroundRefreshFeed — no-op: Feed handles this internally.
function _backgroundRefreshFeed() {}

// _stopLivePolling — delegates to Feed.
function _stopLivePolling() {
  Feed.stopLivePolling();
}

async function createPost() {
  if (!currentUser) {
    showToast("Please log in first.");
    return;
  }
  const text = document.getElementById("post-text").value.trim();
  if (!text && !pendingImageDataUrl && !pendingVideoDataUrl) {
    showToast("Write something or add a photo/video!");
    return;
  }
  const btn = document.getElementById("post-submit-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    const fd = new FormData();
    fd.append("text", text);
    if (pendingImageDataUrl instanceof File)
      fd.append("image", pendingImageDataUrl);
    if (pendingVideoDataUrl instanceof File) {
      fd.append("video", pendingVideoDataUrl);
      fd.append("video_compressed", pendingVideoCompressed ? "1" : "0");
    }

    const res = await api("POST", "/api/posts", fd);
    const newPost = res.data;
    PostCache.putPost(newPost);
    PostCache.invalidateFeed(currentFeedTab);
    posts.unshift(newPost);
    document.getElementById("post-text").value = "";
    removeMedia();
    renderFeed();
    showToast("Posted! ✨");
    loadTrending(true);
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Post";
  }
}

/* ── Edit Post ────────────────────────────────────────────────── */
let _editingPostId = null;
const EDIT_MAX_CHARS = 500;

function openEditPostModal(postId) {
  const post = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  if (!post) {
    showToast("Post not found.");
    return;
  }
  _editingPostId = postId;
  const ta = document.getElementById("edit-post-textarea");
  const counter = document.getElementById("edit-post-char-count");
  ta.value = post.text || "";
  if (counter) counter.textContent = `${ta.value.length} / ${EDIT_MAX_CHARS}`;
  document.getElementById("edit-post-modal").classList.add("open");
  setTimeout(() => {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, 120);
}

function closeEditPostModal(e) {
  if (e && e.target !== document.getElementById("edit-post-modal")) return;
  _closeEditModal();
}
function _closeEditModal() {
  document.getElementById("edit-post-modal").classList.remove("open");
  _editingPostId = null;
}

function onEditTextareaInput() {
  const ta = document.getElementById("edit-post-textarea");
  const counter = document.getElementById("edit-post-char-count");
  const len = ta.value.length;
  if (counter) {
    counter.textContent = `${len} / ${EDIT_MAX_CHARS}`;
    counter.style.color = len > EDIT_MAX_CHARS ? "var(--rose)" : "var(--txt3)";
  }
  const btn = document.getElementById("edit-post-submit-btn");
  if (btn) btn.disabled = len === 0 || len > EDIT_MAX_CHARS;
}

async function submitEditPost() {
  if (!_editingPostId || !currentUser) return;
  const ta = document.getElementById("edit-post-textarea");
  const newText = ta.value.trim();
  if (!newText) {
    showToast("Post cannot be empty.");
    return;
  }
  if (newText.length > EDIT_MAX_CHARS) {
    showToast(`Keep it under ${EDIT_MAX_CHARS} characters.`);
    return;
  }

  const btn = document.getElementById("edit-post-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving…";
  }

  try {
    await api("PUT", `/api/posts/${_editingPostId}`, { text: newText });

    // Update in-memory caches
    const inFeed = posts.find((p) => p.id === _editingPostId);
    if (inFeed) {
      inFeed.text = newText;
      inFeed.edited = true;
    }
    const cached = PostCache.getPost(_editingPostId);
    if (cached) {
      cached.text = newText;
      cached.edited = true;
      PostCache.putPost(cached);
    }

    PostCache.invalidateFeed("global");
    PostCache.invalidateFeed("following");

    _closeEditModal();
    showToast("Post updated ✓");

    // Refresh whichever view is active
    if (document.getElementById("view-feed").classList.contains("active"))
      renderFeed();
    if (document.getElementById("view-profile").classList.contains("active"))
      renderProfile();
    if (
      document.getElementById("view-post-detail").classList.contains("active")
    ) {
      const updated =
        posts.find((p) => p.id === _editingPostId) ||
        PostCache.getPost(_editingPostId);
      if (updated) renderPostDetail(updated);
    }
  } catch (e) {
    showToast("Could not save: " + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="14" height="14"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Save Changes`;
    }
  }
}

async function deletePost(postId) {
  if (!currentUser) return;
  try {
    await api("DELETE", `/api/posts/${postId}`);
    // ── Cache: remove from store and invalidate feeds ───────────
    PostCache.removePost(postId);
    PostCache.invalidateFeed("global");
    PostCache.invalidateFeed("following");
    posts = posts.filter((p) => p.id !== postId);
    renderFeed();
    if (document.getElementById("view-profile").classList.contains("active"))
      renderProfile();
    showToast("Post deleted.");
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

/*LIKES */
async function toggleLike(postId) {
  if (!currentUser) {
    showToast("Log in to like posts.");
    goTo("login");
    return;
  }
  // ── Optimistic update in cache and UI ───────────────────────
  // Check global feed array first, then PostCache (profile posts live there)
  let post = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  if (post) {
    if (!Array.isArray(post.likes)) post.likes = [];
    const i = post.likes.indexOf(currentUser.id);
    if (i === -1) post.likes.push(currentUser.id);
    else post.likes.splice(i, 1);
    PostCache.putPost(post);
    refreshLikeBtn(postId);
  }
  try {
    await api("POST", `/api/posts/${postId}/like`, {
      userId: currentUser.id,
    });
  } catch (e) {
    // Revert optimistic update on failure
    if (post) {
      if (!Array.isArray(post.likes)) post.likes = [];
      const i = post.likes.indexOf(currentUser.id);
      if (i === -1) post.likes.push(currentUser.id);
      else post.likes.splice(i, 1);
      PostCache.putPost(post);
      refreshLikeBtn(postId);
    }
    showToast("Error: " + e.message);
  }
}

function refreshLikeBtn(postId) {
  const post = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  if (!post) return;
  const liked =
    currentUser && post.likes && post.likes.includes(currentUser.id);
  const btnHtml = `<svg fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg><span>${(post.likes && post.likes.length) || ""}</span>`;
  // Update every rendered instance of this post (feed card + detail modal)
  document.querySelectorAll(`[data-post-id="${postId}"]`).forEach((card) => {
    const btn = card.querySelector(".like-btn");
    if (!btn) return;
    btn.className = "act-btn like-btn" + (liked ? " liked" : "");
    btn.innerHTML = btnHtml;
  });
}

/* COMMENTS  */
function toggleComments(postId) {
  document
    .querySelector(`[data-post-id="${postId}"] .comments-panel`)
    .classList.toggle("open");
}

async function addComment(postId, parentId = null) {
  if (!currentUser) {
    showToast("Log in to comment.");
    goTo("login");
    return;
  }
  const inputSelector = parentId
    ? `[data-post-id="${postId}"] .reply-input[data-parent-id="${parentId}"]`
    : `[data-post-id="${postId}"] .comment-input`;
  const input = document.querySelector(inputSelector);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  try {
    const res = await api("POST", `/api/posts/${postId}/comment`, {
      userId: currentUser.id,
      text,
      parentId: parentId || undefined,
    });
    const newComment = res.data;
    // Check global feed array first, then PostCache (covers profile tab posts)
    const post =
      posts.find((p) => p.id === postId) || PostCache.getPost(postId);
    if (post) {
      if (!Array.isArray(post.comments)) post.comments = [];
      if (newComment.parentId) {
        const parent = post.comments.find((c) => c.id === newComment.parentId);
        if (parent) {
          if (!Array.isArray(parent.replies)) parent.replies = [];
          parent.replies.push({ ...newComment, replies: [] });
        } else {
          post.comments.push({ ...newComment, replies: [] });
        }
      } else {
        post.comments.push({ ...newComment, replies: [] });
      }
      PostCache.putPost(post);
    }
    input.value = "";
    renderCommentList(postId);
    const ce = document.querySelector(
      `[data-post-id="${postId}"] .comment-count`,
    );
    if (ce && post) {
      function _countAll(a) {
        return (a || []).reduce(
          (n, c) => n + 1 + _countAll(c.replies || []),
          0,
        );
      }
      ce.textContent = _countAll(post.comments) || "";
    }
    showToast(newComment.parentId ? "Reply added!" : "Comment added!");
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

function renderCommentList(postId) {
  const post = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  const panel = document.querySelector(
    `[data-post-id="${postId}"] .comments-panel`,
  );
  if (!panel || !post) return;
  panel.querySelector(".comment-list").innerHTML = buildCommentItems(
    post.comments,
  );
}

function buildCommentItems(comments) {
  if (!comments || !comments.length) return "";

  function renderOne(c, isReply) {
    const col = stringToColor(c.author || "?");
    const avInner = c.authorPicture
      ? `<img src="${escHtml(c.authorPicture)}" alt="${escHtml((c.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
      : escHtml((c.author || "?").charAt(0).toUpperCase());

    const repliesHtml =
      !isReply && c.replies && c.replies.length
        ? `<div class="comment-replies">${c.replies.map((r) => renderOne(r, true)).join("")}</div>`
        : "";

    return `<div class="comment-row${isReply ? " comment-reply" : ""}">
            <div class="av sm" style="background:${c.authorPicture ? "transparent" : col}">${avInner}</div>
            <div class="comment-bubble">
              <div class="comment-name">${escHtml(c.author || "Anonymous")}</div>
              <div class="comment-txt">${escHtml(c.text || "")}</div>
            </div>
          </div>${repliesHtml}`;
  }

  return comments.map((c) => renderOne(c, false)).join("");
}

/* ── REPOSTS (inline dropdown — same pattern as post menu) ── */

function _resolveRepostTarget(postId) {
  const card = posts.find((p) => p.id === postId);
  const targetId =
    card?.isRepost && card.originalPost?.id ? card.originalPost.id : postId;
  const orig =
    posts.find((p) => p.id === targetId) ||
    PostCache.getPost(targetId) ||
    card?.originalPost ||
    card;
  return { targetId, orig };
}

function openRepostAsQuote(e, postId) {
  e.stopPropagation();
  if (!currentUser) {
    showToast("Log in to Echo.");
    goTo("login");
    return;
  }
  openQuoteModal(postId);
}

function closeRepostPopover() {} // kept as no-op — called by openQuoteModal internals


/* ── Quote modal ── */
function openQuoteModal(postId) {
  if (postId) repostTargetId = _resolveRepostTarget(postId).targetId;
  closeRepostPopover();
  if (!repostTargetId) return;
  const orig =
    posts.find((p) => p.id === repostTargetId) ||
    PostCache.getPost(repostTargetId);
  if (!orig) return;
  document.getElementById("modal-orig-author").textContent = orig.author || "";
  document.getElementById("modal-orig-text").textContent = orig.text || "";
  document.getElementById("quote-text").value = "";
  const img = document.getElementById("modal-orig-img");
  const vid = document.getElementById("modal-orig-video");
  if (orig.video) {
    vid.src = resolveMediaUrl(orig.video);
    vid.style.display = "block";
    img.src = "";
    img.style.display = "none";
  } else if (orig.image) {
    img.src = resolveMediaUrl(orig.image);
    img.style.display = "block";
    vid.src = "";
    vid.style.display = "none";
  } else {
    img.src = "";
    img.style.display = "none";
    vid.src = "";
    vid.style.display = "none";
  }
  document.getElementById("quote-modal").classList.add("open");
  setTimeout(() => document.getElementById("quote-text").focus(), 120);
}

function closeQuoteModal(e) {
  if (e && e.target !== document.getElementById("quote-modal")) return;
  const modal = document.getElementById("quote-modal");
  modal.classList.remove("open");
  modal.style.zIndex = "";
  repostTargetId = null;
  const vid = document.getElementById("modal-orig-video");
  if (vid) {
    vid.pause();
    vid.src = "";
    vid.style.display = "none";
  }
}

async function confirmQuote() {
  const text = document.getElementById("quote-text").value.trim();
  if (!text) {
    showToast("Add a comment to Echo.");
    return;
  }
  if (!currentUser || !repostTargetId) return;
  const orig =
    posts.find((p) => p.id === repostTargetId) ||
    PostCache.getPost(repostTargetId);
  if (!orig) return;
  try {
    const res = await api("POST", `/api/posts/${repostTargetId}/repost`, {
      userId: currentUser.id,
      text,
    });
    const repost = res.data;
    // Quote posts don't toggle the repost button — they are their own posts
    if (repost.isRepost) {
      if (!repost.originalPost) repost.originalPost = {};
      repost.originalPost = Object.assign({}, orig, repost.originalPost);
    }
    posts.unshift(repost);
    const modal = document.getElementById("quote-modal");
    modal.classList.remove("open");
    modal.style.zIndex = "";
    const vid = document.getElementById("modal-orig-video");
    if (vid) {
      vid.pause();
      vid.src = "";
      vid.style.display = "none";
    }
    repostTargetId = null;
    renderFeed();
    if (typeof _lbUpdateActions === "function") _lbUpdateActions();
    showToast("Echoed! 📣");
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRepostPopover();
    const qm = document.getElementById("quote-modal");
    if (qm) {
      qm.classList.remove("open");
      qm.style.zIndex = "";
    }
    repostTargetId = null;
    closeNotifPanel();
    const rm = document.getElementById("report-modal");
    if (rm) rm.classList.remove("open");
    reportTargetPostId = null;
  }
});

/* IMAGE & VIDEO */
// ── Client-side image compression ──────────────────────────────
// Resizes to maxW/maxH (never upscales), converts to WebP, returns a File.
// Handles EXIF orientation via CSS image-orientation (supported in all
// modern browsers); no extra library needed.
async function compressImage(
  file,
  { maxW = 1920, maxH = 1080, quality = 0.82 } = {},
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      const ratio = Math.min(maxW / w, maxH / h, 1); // never upscale
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          const outName = file.name.replace(/\.[^.]+$/, ".webp");
          resolve(new File([blob], outName, { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    // Let CSS handle EXIF orientation automatically
    img.style.imageOrientation = "from-image";
    img.src = objectUrl;
  });
}

async function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("Image must be under 10 MB.");
    event.target.value = "";
    return;
  }
  pendingVideoDataUrl = null;
  // Show original instantly for snappy UX, then swap in compressed version
  const previewEl = document.getElementById("img-preview");
  const wrapEl = document.getElementById("img-preview-wrap");
  const videoEl = document.getElementById("video-preview");
  const rawUrl = URL.createObjectURL(file);
  previewEl.src = rawUrl;
  previewEl.style.display = "block";
  videoEl.style.display = "none";
  videoEl.src = "";
  wrapEl.style.display = "block";
  try {
    const compressed = await compressImage(file);
    pendingImageDataUrl = compressed; // store compressed File for FormData upload
    // Swap preview to the compressed version and free the raw object URL
    const compressedUrl = URL.createObjectURL(compressed);
    previewEl.onload = () => URL.revokeObjectURL(compressedUrl);
    previewEl.src = compressedUrl;
    URL.revokeObjectURL(rawUrl);
  } catch (err) {
    // Compression failed — fall back to raw file silently
    console.warn("[Circle] Image compression failed, using original:", err);
    pendingImageDataUrl = file;
  }
}
// ── Client-side video compression (FFmpeg.wasm) ────────────────
// Loaded lazily from CDN the first time a video is picked.
// onProgress(pct: 0–100) is called as FFmpeg works.
let _ffmpegInstance = null;
let _ffmpegLoaded = false;
let _ffmpegUnavailable = false; // true if CDN failed — skip all future attempts

async function _loadFFmpeg() {
  if (_ffmpegLoaded) return _ffmpegInstance;
  if (_ffmpegUnavailable) throw new Error("FFmpeg unavailable");
  // Dynamically load FFmpeg.wasm from CDN (only when needed)
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";
      s.onload = resolve;
      s.onerror = () =>
        reject(new Error("Failed to load FFmpeg.wasm from CDN"));
      document.head.appendChild(s);
    });
    const { createFFmpeg, fetchFile } = FFmpeg;
    _ffmpegInstance = createFFmpeg({ log: false });
    _ffmpegInstance._fetchFile = fetchFile;
    await _ffmpegInstance.load();
    _ffmpegLoaded = true;
    return _ffmpegInstance;
  } catch (err) {
    _ffmpegUnavailable = true; // don't retry on future picks
    throw err;
  }
}

async function compressVideo(file, onProgress) {
  if (_ffmpegUnavailable) throw new Error("FFmpeg unavailable");
  const ff = await _loadFFmpeg();
  ff.setProgress(({ ratio }) =>
    onProgress?.(Math.min(99, Math.round(ratio * 100))),
  );
  const inName = "input" + file.name.replace(/[^.a-zA-Z0-9]/g, "");
  const outName = "output.mp4";
  ff.FS("writeFile", inName, await ff._fetchFile(file));
  await ff.run(
    "-i",
    inName,
    "-vcodec",
    "libx264",
    "-crf",
    "26", // 18=best quality, 28=smallest, 26=sweet spot
    "-preset",
    "fast",
    "-movflags",
    "+faststart", // metadata at front for instant streaming
    "-acodec",
    "aac",
    "-vf",
    "scale='min(1280,iw)':-2", // cap width, preserve aspect
    outName,
  );
  const data = ff.FS("readFile", outName);
  // Clean up FFmpeg virtual FS
  try {
    ff.FS("unlink", inName);
  } catch (_) {}
  try {
    ff.FS("unlink", outName);
  } catch (_) {}
  onProgress?.(100);
  return new File([data.buffer], file.name.replace(/\.[^.]+$/, ".mp4"), {
    type: "video/mp4",
  });
}

async function previewVideo(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 200 * 1024 * 1024) {
    showToast("Video must be under 200 MB.");
    return;
  }
  pendingImageDataUrl = null;

  // Show raw video preview immediately
  const videoEl = document.getElementById("video-preview");
  const imgEl = document.getElementById("img-preview");
  const wrapEl = document.getElementById("img-preview-wrap");
  const overlay = document.getElementById("video-compress-overlay");
  const fillEl = document.getElementById("video-compress-fill");
  const labelEl = document.getElementById("video-compress-label");
  const submitBtn = document.getElementById("post-submit-btn");

  const rawUrl = URL.createObjectURL(file);
  videoEl.src = rawUrl;
  videoEl.style.display = "block";
  imgEl.style.display = "none";
  imgEl.src = "";
  wrapEl.style.display = "block";

  // Lock Post button and show overlay while compressing
  submitBtn.disabled = true;
  overlay.classList.remove("hidden");
  fillEl.style.width = "0%";
  labelEl.textContent = "Compressing… 0%";

  pendingVideoDataUrl = file; // fallback: use raw if compression fails
  pendingVideoCompressed = false;

  try {
    const compressed = await compressVideo(file, (pct) => {
      fillEl.style.width = pct + "%";
      labelEl.textContent = pct < 100 ? `Compressing… ${pct}%` : "Done ✓";
    });
    pendingVideoDataUrl = compressed;
    pendingVideoCompressed = true; // client compression succeeded
    // Swap preview to compressed version
    URL.revokeObjectURL(rawUrl);
    videoEl.src = URL.createObjectURL(compressed);
  } catch (err) {
    console.warn("[Circle] Video compression failed, using original:", err);
    const msg = _ffmpegUnavailable
      ? "Compressor unavailable — uploading original video."
      : "Compression failed — uploading original.";
    showToast(msg);
  } finally {
    overlay.classList.add("hidden");
    fillEl.style.width = "0%";
    submitBtn.disabled = false;
  }
}
function removeMedia() {
  pendingImageDataUrl = null;
  pendingVideoDataUrl = null;
  pendingVideoCompressed = false;
  document.getElementById("img-preview").src = "";
  document.getElementById("img-preview").style.display = "block";
  const vp = document.getElementById("video-preview");
  vp.pause();
  vp.src = "";
  vp.style.display = "none";
  document.getElementById("img-preview-wrap").style.display = "none";
  document.getElementById("img-input").value = "";
  document.getElementById("video-input").value = "";
}
function removeImage() {
  removeMedia();
}

/*  RENDER */
/*  RENDER */
// renderFeed — global wrapper kept because the rest of the codebase calls it directly
// (createPost, deletePost, submitEditPost, confirmQuote, etc.).
// It delegates to Feed.renderFeed() which owns the empty-state guard.
function renderFeed() {
  Feed.renderFeed();
}


/* ── Trending in Your Circles ──────────────────────────────────── */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "let",
  "may",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "boy",
  "did",
  "man",
  "men",
  "put",
  "say",
  "she",
  "too",
  "use",
  "had",
  "have",
  "that",
  "this",
  "with",
  "they",
  "from",
  "been",
  "will",
  "what",
  "were",
  "when",
  "your",
  "said",
  "each",
  "she",
  "just",
  "into",
  "then",
  "than",
  "some",
  "more",
  "also",
  "over",
  "such",
  "here",
  "know",
  "like",
  "time",
  "very",
  "even",
  "most",
  "make",
  "after",
  "first",
  "well",
  "much",
  "good",
  "want",
  "came",
  "come",
  "back",
  "does",
  "made",
  "many",
  "them",
  "these",
  "other",
  "about",
  "their",
  "there",
  "which",
  "would",
  "could",
  "should",
  "really",
  "think",
  "going",
  "still",
  "being",
  "where",
  "every",
  "those",
  "while",
  "before",
  "again",
  "through",
  "because",
  "always",
  "never",
  "people",
  "thing",
  "things",
  "anyone",
  "someone",
  "something",
  "anything",
  "nothing",
  "everyone",
  "everything",
  "little",
  "great",
  "might",
  "only",
  "both",
  "same",
  "last",
  "long",
  "life",
  "give",
  "work",
  "need",
  "feel",
  "seem",
  "keep",
  "tell",
  "next",
  "best",
  "high",
  "look",
  "place",
  "actually",
  "usually",
  "already",
  "another",
  "between",
  "together",
  "without",
  "year",
  "years",
  "today",
  "right",
  "left",
  "sure",
  "stop",
  "took",
  "take",
  "away",
  "around",
  "different",
  "nothing",
  "another",
  "during",
  "since",
  "until",
  "while",
]);

let _trendingWords = [];
let _trendingLoading = false;
let _trendingLoaded = false;
let _activeFilter = null;

function _setTrendingContent(bodyId, footerId, html, footer) {
  const b = document.getElementById(bodyId);
  const f = document.getElementById(footerId);
  if (b) b.innerHTML = html;
  if (f) f.textContent = footer || "";
}

async function loadTrending(force = false) {
  if (_trendingLoading) return;
  if (_trendingLoaded && !force) {
    renderTrending("search-trending-body", "search-trending-footer");
    return;
  }

  _trendingLoading = true;
  const skelHtml = `<div class="trending-skeleton"><div class="trending-skel-row"></div><div class="trending-skel-row"></div><div class="trending-skel-row"></div><div class="trending-skel-row"></div><div class="trending-skel-row"></div></div>`;
  if (force || !_trendingLoaded) {
    _setTrendingContent("trending-body", "trending-footer", skelHtml, "");
    _setTrendingContent(
      "search-trending-body",
      "search-trending-footer",
      skelHtml,
      "",
    );
  }

  try {
    // Fetch both topics (hashtag-based) and recent posts (plain-word counting)
    // so "Circle is amazing" and "#Circle is amazing" both count the word.
    const [topicsRes, postsRes] = await Promise.allSettled([
      api("GET", "/api/topics?limit=20"),
      api("GET", "/api/posts?feed=global&page=1"),
    ]);

    // Build a score map from the hashtag topics API
    const scoreMap = {};
    const risingMap = {};
    if (topicsRes.status === "fulfilled") {
      (topicsRes.value.data || []).forEach((t) => {
        const key = t.topic.toLowerCase();
        scoreMap[key] = (scoreMap[key] || 0) + (t.post_count || 0) * 2; // weight hashtags higher
      });
    }

    // Merge in plain-word counts from posts (strips # so both forms unify)
    if (postsRes.status === "fulfilled") {
      const allPosts =
        postsRes.value.data || postsRes.value.posts || postsRes.value || [];
      const now = Date.now();
      (Array.isArray(allPosts) ? allPosts : []).forEach((post) => {
        if (!post.text) return;
        const isRecent =
          post.createdAt && now - new Date(post.createdAt).getTime() < 86400000;
        const weight = isRecent ? 2 : 1;
        // Strip # so #Circle and Circle both become "circle"
        const words = post.text
          .toLowerCase()
          .replace(/#/g, "") // remove hash signs first
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(
            (w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w),
          );
        const seen = new Set();
        words.forEach((w) => {
          scoreMap[w] = (scoreMap[w] || 0) + weight;
          if (isRecent && !seen.has(w)) {
            risingMap[w] = (risingMap[w] || 0) + 1;
            seen.add(w);
          }
        });
      });
    }

    _trendingWords = Object.entries(scoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, score]) => ({
        word,
        score,
        postCount: Math.ceil(score / 2),
        rising: (risingMap[word] || 0) >= 2,
      }));
    _trendingLoaded = true;
    const now = new Date();
    const timeStr = `Updated ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    renderTrendingAllContainers();
    const tf = document.getElementById("trending-footer");
    if (tf) tf.textContent = timeStr;
    const stf = document.getElementById("search-trending-footer");
    if (stf) stf.textContent = timeStr;
  } catch (e) {
    const errHtml = `<div class="trending-empty">Couldn't load trends.<br>Check your connection.</div>`;
    _setTrendingContent("trending-body", "trending-footer", errHtml, "");
    _setTrendingContent(
      "search-trending-body",
      "search-trending-footer",
      errHtml,
      "",
    );
  } finally {
    _trendingLoading = false;
  }
}

function extractTrending(followingPosts) {
  const now = Date.now();
  const counts = {};
  const recencyCounts = {};

  followingPosts.forEach((post) => {
    if (!post.text) return;
    const isRecent =
      post.createdAt && now - new Date(post.createdAt).getTime() < 86400000;
    const weight = isRecent ? 2 : 1;

    const words = post.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

    const seen = new Set();
    words.forEach((w) => {
      counts[w] = (counts[w] || 0) + weight;
      if (isRecent && !seen.has(w)) {
        recencyCounts[w] = (recencyCounts[w] || 0) + 1;
        seen.add(w);
      }
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, score]) => ({
      word,
      score,
      postCount: Math.ceil(score / 1.5),
      rising: (recencyCounts[word] || 0) >= 2,
    }));
}

function renderTrending(bodyId, footerId) {
  bodyId = bodyId || "trending-body";
  footerId = footerId || "trending-footer";
  const body = document.getElementById(bodyId);
  if (!body) return;
  if (!_trendingWords.length) {
    body.innerHTML = `<div class="trending-empty">
            No topics yet.<br>Start posting with #hashtags to see<br>what's trending on Circle.
          </div>`;
    return;
  }

  const pills = _trendingWords
    .map((item, i) => {
      const signal = item.rising
        ? `<span class="trending-pill-signal rising">&#8593; rising</span>`
        : `<span class="trending-pill-signal stable">&#9679; active</span>`;
      return `<button class="trending-pill"
            onclick="openTopicFeed('${escHtml(item.word)}')" title="See all posts tagged #${escHtml(item.word)}">
            <span class="trending-pill-rank">${i + 1}</span>
            <span class="trending-pill-word">${item.word.includes(" ") ? escHtml(item.word) : "#" + escHtml(item.word)}</span>
            ${signal}
            <span class="trending-pill-badge">${item.postCount}</span>
          </button>`;
    })
    .join("");

  body.innerHTML = `<div class="trending-pills">${pills}</div>`;
}

function renderTrendingAllContainers() {
  renderTrending("trending-body", "trending-footer");
  renderTrending("search-trending-body", "search-trending-footer");
}

function applyTrendingFilter(word) {
  // Toggle off if already active
  if (_activeFilter === word) {
    clearTrendingFilter();
    return;
  }

  _activeFilter = word;

  // Show filter bar
  const bar = document.getElementById("trending-filter-bar");
  document.getElementById("trending-filter-label").textContent = `#${word}`;
  bar.style.display = "flex";

  // Re-render pills in both containers to show active state
  renderTrendingAllContainers();

  // Filter the feed list client-side
  const filtered = posts.filter(
    (p) => p.text && p.text.toLowerCase().includes(word.toLowerCase()),
  );
  const c = document.getElementById("feed-list");
  if (!filtered.length) {
    c.innerHTML = `<div class="empty">
            <div class="empty-icon">&#128269;</div>
            <h3>No posts found</h3>
            <p>No posts from your circles mention <strong>#${escHtml(word)}</strong> yet.</p>
            <button class="btn btn-ghost" style="margin-top:14px;border-radius:20px" onclick="clearTrendingFilter()">Clear filter</button>
          </div>`;
    return;
  }
  c.innerHTML = filtered.map((p) => buildPostCard(p)).join("");
}

function clearTrendingFilter() {
  _activeFilter = null;
  document.getElementById("trending-filter-bar").style.display = "none";
  renderTrendingAllContainers();
  // Restore the full feed without re-fetching trending data
  const c = document.getElementById("feed-list");
  if (!posts.length) {
    renderFeed();
    return;
  }
  const parts = posts.map((p) => buildPostCard(p));
  if (!_feedSugDismissed && currentUser && parts.length >= 5)
    parts.splice(5, 0, buildFeedSugCard());
  if (!_feedNewDismissed && currentUser && _newMembers.length) {
    const member = _newMembers[_feedNewIndex % _newMembers.length];
    if (member) {
      const injectAt = Math.floor(Math.random() * 3) + 3;
      parts.splice(
        Math.min(injectAt, parts.length),
        0,
        buildFeedNewCard(member),
      );
    }
  }
  c.innerHTML = parts.join("");
  _initPostCardLinkPreviews();
}

/* -- VIEW PROFILE (click author name/avatar) ------------------- */
/* -- VIEW ANOTHER USER'S PROFILE -------------------------------- */

function viewProfile(userId) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById("view-profile").classList.add("active");
  const contentEl = document.querySelector(".content");
  if (contentEl) contentEl.classList.remove("feed-active");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const sn = document.getElementById("snav-profile");
  if (sn) sn.classList.add("active");
  document
    .querySelectorAll(".mnav-item")
    .forEach((n) => n.classList.remove("active"));
  const mn = document.getElementById("mnav-profile");
  if (mn) mn.classList.add("active");
  window.scrollTo(0, 0);
  // Push to navStack so back button works
  if (!_historyNavigating) {
    if (_navStack[_navStack.length - 1] !== "profile") {
      if (_navStack.length >= 20) _navStack.shift();
      _navStack.push("profile");
    }
  }
  _updateBackButtons("profile");
  if (!_historyNavigating) {
    history.pushState(
      { view: "profile", userId: userId || null },
      "",
      _viewToPath("profile", { userId }),
    );
  }
  renderProfile(userId);
}

// ── Profile tab switcher ─────────────────────────────────
function switchProfileTab(tab) {
  document
    .getElementById("ptab-posts")
    .classList.toggle("active", tab === "posts");
  document
    .getElementById("ptab-about")
    .classList.toggle("active", tab === "about");
  document.getElementById("profile-posts-panel").style.display =
    tab === "posts" ? "block" : "none";
  document.getElementById("profile-about-panel").style.display =
    tab === "about" ? "block" : "none";
  // Sync URL: add ?tab=about, strip it for default (posts)
  const base = window.location.pathname;
  const url = tab === "posts" ? base : `${base}?tab=${tab}`;
  history.replaceState({ ...history.state, profileTab: tab }, "", url);
}

async function renderProfile(viewedUserId = null) {
  if (!currentUser) {
    goTo("login");
    return;
  }
  const targetId =
    viewedUserId !== null && viewedUserId !== undefined
      ? parseInt(viewedUserId, 10)
      : currentUser.id;
  const isOwnProfile = targetId === currentUser.id;
  let profileData = null;
  try {
    const res = await api("GET", `/api/users/${targetId}/profile`);
    profileData = res.data;
  } catch (e) {
    showToast("Couldn't load profile. Showing cached info.");
  }
  const name = profileData?.name || currentUser.name;
  const email = isOwnProfile
    ? (profileData?.email || currentUser.email)
    : (profileData?.email || null);
  const pic = resolveMediaUrl(
    profileData?.picture || (isOwnProfile ? currentUser.picture : null),
  );
  const initial = name.charAt(0).toUpperCase();
  const color = stringToColor(name);

  // ── Update page title + og meta with real name ──────────
  _setPageTitle(isOwnProfile ? "Your Profile" : name);

  // ── 1. Banner gradient + cover image ────────────────────
  const bannerGrad = document.getElementById("profile-banner-gradient");
  const coverImg   = document.getElementById("profile-cover-img");
  const coverEditBtn = document.getElementById("profile-cover-edit-btn");
  const coverUrl   = resolveMediaUrl(profileData?.coverImage || null);

  if (coverImg) {
    if (coverUrl) {
      coverImg.src = coverUrl;
      coverImg.style.display = "block";
      if (bannerGrad) bannerGrad.style.background = "rgba(0,0,0,0.25)";
    } else {
      coverImg.style.display = "none";
      coverImg.src = "";
      if (bannerGrad) {
        bannerGrad.style.background = `linear-gradient(135deg, ${color}cc 0%, ${color}55 60%, transparent 100%)`;
      }
    }
  } else if (bannerGrad) {
    bannerGrad.style.background = `linear-gradient(135deg, ${color}cc 0%, ${color}55 60%, transparent 100%)`;
  }

  if (coverEditBtn) coverEditBtn.style.display = isOwnProfile ? "flex" : "none";

  // ── Avatar ──────────────────────────────────────────────
  const av = document.getElementById("profile-av");
  if (pic) {
    av.style.background = "transparent";
    av.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block"/>`;
  } else {
    av.innerHTML = initial;
    av.style.background = color;
  }

  // Configure avatar wrapper click behaviour
  const avWrap = document.getElementById("profile-av-wrap");
  const avOverlay = document.getElementById("profile-av-overlay");
  avWrap.classList.remove("av-view-mode", "av-disabled-mode");
  avWrap.onclick = null;
  if (isOwnProfile) {
    avWrap.title = pic
      ? "View or change profile picture"
      : "Add profile picture";
    avOverlay.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    const viewBtn = document.getElementById("profile-av-view-btn");
    if (viewBtn) viewBtn.style.display = pic ? "flex" : "none";
    avWrap.dataset.currentPic = pic || "";
    avWrap.dataset.currentName = name;
    avWrap.onclick = (e) => {
      e.stopPropagation();
      toggleAvatarMenu();
    };
  } else if (pic) {
    avWrap.classList.add("av-view-mode");
    avWrap.title = `View ${name}'s photo`;
    avOverlay.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    avWrap.onclick = () => openProfilePicLightbox(pic, name);
  } else {
    avWrap.classList.add("av-disabled-mode");
    avWrap.title = "";
    avWrap.onclick = null;
  }

  // ── 2. Meta row ─────────────────────────────────────────
  document.getElementById("profile-name").textContent = name;
  const handleEl = document.getElementById("profile-email");
  handleEl.textContent = isOwnProfile
    ? email
    : profileData?.handle
      ? `@${profileData.handle}`
      : "";
  const bio = profileData?.bio || (isOwnProfile ? currentUser.bio || "" : "");
  const bioEl = document.getElementById("profile-bio");
  if (bioEl) {
    bioEl.textContent = bio;
    bioEl.style.display = bio ? "block" : "none";
  }

  // ── 3. Stats pills ──────────────────────────────────────
  document.getElementById("stat-posts").textContent =
    profileData?.postCount || 0;
  document.getElementById("stat-followers").textContent =
    profileData?.followerCount || 0;
  document.getElementById("stat-following").textContent =
    profileData?.followingCount || 0;
  const liked = posts.reduce(
    (n, p) => n + (p.likes.includes(currentUser.id) ? 1 : 0),
    0,
  );
  document.getElementById("stat-likes").textContent = liked;

  // ── Action buttons ──────────────────────────────────────
  const actionsEl = document.getElementById("profile-actions");
  if (isOwnProfile) {
    actionsEl.innerHTML = `
      <button class="btn btn-ghost" onclick="goTo('settings')" style="font-size:13px;padding:8px 16px">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit Profile
      </button>
      <button class="logout-btn-sm" onclick="logout()">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Log Out
      </button>`;
  } else {
    const isFollowing = profileData?.isFollowing || false;
    const _dmUser = JSON.stringify({
      id: targetId,
      name,
      picture: pic || null,
    });
    actionsEl.innerHTML = `
            <button class="btn ${isFollowing ? "btn-outline" : "btn-primary"}" style="font-size:13px;padding:8px 20px" data-following="${isFollowing}" onclick="toggleFollow(${targetId}, this)">${isFollowing ? "Following" : "Follow"}</button>
            <button class="btn btn-ghost" style="font-size:13px;padding:8px 18px;gap:7px" onclick='DM.startConvWithUser(${_dmUser})'>
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Message
            </button>`;
  }

  // ── 4. About panel content ──────────────────────────────
  const aboutEl = document.getElementById("profile-about-content");
  if (aboutEl) {
    // For own profile, merge API data with cached currentUser so private
    // fields (phone, dateOfBirth) are available even though getProfile
    // intentionally omits them from the public response.
    const src = isOwnProfile
      ? { ...currentUser, ...profileData }
      : profileData || {};

    const esc = escHtml;
    const rows = [];

    // ── Bio ──────────────────────────────────────────────
    if (bio) {
      rows.push(`
              <div class="about-section-title">Bio</div>
              <p style="font-size:14px;color:var(--txt);line-height:1.6;margin-bottom:4px">${esc(bio)}</p>`);
    }

    // ── Details rows ────────────────────────────────────
    const detailRows = [];

    if (src.location) {
      detailRows.push({
        label: "Location",
        value: esc(src.location),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      });
    }
    if (src.school) {
      detailRows.push({
        label: "School",
        value: esc(src.school),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
      });
    }
    if (src.occupation) {
      detailRows.push({
        label: "Occupation",
        value: esc(src.occupation),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>`,
      });
    }
    if (src.website) {
      const href = src.website.startsWith("http")
        ? src.website
        : `https://${src.website}`;
      detailRows.push({
        label: "Website",
        value: `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(src.website)}</a>`,
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`,
      });
    }
    if (src.gender) {
      detailRows.push({
        label: "Gender",
        value: esc(src.gender.charAt(0).toUpperCase() + src.gender.slice(1)),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M12 12v8M8 16h8"/></svg>`,
      });
    }
    // Private fields — own profile only
    if (isOwnProfile && src.phone) {
      // Strip the stored "dialCode|digits" to show as "+254 712345678"
      const phoneParts = src.phone.split("|");
      const phoneDisplay =
        phoneParts.length === 2
          ? `${phoneParts[0]} ${phoneParts[1]}`
          : src.phone;
      detailRows.push({
        label: "Phone",
        value: esc(phoneDisplay),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 10.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>`,
      });
    }
    if (isOwnProfile && src.dateOfBirth) {
      const dob = new Date(src.dateOfBirth);
      const age = Math.floor(
        (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000),
      );
      const dobDisplay = dob.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      detailRows.push({
        label: "Date of Birth",
        value: `${esc(dobDisplay)} (${age} yrs)`,
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      });
    }

    const joinDate = src.createdAt
      ? new Date(src.createdAt).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      : null;
    if (joinDate) {
      detailRows.push({
        label: "Joined",
        value: esc(joinDate),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      });
    }

    if (detailRows.length) {
      rows.push(`<div class="about-section-title">Details</div>`);
      rows.push(
        ...detailRows.map(
          (r) => `
              <div class="about-row">
                <div class="about-row-icon">${r.icon}</div>
                <div class="about-row-body">
                  <div class="about-row-label">${r.label}</div>
                  <div class="about-row-value">${r.value}</div>
                </div>
              </div>`,
        ),
      );
    }

    // ── Mutual followers (other profiles) ───────────────
    const mutuals = profileData?.mutualFollowers;
    if (!isOwnProfile && mutuals && mutuals.length) {
      rows.push(`
              <div class="about-section-title">Connections</div>
              <div class="about-row">
                <div class="about-row-icon">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <div class="about-row-body">
                  <div class="about-row-label">Mutual Followers</div>
                  <div class="about-row-value">${mutuals.length} mutual follower${mutuals.length !== 1 ? "s" : ""}</div>
                </div>
              </div>`);
    }

    aboutEl.innerHTML = rows.length
      ? rows.join("")
      : `<div class="about-empty">No info added yet.</div>`;
  }

  // ── Reset tabs to Posts ─────────────────────────────────
  switchProfileTab("posts");

  const c = document.getElementById("profile-feed");

  // Pagination state for this profile view
  let _profilePage = 1;
  let _profileHasMore = false;
  let _profileLoading = false;
  let _profileUserId = targetId;

  async function loadProfilePosts(page, append = false) {
    if (_profileLoading) return;
    _profileLoading = true;

    if (!append) {
      c.innerHTML = `<div style="text-align:center;padding:32px;color:var(--txt2)"><div class="spinner" style="margin:0 auto 12px"></div></div>`;
    } else {
      // Show a small spinner below existing posts while loading next page
      const skel = document.createElement("div");
      skel.id = "profile-load-skel";
      skel.style.cssText = "text-align:center;padding:20px;color:var(--txt2)";
      skel.innerHTML = `<div class="spinner" style="margin:0 auto"></div>`;
      c.appendChild(skel);
    }

    // Remove existing load-more button before fetch
    document.getElementById("profile-load-more-btn")?.remove();

    try {
      const res = await api(
        "GET",
        `/api/posts?userId=${_profileUserId}&page=${page}&limit=20`,
      );
      const userPosts = res.data?.posts || [];
      const hasMore = res.data?.hasMore ?? userPosts.length === 20;

      // Hydrate into cache so likes/comments/reposts work
      userPosts.forEach((p) => {
        if (!Array.isArray(p.likes)) p.likes = [];
        if (!Array.isArray(p.reposts)) p.reposts = [];
        if (!Array.isArray(p.comments)) p.comments = [];
        PostCache.putPost(p);
      });

      document.getElementById("profile-load-skel")?.remove();

      if (!append) {
        c.innerHTML = userPosts.length
          ? userPosts.map((p) => buildPostCard(p, isOwnProfile)).join("")
          : `<div class="empty"><div class="empty-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg></div><h3>No posts yet</h3><p>${isOwnProfile ? "Share your first post!" : "Nothing posted yet."}</p></div>`;
      } else {
        const frag = document.createElement("div");
        frag.innerHTML = userPosts
          .map((p) => buildPostCard(p, isOwnProfile))
          .join("");
        c.appendChild(frag);
      }

      _profileHasMore = hasMore;

      if (hasMore) {
        const btn = document.createElement("button");
        btn.id = "profile-load-more-btn";
        btn.className = "btn btn-ghost";
        btn.style.cssText = "width:100%;margin-top:16px;";
        btn.textContent = "Load more posts";
        btn.onclick = () => {
          _profilePage++;
          loadProfilePosts(_profilePage, true);
        };
        c.appendChild(btn);
      }
    } catch (e) {
      document.getElementById("profile-load-skel")?.remove();
      if (!append) {
        c.innerHTML = `<div class="empty"><h3>Could not load posts</h3><p>${e.message}</p></div>`;
      } else {
        showToast("Could not load more posts: " + e.message);
      }
    } finally {
      _profileLoading = false;
    }
  }

  loadProfilePosts(_profilePage);
}

function buildPostCard(post, showDelete = false) {
  // ── Profile photo update activity card ──────────────────────────
  if (post.type === "profile_pic") {
    const color = stringToColor(post.author || "");
    return `<div class="post-card activity-card" data-post-id="${post.id}" onclick="viewProfile(${post.userId})" style="cursor:pointer">
  <div class="post-head">
    <div class="av" style="background:${post.authorPicture ? "transparent" : color};cursor:pointer">
      ${post.authorPicture ? `<img src="${post.authorPicture}" alt="${escHtml((post.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>` : escHtml((post.author || "?").charAt(0))}
    </div>
    <div class="post-meta">
      <div class="post-name">${escHtml(post.author || "")}</div>
      <div class="post-time">${formatTime(post.createdAt)}</div>
    </div>
  </div>
  <div class="activity-body">
    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="15" height="15" style="flex-shrink:0;color:var(--accent)"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    <span>${escHtml(post.author || "")} updated their profile photo</span>
  </div>
  ${post.image ? `<div class="activity-photo-wrap"><img src="${escHtml(post.image)}" alt="New profile photo" loading="lazy" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--accent)"/></div>` : ""}
</div>`;
  }
  if (post.type === "profile_update") {
    const color = stringToColor(post.author || "");
    return `<div class="post-card activity-card" data-post-id="${post.id}" onclick="viewProfile(${post.userId})" style="cursor:pointer">
  <div class="post-head">
    <div class="av" style="background:${post.authorPicture ? "transparent" : color};cursor:pointer">
      ${post.authorPicture ? `<img src="${post.authorPicture}" alt="${escHtml((post.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>` : escHtml((post.author || "?").charAt(0))}
    </div>
    <div class="post-meta">
      <div class="post-name">${escHtml(post.author || "")}</div>
      <div class="post-time">${formatTime(post.createdAt)}</div>
    </div>
  </div>
  <div class="activity-body">
    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="15" height="15" style="flex-shrink:0;color:var(--accent)"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    <span>${escHtml(post.author || "")} updated their profile</span>
  </div>
  ${post.text ? `<div class="activity-body" style="padding-top:0;font-style:italic;color:var(--txt3)">"${escHtml(post.text)}"</div>` : ""}
</div>`;
  }
  // If this is a repost, patch originalPost with video/image.
  // Priority: 1) local posts cache, 2) PostCache store, 3) async API fetch
  if (post.isRepost && post.originalPost) {
    const _oid = post.originalPost.id;
    // Check local feed array first
    const _cached = posts.find((p) => !p.isRepost && p.id === _oid);
    if (_cached) {
      if (!post.originalPost.video && _cached.video)
        post.originalPost.video = _cached.video;
      if (!post.originalPost.image && _cached.image)
        post.originalPost.image = _cached.image;
      if (!post.originalPost.authorPicture && _cached.authorPicture)
        post.originalPost.authorPicture = _cached.authorPicture;
      if (!post.originalPost.createdAt && _cached.createdAt)
        post.originalPost.createdAt = _cached.createdAt;
      if (!post.originalPost.text && _cached.text)
        post.originalPost.text = _cached.text;
      if (!post.originalPost.author && _cached.author)
        post.originalPost.author = _cached.author;
      if (!post.originalPost.likes && _cached.likes)
        post.originalPost.likes = _cached.likes;
      if (!post.originalPost.comments && _cached.comments)
        post.originalPost.comments = _cached.comments;
      if (!post.originalPost.reposts && _cached.reposts)
        post.originalPost.reposts = _cached.reposts;
      if (!post.originalPost.views && _cached.views)
        post.originalPost.views = _cached.views;
    }
    // Check PostCache store
    if (!post.originalPost.video && !post.originalPost.image) {
      const _stored = PostCache.getPost(_oid);
      if (_stored) {
        if (!post.originalPost.video && _stored.video)
          post.originalPost.video = _stored.video;
        if (!post.originalPost.image && _stored.image)
          post.originalPost.image = _stored.image;
        if (!post.originalPost.authorPicture && _stored.authorPicture)
          post.originalPost.authorPicture = _stored.authorPicture;
        if (!post.originalPost.createdAt && _stored.createdAt)
          post.originalPost.createdAt = _stored.createdAt;
        if (!post.originalPost.text && _stored.text)
          post.originalPost.text = _stored.text;
        if (!post.originalPost.author && _stored.author)
          post.originalPost.author = _stored.author;
        if (!post.originalPost.likes && _stored.likes)
          post.originalPost.likes = _stored.likes;
        if (!post.originalPost.comments && _stored.comments)
          post.originalPost.comments = _stored.comments;
        if (!post.originalPost.reposts && _stored.reposts)
          post.originalPost.reposts = _stored.reposts;
        if (!post.originalPost.views && _stored.views)
          post.originalPost.views = _stored.views;
      }
    }
    // If still missing media or timestamp, fetch from API in background and re-render that card
    if (
      (!post.originalPost.video && !post.originalPost.image) ||
      !post.originalPost.createdAt
    ) {
      if (!window._repostMediaFetchQueue)
        window._repostMediaFetchQueue = new Set();
      if (!window._repostMediaFetchQueue.has(_oid)) {
        window._repostMediaFetchQueue.add(_oid);
        api("GET", `/api/posts/${_oid}`)
          .then((res) => {
            const orig = res && (res.data || res);
            if (!orig) return;
            PostCache.putPost(orig);
            // Patch all repost cards in current posts array that reference this original
            posts.forEach((p) => {
              if (p.isRepost && p.originalPost && p.originalPost.id === _oid) {
                if (orig.video) p.originalPost.video = orig.video;
                if (orig.image) p.originalPost.image = orig.image;
                if (orig.authorPicture)
                  p.originalPost.authorPicture = orig.authorPicture;
                if (orig.createdAt) p.originalPost.createdAt = orig.createdAt;
                if (orig.text) p.originalPost.text = orig.text;
                if (orig.author) p.originalPost.author = orig.author;
                if (orig.likes) p.originalPost.likes = orig.likes;
                if (orig.comments) p.originalPost.comments = orig.comments;
                if (orig.reposts) p.originalPost.reposts = orig.reposts;
                if (orig.views) p.originalPost.views = orig.views;
              }
            });
            // Re-render just the affected card(s) in the DOM
            document.querySelectorAll(`[data-post-id]`).forEach((card) => {
              const pid = parseInt(card.dataset.postId);
              const p = posts.find((x) => x.id === pid);
              if (
                p &&
                p.isRepost &&
                p.originalPost &&
                p.originalPost.id === _oid
              ) {
                const tmp = document.createElement("div");
                tmp.innerHTML = buildPostCard(p);
                card.replaceWith(tmp.firstElementChild);
              }
            });
          })
          .catch(() => {});
      }
    }
  }
  // Fix any private-network URLs baked in when the app was tested over LAN
  resolvePostMedia(post);

  const liked =
    currentUser && post.likes && post.likes.includes(currentUser.id);
  const reposted =
    currentUser && post.reposts && post.reposts.includes(currentUser.id);
  const canDelete =
    currentUser && (currentUser.id === post.userId || showDelete);
  if (!Array.isArray(post.likes)) post.likes = [];
  if (!Array.isArray(post.reposts)) post.reposts = [];
  if (!Array.isArray(post.comments)) post.comments = [];
  const color = stringToColor(post.author || "");
  // For no-quote reposts every engagement action targets the original post,
  // so data-post-id must match the original's ID — that's what toggleLike,
  // refreshLikeBtn, renderCommentList etc. all query against.
  // We keep the repost's own ID in data-repost-id for reference.
  const _isNoQuoteRepost = post.isRepost && post.originalPost && !post.text;
  const _cardPostId = _isNoQuoteRepost ? post.originalPost.id : post.id;
  const _cardClickId = _isNoQuoteRepost ? post.originalPost.id : post.id;
  const _repostIdAttr = _isNoQuoteRepost ? ` data-repost-id="${post.id}"` : "";
  return `<div class="post-card" data-post-id="${_cardPostId}"${_repostIdAttr} onclick="openPostDetail(event,${_cardClickId})" style="cursor:pointer">
    ${post.isRepost ? `<div class="echo-strip"><svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>${escHtml(post.author || "")} echoed</div>` : ""}
    ${
      post.isRepost && !post.text
        ? ""
        : `<div class="post-head">
      <div class="av" style="background:${post.authorPicture ? "transparent" : color};cursor:pointer" onclick="viewProfile(${post.userId})" title="View profile">${post.authorPicture ? `<img src="${post.authorPicture}" alt="${escHtml((post.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>` : escHtml((post.author || "?").charAt(0))}</div>
      <div class="post-meta"><div class="post-name" onclick="event.stopPropagation();openPostDetail(event,${post.id})" style="cursor:pointer" title="View post">${escHtml(post.author || "")}</div><div class="post-time">${formatTime(post.createdAt)}</div>${post.groupId ? `<div class="post-group-badge" onclick="event.stopPropagation();openGroup(${post.groupId})" title="View group">\n        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>\n        ${escHtml(post.groupName || post.groupTopic || "Group")}\n      </div>` : ""}</div>
      <div class="post-menu-wrap" onclick="event.stopPropagation()">
        <button class="post-menu-btn" onclick="togglePostMenu(event,${post.id})" title="More options">⋯</button>
        <div class="post-dropdown" id="post-menu-${post.id}">
          ${
            !canDelete
              ? `<button class="post-dropdown-item post-menu-follow-btn" data-user-id="${post.userId}" data-following="false" onclick="postMenuFollow(${post.userId},${post.id},this)">
            <svg class="post-menu-follow-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            <span class="post-menu-follow-label">Follow</span>
          </button>`
              : ""
          }
          <button class="post-dropdown-item" onclick="postMenuNotInterested(${post.id})">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Not Interested
          </button>
          <div class="post-dropdown-divider"></div>
          <button class="post-dropdown-item danger" onclick="postMenuReport(${post.id})">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Report
          </button>
          <button class="post-dropdown-item danger" onclick="postMenuBlock(${post.userId},${post.id})">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Block
          </button>
          ${
            canDelete
              ? `<div class="post-dropdown-divider"></div>
          <button class="post-dropdown-item" onclick="closePostMenu(${post.id});openEditPostModal(${post.id})">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="post-dropdown-item danger" onclick="closePostMenu(${post.id});deletePost(${post.id})">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Delete
          </button>`
              : ""
          }
        </div>
      </div>
    </div>`
    }
    ${
      post.text
        ? post.text.length > 280
          ? `<div class="post-body truncated" id="pb-${post.id}">${linkifyHashtags(escHtml(post.text))}</div><span class="post-see-more" onclick="event.stopPropagation();toggleSeeMore(${post.id},this)" id="sm-${post.id}">See more</span>`
          : `<div class="post-body">${linkifyHashtags(escHtml(post.text))}</div>`
        : ""
    }
    ${
      post.isRepost && post.originalPost && !post.text
        ? (() => {
            const op = post.originalPost;
            const opColor = stringToColor(op.author || "");
            const opAvHtml = op.authorPicture
              ? `<img src="${op.authorPicture}" alt="${escHtml((op.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
              : escHtml((op.author || "?").charAt(0));
            return `<div class="post-head" style="padding-top:10px">
        <div class="av" style="background:${op.authorPicture ? "transparent" : opColor};cursor:pointer" onclick="event.stopPropagation();viewProfile(${op.userId})" title="View profile">${opAvHtml}</div>
        <div class="post-meta"><div class="post-name" onclick="event.stopPropagation();openOriginalPost(${op.id})" style="cursor:pointer" title="View post">${escHtml(op.author || "")}</div><div class="post-time">${formatTime(op.createdAt)}</div></div>
      </div>
      ${op.text ? `<div class="post-body">${linkifyHashtags(escHtml(op.text))}</div>` : ""}
      ${op.video ? `<div class="post-video-wrap" onclick="event.stopPropagation();openVideoLightbox(this)" data-lb-video="${op.video}" data-lb-name="${escHtml(op.author || "")}" data-lb-picture="${escHtml(op.authorPicture || "")}" data-lb-user-id="${op.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(op.text || "")}" title="Watch video"><video src="${op.video}" preload="metadata" playsinline muted></video><div class="post-video-play-btn"><svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.45)"/><polygon points="22,16 42,28 22,40" fill="white"/></svg></div></div>` : op.image ? `<img class="post-img lb-thumb" src="${op.image}" loading="lazy" data-lb-name="${escHtml(op.author)}" data-lb-picture="${escHtml(op.authorPicture || "")}" data-lb-user-id="${op.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(op.text || "")}" onclick="event.stopPropagation();openLightbox(this)" title="View full image"/>` : ""}`;
          })()
        : post.isRepost && post.originalPost && post.text
          ? `<div class="echo-embed" style="cursor:pointer" onclick="event.stopPropagation();openOriginalPost(${post.originalPost.id})" title="View original post by ${escHtml(post.originalPost.author || "")}"><div class="echo-embed-name">${escHtml(post.originalPost.author || "")} </div>${post.originalPost.text ? `<div class="echo-embed-text">${escHtml(post.originalPost.text)}</div>` : ""}${post.originalPost.video ? `<div class="post-video-wrap echo-embed-video" onclick="event.stopPropagation();openVideoLightbox(this)" data-lb-video="${post.originalPost.video}" data-lb-name="${escHtml(post.originalPost.author)}" data-lb-picture="${escHtml(post.originalPost.authorPicture || "")}" data-lb-user-id="${post.originalPost.userId || ""}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.originalPost.text || "")}" title="Watch video" style="margin-top:8px"><video src="${post.originalPost.video}" preload="metadata" playsinline muted></video><div class="post-video-play-btn"><svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.45)"/><polygon points="22,16 42,28 22,40" fill="white"/></svg></div></div>` : post.originalPost.image ? `<img class="echo-embed-img lb-thumb" src="${post.originalPost.image}" loading="lazy" data-lb-name="${escHtml(post.originalPost.author)}" data-lb-picture="${escHtml(post.originalPost.authorPicture || "")}" data-lb-user-id="${post.originalPost.userId || ""}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.text || "")}" onclick="event.stopPropagation();openLightbox(this)" title="View full image"/>` : ""}</div>`
          : !post.isRepost && post.video
            ? `<div class="post-video-wrap" onclick="openVideoLightbox(this)" data-lb-video="${post.video}" data-lb-name="${escHtml(post.author)}" data-lb-picture="${escHtml(post.authorPicture || "")}" data-lb-user-id="${post.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.text || "")}" title="Watch video"><video src="${post.video}" preload="metadata" playsinline muted></video><div class="post-video-play-btn"><svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.45)"/><polygon points="22,16 42,28 22,40" fill="white"/></svg></div></div>`
            : !post.isRepost && post.image
              ? `<img class="post-img lb-thumb" src="${post.image}" loading="lazy" data-lb-name="${escHtml(post.author)}" data-lb-picture="${escHtml(post.authorPicture || "")}" data-lb-user-id="${post.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.text || "")}" onclick="openLightbox(this)" title="View full image"/>`
              : (() => {
                  // No media — show a link preview card if the post text contains a URL
                  if (post.isRepost) return "";
                  const _urlMatch = (post.text || "").match(/(?:https?:\/\/|(?<![/\w])www\.)[^\s]+/);
                  if (!_urlMatch) return "";
                  const _rawUrl = _urlMatch[0];
                  const _previewUrl = _rawUrl.startsWith("www.") ? `https://${_rawUrl}` : _rawUrl;
                  return `<div class="post-link-preview" data-preview-url="${escHtml(_previewUrl)}" data-post-id-lp="${post.id}"><div class="post-link-preview-loading">Loading preview…</div></div>`;
                })()
    }
    ${(() => {
      // For a no-quote repost, all actions should target the original post
      const isNoQuoteRepost = post.isRepost && post.originalPost && !post.text;
      const targetId = isNoQuoteRepost ? post.originalPost.id : post.id;
      const targetLikes = isNoQuoteRepost
        ? post.originalPost.likes || []
        : post.likes || [];
      const targetComments = isNoQuoteRepost
        ? post.originalPost.comments || []
        : post.comments || [];
      const targetReposts = isNoQuoteRepost
        ? post.originalPost.reposts || []
        : post.reposts || [];
      const targetLiked = currentUser && targetLikes.includes(currentUser.id);
      const targetReposted =
        currentUser &&
        targetReposts.some((r) => (r.userId || r) === currentUser.id);
      return `<div class="post-actions">
      <button class="act-btn like-btn${targetLiked ? " liked" : ""}" data-post-id="${targetId}" onclick="event.stopPropagation();toggleLike(${targetId})">
        <svg fill="${targetLiked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span>${targetLikes.length || ""}</span>
      </button>
      <button class="act-btn" onclick="event.stopPropagation();goToPostDetail(${targetId},true)">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <span class="comment-count">${
          (function countAll(arr) {
            return (arr || []).reduce(
              (n, c) => n + 1 + countAll(c.replies || []),
              0,
            );
          })(targetComments) || ""
        }</span>
      </button>
      <button class="act-btn repost-btn" onclick="openRepostAsQuote(event,${targetId})"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg><span>${targetReposts.length || ""}</span></button>
      <button class="act-btn share-btn" title="Share post" onclick="event.stopPropagation();sharePostLink(${targetId})"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
      <span class="act-views" id="views-${targetId}" title="Views">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>${(isNoQuoteRepost ? post.originalPost.views : post.views) ? fmtViews(isNoQuoteRepost ? post.originalPost.views : post.views) : ""}</span>
      </span>
    </div>`;
    })()}
  </div>`;
}

/*  PROFILE PICTURE */
async function handleProfilePicUpload(event) {
  if (!currentUser) {
    showToast("Log in first.");
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    showToast("Image must be under 100 MB.");
    return;
  }
  showToast("Uploading…");
  event.target.value = "";
  try {
    // Compress to 400×400 WebP before uploading — server no longer needs to do this
    let uploadFile = file;
    try {
      uploadFile = await compressImage(file, {
        maxW: 400,
        maxH: 400,
        quality: 0.88,
      });
    } catch (err) {
      console.warn(
        "[Circle] Profile pic compression failed, using original:",
        err,
      );
    }
    const fd = new FormData();
    fd.append("image", uploadFile);
    const res = await api("PUT", `/api/users/${currentUser.id}/picture`, fd);
    currentUser.picture = resolveMediaUrl(res.data.picture);
    localStorage.setItem("circle_user", JSON.stringify(currentUser));
    setCurrentUser(currentUser);
    renderProfile();
    populateSettings();
    showToast("Profile photo updated! 📸");
    // Post a profile_pic activity to the feed
    try {
      await api("POST", "/api/posts", {
        type: "profile_pic",
        text: "",
        image: currentUser.picture,
      });
      PostCache.invalidateFeed("global");
      PostCache.invalidateFeed("following");
    } catch (_) {}
  } catch (e) {
    showToast("Upload failed: " + e.message);
  }
}

async function handleCoverImageUpload(event) {
  if (!currentUser) { showToast("Log in first."); return; }
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) { showToast("Image must be under 100 MB."); return; }
  showToast("Uploading cover…");
  event.target.value = "";
  try {
    let uploadFile = file;
    try {
      uploadFile = await compressImage(file, { maxW: 1500, maxH: 500, quality: 0.88 });
    } catch (err) {
      console.warn("[Circle] Cover image compression failed, using original:", err);
    }
    const fd = new FormData();
    fd.append("image", uploadFile);
    const res = await api("PUT", `/api/users/${currentUser.id}/cover`, fd);
    currentUser.coverImage = resolveMediaUrl(res.data.coverImage);
    localStorage.setItem("circle_user", JSON.stringify(currentUser));
    renderProfile();
    showToast("Cover image updated! 🖼️");
  } catch (e) {
    showToast("Upload failed: " + e.message);
  }
}

/* ── Avatar action menu (own profile) ── */
function toggleAvatarMenu() {
  const menu = document.getElementById("profile-av-menu");
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  if (isOpen) {
    closeAvatarMenu();
  } else {
    // Position the menu below the avatar using fixed coords
    const wrap = document.getElementById("profile-av-wrap");
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      const menuW = 180;
      let left = r.left + r.width / 2 - menuW / 2;
      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      menu.style.top = r.bottom + 10 + "px";
      menu.style.left = left + "px";
      menu.style.transformOrigin = "top center";
    }
    menu.classList.add("open");
    // Close on next outside click
    setTimeout(() => {
      document.addEventListener("click", closeAvatarMenu, { once: true });
    }, 0);
  }
}
function closeAvatarMenu() {
  const menu = document.getElementById("profile-av-menu");
  if (menu) menu.classList.remove("open");
}
function profileAvViewPhoto() {
  closeAvatarMenu();
  const wrap = document.getElementById("profile-av-wrap");
  const pic = wrap?.dataset.currentPic;
  const name = wrap?.dataset.currentName || "Your";
  if (pic) openProfilePicLightbox(pic, name);
}
function profileAvChangePhoto() {
  closeAvatarMenu();
  document.getElementById("profile-pic-input").click();
}


/* openProfilePicLightbox → moved to lightbox.js */

/* FOLLOW / UNFOLLOW  */
function buildSuggestionCard(user) {
  const initial = (user.name || "?").charAt(0).toUpperCase();
  const color = stringToColor(user.name);
  const avBg = user.picture ? "transparent" : color;
  const avInner = user.picture
    ? '<img src="' +
      escHtml(user.picture) +
      '" alt="' +
      initial +
      '" loading="lazy" ' +
      'onerror="this.parentElement.style.background=' +
      color +
      ";this.parentElement.innerHTML=" +
      initial +
      '"/>'
    : initial;
  return (
    '<div class="sug-card" data-user-id="' +
    user.id +
    '">' +
    '<div class="sug-av" style="background:' +
    avBg +
    '" onclick="viewProfile(' +
    user.id +
    ')" title="View profile">' +
    avInner +
    "</div>" +
    '<div class="sug-name" onclick="viewProfile(' +
    user.id +
    ')" title="' +
    escHtml(user.name) +
    '">' +
    escHtml(user.name) +
    "</div>" +
    '<div class="sug-score">' +
    user.score +
    " interaction" +
    (user.score == 1 ? "" : "s") +
    "</div>" +
    '<button class="sug-follow-btn follow" onclick="event.stopPropagation();sugFollow(' +
    user.id +
    ',this)">Follow</button>' +
    "</div>"
  );
}

async function sugFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow people.");
    goTo("login");
    return;
  }
  const following = btn.classList.contains("unfollow");
  btn.disabled = true;
  try {
    if (following) {
      await api("DELETE", "/api/unfollow/" + userId);
      _followingSet.delete(userId);
      btn.classList.replace("unfollow", "follow");
      btn.textContent = "Follow";
      showToast("Unfollowed.");
    } else {
      await api("POST", "/api/follow/" + userId);
      _followingSet.add(userId);
      btn.classList.replace("follow", "unfollow");
      btn.textContent = "Following";
      showToast("Following! Refreshing feed...");
      setTimeout(() => {
        const card = btn.closest(".sug-card");
        if (card) {
          card.style.cssText +=
            ";transition:opacity .3s,transform .3s;opacity:0;transform:scale(.9)";
          setTimeout(() => {
            card.remove();
            if (!document.querySelectorAll(".sug-card").length)
              loadSuggestions(true);
          }, 300);
        }
      }, 900);
      setTimeout(() => {
        feedPage = 1;
        feedHasMore = true;
        loadPosts();
      }, 1200);
    }
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function toggleFollow(targetId, btn) {
  if (!currentUser) {
    showToast("Log in to follow people.");
    goTo("login");
    return;
  }
  const isFollowing = btn.dataset.following === "true";
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    if (isFollowing) {
      await api("DELETE", `/api/unfollow/${targetId}`);
      _followingSet.delete(targetId);
      btn.dataset.following = "false";
      btn.textContent = "Follow";
      btn.classList.remove("btn-outline", "unfollow");
      btn.classList.add("btn-primary", "follow");
      showToast("Unfollowed.");
    } else {
      await api("POST", `/api/follow/${targetId}`);
      _followingSet.add(targetId);
      btn.dataset.following = "true";
      btn.textContent = "Following";
      btn.classList.remove("btn-primary", "follow");
      btn.classList.add("btn-outline", "unfollow");
      showToast("Following! 🎉");
    }
    const pv = document.getElementById("view-profile");
    if (pv && pv.classList.contains("active"))
      renderProfile(targetId === currentUser.id ? null : targetId);
  } catch (e) {
    btn.textContent = orig;
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

/* SEARCH */
// ── Search state ─────────────────────────────────────────────────────
let searchTab = "posts";
let searchTimer = null; // debounce timer handle
let _searchAbort = null; // AbortController for in-flight request
let _searchPage = 1; // current pagination page
let _searchHasMore = false; // whether more pages exist
let _searchLastQ = ""; // last executed query (for load-more)

// LRU-style cache: key = "q|type|page" → response data array
// Capped at 60 entries so it never grows unbounded.
const _searchCache = new Map();
const SEARCH_CACHE_MAX = 60;
function _cacheGet(key) {
  return _searchCache.get(key) ?? null;
}
function _cacheSet(key, val) {
  if (_searchCache.size >= SEARCH_CACHE_MAX) {
    // Evict the oldest entry
    _searchCache.delete(_searchCache.keys().next().value);
  }
  _searchCache.set(key, val);
}

function switchSearchTab(tab) {
  searchTab = tab;
  document
    .getElementById("stab-posts")
    .classList.toggle("active", tab === "posts");
  document
    .getElementById("stab-people")
    .classList.toggle("active", tab === "people");
  const q = document.getElementById("search-input").value.trim();
  _searchPage = 1;
  if (q.length >= 2) {
    // Sync URL: /search?q=...&type=...
    const url = _viewToPath("search", { q, type: tab });
    history.replaceState({ view: "search", q, type: tab }, "", url);
    _updateMeta(
      _routes.find((r) => r.view === "search"),
      {},
      { q, type: tab },
    );
    runSearch(q);
  } else {
    renderSearchHint();
  }
}

function onSearchInput() {
  // Cancel any pending debounce and abort in-flight request
  clearTimeout(searchTimer);
  _searchAbort?.abort();
  _searchAbort = null;

  const q = document.getElementById("search-input").value.trim();
  const stSection = document.getElementById("search-trending-section");
  if (q.length < 2) {
    if (stSection) stSection.style.display = "block";
    // Clear query param from URL when input is cleared
    history.replaceState({ view: "search" }, "", "/search");
    document.title = "Search · Circle";
    renderSearchHint();
    return;
  }
  if (stSection) stSection.style.display = "none";
  // Debounce: wait 300 ms after the user stops typing
  searchTimer = setTimeout(function () {
    _searchPage = 1;
    // Sync URL with the search query
    const url = _viewToPath("search", { q, type: searchTab });
    history.replaceState({ view: "search", q, type: searchTab }, "", url);
    _updateMeta(
      _routes.find((r) => r.view === "search"),
      {},
      { q, type: searchTab },
    );
    runSearch(q);
  }, 300);
}

function renderSearchHint() {
  document.getElementById("search-results").innerHTML =
    `<div class="search-hint"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Type to search ${searchTab === "posts" ? "posts" : "people"}</p></div>`;
}

function _skelPost() {
  return `<div class="search-skel-post">
          <div class="search-skel-post-head">
            <div class="search-skel-av"></div>
            <div class="search-skel-meta">
              <div class="search-skel-line w-40"></div>
              <div class="search-skel-line w-60"></div>
            </div>
          </div>
          <div class="search-skel-meta" style="gap:7px">
            <div class="search-skel-line w-90"></div>
            <div class="search-skel-line w-80"></div>
            <div class="search-skel-line w-55"></div>
          </div>
        </div>`;
}
function _skelPerson() {
  return `<div class="search-skel-person">
          <div class="search-skel-av" style="width:42px;height:42px"></div>
          <div class="search-skel-person-info">
            <div class="search-skel-line w-40"></div>
            <div class="search-skel-line w-60"></div>
          </div>
          <div class="search-skel-btn"></div>
        </div>`;
}

async function runSearch(q, loadMore = false) {
  if (!currentUser) {
    showToast("Log in to search.");
    goTo("login");
    return;
  }

  const box = document.getElementById("search-results");
  const page = loadMore ? _searchPage : 1;
  const cacheKey = `${q}|${searchTab}|${page}`;

  // ── Cache hit: paint instantly, no network needed ──
  const cached = _cacheGet(cacheKey);
  if (cached) {
    if (loadMore) {
      await _appendSearchResults(cached.data, q);
    } else {
      await renderSearchResults(cached.data, q);
    }
    _searchHasMore = cached.hasMore;
    _searchLastQ = q;
    _renderLoadMore(q);
    return;
  }

  // ── Show skeletons only on fresh (non-load-more) searches ──
  if (!loadMore) {
    box.innerHTML =
      searchTab === "posts"
        ? [0, 1, 2, 3].map(_skelPost).join("")
        : [0, 1, 2, 3, 4].map(_skelPerson).join("");
  } else {
    // Append a mini skeleton strip below existing results
    const strip = document.createElement("div");
    strip.id = "search-load-more-skel";
    strip.innerHTML =
      searchTab === "posts"
        ? [0, 1].map(_skelPost).join("")
        : [0, 1].map(_skelPerson).join("");
    box.appendChild(strip);
  }

  // ── Abort any previous in-flight request ──
  _searchAbort?.abort();
  _searchAbort = new AbortController();

  try {
    const res = await api(
      "GET",
      `/api/search?q=${encodeURIComponent(q)}&type=${searchTab}&page=${page}&limit=20`,
      null,
      _searchAbort.signal,
    );

    // Remove load-more skeleton if present
    document.getElementById("search-load-more-skel")?.remove();

    const resultData = res.data ?? [];
    const hasMore = res.meta?.hasMore ?? resultData.length === 20;

    // For people results, hydrate follow status from the local _followingSet
    // (same source the profile tab uses) — avoids N extra API calls
    if (searchTab === "people" && currentUser && resultData.length) {
      resultData.forEach((user) => {
        // Prefer server-returned isFollowing if present, otherwise use local set
        if (typeof user.isFollowing !== "boolean") {
          user.isFollowing = _followingSet.has(user.id);
        } else {
          // Sync local set to match server truth
          if (user.isFollowing) _followingSet.add(user.id);
          else _followingSet.delete(user.id);
        }
      });
    }

    // Cache the result
    _cacheSet(cacheKey, { data: resultData, hasMore });
    _searchHasMore = hasMore;
    _searchLastQ = q;

    if (loadMore) {
      await _appendSearchResults(resultData, q);
    } else {
      await renderSearchResults(resultData, q);
    }
    _renderLoadMore(q);
  } catch (e) {
    document.getElementById("search-load-more-skel")?.remove();
    if (e.name === "AbortError") return; // request was superseded — do nothing
    box.innerHTML = `<div class="search-hint"><p style="color:var(--rose)">Error: ${escHtml(e.message)}</p></div>`;
  }
}

function _renderLoadMore(q) {
  // Remove any existing load-more button
  document.getElementById("search-load-more-btn")?.remove();
  if (!_searchHasMore) return;
  const box = document.getElementById("search-results");
  const btn = document.createElement("button");
  btn.id = "search-load-more-btn";
  btn.className = "btn btn-ghost";
  btn.style.cssText = "width:100%;margin-top:16px;";
  btn.textContent = "Load more";
  btn.onclick = () => {
    _searchPage++;
    btn.remove();
    runSearch(q, true);
  };
  box.appendChild(btn);
}

async function _appendSearchResults(data, q) {
  if (!data || !data.length) return;
  const box = document.getElementById("search-results");
  // Remove the load-more button before appending so new items go above it
  document.getElementById("search-load-more-btn")?.remove();
  const frag = document.createElement("div");
  if (searchTab === "posts") {
    await _hydratePostResults(data);
    frag.innerHTML = data.map((post) => buildPostCard(post, false)).join("");
  } else {
    frag.innerHTML = _buildPeopleCards(data, q);
  }
  box.appendChild(frag);
  _initPostCardLinkPreviews();
}

function highlight(text, q) {
  if (!text) return "";
  const safe = escHtml(text);
  const safeQ = escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(
    new RegExp(`(${safeQ})`, "gi"),
    '<mark class="hl">$1</mark>',
  );
}

async function _hydratePostResults(data) {
  await Promise.all(
    data.map(async (post) => {
      const cached =
        PostCache.getPost(post.id) || posts.find((p) => p.id === post.id);
      if (!cached) {
        try {
          const r = await api("GET", `/api/posts/${post.id}`);
          const full = r.data || r;
          full.likes = Array.isArray(full.likes) ? full.likes : [];
          full.reposts = Array.isArray(full.reposts) ? full.reposts : [];
          full.comments = Array.isArray(full.comments) ? full.comments : [];
          PostCache.putPost(full);
          posts.unshift(full);
          Object.assign(post, full);
        } catch (_) {}
      } else {
        post.likes = cached.likes;
        post.reposts = cached.reposts;
        post.comments = cached.comments;
      }
      post.likes = Array.isArray(post.likes) ? post.likes : [];
      post.reposts = Array.isArray(post.reposts) ? post.reposts : [];
      post.comments = Array.isArray(post.comments) ? post.comments : [];
      PostCache.putPost(post);
      if (!posts.find((p) => p.id === post.id)) posts.unshift(post);
    }),
  );
}

function _buildPeopleCards(data, q) {
  return data
    .map((user) => {
      const color = stringToColor(user.name || "");
      const nameInitial = (user.name || "?").charAt(0);
      const avHtml = user.picture
        ? `<img src="${user.picture}" alt="${escHtml(nameInitial)}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
        : escHtml(nameInitial);
      const isOwnProfile = currentUser && currentUser.id === user.id;
      const followBtnHtml =
        !isOwnProfile && currentUser
          ? `<button class="btn ${user.isFollowing ? "btn-outline" : "btn-primary"}" style="font-size:13px;padding:8px 20px" data-following="${user.isFollowing ? "true" : "false"}" onclick="event.stopPropagation();searchFollow(${user.id},this)">${user.isFollowing ? "Following" : "Follow"}</button>`
          : "";
      return `<div class="people-card" onclick="viewProfile(${user.id})" style="cursor:pointer">
      <div class="av" style="background:${user.picture ? "transparent" : color}">${avHtml}</div>
      <div class="people-card-info">
        <div class="people-card-name">${highlight(user.name, q)}</div>
        <div class="people-card-email">${highlight(user.email, q)}</div>
        <div class="people-card-posts">${user.postCount || 0} post${user.postCount === 1 ? "" : "s"} · ${user.followerCount || 0} followers</div>
      </div>
      ${followBtnHtml}
    </div>`;
    })
    .join("");
}

async function renderSearchResults(data, q) {
  const box = document.getElementById("search-results");
  if (!data || !data.length) {
    box.innerHTML = `<div class="search-hint"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No ${searchTab} found for "<strong>${escHtml(q)}</strong>"</p></div>`;
    return;
  }
  if (searchTab === "posts") {
    await _hydratePostResults(data);
    box.innerHTML = data.map((post) => buildPostCard(post, false)).join("");
    _initPostCardLinkPreviews();
  } else {
    box.innerHTML = _buildPeopleCards(data, q);
  }
}

async function searchFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  const isFollowing = btn.dataset.following === "true";
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    if (isFollowing) {
      await api("DELETE", "/api/unfollow/" + userId);
      _followingSet.delete(userId);
      btn.dataset.following = "false";
      btn.textContent = "Follow";
      btn.classList.remove("btn-outline");
      btn.classList.add("btn-primary");
      showToast("Unfollowed.");
    } else {
      await api("POST", "/api/follow/" + userId);
      _followingSet.add(userId);
      btn.dataset.following = "true";
      btn.textContent = "Following";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
      showToast("Following! 🎉");
    }
    // Invalidate cached people search results so re-searches reflect new status
    for (const key of _searchCache.keys()) {
      if (key.includes("|people|")) _searchCache.delete(key);
    }
  } catch (e) {
    btn.textContent = orig;
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

/*  NOTIFICATIONS */
let notifPollTimer = null;
let _notifPage = 1;
let _notifHasMore = true;
let _notifLoading = false;
let _notifItems = []; // accumulated list across all pages

const NOTIF_ICONS = {
  like: `<svg fill="currentColor" viewBox="0 0 24 24" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  comment: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  reply: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>`,
  repost: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  follow: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  new_post: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>`,
  live:     `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M6.3 6.3a8 8 0 000 11.4"/><path d="M17.7 6.3a8 8 0 010 11.4"/><path d="M3.5 3.5a13.5 13.5 0 000 17"/><path d="M20.5 3.5a13.5 13.5 0 010 17"/></svg>`,
  profile_pic: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mention: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg>`,
  milestone: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  report_resolved: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`,
  report_ignored:  `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};
const NOTIF_COPY = {
  like: (name) => `<strong>${escHtml(name)}</strong> liked your post`,
  comment: (name) => `<strong>${escHtml(name)}</strong> commented on your post`,
  reply: (name) => `<strong>${escHtml(name)}</strong> replied to your comment`,
  repost: (name) => `<strong>${escHtml(name)}</strong> echoed your post`,
  follow: (name) => `<strong>${escHtml(name)}</strong> started following you`,
  new_post: (name) => `<strong>${escHtml(name)}</strong> published a new post`,
  live:     (name) => `<strong>${escHtml(name)}</strong> just started a live stream`,
  profile_pic: (name) =>
    `<strong>${escHtml(name)}</strong> updated their profile picture`,
  mention: (name) =>
    `<strong>${escHtml(name)}</strong> mentioned you in a post`,
  milestone: (name) => `🎉 <strong>${escHtml(name)}</strong>`,
  report_resolved: () => `<strong>Report resolved</strong>`,
  report_ignored:  () => `<strong>Report reviewed</strong>`,
};

async function fetchNotifications(reset = false) {
  if (!currentUser) return;
  if (_notifLoading) return;
  if (!reset && !_notifHasMore) return;

  if (reset) {
    _notifPage = 1;
    _notifHasMore = true;
    _notifItems = [];
  }

  _notifLoading = true;
  const list = document.getElementById("notif-list");

  // Show skeletons — full panel on first page, mini strip on subsequent
  if (_notifPage === 1) {
    list.innerHTML = _buildNotifSkeletons(5);
  } else {
    const strip = document.createElement("div");
    strip.id = "notif-skel-strip";
    strip.innerHTML = _buildNotifSkeletons(3);
    list.appendChild(strip);
  }

  try {
    const res = await api(
      "GET",
      `/api/notifications/${currentUser.id}?page=${_notifPage}&limit=10`,
    );
    const { notifications, hasMore } = res.data;

    // Remove skeleton strip for page 2+
    const strip = document.getElementById("notif-skel-strip");
    if (strip) strip.remove();

    // Filter by user prefs
    const prefs = JSON.parse(
      localStorage.getItem("circle_notif_prefs") || "{}",
    );
    const PREF_KEY = {
      like: "likes",
      comment: "comments",
      reply: "comments",
      repost: "reposts",
      follow: null,
      new_post: "new_post",
      live:     null,        // always shown — no opt-out
      profile_pic: "profile_pic",
      mention: "mention",
      milestone: "milestone",
    };
    const visible = (notifications || []).filter((n) => {
      const key = PREF_KEY[n.type];
      if (key === null || key === undefined) return true;
      return prefs[key] !== false;
    });

    _notifItems = _notifPage === 1 ? visible : [..._notifItems, ...visible];
    _notifHasMore = hasMore;
    _notifPage++;

    if (_notifPage === 2) {
      // First page — full render
      _renderNotifPage(visible, true);
    } else {
      // Subsequent pages — append only new items
      _renderNotifPage(visible, false);
    }

    updateNotifBadge(_notifItems.filter((n) => !n.isRead).length);
  } catch (e) {
    const strip = document.getElementById("notif-skel-strip");
    if (strip) strip.remove();
    if (_notifPage === 1) {
      list.innerHTML = `<div class="notif-empty"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>Could not load notifications</p></div>`;
    }
  } finally {
    _notifLoading = false;
  }
}

function _buildNotifSkeletons(count) {
  return Array.from({ length: count })
    .map(
      (_, i) => `
          <div class="notif-skel-item" style="animation-delay:${i * 0.1}s">
            <div class="notif-skel-av"></div>
            <div class="notif-skel-body">
              <div class="notif-skel-line w-70"></div>
              <div class="notif-skel-line w-45"></div>
            </div>
            <div class="notif-skel-icon"></div>
          </div>`,
    )
    .join("");
}

function _renderNotifPage(items, isFirstPage) {
  const list = document.getElementById("notif-list");

  if (isFirstPage) {
    if (!_notifItems.length) {
      list.innerHTML = `<div class="notif-empty"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>No notifications yet</p></div>`;
      return;
    }
    list.innerHTML = items.map(_buildNotifItem).join("");
  } else {
    // Remove end-cap if present before appending
    const endCap = document.getElementById("notif-end-cap");
    if (endCap) endCap.remove();
    items.forEach((n) => {
      const el = document.createElement("div");
      el.innerHTML = _buildNotifItem(n);
      list.appendChild(el.firstElementChild);
    });
  }

  // Add or refresh end cap
  const existingCap = document.getElementById("notif-end-cap");
  if (existingCap) existingCap.remove();
  const cap = document.createElement("div");
  cap.id = "notif-end-cap";
  cap.className = _notifHasMore ? "notif-load-more-sentinel" : "notif-end";
  cap.innerHTML = _notifHasMore
    ? `<div class="notif-skel-strip-wrap" id="notif-scroll-trigger"></div>`
    : `<div class="notif-end-text">You're all caught up ✓</div>`;
  list.appendChild(cap);
}

function _buildNotifItem(n) {
  const isSystem = !n.actorId;
  const color = stringToColor(n.actorName || "?");
  const avHtml = isSystem
    ? `🛡️`
    : (n.actorPicture
        ? `<img src="${n.actorPicture}" alt="${escHtml((n.actorName || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
        : escHtml((n.actorName || "?").charAt(0)));
  const avBg = isSystem ? "var(--accent-bg)" : (n.actorPicture ? "transparent" : color);
  const picThumb =
    n.type === "profile_pic" && n.actorPicture
      ? `<img src="${n.actorPicture}" loading="lazy" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);flex-shrink:0" alt="new pic"/>`
      : "";
  const notifText = n.message
    ? escHtml(n.message)
    : (NOTIF_COPY[n.type] || NOTIF_COPY.like)(n.actorName || "Someone");
  return `<div class="notif-item${n.isRead ? "" : " unread"}" onclick="onNotifClick(${n.id}, ${n.postId || "null"}, '${n.type}', ${n.actorId || "null"})">
          <div class="av sm" style="background:${avBg};font-size:${isSystem ? "16px" : ""}">${avHtml}</div>
          <div class="notif-body">
            <div class="notif-text">${notifText}</div>
            ${n.postSnippet ? `<div class="notif-snippet">"${escHtml(n.postSnippet)}"</div>` : ""}
            <div class="notif-time">${formatTime(n.createdAt)}</div>
          </div>
          ${picThumb || `<div class="notif-icon ${n.type}">${NOTIF_ICONS[n.type] || ""}</div>`}
          ${!n.isRead ? '<div class="notif-dot"></div>' : ""}
        </div>`;
}

let _prevNotifCount = null;
async function fetchUnreadCount() {
  if (!currentUser) return;
  try {
    const res = await api(
      "GET",
      `/api/notifications/${currentUser.id}/unread-count`,
    );
    const count = res.data.count;
    if (_prevNotifCount !== null && count > _prevNotifCount) {
      try {
        DM._tonePlay();
      } catch (_) {}
    }
    _prevNotifCount = count;
    updateNotifBadge(count);
  } catch (e) {
    /* silent */
  }
}

function updateNotifBadge(count) {
  const b1 = document.getElementById("topbar-notif-badge");
  const b2 = document.getElementById("snav-notif-badge");
  if (b1) {
    b1.textContent = count > 99 ? "99+" : count > 0 ? count : "";
    b1.classList.toggle("show", count > 0);
  }
  if (b2) {
    b2.textContent = count > 99 ? "99+" : count > 0 ? count : "";
    b2.classList.toggle("show", count > 0);
  }
}

// renderNotifList replaced by _renderNotifPage + _buildNotifItem above

async function onNotifClick(notifId, postId, type, actorId) {
  try {
    await api("PUT", `/api/notifications/${notifId}/read`);
  } catch (e) {
    /* silent */
  }
  closeNotifPanel();

  // System notifications (no actor) — just mark as read, no navigation
  if (type === "report_resolved" || type === "report_ignored") {
    const item = _notifItems.find((n) => n.id === notifId);
    if (item) { item.isRead = true; _renderNotifPage(_notifItems, true); }
    updateNotifBadge(_notifItems.filter((n) => !n.isRead).length);
    return;
  }

  // Smart routing based on notification type
  if (type === "profile_pic" || type === "follow") {
    // Go to the actor's profile
    if (actorId) {
      viewProfile(actorId);
    } else goTo("feed");
  } else if (type === "live" && n.sessionId) {
    // Try to open the live stream; fall back to feed if it has ended
    if (typeof Live !== "undefined") {
      Live.watchSession(n.sessionId).catch(() => goTo("feed"));
    } else {
      goTo("feed");
    }
  } else if (type === "new_post" && postId) {
    // Open the specific post directly
    const post =
      posts.find((p) => p.id === postId) || PostCache.getPost(postId);
    if (post) {
      renderPostDetail(post);
      goTo("post-detail");
    } else {
      goTo("feed");
    }
  } else if (type === "mention" && postId) {
    const post =
      posts.find((p) => p.id === postId) || PostCache.getPost(postId);
    if (post) {
      renderPostDetail(post);
      goTo("post-detail");
    } else {
      goTo("feed");
    }
  } else if (type === "milestone") {
    goTo("profile");
  } else {
    if (postId) {
      // For comment/like/repost/reply notifications, always fetch a fresh
      // copy from the API so the new comment/reaction is visible immediately
      // without requiring a manual refresh.
      const needsFresh =
        type === "comment" ||
        type === "like" ||
        type === "repost" ||
        type === "reply";
      const cached =
        !needsFresh &&
        (posts.find((p) => p.id === postId) || PostCache.getPost(postId));
      if (cached) {
        renderPostDetail(cached);
        goTo("post-detail");
      } else {
        try {
          if (!needsFresh) showToast("Loading post…");
          const res = await api("GET", `/api/posts/${postId}`);
          const found = res.data;
          if (found) {
            PostCache.putPost(found);
            renderPostDetail(found);
            goTo("post-detail");
          } else {
            showToast("Post not found.");
            goTo("feed");
          }
        } catch (e) {
          showToast("Could not load post.");
          goTo("feed");
        }
      }
    } else {
      goTo("feed");
    }
  }
  fetchNotifications(true);
}

async function markAllRead() {
  if (!currentUser) return;
  try {
    await api("PUT", `/api/notifications/${currentUser.id}/read-all`);
    // Mark all in-memory items as read and re-render without refetch
    _notifItems.forEach((n) => (n.isRead = true));
    _renderNotifPage(_notifItems, true);
    updateNotifBadge(0);
  } catch (e) {
    // silently ignore — non-critical background action
  }
}

function openNotifPanel() {
  if (!currentUser) {
    showToast("Log in to see notifications.");
    return;
  }
  // Reset and fetch fresh from page 1 every time panel opens
  fetchNotifications(true);
  document.getElementById("notif-panel").classList.add("open");
  document.getElementById("notif-backdrop").classList.add("open");
  document.body.style.overflow = "hidden";

  // Attach scroll listener for infinite load
  const list = document.getElementById("notif-list");
  list.onscroll = () => {
    if (_notifLoading || !_notifHasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = list;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      fetchNotifications();
    }
  };
}

function closeNotifPanel() {
  document.getElementById("notif-panel").classList.remove("open");
  document.getElementById("notif-backdrop").classList.remove("open");
  document.body.style.overflow = "";
  // Auto-mark all as read when the user dismisses the panel
  markAllRead();
  // Detach scroll listener
  const list = document.getElementById("notif-list");
  if (list) list.onscroll = null;
}

function startNotifPolling() {
  stopNotifPolling();
  fetchUnreadCount();
  notifPollTimer = setInterval(fetchUnreadCount, 30_000);
}
function stopNotifPolling() {
  if (notifPollTimer) {
    clearInterval(notifPollTimer);
    notifPollTimer = null;
  }
}

/* HELPERS */

/*  REPORT POST */
let reportTargetPostId = null;

/* ── Post three-dot menu ─────────────────────────────────── */
function togglePostMenu(e, postId) {
  e.stopPropagation();
  const menu = document.getElementById("post-menu-" + postId);
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  // Close all other open menus
  document.querySelectorAll(".post-dropdown.open").forEach((m) => {
    m.classList.remove("open");
  });
  if (!isOpen) {
    menu.classList.add("open");

    // Dynamically update Follow/Unfollow button — same API the profile tab uses
    if (currentUser) {
      const followBtn = menu.querySelector(".post-menu-follow-btn");
      if (followBtn) {
        const userId = parseInt(followBtn.dataset.userId);
        api("GET", `/api/users/${userId}/profile`)
          .then((res) => {
            const isFollowing = res.data?.isFollowing || false;
            followBtn.dataset.following = isFollowing ? "true" : "false";
            const label = followBtn.querySelector(".post-menu-follow-label");
            const icon = followBtn.querySelector(".post-menu-follow-icon");
            if (label) label.textContent = isFollowing ? "Unfollow" : "Follow";
            if (icon) {
              icon.innerHTML = isFollowing
                ? `<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/>`
                : `<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>`;
            }
          })
          .catch(() => {});
      }
    }
  }
}

function closePostMenu(postId) {
  const menu = document.getElementById("post-menu-" + postId);
  if (menu) menu.classList.remove("open");
}

// Close all dropdowns (post menus + repost menus) on outside click
document.addEventListener("click", () => {
  document.querySelectorAll(".post-dropdown.open").forEach((m) => {
    m.classList.remove("open");
  });
});

function postMenuFollow(userId, postId, btn) {
  closePostMenu(postId);
  if (!currentUser) {
    showToast("Log in to follow people.");
    goTo("login");
    return;
  }
  const isFollowing = btn && btn.dataset.following === "true";
  if (isFollowing) {
    api("DELETE", "/api/unfollow/" + userId)
      .then(() => {
        _followingSet.delete(userId);
        showToast("Unfollowed.");
      })
      .catch((e) => showToast("Error: " + e.message));
  } else {
    api("POST", "/api/follow/" + userId)
      .then(() => {
        _followingSet.add(userId);
        showToast("Following! 🎉");
      })
      .catch((e) => showToast("Error: " + e.message));
  }
}

function postMenuNotInterested(postId) {
  closePostMenu(postId);
  // Remove the post from the feed visually
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (card) {
    card.style.cssText +=
      ";transition:opacity .25s,max-height .35s,margin .35s;opacity:0;max-height:0;overflow:hidden;margin:0;padding:0;border:none";
    setTimeout(() => {
      card.remove();
      posts = posts.filter((p) => p.id !== postId);
    }, 350);
  }
  showToast("Got it — we'll show you less like this.");
}

function postMenuReport(postId) {
  closePostMenu(postId);
  reportPost(postId);
}

function postMenuBlock(userId, postId) {
  closePostMenu(postId);
  if (!currentUser) {
    showToast("Log in to block users.");
    goTo("login");
    return;
  }
  // Remove all posts by this user from the feed
  const cards = document.querySelectorAll(".post-card");
  cards.forEach((card) => {
    const pid = parseInt(card.dataset.postId);
    const post = posts.find((p) => p.id === pid);
    if (post && post.userId === userId) {
      card.style.cssText += ";transition:opacity .25s;opacity:0";
      setTimeout(() => card.remove(), 260);
    }
  });
  posts = posts.filter((p) => p.userId !== userId);
  showToast("User blocked. You won't see their posts anymore.");
}
/* ── End post menu ─────────────────────────────────────────── */

function reportPost(postId) {
  if (!currentUser) {
    showToast("Log in to report posts.");
    goTo("login");
    return;
  }
  reportTargetPostId = postId;
  document.getElementById("report-reason-select").value = "";
  document.getElementById("report-other-field").style.display = "none";
  document.getElementById("report-other-text").value = "";
  document.getElementById("report-modal").classList.add("open");
}

function onReportReasonChange() {
  const val = document.getElementById("report-reason-select").value;
  document.getElementById("report-other-field").style.display =
    val === "Other" ? "block" : "none";
}

function closeReportModal(e) {
  if (e && e.target !== document.getElementById("report-modal")) return;
  document.getElementById("report-modal").classList.remove("open");
  reportTargetPostId = null;
}

async function submitReport() {
  if (!reportTargetPostId) return;
  let reason = document.getElementById("report-reason-select").value;
  if (!reason) {
    showToast("Please select a reason.");
    return;
  }
  if (reason === "Other") {
    const other = document.getElementById("report-other-text").value.trim();
    if (!other || other.length < 5) {
      showToast("Please describe the issue (min 5 chars).");
      return;
    }
    reason = other;
  }
  const btn = document.getElementById("report-submit-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    await api("POST", "/api/admin/reports", {
      postId: reportTargetPostId,
      reason,
    });
    document.getElementById("report-modal").classList.remove("open");
    reportTargetPostId = null;
    showToast("Report submitted. Thank you for keeping Circle safe!");
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Submit Report";
  }
}

/*  SUGGESTED USERS  */
let _suggestionsLoaded = false;
let _feedSugUsers = []; // cached suggestion users for inline card
let _feedSugDismissed = false; // session-only dismiss flag

// ── Build inline feed suggestions card ──────────────────────────
function buildFeedSugCard() {
  if (!_feedSugUsers.length) return "";
  const pills = _feedSugUsers
    .map((user) => {
      const initial = (user.name || "?").charAt(0).toUpperCase();
      const color = stringToColor(user.name);
      const avBg = user.picture ? "transparent" : color;
      const avInner = user.picture
        ? `<img src="${escHtml(user.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
        : initial;
      const score = user.score || 0;
      const reason =
        score === 0
          ? "New to Circle"
          : score === 1
            ? `<strong>1</strong> interaction`
            : `<strong>${score}</strong> interactions`;
      return `<div class="feed-sug-pill">
            <div class="sug-av" style="background:${avBg}" onclick="viewProfile(${user.id})">${avInner}</div>
            <div class="feed-sug-pill-name" onclick="viewProfile(${user.id})" title="${escHtml(user.name)}">${escHtml(user.name)}</div>
            <div class="feed-sug-reason">${reason}</div>
            <button class="feed-sug-pill-btn" onclick="feedSugFollow(${user.id},this)">Follow</button>
          </div>`;
    })
    .join("");

  return `<div class="feed-sug-card" id="feed-sug-inline">
          <div class="feed-sug-header">
            <span class="feed-sug-title">✨ People you may know</span>
            <span class="feed-sug-dismiss" onclick="dismissFeedSug()">✕ Dismiss</span>
          </div>
          <div class="feed-sug-scroll">${pills}</div>
        </div>`;
}

function dismissFeedSug() {
  _feedSugDismissed = true;
  const el = document.getElementById("feed-sug-inline");
  if (el) {
    el.style.cssText +=
      ";transition:opacity .25s,max-height .3s;opacity:0;max-height:0;overflow:hidden;margin:0;padding:0;border:none";
    setTimeout(() => el.remove(), 320);
  }
}

async function feedSugFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following";
    btn.classList.add("following");
    // Remove from inline list after short delay
    const pill = btn.closest(".feed-sug-pill");
    if (pill) {
      pill.style.cssText +=
        ";transition:opacity .3s,transform .3s;opacity:0;transform:scale(.85)";
      setTimeout(() => {
        pill.remove();
        _feedSugUsers = _feedSugUsers.filter((u) => u.id !== userId);
        if (!document.querySelectorAll(".feed-sug-pill").length)
          dismissFeedSug();
      }, 300);
    }
    _followingSet.add(userId);
    showToast("Following!");
    // Re-filter the following tab in memory — no full reload needed
    if (currentFeedTab === "following" && _masterPosts.length > 0) {
      posts = _masterPosts.filter(
        (p) => (currentUser && p.userId === currentUser.id) || _followingSet.has(p.userId)
      );
      renderFeed();
    }
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadSuggestions(force = false) {
  if (!currentUser) return;
  if (_suggestionsLoaded && !force) return;

  try {
    const res = await api(
      "GET",
      "/api/recommendations?userId=" + currentUser.id + "&limit=10",
    );
    _feedSugUsers = res.data || [];
    _suggestionsLoaded = true;

    // If feed is already rendered, inject the card now
    if (!_feedSugDismissed && _feedSugUsers.length) {
      const feedList = document.getElementById("feed-list");
      if (feedList && !document.getElementById("feed-sug-inline")) {
        const postCards = feedList.querySelectorAll(".post-card");
        if (postCards.length >= 5) {
          const cardHtml = buildFeedSugCard();
          const temp = document.createElement("div");
          temp.innerHTML = cardHtml;
          const fifthPost = postCards[4];
          fifthPost.insertAdjacentElement("afterend", temp.firstElementChild);
        }
      }
    }
  } catch (e) {
    showToast("Couldn't load suggestions.");
  }
}

/* ═══════════════════ EXPLORE ═══════════════════════════ */
let _exploreLoaded = false;

// ── Trending state ────────────────────────────────────────────
let _trendingRaw = []; // full unfiltered data from API
let _trendingCategory = "all";
let _trendingSort = "hot";

function loadExplore() {
  // Guests can see trending too — only people-follow requires login
  loadExplorePeople();
  loadExploreTopics();
  loadExploreTrending();
  if (currentUser) loadExploreNewMembers();
}

/* ── Hashtag linkifier ───────────────────────────────────────── */
function linkifyHashtags(html) {
  // html is already escHtml'd
  // 1. Linkify URLs (http/https and protocol-relative //host) — open in new tab
  html = html.replace(
    /(?:https?:\/\/|\/\/)[-a-zA-Z0-9@:%._+~#=]{1,256}(?::[0-9]{1,5})?(?:[\/][-a-zA-Z0-9()@:%_+.~#?&\/=]*)?/g,
    (url) => {
      const href = url.startsWith('//') ? `http:${url}` : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="post-link" onclick="event.stopPropagation()">${url}</a>`;
    }
  );
  // 1b. Linkify bare www. links
  html = html.replace(
    /(?<![\w\/:.])www\.[a-zA-Z0-9-]{1,256}\.[a-zA-Z]{2,}(?::[0-9]{1,5})?(?:[\/][-a-zA-Z0-9()@:%_+.~#?&\/=]*)?/g,
    (url) => `<a href="https://${url}" target="_blank" rel="noopener noreferrer" class="post-link" onclick="event.stopPropagation()">${url}</a>`
  );
  // 2. Linkify @mentions — open profile
  html = html.replace(
    /(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]{1,30})/g,
    (match, username) =>
      `<a class="mention" href="javascript:void(0)" onclick="event.stopPropagation();searchAndViewProfile('${username}')">${match}</a>`
  );
  // 3. Linkify #hashtags
  html = html.replace(
    /(?<!&)#([a-zA-Z][a-zA-Z0-9_]*)/g,
    (match, tag) =>
      `<span class="hashtag" onclick="event.stopPropagation();openTopicFeed('${tag.toLowerCase()}')">${match}</span>`,
  );
  return html;
}

/* ── @mention profile lookup ────────────────────────────── */
async function searchAndViewProfile(username) {
  try {
    const res = await api("GET", `/api/search?q=${encodeURIComponent(username)}&type=people&page=1`);
    const users = res.data || res.users || res || [];
    const match = users.find(u =>
      (u.username || u.name || "").toLowerCase() === username.toLowerCase()
    );
    if (match) {
      viewProfile(match.id);
    } else {
      showToast(`@${username} not found`);
    }
  } catch (e) {
    showToast("Could not load profile");
  }
}

/* ── Topic explore section ───────────────────────────────────── */
async function loadExploreTopics(force = false) {
  const list = document.getElementById("explore-topics-list");
  const btn = document.getElementById("explore-topics-refresh");
  if (!list) return;

  if (btn) {
    btn.classList.add("spinning");
    btn.disabled = true;
  }
  list.innerHTML = `<div class="explore-skeleton-row">${[1, 2, 3, 4, 5].map(() => '<div class="explore-skel-card" style="height:36px;width:100%"></div>').join("")}</div>`;

  try {
    const res = await api("GET", "/api/topics?limit=20");
    const topics = res.data || [];

    if (!topics.length) {
      list.innerHTML = `<div class="explore-trending-empty">No topics yet — start posting with #hashtags!</div>`;
      return;
    }

    const VISIBLE = 10;
    const renderRows = (items, offset = 0) =>
      items
        .map((t, i) => {
          const count =
            t.post_count >= 1000
              ? (t.post_count / 1000).toFixed(1) + "k"
              : t.post_count;
          return `<div class="topic-list-row" onclick="openTopicFeed('${escHtml(t.topic)}')">
              <span class="topic-list-rank">${offset + i + 1}</span>
              <span class="topic-list-name">#${escHtml(t.topic)}</span>
              <span class="topic-list-count">${count} posts</span>
            </div>`;
        })
        .join("");

    if (topics.length <= VISIBLE) {
      list.innerHTML = `<div class="topic-list">${renderRows(topics)}</div>`;
    } else {
      const remaining = topics.slice(VISIBLE);
      list.innerHTML = `
              <div class="topic-list" id="topic-list-inner">
                ${renderRows(topics.slice(0, VISIBLE))}
              </div>
              <div class="topic-extra-drawer" id="topic-extra-drawer">
                <div class="topic-list" style="margin-top:2px">
                  ${renderRows(remaining, VISIBLE)}
                </div>
              </div>
              <button class="topic-show-more" id="topic-show-more-btn"
                onclick="toggleTopicDrawer(${remaining.length})">
                <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                Show ${remaining.length} more topics
              </button>`;
    }
  } catch (e) {
    list.innerHTML = `<div class="explore-trending-empty" style="color:var(--rose)">Could not load topics.</div>`;
  } finally {
    if (btn) {
      btn.classList.remove("spinning");
      btn.disabled = false;
    }
  }
}

function toggleTopicDrawer(count) {
  const drawer = document.getElementById("topic-extra-drawer");
  const btn = document.getElementById("topic-show-more-btn");
  if (!drawer || !btn) return;
  const isOpen = drawer.classList.toggle("open");
  btn.classList.toggle("open", isOpen);
  const svg = btn.querySelector("svg").outerHTML;
  btn.innerHTML = svg + (isOpen ? ` Show less` : ` Show ${count} more topics`);
  // re-bind click since innerHTML replaced it
  btn.onclick = () => toggleTopicDrawer(count);
}

/* ── Topic feed view ─────────────────────────────────────────── */
let _topicFeedCurrent = null;
let _topicFeedPage = 1;
let _topicFeedMore = true;
let _topicFeedLoading = false;

async function openTopicFeed(topic) {
  _topicFeedCurrent = topic;
  _topicFeedPage = 1;
  _topicFeedMore = true;
  _topicFeedLoading = false;

  // Passively register interest — silent, score uses GREATEST so won't overwrite higher
  if (currentUser) {
    api("POST", `/api/topics/${encodeURIComponent(topic)}/follow`).catch(
      () => {},
    );
  }

  document.getElementById("topic-view-title").textContent = `#${topic}`;
  document.getElementById("topic-view-subtitle").textContent =
    `Posts tagged with #${topic}`;
  document.getElementById("topic-feed-list").innerHTML = "";

  goTo("topic");
  await _loadTopicFeedPage(true);
}

async function _loadTopicFeedPage(isFirst = false) {
  if (_topicFeedLoading || !_topicFeedMore) return;
  _topicFeedLoading = true;

  const list = document.getElementById("topic-feed-list");
  const loader = document.getElementById("topic-feed-loader");
  if (loader) loader.style.display = "block";

  if (isFirst) {
    list.innerHTML =
      '<div class="explore-post-skeleton"></div><div class="explore-post-skeleton"></div><div class="explore-post-skeleton"></div>';
  }

  try {
    const res = await api(
      "GET",
      `/api/topics/${_topicFeedCurrent}/posts?page=${_topicFeedPage}`,
    );
    const { posts: newPosts, hasMore } = res.data;

    if (isFirst) list.innerHTML = "";

    if (!newPosts.length && isFirst) {
      list.innerHTML = `<div class="explore-trending-empty">No posts for #${escHtml(_topicFeedCurrent)} yet.</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    newPosts.forEach((p) => {
      const d = document.createElement("div");
      d.innerHTML = buildPostCard(p);
      frag.appendChild(d.firstElementChild);
    });
    list.appendChild(frag);

    _topicFeedMore = hasMore;
    _topicFeedPage++;
  } catch (e) {
    if (isFirst)
      list.innerHTML = `<div class="explore-trending-empty" style="color:var(--rose)">Could not load posts.</div>`;
  } finally {
    _topicFeedLoading = false;
    if (loader) loader.style.display = "none";
  }
}

// Infinite scroll for topic feed
window.addEventListener(
  "scroll",
  () => {
    const v = document.getElementById("view-topic");
    if (!v || !v.classList.contains("active")) return;
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 300
    ) {
      _loadTopicFeedPage();
    }
  },
  { passive: true },
);

async function loadExplorePeople(force = false) {
  const list = document.getElementById("explore-people-list");
  const btn = document.getElementById("explore-people-refresh");
  if (!list) return;

  // Hide people section for guests; show a login nudge instead
  if (!currentUser) {
    list.innerHTML = `<div class="explore-trending-empty">
            <button class="link" onclick="goTo('login')">Log in</button> to see people you may know.
          </div>`;
    return;
  }

  if (btn) {
    btn.classList.add("spinning");
    btn.disabled = true;
  }
  list.innerHTML = `<div class="explore-skeleton-row">${[1, 2, 3, 4].map(() => '<div class="explore-skel-card"></div>').join("")}</div>`;

  try {
    const res = await api(
      "GET",
      `/api/recommendations?userId=${currentUser.id}&limit=12`,
    );
    const users = res.data || [];

    if (!users.length) {
      list.innerHTML = `<div class="explore-trending-empty">No suggestions right now. Interact with posts to get recommendations!</div>`;
      return;
    }

    list.innerHTML = `<div class="explore-people-scroll">${users.map((u) => buildExplorePersonCard(u)).join("")}</div>`;
  } catch (e) {
    list.innerHTML = `<div class="explore-trending-empty" style="color:var(--rose)">Could not load suggestions.</div>`;
  } finally {
    if (btn) {
      btn.classList.remove("spinning");
      btn.disabled = false;
    }
  }
}

function buildExplorePersonCard(user) {
  const initial = (user.name || "?").charAt(0).toUpperCase();
  const color = stringToColor(user.name);
  const avBg = user.picture ? "transparent" : color;
  const avInner = user.picture
    ? `<img src="${escHtml(user.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
    : initial;
  const score = user.score || 0;
  const meta =
    score > 0 ? `${score} interaction${score === 1 ? "" : "s"}` : "New member";
  return `<div class="explore-person-card" onclick="viewProfile(${user.id})">
          <div class="explore-person-av" style="background:${avBg}">${avInner}</div>
          <div class="explore-person-name" title="${escHtml(user.name)}">${escHtml(user.name)}</div>
          <div class="explore-person-meta">${meta}</div>
          <button class="explore-person-follow" onclick="event.stopPropagation();exploreFollow(${user.id},this)">Follow</button>
        </div>`;
}

async function exploreFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following";
    btn.classList.add("following");
    _followingSet.add(userId);
    showToast("Following!");
    // Re-filter the following tab in memory — no full reload needed
    if (currentFeedTab === "following" && _masterPosts.length > 0) {
      posts = _masterPosts.filter(
        (p) => (currentUser && p.userId === currentUser.id) || _followingSet.has(p.userId)
      );
      renderFeed();
    }
  } catch (e) {
    showToast("Error: " + e.message);
    btn.disabled = false;
  }
}

// ── Router: set active category ───────────────────────────────
function setTrendingCategory(category, btn) {
  _trendingCategory = category;
  document
    .querySelectorAll(".trending-route-btn")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderTrendingList();
}

// ── Controller: set active sort ───────────────────────────────
function setTrendingSort(sort, btn) {
  _trendingSort = sort;
  document
    .querySelectorAll(".trending-sort-btn")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderTrendingList();
}

// ── Filter + sort the cached raw data and render ──────────────
function renderTrendingList() {
  const list = document.getElementById("explore-trending-list");
  if (!list) return;

  let items = [..._trendingRaw];

  // ── Router filter ──
  switch (_trendingCategory) {
    case "popular":
      items = items.filter((p) => (p.likes?.length || 0) > 0);
      break;
    case "discussed":
      items = items.filter((p) => (p.comments?.length || 0) > 0);
      break;
    case "shared":
      items = items.filter((p) => (p.reposts?.length || 0) > 0);
      break;
    case "media":
      items = items.filter((p) => !!p.image);
      break;
    // "all" → no filter
  }

  // ── Controller sort ──
  switch (_trendingSort) {
    case "hot":
      // Engagement score weighted by recency
      items.sort((a, b) => {
        const engA =
          (a.likes?.length || 0) * 3 +
          (a.comments?.length || 0) * 2 +
          (a.reposts?.length || 0) * 2;
        const engB =
          (b.likes?.length || 0) * 3 +
          (b.comments?.length || 0) * 2 +
          (b.reposts?.length || 0) * 2;
        const ageA = Date.now() - new Date(a.createdAt);
        const ageB = Date.now() - new Date(b.createdAt);
        // Decay: divide by hours since post
        const scoreA = engA / (1 + ageA / 3600000);
        const scoreB = engB / (1 + ageB / 3600000);
        return scoreB - scoreA;
      });
      break;
    case "newest":
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case "top":
      items.sort((a, b) => {
        const eA =
          (a.likes?.length || 0) +
          (a.comments?.length || 0) +
          (a.reposts?.length || 0);
        const eB =
          (b.likes?.length || 0) +
          (b.comments?.length || 0) +
          (b.reposts?.length || 0);
        return eB - eA;
      });
      break;
  }

  // Update count badge
  const badge = document.getElementById("trending-count-badge");
  if (badge)
    badge.textContent = `${items.length} post${items.length !== 1 ? "s" : ""}`;

  if (!items.length) {
    list.innerHTML = `<div class="explore-trending-empty">🔍 No posts match this filter. Try a different category!</div>`;
    return;
  }

  list.innerHTML = items.map((p) => buildPostCard(p, false)).join("");
  _initPostCardLinkPreviews();
}

async function loadExploreTrending(force = false) {
  const list = document.getElementById("explore-trending-list");
  const btn = document.getElementById("explore-trending-refresh");
  if (!list) return;

  if (btn) {
    btn.classList.add("spinning");
    btn.disabled = true;
  }
  list.innerHTML = [1, 2, 3]
    .map(() => `<div class="explore-post-skeleton"></div>`)
    .join("");

  try {
    const res = await api("GET", "/api/explore/trending");
    const trending = res.data || [];

    if (!trending.length) {
      _trendingRaw = [];
      list.innerHTML = `<div class="explore-trending-empty">🔥 No trending posts yet. Check back soon!</div>`;
      const badge = document.getElementById("trending-count-badge");
      if (badge) badge.textContent = "0 posts";
      return;
    }

    // Hydrate posts so engagement works
    trending.forEach((post) => {
      post.likes = Array.isArray(post.likes) ? post.likes : [];
      post.reposts = Array.isArray(post.reposts) ? post.reposts : [];
      post.comments = Array.isArray(post.comments) ? post.comments : [];
      PostCache.putPost(post);
      if (!posts.find((p) => p.id === post.id)) posts.unshift(post);
    });

    // Store raw data and let the controller/router render
    _trendingRaw = trending;
    renderTrendingList();
  } catch (e) {
    list.innerHTML = `<div class="explore-trending-empty" style="color:var(--rose)">Could not load trending posts.</div>`;
  } finally {
    if (btn) {
      btn.classList.remove("spinning");
      btn.disabled = false;
    }
  }
}
/* ═══════════════════ END EXPLORE ════════════════════════ */

/* ═══════════════════ NEW MEMBERS ═══════════════════════ */
const FEED_NEW_LIMIT = 3; // max cards shown in feed
let _newMembers = [];
let _newMembersLoaded = false;
let _feedNewDismissed = !!localStorage.getItem("circle_new_dismissed");
let _feedNewIndex = 0;
// Track per-user dismissals so each card is independently dismissable
let _dismissedNewIds = new Set(
  JSON.parse(localStorage.getItem("circle_new_dismissed_ids") || "[]"),
);

function _joinedAgo(dateStr) {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86400000,
  );
  if (diff === 0) return "Joined today";
  if (diff === 1) return "Joined yesterday";
  return `Joined ${diff} days ago`;
}

function _saveDismissed() {
  localStorage.setItem(
    "circle_new_dismissed_ids",
    JSON.stringify([..._dismissedNewIds]),
  );
}

async function loadNewMembers(force = false) {
  if (!currentUser) return;
  if (_newMembersLoaded && !force) return;
  try {
    const res = await api("GET", "/api/users/new-members?limit=20");
    _newMembers = (res.data || []).filter((u) => {
      if (u.id === currentUser.id) return false;
      const days = Math.floor(
        (Date.now() - new Date(u.createdAt).getTime()) / 86400000,
      );
      return days <= 3;
    });
    _newMembersLoaded = true;
    _injectFeedNewCards();
    loadExploreNewMembers();
  } catch (e) {
    showToast("Couldn't load new members.");
  }
}

function _visibleNewMembers() {
  // Members not yet dismissed, capped at limit
  return _newMembers
    .filter((u) => !_dismissedNewIds.has(u.id))
    .slice(0, FEED_NEW_LIMIT);
}

function _injectFeedNewCards() {
  const feedList = document.getElementById("feed-list");
  if (!feedList) return;
  // Remove any existing new-member cards before re-injecting
  feedList.querySelectorAll(".feed-new-card").forEach((el) => el.remove());
  const toShow = _visibleNewMembers();
  if (!toShow.length) return;
  const postCards = feedList.querySelectorAll(".post-card");
  // Inject all cards after the 3rd post (or last post if fewer)
  const anchor = postCards[Math.min(2, postCards.length - 1)];
  if (!anchor) return;
  // Insert in reverse so order is preserved after afterend insertions
  // Then stagger the fade-in so cards appear one by one
  [...toShow].reverse().forEach((u) => {
    const temp = document.createElement("div");
    temp.innerHTML = buildFeedNewCard(u);
    anchor.insertAdjacentElement("afterend", temp.firstElementChild);
  });
  // Stagger visibility: each card fades in 150ms after the previous
  document.querySelectorAll(".feed-new-card").forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), 120 + i * 180);
  });
}

function buildFeedNewCard(u) {
  const initial = (u.name || "?").charAt(0).toUpperCase();
  const color = stringToColor(u.name || "");
  const avBg = u.picture ? "transparent" : color;
  const avInner = u.picture
    ? `<img src="${escHtml(u.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
    : initial;
  const bioHtml = u.bio
    ? `<div class="feed-new-bio">${escHtml(u.bio)}</div>`
    : "";

  return `<div class="feed-new-card" id="feed-new-${u.id}" data-uid="${u.id}">
          <div class="feed-new-banner">
            <span class="feed-new-banner-label">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              New to Circle
            </span>
            <span class="feed-new-dismiss" onclick="dismissFeedNew(${u.id})">✕</span>
          </div>
          <div class="feed-new-row" onclick="viewProfile(${u.id})">
            <div class="av" style="background:${avBg};width:46px;height:46px;font-size:18px;flex-shrink:0">${avInner}</div>
            <div class="feed-new-info">
              <div class="feed-new-name">${escHtml(u.name || "New member")}</div>
              <div class="feed-new-joined">${_joinedAgo(u.createdAt)}</div>
              ${bioHtml}
            </div>
            <button class="feed-new-follow-btn" onclick="event.stopPropagation();feedNewFollow(${u.id},this)">Follow 👋</button>
          </div>
        </div>`;
}

function dismissFeedNew(userId) {
  _dismissedNewIds.add(userId);
  _saveDismissed();
  const el = document.getElementById("feed-new-" + userId);
  if (el) {
    el.style.transition = "opacity .22s, max-height .3s";
    el.style.opacity = "0";
    el.style.maxHeight = el.offsetHeight + "px";
    requestAnimationFrame(() => {
      el.style.maxHeight = "0";
      el.style.marginBottom = "0";
      el.style.overflow = "hidden";
    });
    setTimeout(() => el.remove(), 320);
  }
}

async function feedNewFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following ✓";
    btn.classList.add("following");
    showToast("You're now following them! 🎉");
    // Auto-dismiss card after a short delay
    setTimeout(() => dismissFeedNew(userId), 800);
  } catch (e) {
    showToast("Error: " + e.message);
    btn.disabled = false;
  }
}

async function loadExploreNewMembers(force = false) {
  const section = document.getElementById("explore-new-section");
  const list = document.getElementById("explore-new-list");
  const btn = document.getElementById("explore-new-refresh");
  if (!section || !list) return;

  if (btn) {
    btn.classList.add("spinning");
    btn.disabled = true;
  }

  try {
    let members = _newMembers;
    if (!_newMembersLoaded || force) {
      const res = await api("GET", "/api/users/new-members?limit=20");
      members = (res.data || []).filter((u) => {
        if (u.id !== currentUser?.id) return false;
        const days = Math.floor(
          (Date.now() - new Date(u.createdAt).getTime()) / 86400000,
        );
        return days <= 3;
      });
      _newMembers = members;
      _newMembersLoaded = true;
    }

    if (!members.length) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    list.innerHTML = `<div class="explore-people-scroll">${members
      .map((u) => {
        const initial = (u.name || "?").charAt(0).toUpperCase();
        const color = stringToColor(u.name || "");
        const avBg = u.picture ? "transparent" : color;
        const avInner = u.picture
          ? `<img src="${escHtml(u.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
          : initial;
        return `<div class="explore-person-card" onclick="viewProfile(${u.id})" style="border-color:var(--green);position:relative">
              <span style="position:absolute;top:-7px;right:-7px;background:var(--green);color:#fff;font-size:9px;font-weight:800;padding:2px 5px;border-radius:20px;text-transform:uppercase">NEW</span>
              <div class="explore-person-av" style="background:${avBg}">${avInner}</div>
              <div class="explore-person-name" title="${escHtml(u.name || "")}">${escHtml(u.name || "")}</div>
              <div class="explore-person-meta" style="color:var(--green)">${_joinedAgo(u.createdAt)}</div>
              <button class="explore-person-follow" onclick="event.stopPropagation();exploreNewFollow(${u.id},this)" style="background:var(--green);border-color:var(--green)">Follow</button>
            </div>`;
      })
      .join("")}</div>`;
  } catch (e) {
    if (section) section.style.display = "none";
  } finally {
    if (btn) {
      btn.classList.remove("spinning");
      btn.disabled = false;
    }
  }
}

async function exploreNewFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following ✓";
    btn.style.opacity = "0.7";
    showToast("You're now following them! 🎉");
    _newMembers = _newMembers.filter((u) => u.id !== userId);
  } catch (e) {
    showToast("Error: " + e.message);
    btn.disabled = false;
  }
}
/* ═══════════════════ END NEW MEMBERS ════════════════════ */

// Resolves a stored media URL or relative path to a full URL using the
// current window origin. Handles three cases:
//  1. Already a full URL with a private LAN IP → rewrite to current origin
//  2. Relative path like /uploads/foo.webp    → prefix with current origin
//  3. Any other full URL                       → leave untouched
function resolveMediaUrl(url) {
  if (!url) return url;
  // Relative path like /uploads/foo.webp — point to the API server, not Live Server
  if (url.startsWith("/")) return API + url;
  try {
    const u = new URL(url);
    const apiHost = new URL(API).host; // e.g. "127.0.0.1:5000"
    // Already pointing at the right place — leave it alone
    if (u.host === apiHost) return url;
    // Rewrite localhost/127.0.0.1 on any port (catches Live Server at :5500, etc.)
    const isLocal = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    // Rewrite private/LAN IPs too
    const isLAN = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      u.hostname,
    );
    if (isLocal || isLAN) {
      return API + u.pathname + u.search;
    }
  } catch {}
  return url;
}

// Patch all media fields on a post object in-place so every render path
// (buildPostCard, renderPostDetail, lightbox, etc.) gets clean URLs.
function resolvePostMedia(post) {
  if (!post) return post;
  post.image = resolveMediaUrl(post.image);
  post.video = resolveMediaUrl(post.video);
  post.authorPicture = resolveMediaUrl(post.authorPicture);
  if (post.originalPost) {
    post.originalPost.image = resolveMediaUrl(post.originalPost.image);
    post.originalPost.video = resolveMediaUrl(post.originalPost.video);
    post.originalPost.authorPicture = resolveMediaUrl(
      post.originalPost.authorPicture,
    );
  }
  return post;
}

function toggleSeeMore(postId, btn) {
  const body = document.getElementById("pb-" + postId);
  if (!body) return;
  const collapsed = body.classList.contains("truncated");
  body.classList.toggle("truncated", !collapsed);
  btn.textContent = collapsed ? "See less" : "See more";
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 2592000) return Math.floor(diff / 86400) + "d ago";
  if (diff < 31536000) return Math.floor(diff / 2592000) + "mo ago";
  return Math.floor(diff / 31536000) + "y ago";
}

function formatFullDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── View count helpers ────────────────────────────────────────
function fmtViews(n) {
  if (!n) return "";
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// Generate or retrieve a stable anonymous fingerprint for guests
function _getFingerprint() {
  let fp = localStorage.getItem("circle_fp");
  if (!fp) {
    fp = "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("circle_fp", fp);
  }
  return fp;
}

// Fire POST /api/posts/:id/view when a card has been visible for ≥1s
function _recordView(postId) {
  /* const body = currentUser
          ? {}
          : { fingerprint: _getFingerprint() };*/

  const body = currentUser
    ? { dwellMs: window._lastDwellMs || null }
    : { fingerprint: _getFingerprint() };

  api("POST", `/api/posts/${postId}/view`, body)
    .then((res) => {
      // Update the count in the DOM without re-rendering the whole card
      const el = document.getElementById(`views-${postId}`);
      if (el) {
        const span = el.querySelector("span");
        if (span) span.textContent = fmtViews(res?.data?.views || 0);
      }
      // Patch the in-memory post object too
      const post = posts.find((p) => p.id === postId);
      if (post && res?.data?.views !== undefined) post.views = res.data.views;
    })
    .catch(() => {
      /* silent — view tracking is best-effort */
    });
}

// IntersectionObserver: fires _recordView after the card has been
// visible for at least 1 second (avoids counting quick scrolls).
(function initViewTracker() {
  const _timers = new Map(); // postId → setTimeout handle

  const _io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        const postId = parseInt(card.dataset.postId);
        if (isNaN(postId)) return;

        if (entry.isIntersecting) {
          if (!_timers.has(postId)) {
            /*const t = setTimeout(() => {
                  _timers.delete(postId);
                  _recordView(postId);
                  _io.unobserve(card); // only count once per card lifetime
                }, 1000);*/
            const enteredAt = Date.now();
            const t = setTimeout(() => {
              _timers.delete(postId);
              window._lastDwellMs = Date.now() - enteredAt;
              _recordView(postId);
              window._lastDwellMs = null;
              _io.observe(card);
            }, 1000);
            _timers.set(postId, t);
          }
        } else {
          const t = _timers.get(postId);
          if (t !== undefined) {
            clearTimeout(t);
            _timers.delete(postId);

            //fast scroll = skip signal

            if (currentUser) {
              api("POST", `/api/posts/${postId}/skip`, {}).catch(() => {});
            }
          }
        }
      });
    },
    { threshold: 0.6 },
  ); // at least 60% of card must be visible

  // Observe newly added post cards via MutationObserver
  const _mo = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains("post-card") && node.dataset.postId) {
          _io.observe(node);
        }
        node
          .querySelectorAll?.(".post-card[data-post-id]")
          .forEach((c) => _io.observe(c));
      });
    });
  });
  _mo.observe(document.body, { childList: true, subtree: true });
})();
function showAlert(el, msg, type) {
  el.textContent = msg;
  el.className = "alert " + type;
}
let _tt;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove("show"), 2800);
}

// ── Offline banner ────────────────────────────────────────
function showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
    </svg>
    You're offline — showing cached posts`;
  document.body.appendChild(banner);
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.remove();
}

window.addEventListener('online',  hideOfflineBanner);
window.addEventListener('offline', showOfflineBanner);

// Show immediately if already offline on load
if (!navigator.onLine) showOfflineBanner();

// Default avatar SVG — shown when user has no profile picture or image fails to load
function defaultAvatar() {
  return `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:60%;height:60%;opacity:0.9">
          <circle cx="18" cy="13" r="7" fill="white" fill-opacity="0.9"/>
          <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" fill="white" fill-opacity="0.9"/>
        </svg>`;
}

function stringToColor(s) {
  const c = [
    "#7c6bff",
    "#ff5f7a",
    "#22d48f",
    "#f5a623",
    "#00b4d8",
    "#e040fb",
    "#26c6da",
    "#ff7043",
  ];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
}

/* ═══════════════════════════════════════════
   LIGHTBOX — moved to lightbox.js
   ═══════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════
         E2E ENCRYPTION  —  ECDH key exchange + AES-GCM per-message
         ═══════════════════════════════════════════════════════════════
         How it works:
           1. On first login each device generates a persistent ECDH key-pair
              (P-256). The PUBLIC key is uploaded to the server so other users
              can fetch it.  The PRIVATE key never leaves localStorage.
           2. When Alice opens a conversation with Bob she fetches Bob's public
              key, derives a shared AES-GCM secret via ECDH, and caches it.
           3. Every outgoing message body is encrypted:
                ciphertext  = AES-GCM-encrypt(sharedKey, plaintext)
                wire format = "e2e:" + base64(iv + ciphertext)
           4. On receipt the same derivation gives the same shared key and the
              message is decrypted before display.
           5. The server only ever stores/sees the "e2e:…" blob — plaintext
              never touches the server.
         ═══════════════════════════════════════════════════════════════ */
const E2E = (() => {
  const STORE_KEY = "circle_e2e_keypair"; // localStorage key
  let _myKeyPair = null; // CryptoKeyPair (this device)
  let _sharedKeys = {}; // { userId: CryptoKey }

  // ── Helpers ─────────────────────────────────────────────
  function _b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function _unb64(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  // ── Generate or load this device's ECDH key-pair ────────
  async function ensureMyKeys() {
    if (_myKeyPair) return _myKeyPair;
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      try {
        const { pub, priv } = JSON.parse(stored);
        const publicKey = await crypto.subtle.importKey(
          "spki",
          _unb64(pub),
          { name: "ECDH", namedCurve: "P-256" },
          true,
          [],
        );
        const privateKey = await crypto.subtle.importKey(
          "pkcs8",
          _unb64(priv),
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveKey"],
        );
        _myKeyPair = { publicKey, privateKey };
        return _myKeyPair;
      } catch (e) {
        /* corrupt — regenerate */
      }
    }
    _myKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"],
    );
    // Persist to localStorage
    const pub = _b64(
      await crypto.subtle.exportKey("spki", _myKeyPair.publicKey),
    );
    const priv = _b64(
      await crypto.subtle.exportKey("pkcs8", _myKeyPair.privateKey),
    );
    localStorage.setItem(STORE_KEY, JSON.stringify({ pub, priv }));
    return _myKeyPair;
  }

  // ── Upload our public key to server ─────────────────────
  // PUT /api/users/:id/publickey  { publicKey: "<b64 spki>" }
  async function publishMyPublicKey() {
    if (!currentUser) return;
    try {
      const kp = await ensureMyKeys();
      const pub = _b64(await crypto.subtle.exportKey("spki", kp.publicKey));
      await api("PUT", `/api/users/${currentUser.id}/publickey`, {
        publicKey: pub,
      });
    } catch (e) {
      /* server may not support yet — silently ignore */
    }
  }

  // ── Fetch a peer's public key from server ───────────────
  // GET /api/users/:id/publickey  → { publicKey: "<b64 spki>" }
  async function _fetchPeerKey(userId) {
    try {
      const res = await api("GET", `/api/users/${userId}/publickey`);
      const b64 = res.data?.publicKey || res.publicKey;
      if (!b64) return null;
      return await crypto.subtle.importKey(
        "spki",
        _unb64(b64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        [],
      );
    } catch (e) {
      return null;
    }
  }

  // ── Derive (or return cached) shared AES-GCM key ────────
  async function _sharedKey(peerUserId) {
    if (_sharedKeys[peerUserId]) return _sharedKeys[peerUserId];
    const kp = await ensureMyKeys();
    const peerPub = await _fetchPeerKey(peerUserId);
    if (!peerPub) return null;
    const key = await crypto.subtle.deriveKey(
      { name: "ECDH", public: peerPub },
      kp.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    _sharedKeys[peerUserId] = key;
    return key;
  }

  // ── Encrypt plaintext → "e2e:<b64(iv+ct)>" ──────────────
  async function encrypt(peerUserId, plaintext) {
    const key = await _sharedKey(peerUserId);
    if (!key) return plaintext; // fall back to plaintext
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    const blob = new Uint8Array(12 + ct.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(ct), 12);
    return "e2e:" + _b64(blob.buffer);
  }

  // ── Decrypt "e2e:…" → plaintext ─────────────────────────
  async function decrypt(peerUserId, body) {
    if (!body || !body.startsWith("e2e:")) return body;
    try {
      const key = await _sharedKey(peerUserId);
      if (!key) return "[🔒 Encrypted — open conversation to decrypt]";
      const blob = _unb64(body.slice(4));
      const iv = blob.slice(0, 12);
      const ct = blob.slice(12);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch (e) {
      return "[🔒 Encrypted message]";
    }
  }

  // ── Clear cached shared keys (e.g. on logout) ───────────
  function clearCache() {
    _sharedKeys = {};
    _myKeyPair = null;
  }

  // ── Check if E2E is active for a peer ────────────────────
  async function isEnabled(peerUserId) {
    const key = await _sharedKey(peerUserId);
    return !!key;
  }

  return {
    ensureMyKeys,
    publishMyPublicKey,
    encrypt,
    decrypt,
    clearCache,
    isEnabled,
  };
})();

/* ═══════════════════════════════════════════════════════════════
         DIRECT MESSAGES  —  localStorage-backed private messaging
         ═══════════════════════════════════════════════════════════════ */
const DM = (() => {
  // State
  let _inbox = []; // rows from GET /api/dm/inbox
  let _activeConvId = null;
  let _activeOther = null;
  let _messages = [];
  let _inboxFilter = "";
  let _polling = null;
  let _sending = false;

  // Pagination state
  let _cursor = null; // id of the oldest loaded message (for load-more)
  let _hasMore = false; // whether older messages exist on the server
  let _latestId = null; // id of the newest loaded message (for polling)
  let _loadingMore = false; // guard against concurrent load-more calls

  // Presence & heartbeat state
  let _heartbeatTimer = null; // interval for POST /api/dm/heartbeat
  let _presenceTimer = null; // interval for GET .../presence
  let _peerOnline = false; // last known peer status

  // Typing indicator state
  let _typingTimeout = null;   // debounce timer for outgoing typing events
  let _isTypingOut   = false;  // are we currently flagged as typing to the server

  // ── Time helpers ────────────────────────────────────────
  function _fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function _fmtDate(ts) {
    const d = new Date(ts),
      now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function _fmtPreviewTime(ts) {
    if (!ts) return "";
    const d = new Date(ts),
      now = new Date();
    return d.toDateString() === now.toDateString()
      ? _fmtTime(ts)
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // ── Load inbox from backend ─────────────────────────────
  // GET /api/dm/inbox
  let _prevInboxSnapshot = {}; // convId -> last_message_at, to detect new messages
  async function _loadInbox() {
    if (!currentUser) return;
    try {
      const res = await api("GET", "/api/dm/inbox");
      const newInbox = Array.isArray(res.data) ? res.data : [];

      // Detect new incoming messages and update badge + play tone
      if (Object.keys(_prevInboxSnapshot).length > 0) {
        let newCount = 0;
        let toneTriggered = false;
        for (const conv of newInbox) {
          const prev = _prevInboxSnapshot[conv.id];
          const isActiveConv = conv.id === _activeConvId;
          const isFromOther = conv.last_sender_id !== currentUser.id;
          const isNewer =
            !prev || conv.last_message_at !== prev.last_message_at;
          if (!isActiveConv && isFromOther && isNewer && conv.last_message_at) {
            newCount++;
            if (!toneTriggered) {
              _msgTone.play();
              toneTriggered = true;
            }
          }
        }
        if (newCount > 0) _refreshBadge(newCount);
      }

      // Update snapshot
      _prevInboxSnapshot = {};
      for (const conv of newInbox) {
        _prevInboxSnapshot[conv.id] = { last_message_at: conv.last_message_at };
      }

      _inbox = newInbox;
      renderInbox();
    } catch (e) {
      _inbox = [];
    }
  }

  // ── Message tone ────────────────────────────────────────
  const _msgTone = (function () {
    const audio = new Audio("message tone.wav");
    return {
      play() {
        try {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } catch (_) {}
      },
    };
  })();

  // ── Polling ─────────────────────────────────────────────
  function _startPolling() {
    _stopPolling();
    _polling = setInterval(async () => {
      if (!currentUser) return;
      await _loadInbox();
      if (_activeConvId) {
        await _pollNewMessages(_activeConvId);
        await _fetchPresence(_activeConvId); // piggyback on 4s cycle for responsive status
      }
    }, 4000);
  }
  function _stopPolling() {
    if (_polling) {
      clearInterval(_polling);
      _polling = null;
    }
  }

  // ── Heartbeat — keep current user's presence alive ───────
  function _startHeartbeat() {
    _stopHeartbeat();
    // Fire immediately, then every 30 s
    _sendHeartbeat();
    _heartbeatTimer = setInterval(_sendHeartbeat, 30_000);
  }
  function _stopHeartbeat() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
  }
  async function _sendHeartbeat() {
    if (!currentUser) return;
    try {
      await api("POST", "/api/dm/heartbeat");
    } catch (_) {}
  }

  // ── Presence polling — update peer status in header ──────
  function _startPresencePolling(convId) {
    _stopPresencePolling();
    _fetchPresence(convId); // immediate
    _presenceTimer = setInterval(() => _fetchPresence(convId), 30_000);
  }
  function _stopPresencePolling() {
    if (_presenceTimer) {
      clearInterval(_presenceTimer);
      _presenceTimer = null;
    }
  }
  async function _fetchPresence(convId) {
    if (!currentUser || !convId) return;
    try {
      const res = await api("GET", `/api/dm/conversations/${convId}/presence`);
      const { online, last_seen_at } = res.data;
      _peerOnline = online;
      _updateStatusEl(online, last_seen_at);
    } catch (_) {}
  }
  function _updateStatusEl(online, lastSeenAt) {
    const el = document.getElementById("dm-chat-status");
    if (!el) return;
    el.style.display = "flex";
    if (online) {
      el.textContent = "Active now";
      el.className = "dm-chat-head-status online";
    } else if (lastSeenAt) {
      const diff = Date.now() - new Date(lastSeenAt).getTime();
      const mins = Math.floor(diff / 60_000);
      const hrs = Math.floor(diff / 3_600_000);
      const days = Math.floor(diff / 86_400_000);
      let label;
      if (mins < 1) label = "Active just now";
      else if (mins < 60) label = `Active ${mins}m ago`;
      else if (hrs < 24) label = `Active ${hrs}h ago`;
      else label = `Active ${days}d ago`;
      el.textContent = label;
      el.className = "dm-chat-head-status";
    } else {
      el.textContent = "Offline";
      el.className = "dm-chat-head-status";
    }
  }

  // ── Render inbox list ───────────────────────────────────
  function renderInbox() {
    const list = document.getElementById("dm-conv-list");
    if (!currentUser) {
      list.innerHTML =
        '<div class="dm-conv-empty"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="36" height="36"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>Log in to use messages</p></div>';
      return;
    }
    const q = _inboxFilter.toLowerCase();
    const convs = _inbox.filter(
      (c) => !q || (c.other_name || "").toLowerCase().includes(q),
    );
    if (!convs.length) {
      list.innerHTML =
        '<div class="dm-conv-empty"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="36" height="36"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>No conversations yet.<br/>Start one!</p></div>';
      return;
    }

    // Render synchronously first; then async-decrypt e2e previews
    const renderConv = (conv, plainPreview) => {
      const unread = conv.unread_count || 0;
      const preview =
        plainPreview !== undefined
          ? plainPreview
          : conv.last_message
            ? (conv.last_sender_id === currentUser.id ? "You: " : "") +
              conv.last_message
            : "No messages yet";
      const timeStr = _fmtPreviewTime(conv.last_message_at);
      const initial = (conv.other_name || "?").charAt(0).toUpperCase();
      const color = stringToColor(conv.other_name || "");
      const avHtml = conv.other_picture
        ? `<div class="av sm" style="background:transparent;overflow:hidden;flex-shrink:0"><img src="${conv.other_picture}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${initial}"/></div>`
        : `<div class="av sm" style="background:${color};flex-shrink:0">${initial}</div>`;
      return `<div class="dm-conv-item${unread ? " unread" : ""}${conv.id === _activeConvId ? " active" : ""}" id="dm-conv-${conv.id}" onclick="DM.openConv(${conv.id})">
              ${avHtml}
              <div class="dm-conv-info">
                <div class="dm-conv-name">${escHtml(conv.other_name || "")}</div>
                <div class="dm-conv-preview">${escHtml((preview || "").slice(0, 60))}</div>
              </div>
              <div class="dm-conv-meta">
                ${timeStr ? `<div class="dm-conv-time">${timeStr}</div>` : ""}
                ${unread ? `<div class="dm-unread-dot"></div>` : ""}
              </div>
            </div>`;
    };

    list.innerHTML = convs.map((conv) => renderConv(conv)).join("");

    // Async: decrypt e2e last_message previews
    convs.forEach(async (conv) => {
      if (
        conv.last_message &&
        conv.last_message.startsWith("e2e:") &&
        conv.other_id
      ) {
        const plain = await E2E.decrypt(conv.other_id, conv.last_message);
        const sender = conv.last_sender_id === currentUser.id ? "You: " : "";
        const el = document.getElementById(`dm-conv-${conv.id}`);
        if (el) {
          const previewEl = el.querySelector(".dm-conv-preview");
          if (previewEl)
            previewEl.textContent = ("🔒 " + sender + plain).slice(0, 60);
        }
      }
    });

    _refreshBadge();
  }

  // ── Open a conversation ─────────────────────────────────
  async function openConv(cid) {
    if (!currentUser) {
      goTo("login");
      return;
    }
    _activeConvId = cid;
    const row = _inbox.find((c) => c.id == cid);
    _activeOther = row
      ? { name: row.other_name, picture: row.other_picture, id: row.other_id }
      : { name: "…", picture: null, id: null };

    document.getElementById("dm-inbox").classList.add("hidden-mobile");
    document.getElementById("dm-chat").classList.add("visible-mobile");

    const avEl = document.getElementById("dm-chat-av");
    if (_activeOther.picture) {
      avEl.style.background = "transparent";
      avEl.innerHTML = `<img src="${_activeOther.picture}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${_activeOther.name.charAt(0)}"/>`;
    } else {
      avEl.innerHTML = _activeOther.name.charAt(0).toUpperCase();
      avEl.style.background = stringToColor(_activeOther.name);
    }
    document.getElementById("dm-chat-name").textContent = _activeOther.name;
    // Reset status while we load presence
    const statusEl = document.getElementById("dm-chat-status");
    if (statusEl) {
      statusEl.style.display = "none";
      statusEl.textContent = "";
    }
    document.getElementById("dm-chat-empty").style.display = "none";
    document.getElementById("dm-chat-active").style.display = "flex";
    document.getElementById("dm-messages").innerHTML =
      `<div style="text-align:center;padding:40px 16px;color:var(--txt3);font-size:13.5px">Loading…</div>`;

    // Show/update E2E badge in header
    let e2eBadge = document.getElementById("dm-e2e-badge");
    if (!e2eBadge) {
      e2eBadge = document.createElement("span");
      e2eBadge.id = "dm-e2e-badge";
      e2eBadge.style.cssText =
        "display:none;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--green);background:var(--green-bg);border:1px solid var(--green);border-radius:20px;padding:2px 9px;cursor:default;";
      e2eBadge.title = "Messages in this conversation are end-to-end encrypted";
      e2eBadge.innerHTML = "🔒 End-to-end encrypted";
      const nameEl = document.getElementById("dm-chat-name");
      if (nameEl && nameEl.parentNode) nameEl.parentNode.appendChild(e2eBadge);
    }

    // Check if E2E is available for this peer
    if (_activeOther.id) {
      E2E.isEnabled(_activeOther.id).then((enabled) => {
        e2eBadge.style.display = enabled ? "inline-flex" : "none";
      });
    }

    // Reset pagination state for the new conversation
    _messages = [];
    _cursor = null;
    _hasMore = false;
    _latestId = null;
    _loadingMore = false;

    await _fetchMessages(cid, true);
    _startPolling();
    _startHeartbeat();   // keep current user's presence alive
    _fetchPresence(cid); // immediate fetch on open
    // Tell WebSocket server we are viewing this conversation
    if (typeof CircleWS !== "undefined") CircleWS.joinConversation(cid);
  }

  // ── Fetch messages (initial load or conversation switch) ──
  // GET /api/dm/conversations/:id/messages?limit=10
  async function _fetchMessages(cid, markRead) {
    try {
      const res = await api(
        "GET",
        `/api/dm/conversations/${cid}/messages?limit=10`,
      );
      const { messages: msgs, hasMore } = res.data;

      // Determine peer user id for decryption
      const otherUserId = _inbox.find((c) => c.id == cid)?.other_id;

      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m._plain) return m;
          if (m.body && m.body.startsWith("e2e:") && otherUserId) {
            return { ...m, _plain: await E2E.decrypt(otherUserId, m.body) };
          }
          return { ...m, _plain: m.body };
        }),
      );

      _messages = decrypted;
      _hasMore = hasMore;
      _cursor = decrypted.length ? decrypted[0].id : null;
      _latestId = decrypted.length ? decrypted[decrypted.length - 1].id : null;

      _renderMessages(decrypted);

      if (markRead) {
        const row = _inbox.find((c) => c.id == cid);
        if (row) row.unread_count = 0;
        renderInbox();
      }
    } catch (e) {
      if (markRead)
        document.getElementById("dm-messages").innerHTML =
          `<div style="text-align:center;padding:40px 16px;color:var(--rose);font-size:13.5px">Failed to load messages.</div>`;
    }
  }

  // ── Load earlier messages (prepend) ──────────────────────
  // GET /api/dm/conversations/:id/messages?limit=10&before_id=<cursor>
  async function _loadMore() {
    if (!_activeConvId || !_hasMore || _loadingMore || !_cursor) return;
    _loadingMore = true;

    const btn = document.getElementById("dm-load-more-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Loading…";
    }

    try {
      const res = await api(
        "GET",
        `/api/dm/conversations/${_activeConvId}/messages?limit=10&before_id=${_cursor}`,
      );
      const { messages: msgs, hasMore } = res.data;

      const otherUserId = _inbox.find((c) => c.id == _activeConvId)?.other_id;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m._plain) return m;
          if (m.body && m.body.startsWith("e2e:") && otherUserId) {
            return { ...m, _plain: await E2E.decrypt(otherUserId, m.body) };
          }
          return { ...m, _plain: m.body };
        }),
      );

      // Prepend older messages and update cursor
      _messages = [...decrypted, ..._messages];
      _hasMore = hasMore;
      _cursor = decrypted.length ? decrypted[0].id : _cursor;

      // Preserve scroll position after prepend
      const el = document.getElementById("dm-messages");
      const prevH = el.scrollHeight;
      _renderMessages(_messages, false);
      el.scrollTop += el.scrollHeight - prevH;
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "↑ Load earlier messages";
      }
    } finally {
      _loadingMore = false;
    }
  }

  // ── Poll for new messages only (after _latestId) ─────────
  // GET /api/dm/conversations/:id/messages/new?after_id=<latestId>
  async function _pollNewMessages(cid) {
    if (!_latestId) {
      // No messages loaded yet — do a full fetch instead
      await _fetchMessages(cid, false);
      return;
    }
    try {
      const res = await api(
        "GET",
        `/api/dm/conversations/${cid}/messages/new?after_id=${_latestId}`,
      );
      const msgs = Array.isArray(res.data) ? res.data : [];
      if (!msgs.length) {
        // No new messages — check if peer read ours
        await _patchReadTicks();
        return;
      }

      const otherUserId = _inbox.find((c) => c.id == cid)?.other_id;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m._plain) return m;
          if (m.body && m.body.startsWith("e2e:") && otherUserId) {
            return { ...m, _plain: await E2E.decrypt(otherUserId, m.body) };
          }
          return { ...m, _plain: m.body };
        }),
      );

      // Play tone for new incoming messages
      const hasIncoming = decrypted.some((m) => m.sender_id !== currentUser.id);
      if (hasIncoming) _msgTone.play();

      _messages = [..._messages, ...decrypted];
      _latestId = decrypted[decrypted.length - 1].id;
      _renderMessages(_messages);
      await _patchReadTicks();
    } catch (_) {}
  }

  // ── Patch "Seen" label without a full re-render ────────────
  // Called every poll cycle. Asks the server which of our sent
  // messages have actually been read — no guessing.
  async function _patchReadTicks() {
    // Collect IDs of our sent messages that are not yet marked read in local state
    const unreadSentIds = _messages
      .filter(
        (m) =>
          m.sender_id === currentUser.id &&
          !m.is_read &&
          !String(m.id).startsWith("tmp_"),
      )
      .map((m) => m.id);

    if (!unreadSentIds.length) return;

    try {
      const res = await api("POST", "/api/dm/read-status", {
        ids: unreadSentIds,
      });
      const readIds = new Set(res.data?.readIds || []);
      if (!readIds.size) return;

      // Update local state
      _messages = _messages.map((m) =>
        readIds.has(m.id) ? { ...m, is_read: 1 } : m,
      );

      // Find the last sent message id (for placing the single "Seen" label)
      let lastSentId = null;
      for (let i = _messages.length - 1; i >= 0; i--) {
        if (
          _messages[i].sender_id === currentUser.id &&
          !String(_messages[i].id).startsWith("tmp_")
        ) {
          lastSentId = _messages[i].id;
          break;
        }
      }

      // Remove stale Seen labels
      document.querySelectorAll(".dm-seen-label").forEach((el) => el.remove());

      // Only show "Seen" if the last sent message is read
      if (!lastSentId) return;
      const lastMsg = _messages.find((m) => m.id === lastSentId);
      if (!lastMsg?.is_read) return;

      const msgEl = document.querySelector(
        `.dm-msg[data-msg-id="${lastSentId}"]`,
      );
      if (!msgEl) return;
      const seen = document.createElement("div");
      seen.className = "dm-seen-label";
      seen.textContent = "Seen";
      msgEl.appendChild(seen);
    } catch (_) {}
  }

  // ── Render message bubbles ──────────────────────────────
  // Backend fields: sender_id, body, created_at
  // scrollToBottom=true on initial load; false when prepending older messages.
  function _renderMessages(msgs, scrollToBottom = true) {
    const el = document.getElementById("dm-messages");
    if (!msgs.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px 16px;color:var(--txt3);font-size:13.5px">Send a message to start the conversation ✨</div>`;
      return;
    }
    let lastDate = "";
    // Find the id of the last message sent by the current user (for "Seen" label)
    let lastSentId = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (
        msgs[i].sender_id === currentUser.id &&
        !String(msgs[i].id).startsWith("tmp_")
      ) {
        lastSentId = msgs[i].id;
        break;
      }
    }
    const bubbles = msgs
      .map((msg) => {
        const mine = msg.sender_id === currentUser.id;
        const dateStr = _fmtDate(msg.created_at);
        let divider = "";
        if (dateStr !== lastDate) {
          lastDate = dateStr;
          divider = `<div class="dm-date-divider">${dateStr}</div>`;
        }
        const displayText = msg._plain !== undefined ? msg._plain : msg.body;
        const isE2E = msg.body && msg.body.startsWith("e2e:");
        // "Seen" label — only on the last sent message when it has been read
        const isTmp = String(msg.id).startsWith("tmp_");
        let seenLabel = "";
        if (mine && !isTmp && msg.id === lastSentId && !!msg.is_read) {
          seenLabel = `<div class="dm-seen-label">Seen</div>`;
        }
        return `${divider}<div class="dm-msg ${mine ? "mine" : "theirs"}" data-msg-id="${msg.id}">
              <div class="dm-bubble">
                ${escHtml(displayText || "").replace(/\n/g, "<br>")}
                <span class="dm-bubble-time">${_fmtTime(msg.created_at)}${isE2E ? ' <span title="End-to-end encrypted" style="opacity:0.7">🔒</span>' : ""}</span>
              </div>${seenLabel}
            </div>`;
      })
      .join("");

    // Prepend "Load earlier" button if more messages exist on the server
    const loadMoreBtn = _hasMore
      ? `<button id="dm-load-more-btn" onclick="DM.loadMore()" style="
                display:block;margin:12px auto 6px;padding:7px 18px;
                background:var(--accent-bg);color:var(--accent);
                border:1px solid var(--accent);border-radius:20px;
                font-size:12.5px;font-weight:600;cursor:pointer;
                transition:background var(--tr),opacity var(--tr);"
                onmouseover="this.style.background='var(--accent)';this.style.color='#fff';"
                onmouseout="this.style.background='var(--accent-bg)';this.style.color='var(--accent)';">
                ↑ Load earlier messages
              </button>`
      : "";

    el.innerHTML = loadMoreBtn + bubbles;
    if (scrollToBottom) el.scrollTop = el.scrollHeight;
  }

  // ── Send a message ──────────────────────────────────────
  // POST /api/dm/conversations/:id/messages  { body }
  async function sendMessage() {
    if (!currentUser || !_activeConvId || _sending) return;
    const input = document.getElementById("dm-compose-input");
    const text = input.value.trim();
    if (!text) return;
    _sending = true;
    _emitTypingStop(); // user sent — stop typing indicator immediately

    // Optimistic bubble shows plaintext immediately
    const tempId = "tmp_" + Date.now();
    const tempMsg = {
      id: tempId,
      sender_id: currentUser.id,
      body: text,
      created_at: new Date().toISOString(),
      _plain: text,
    };
    _messages = [..._messages, tempMsg];
    _renderMessages(_messages);
    input.value = "";
    input.style.height = "";

    try {
      // Encrypt before sending to server
      const otherUserId = _inbox.find((c) => c.id == _activeConvId)?.other_id;
      const wireBody = otherUserId
        ? await E2E.encrypt(otherUserId, text)
        : text;

      const res = await api(
        "POST",
        `/api/dm/conversations/${_activeConvId}/messages`,
        { body: wireBody },
      );
      const saved = res.data || res;
      _messages = _messages.filter((m) => m.id !== tempId);
      // Store plaintext on the saved message so we don't re-decrypt our own
      if (saved && saved.id) {
        saved._plain = text;
        _messages.push(saved);
        // Advance the polling cursor so we don't re-fetch this message
        _latestId = saved.id;
      }
      _renderMessages(_messages);
      await _loadInbox();
    } catch (e) {
      showToast("Failed to send: " + e.message);
      _messages = _messages.filter((m) => m.id !== tempId);
      _renderMessages(_messages);
    } finally {
      _sending = false;
    }
  }

  // ── Badge ───────────────────────────────────────────────
  // Local unread counter — only cleared when user opens the messages view
  let _localUnread = 0;

  function _refreshBadge(delta) {
    if (delta) _localUnread = Math.max(0, _localUnread + delta);
    const count = _localUnread;
    const badge = document.getElementById("snav-dm-badge");
    if (badge) {
      badge.textContent = count > 9 ? "9+" : count;
      badge.classList.toggle("show", count > 0);
    }
    const mbadge = document.getElementById("mnav-dm-badge");
    if (mbadge) {
      mbadge.textContent = count > 9 ? "9+" : count;
      mbadge.classList.toggle("show", count > 0);
    }
    const tbadge = document.getElementById("topbar-dm-badge");
    if (tbadge) {
      tbadge.textContent = count > 9 ? "9+" : count;
      tbadge.classList.toggle("show", count > 0);
    }
  }

  function clearDMBadge() {
    _localUnread = 0;
    _refreshBadge();
  }

  function filterInbox() {
    _inboxFilter = document.getElementById("dm-inbox-search").value;
    renderInbox();
  }
  function updateDMBadge() {
    _refreshBadge();
  }

  // ── Start conversation from profile / picker ────────────
  // POST /api/dm/conversations  { recipientId }
  async function startConvWithUser(user) {
    if (!currentUser) {
      goTo("login");
      return;
    }
    try {
      const res = await api("POST", "/api/dm/conversations", {
        recipientId: user.id,
      });
      const conv = res.data || res;
      if (!conv || !conv.id) throw new Error("Invalid response.");
      if (!_inbox.find((c) => c.id === conv.id)) {
        _inbox.unshift({
          id: conv.id,
          other_id: user.id,
          other_name: user.name,
          other_picture: user.picture || null,
          last_message: null,
          last_sender_id: null,
          last_message_at: null,
          unread_count: 0,
          created_at: conv.created_at || new Date().toISOString(),
        });
      }
      goTo("messages");
      setTimeout(() => openConv(conv.id), 60);
    } catch (e) {
      showToast("Could not open conversation: " + e.message);
    }
  }

  // ── Typing indicator helpers ─────────────────────────────

  // Called by wsClient when the OTHER user's typing state changes.
  function _setTyping(isTyping) {
    const el = document.getElementById("dm-typing-indicator");
    if (el) el.style.display = isTyping ? "flex" : "none";
  }

  // Emit our own typing state to the server (debounced).
  function _emitTypingStart() {
    if (!_activeConvId || typeof CircleWS === "undefined" || !CircleWS.isAlive()) return;
    if (!_isTypingOut) {
      _isTypingOut = true;
      CircleWS.sendTyping(_activeConvId, true);
    }
    clearTimeout(_typingTimeout);
    _typingTimeout = setTimeout(_emitTypingStop, 2000);
  }

  function _emitTypingStop() {
    clearTimeout(_typingTimeout);
    _typingTimeout = null;
    if (_isTypingOut) {
      _isTypingOut = false;
      if (_activeConvId && typeof CircleWS !== "undefined" && CircleWS.isAlive()) {
        CircleWS.sendTyping(_activeConvId, false);
      }
    }
  }

  // ── WebSocket injection hooks (called by ws-client.js) ──────
  // Appends a message that arrived via WS into the open chat view.
  function _wsInjectMessage(convId, message) {
    if (_activeConvId !== convId) return;
    // Don't double-add if the same message already arrived via HTTP send
    if (_messages.find(m => m.id === message.id)) return;
    _messages = [..._messages, message];
    _latestId = message.id;
    _renderMessages(_messages);
    // Auto-mark as read since the user is actively viewing this conversation
    api("PATCH", `/api/dm/conversations/${convId}/read`).catch(() => {});
  }

  // Refreshes the inbox preview row for a conversation after a WS new_dm event.
  function _wsRefreshInbox(convId, message) {
    const conv = _inbox.find(c => c.id === convId);
    if (conv) {
      conv.last_message    = message.body;
      conv.last_sender_id  = message.sender_id;
      conv.last_message_at = message.created_at;
      if (message.sender_id !== currentUser.id && convId !== _activeConvId) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
    } else {
      // Conversation not in inbox yet (first ever message) — reload fully
      _loadInbox();
      return;
    }
    renderInbox();
  }

  return {
    init: _loadInbox,
    renderInbox,
    openConv,
    sendMessage,
    filterInbox,
    updateDMBadge,
    clearDMBadge,
    startConvWithUser,
    loadMore: _loadMore,
    getActiveConvId: () => _activeConvId,
    stopHeartbeat: _stopHeartbeat,
    startHeartbeat: _startHeartbeat,
    _tonePlay: () => _msgTone.play(),
    _wsInjectMessage,
    _wsRefreshInbox,
    _setTyping,
    _emitTypingStart,
    _emitTypingStop,
  };
})();

/* DM UI helpers */
function dmFilterInbox() {
  DM.filterInbox();
}
function dmSendMessage() {
  DM.sendMessage();
}
function dmAutoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
  DM._emitTypingStart(); // user is actively typing
}
function dmSendOnEnter(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    DM.sendMessage();
  }
}
function dmBackToInbox() {
  // Leave the WS conversation room before going back
  const _leavingConv = DM.getActiveConvId();
  if (_leavingConv && typeof CircleWS !== "undefined") CircleWS.leaveConversation(_leavingConv);
  DM._emitTypingStop(); // clear any in-flight typing event
  DM.stopHeartbeat(); // no longer in an active conversation
  document.getElementById("dm-inbox").classList.remove("hidden-mobile");
  document.getElementById("dm-chat").classList.remove("visible-mobile");
}

/* New DM modal */
let _dmSearchDebounce = null;
function openNewDMModal() {
  if (!currentUser) {
    goTo("login");
    return;
  }
  document.getElementById("dm-new-modal").classList.add("open");
  document.getElementById("dm-new-search").value = "";
  document.getElementById("dm-new-results").innerHTML =
    '<div class="dm-new-empty">Search for someone to message</div>';
  setTimeout(() => document.getElementById("dm-new-search").focus(), 80);
}
function closeNewDMModal() {
  document.getElementById("dm-new-modal").classList.remove("open");
}
function dmSearchPeople() {
  const q = document.getElementById("dm-new-search").value.trim();
  const res = document.getElementById("dm-new-results");
  if (!q) {
    res.innerHTML =
      '<div class="dm-new-empty">Search for someone to message</div>';
    return;
  }
  clearTimeout(_dmSearchDebounce);
  res.innerHTML = '<div class="dm-new-empty">Searching…</div>';
  _dmSearchDebounce = setTimeout(async () => {
    try {
      const data = await api(
        "GET",
        `/api/users?search=${encodeURIComponent(q)}&limit=8`,
      );
      let users = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      users = users.filter((u) => u.id !== currentUser.id).slice(0, 8);
      if (!users.length) {
        res.innerHTML = '<div class="dm-new-empty">No users found</div>';
        return;
      }
      res.innerHTML = users
        .map((u) => {
          const initial = (u.name || "?").charAt(0).toUpperCase();
          const color = stringToColor(u.name || "");
          const avHtml = u.picture
            ? `<div class="av sm" style="background:transparent;overflow:hidden;flex-shrink:0"><img src="${u.picture}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${initial}"/></div>`
            : `<div class="av sm" style="background:${color};flex-shrink:0">${initial}</div>`;
          return `<div class="dm-new-result" data-user="${escHtml(JSON.stringify(u))}" onclick="dmPickUser(this)">
                ${avHtml}
                <div class="dm-new-result-info">
                  <div class="dm-new-result-name">${escHtml(u.name || "")}</div>
                  <div class="dm-new-result-email">${escHtml(u.email || "")}</div>
                </div>
              </div>`;
        })
        .join("");
    } catch (e) {
      res.innerHTML =
        '<div class="dm-new-empty">Search failed — try again</div>';
    }
  }, 300);
}
function dmPickUser(el) {
  try {
    const u = JSON.parse(el.dataset.user);
    closeNewDMModal();
    DM.startConvWithUser(u);
  } catch (e) {
    console.error("dmPickUser error:", e);
  }
}

/* ── COUNTRY DIAL CODES — all ITU-T E.164 countries ─────────── */
const DIAL_COUNTRIES = [
  ["+93", "🇦🇫", "Afghanistan"],
  ["+355", "🇦🇱", "Albania"],
  ["+213", "🇩🇿", "Algeria"],
  ["+1684", "🇦🇸", "American Samoa"],
  ["+376", "🇦🇩", "Andorra"],
  ["+244", "🇦🇴", "Angola"],
  ["+1264", "🇦🇮", "Anguilla"],
  ["+1268", "🇦🇬", "Antigua & Barbuda"],
  ["+54", "🇦🇷", "Argentina"],
  ["+374", "🇦🇲", "Armenia"],
  ["+297", "🇦🇼", "Aruba"],
  ["+61", "🇦🇺", "Australia"],
  ["+43", "🇦🇹", "Austria"],
  ["+994", "🇦🇿", "Azerbaijan"],
  ["+1242", "🇧🇸", "Bahamas"],
  ["+973", "🇧🇭", "Bahrain"],
  ["+880", "🇧🇩", "Bangladesh"],
  ["+1246", "🇧🇧", "Barbados"],
  ["+375", "🇧🇾", "Belarus"],
  ["+32", "🇧🇪", "Belgium"],
  ["+501", "🇧🇿", "Belize"],
  ["+229", "🇧🇯", "Benin"],
  ["+1441", "🇧🇲", "Bermuda"],
  ["+975", "🇧🇹", "Bhutan"],
  ["+591", "🇧🇴", "Bolivia"],
  ["+387", "🇧🇦", "Bosnia & Herzegovina"],
  ["+267", "🇧🇼", "Botswana"],
  ["+55", "🇧🇷", "Brazil"],
  ["+246", "🇮🇴", "British Indian Ocean Ter."],
  ["+1284", "🇻🇬", "British Virgin Islands"],
  ["+673", "🇧🇳", "Brunei"],
  ["+359", "🇧🇬", "Bulgaria"],
  ["+226", "🇧🇫", "Burkina Faso"],
  ["+257", "🇧🇮", "Burundi"],
  ["+238", "🇨🇻", "Cabo Verde"],
  ["+855", "🇰🇭", "Cambodia"],
  ["+237", "🇨🇲", "Cameroon"],
  ["+1", "🇨🇦", "Canada"],
  ["+1345", "🇰🇾", "Cayman Islands"],
  ["+236", "🇨🇫", "Central African Republic"],
  ["+235", "🇹🇩", "Chad"],
  ["+56", "🇨🇱", "Chile"],
  ["+86", "🇨🇳", "China"],
  ["+61", "🇨🇽", "Christmas Island"],
  ["+61", "🇨🇨", "Cocos Islands"],
  ["+57", "🇨🇴", "Colombia"],
  ["+269", "🇰🇲", "Comoros"],
  ["+243", "🇨🇩", "Congo (DRC)"],
  ["+242", "🇨🇬", "Congo (Republic)"],
  ["+682", "🇨🇰", "Cook Islands"],
  ["+506", "🇨🇷", "Costa Rica"],
  ["+225", "🇨🇮", "Côte d'Ivoire"],
  ["+385", "🇭🇷", "Croatia"],
  ["+53", "🇨🇺", "Cuba"],
  ["+599", "🇨🇼", "Curaçao"],
  ["+357", "🇨🇾", "Cyprus"],
  ["+420", "🇨🇿", "Czech Republic"],
  ["+45", "🇩🇰", "Denmark"],
  ["+253", "🇩🇯", "Djibouti"],
  ["+1767", "🇩🇲", "Dominica"],
  ["+1809", "🇩🇴", "Dominican Republic"],
  ["+593", "🇪🇨", "Ecuador"],
  ["+20", "🇪🇬", "Egypt"],
  ["+503", "🇸🇻", "El Salvador"],
  ["+240", "🇬🇶", "Equatorial Guinea"],
  ["+291", "🇪🇷", "Eritrea"],
  ["+372", "🇪🇪", "Estonia"],
  ["+268", "🇸🇿", "Eswatini"],
  ["+251", "🇪🇹", "Ethiopia"],
  ["+500", "🇫🇰", "Falkland Islands"],
  ["+298", "🇫🇴", "Faroe Islands"],
  ["+679", "🇫🇯", "Fiji"],
  ["+358", "🇫🇮", "Finland"],
  ["+33", "🇫🇷", "France"],
  ["+594", "🇬🇫", "French Guiana"],
  ["+689", "🇵🇫", "French Polynesia"],
  ["+241", "🇬🇦", "Gabon"],
  ["+220", "🇬🇲", "Gambia"],
  ["+995", "🇬🇪", "Georgia"],
  ["+49", "🇩🇪", "Germany"],
  ["+233", "🇬🇭", "Ghana"],
  ["+350", "🇬🇮", "Gibraltar"],
  ["+30", "🇬🇷", "Greece"],
  ["+299", "🇬🇱", "Greenland"],
  ["+1473", "🇬🇩", "Grenada"],
  ["+590", "🇬🇵", "Guadeloupe"],
  ["+1671", "🇬🇺", "Guam"],
  ["+502", "🇬🇹", "Guatemala"],
  ["+224", "🇬🇳", "Guinea"],
  ["+245", "🇬🇼", "Guinea-Bissau"],
  ["+592", "🇬🇾", "Guyana"],
  ["+509", "🇭🇹", "Haiti"],
  ["+504", "🇭🇳", "Honduras"],
  ["+852", "🇭🇰", "Hong Kong"],
  ["+36", "🇭🇺", "Hungary"],
  ["+354", "🇮🇸", "Iceland"],
  ["+91", "🇮🇳", "India"],
  ["+62", "🇮🇩", "Indonesia"],
  ["+98", "🇮🇷", "Iran"],
  ["+964", "🇮🇶", "Iraq"],
  ["+353", "🇮🇪", "Ireland"],
  ["+972", "🇮🇱", "Israel"],
  ["+39", "🇮🇹", "Italy"],
  ["+1876", "🇯🇲", "Jamaica"],
  ["+81", "🇯🇵", "Japan"],
  ["+962", "🇯🇴", "Jordan"],
  ["+7", "🇰🇿", "Kazakhstan"],
  ["+254", "🇰🇪", "Kenya"],
  ["+686", "🇰🇮", "Kiribati"],
  ["+383", "🇽🇰", "Kosovo"],
  ["+965", "🇰🇼", "Kuwait"],
  ["+996", "🇰🇬", "Kyrgyzstan"],
  ["+856", "🇱🇦", "Laos"],
  ["+371", "🇱🇻", "Latvia"],
  ["+961", "🇱🇧", "Lebanon"],
  ["+266", "🇱🇸", "Lesotho"],
  ["+231", "🇱🇷", "Liberia"],
  ["+218", "🇱🇾", "Libya"],
  ["+423", "🇱🇮", "Liechtenstein"],
  ["+370", "🇱🇹", "Lithuania"],
  ["+352", "🇱🇺", "Luxembourg"],
  ["+853", "🇲🇴", "Macao"],
  ["+261", "🇲🇬", "Madagascar"],
  ["+265", "🇲🇼", "Malawi"],
  ["+60", "🇲🇾", "Malaysia"],
  ["+960", "🇲🇻", "Maldives"],
  ["+223", "🇲🇱", "Mali"],
  ["+356", "🇲🇹", "Malta"],
  ["+692", "🇲🇭", "Marshall Islands"],
  ["+596", "🇲🇶", "Martinique"],
  ["+222", "🇲🇷", "Mauritania"],
  ["+230", "🇲🇺", "Mauritius"],
  ["+52", "🇲🇽", "Mexico"],
  ["+691", "🇫🇲", "Micronesia"],
  ["+373", "🇲🇩", "Moldova"],
  ["+377", "🇲🇨", "Monaco"],
  ["+976", "🇲🇳", "Mongolia"],
  ["+382", "🇲🇪", "Montenegro"],
  ["+1664", "🇲🇸", "Montserrat"],
  ["+212", "🇲🇦", "Morocco"],
  ["+258", "🇲🇿", "Mozambique"],
  ["+95", "🇲🇲", "Myanmar"],
  ["+264", "🇳🇦", "Namibia"],
  ["+674", "🇳🇷", "Nauru"],
  ["+977", "🇳🇵", "Nepal"],
  ["+31", "🇳🇱", "Netherlands"],
  ["+687", "🇳🇨", "New Caledonia"],
  ["+64", "🇳🇿", "New Zealand"],
  ["+505", "🇳🇮", "Nicaragua"],
  ["+227", "🇳🇪", "Niger"],
  ["+234", "🇳🇬", "Nigeria"],
  ["+683", "🇳🇺", "Niue"],
  ["+672", "🇳🇫", "Norfolk Island"],
  ["+850", "🇰🇵", "North Korea"],
  ["+389", "🇲🇰", "North Macedonia"],
  ["+1670", "🇲🇵", "Northern Mariana Islands"],
  ["+47", "🇳🇴", "Norway"],
  ["+968", "🇴🇲", "Oman"],
  ["+92", "🇵🇰", "Pakistan"],
  ["+680", "🇵🇼", "Palau"],
  ["+970", "🇵🇸", "Palestine"],
  ["+507", "🇵🇦", "Panama"],
  ["+675", "🇵🇬", "Papua New Guinea"],
  ["+595", "🇵🇾", "Paraguay"],
  ["+51", "🇵🇪", "Peru"],
  ["+63", "🇵🇭", "Philippines"],
  ["+48", "🇵🇱", "Poland"],
  ["+351", "🇵🇹", "Portugal"],
  ["+1787", "🇵🇷", "Puerto Rico"],
  ["+974", "🇶🇦", "Qatar"],
  ["+262", "🇷🇪", "Réunion"],
  ["+40", "🇷🇴", "Romania"],
  ["+7", "🇷🇺", "Russia"],
  ["+250", "🇷🇼", "Rwanda"],
  ["+590", "🇧🇱", "Saint Barthélemy"],
  ["+290", "🇸🇭", "Saint Helena"],
  ["+1869", "🇰🇳", "Saint Kitts & Nevis"],
  ["+1758", "🇱🇨", "Saint Lucia"],
  ["+1721", "🇸🇽", "Saint Martin"],
  ["+508", "🇵🇲", "Saint Pierre & Miquelon"],
  ["+1784", "🇻🇨", "Saint Vincent & Grenadines"],
  ["+685", "🇼🇸", "Samoa"],
  ["+378", "🇸🇲", "San Marino"],
  ["+239", "🇸🇹", "São Tomé & Príncipe"],
  ["+966", "🇸🇦", "Saudi Arabia"],
  ["+221", "🇸🇳", "Senegal"],
  ["+381", "🇷🇸", "Serbia"],
  ["+248", "🇸🇨", "Seychelles"],
  ["+232", "🇸🇱", "Sierra Leone"],
  ["+65", "🇸🇬", "Singapore"],
  ["+1721", "🇸🇽", "Sint Maarten"],
  ["+421", "🇸🇰", "Slovakia"],
  ["+386", "🇸🇮", "Slovenia"],
  ["+677", "🇸🇧", "Solomon Islands"],
  ["+252", "🇸🇴", "Somalia"],
  ["+27", "🇿🇦", "South Africa"],
  ["+82", "🇰🇷", "South Korea"],
  ["+211", "🇸🇸", "South Sudan"],
  ["+34", "🇪🇸", "Spain"],
  ["+94", "🇱🇰", "Sri Lanka"],
  ["+249", "🇸🇩", "Sudan"],
  ["+597", "🇸🇷", "Suriname"],
  ["+47", "🇸🇯", "Svalbard & Jan Mayen"],
  ["+46", "🇸🇪", "Sweden"],
  ["+41", "🇨🇭", "Switzerland"],
  ["+963", "🇸🇾", "Syria"],
  ["+886", "🇹🇼", "Taiwan"],
  ["+992", "🇹🇯", "Tajikistan"],
  ["+255", "🇹🇿", "Tanzania"],
  ["+66", "🇹🇭", "Thailand"],
  ["+670", "🇹🇱", "Timor-Leste"],
  ["+228", "🇹🇬", "Togo"],
  ["+690", "🇹🇰", "Tokelau"],
  ["+676", "🇹🇴", "Tonga"],
  ["+1868", "🇹🇹", "Trinidad & Tobago"],
  ["+216", "🇹🇳", "Tunisia"],
  ["+90", "🇹🇷", "Turkey"],
  ["+993", "🇹🇲", "Turkmenistan"],
  ["+1649", "🇹🇨", "Turks & Caicos Islands"],
  ["+688", "🇹🇻", "Tuvalu"],
  ["+256", "🇺🇬", "Uganda"],
  ["+380", "🇺🇦", "Ukraine"],
  ["+971", "🇦🇪", "United Arab Emirates"],
  ["+44", "🇬🇧", "United Kingdom"],
  ["+1", "🇺🇸", "United States"],
  ["+598", "🇺🇾", "Uruguay"],
  ["+1340", "🇻🇮", "US Virgin Islands"],
  ["+998", "🇺🇿", "Uzbekistan"],
  ["+678", "🇻🇺", "Vanuatu"],
  ["+379", "🇻🇦", "Vatican City"],
  ["+58", "🇻🇪", "Venezuela"],
  ["+84", "🇻🇳", "Vietnam"],
  ["+681", "🇼🇫", "Wallis & Futuna"],
  ["+212", "🇪🇭", "Western Sahara"],
  ["+967", "🇾🇪", "Yemen"],
  ["+260", "🇿🇲", "Zambia"],
  ["+263", "🇿🇼", "Zimbabwe"],
];

function _buildDialOptions(defaultCode) {
  return DIAL_COUNTRIES.sort((a, b) => a[2].localeCompare(b[2]))
    .map(([code, flag, name]) => {
      const sel = code === defaultCode ? " selected" : "";
      return `<option value="${code}"${sel} title="${name}">${flag} ${code}</option>`;
    })
    .join("");
}

function _populateDialSelects() {
  // Try to detect user's country from timezone as a hint (best-effort)
  let defaultCode = "+268"; // Eswatini default given app origin
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tzMap = {
      "Africa/Mbabane": "+268",
      "America/New_York": "+1",
      "America/Chicago": "+1",
      "America/Denver": "+1",
      "America/Los_Angeles": "+1",
      "America/Toronto": "+1",
      "America/Vancouver": "+1",
      "Europe/London": "+44",
      "Europe/Paris": "+33",
      "Europe/Berlin": "+49",
      "Europe/Rome": "+39",
      "Europe/Madrid": "+34",
      "Africa/Johannesburg": "+27",
      "Africa/Nairobi": "+254",
      "Africa/Lagos": "+234",
      "Africa/Accra": "+233",
      "Africa/Dar_es_Salaam": "+255",
      "Africa/Kampala": "+256",
      "Africa/Lusaka": "+260",
      "Africa/Harare": "+263",
      "Africa/Addis_Ababa": "+251",
      "Africa/Cairo": "+20",
      "Asia/Kolkata": "+91",
      "Asia/Tokyo": "+81",
      "Asia/Shanghai": "+86",
      "Asia/Seoul": "+82",
      "Asia/Dubai": "+971",
      "Asia/Singapore": "+65",
      "Australia/Sydney": "+61",
      "Pacific/Auckland": "+64",
    };
    if (tzMap[tz]) defaultCode = tzMap[tz];
  } catch (e) {}
  const html = _buildDialOptions(defaultCode);
  ["login-dial-code", "reg-dial-code", "reg-phone-dial-code"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

/*  BOOT*/
(function boot() {
  PostCache.init(); // hydrate from localStorage
  // Feed freshness is managed by the 5-min TTL in PostCache.
  // Invalidating here caused an empty feed flash on refresh because the
  // feed index was wiped before loadPosts() could paint from cache.
  _populateDialSelects(); // fill country code dropdowns
  DM.init(); // load inbox from backend (no-ops if not logged in)
  applyTheme(localStorage.getItem("circle_theme") || "dark");
  try {
    const s = localStorage.getItem("circle_user");
    if (s) setCurrentUser(JSON.parse(s));
    // If user object is gone, clear any stale token too
    if (!s) localStorage.removeItem("circle_token");
  } catch (e) {
    localStorage.removeItem("circle_user");
    localStorage.removeItem("circle_token");
  }

  // If arriving via reset link, show new-password view and skip loadPosts
  const resetToken = new URLSearchParams(window.location.search).get("token");
  if (resetToken) {
    goTo("new-password");
    return;
  }

  // ── Seed history so the very first back press stays in the app ──
  // Use the actual current path so a direct URL load is reflected correctly.
  const _initState = _pathToState(
    window.location.pathname,
    window.location.search,
  );
  history.replaceState(
    _initState,
    "",
    window.location.pathname + window.location.search || "/",
  );

  // ── Cold-start URL routing (direct link / page refresh) ──────
  // After the feed/auth loads, navigate to the view implied by the URL.
  // We defer so that currentUser and posts have a chance to populate.
  if (_initState.view !== "feed" || _initState._notFound) {
    setTimeout(async () => {
      _historyNavigating = true;
      try {
        if (_initState._notFound) {
          _show404();
        } else if (_initState.view === "post-detail" && _initState.postId) {
          _postDetailPrevView = "feed";
          const cached =
            posts.find((p) => p.id === _initState.postId) ||
            PostCache.getPost(_initState.postId);
          if (cached) {
            renderPostDetail(cached);
            goTo("post-detail");
          } else {
            try {
              const res = await api("GET", `/api/posts/${_initState.postId}`);
              const p = res.data || res;
              PostCache.putPost(p);
              renderPostDetail(p);
              goTo("post-detail");
            } catch (_) {
              _show404();
            }
          }
        } else if (_initState.view === "profile" && _initState.userId) {
          viewProfile(_initState.userId);
          // Restore profile tab from ?tab= param
          if (_initState.tab && ["posts", "about"].includes(_initState.tab)) {
            setTimeout(() => switchProfileTab(_initState.tab), 300);
          }
        } else if (_initState.view === "group-detail" && _initState.groupId) {
          await openGroup(_initState.groupId);
          // Restore group tab from ?tab= param
          if (_initState.tab && ["feed", "about"].includes(_initState.tab)) {
            switchGroupTab(_initState.tab);
          }
        } else if (_initState.view === "search") {
          goTo("search");
          // Restore search query from ?q= param
          if (_initState.q) {
            const inp = document.getElementById("search-input");
            if (inp) {
              inp.value = _initState.q;
              searchTab = _initState.type || "posts";
              document
                .getElementById("stab-posts")
                ?.classList.toggle("active", searchTab === "posts");
              document
                .getElementById("stab-people")
                ?.classList.toggle("active", searchTab === "people");
              const stSection = document.getElementById(
                "search-trending-section",
              );
              if (stSection) stSection.style.display = "none";
              runSearch(_initState.q);
            }
          }
        } else {
          goTo(_initState.view);
          // Post-login redirect
          const redir = sessionStorage.getItem("_redirectAfterLogin");
          if (redir && _initState.view === "feed" && currentUser) {
            sessionStorage.removeItem("_redirectAfterLogin");
            if (redir.startsWith("/articles")) {
              location.href = "https://www.circlenet.social/articles";
            } else {
              const redirState = _pathToState(redir);
              if (redirState.view !== "feed") goTo(redirState.view, redirState);
            }
          }
        }
      } finally {
        _historyNavigating = false;
      }
    }, 600);
  } else {
    // Feed cold-start: check for pending redirect after login
    setTimeout(() => {
      const redir = sessionStorage.getItem("_redirectAfterLogin");
      if (redir && currentUser) {
        sessionStorage.removeItem("_redirectAfterLogin");
        if (redir.startsWith("/articles")) {
          location.href = "https://www.circlenet.social/articles";
        } else {
          const redirState = _pathToState(redir);
          if (redirState.view !== "feed") {
            _historyNavigating = false;
            goTo(redirState.view, redirState);
          }
        }
      }
    }, 700);
  }

  // ── Android / browser back button handler ────────────────────
  window.addEventListener("popstate", (e) => {
    const state = e.state;
    if (!state || !state.view) {
      // No state — we've gone before the app's first entry; do nothing
      // (browser will handle exiting naturally)
      return;
    }
    _historyNavigating = true;
    try {
      if (state.view === "profile") {
        // Re-render profile; viewProfile would push again so call internals directly
        document
          .querySelectorAll(".view")
          .forEach((v) => v.classList.remove("active"));
        document.getElementById("view-profile").classList.add("active");
        document.querySelector(".content")?.classList.remove("feed-active");
        document
          .querySelectorAll(".nav-item")
          .forEach((n) => n.classList.remove("active"));
        const sn = document.getElementById("snav-profile");
        if (sn) sn.classList.add("active");
        document
          .querySelectorAll(".mnav-item")
          .forEach((n) => n.classList.remove("active"));
        const mn = document.getElementById("mnav-profile");
        if (mn) mn.classList.add("active");
        window.scrollTo(0, 0);
        renderProfile(state.userId || null);
      } else if (state.view === "post-detail" && state.postId) {
        _postDetailPrevView = state.prevView || "feed";
        const post =
          posts.find((p) => p.id === state.postId) ||
          PostCache.getPost(state.postId);
        if (post) {
          renderPostDetail(post);
          goTo("post-detail");
        } else {
          goTo(_postDetailPrevView);
        }
      } else {
        goTo(state.view);
      }
    } finally {
      _historyNavigating = false;
    }
  });

  // Show the global feed tab even for guests
  const ftGuest = document.getElementById("feed-tabs");
  if (ftGuest && !currentUser) {
    ftGuest.style.display = "flex";
    const ftFollowing = document.getElementById("ftab-following");
    if (ftFollowing) ftFollowing.style.opacity = "0.5";
  }

  // ── Cold-start push notification deep-link ────────────────
  // When the user taps a notification while the app is closed, the SW
  // opens a new tab with a hash like #notif:post:42 or #notif:profile:7.
  // We parse it here and navigate after the feed has loaded.
  const _coldHash = window.location.hash;
  if (_coldHash && _coldHash.startsWith("#notif:")) {
    // Strip the hash immediately so refreshing doesn't re-trigger
    history.replaceState(
      { view: "feed" },
      "",
      window.location.pathname + window.location.search,
    );
    const parts = _coldHash.slice(1).split(":"); // ['notif','post','42']
    const _coldTarget = parts[1]; // 'post' | 'profile'
    const _coldId = parts[2]; // id as string or 'me'

    // Defer until after loadPosts() so the cache has a chance to fill
    setTimeout(async () => {
      if (_coldTarget === "post" && _coldId) {
        const pid = parseInt(_coldId, 10);
        const cached =
          posts.find((p) => p.id === pid) || PostCache.getPost(pid);
        if (cached) {
          renderPostDetail(cached);
          goTo("post-detail");
        } else {
          try {
            const res = await api("GET", `/api/posts/${pid}`);
            if (res.data) {
              PostCache.putPost(res.data);
              renderPostDetail(res.data);
              goTo("post-detail");
            }
          } catch (_) {}
        }
      } else if (_coldTarget === "profile") {
        if (_coldId === "me") {
          goTo("profile");
        } else if (_coldId) {
          viewProfile(parseInt(_coldId, 10));
        }
      }
    }, 800);
  }

  loadPosts();
  loadTrending();
})();

/* ── POST DETAIL ──────────────────────────────────────────── */
let _postDetailPrevView = "feed";
let _postDetailScrollY = 0;

function goToPostDetail(postId, focusReply) {
  const active = document.querySelector(".view.active");
  _postDetailPrevView = active ? active.id.replace("view-", "") : "feed";
  const post = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  if (!post) return;
  renderPostDetail(post);
  _postDetailScrollY = window.scrollY;
  if (!_historyNavigating) {
    history.pushState(
      { view: "post-detail", postId, prevView: _postDetailPrevView },
      "",
      _viewToPath("post-detail", { postId }),
    );
  }
  goTo("post-detail");
  if (focusReply) {
    requestAnimationFrame(() => {
      const input = document.getElementById("post-detail-reply-input");
      if (input) input.focus();
    });
  }
}

function openPostDetail(e, postId) {
  // Don't open if clicking on a button, link, avatar, or input
  const tag = e.target.tagName.toLowerCase();
  if (
    [
      "button",
      "svg",
      "path",
      "polyline",
      "line",
      "circle",
      "polygon",
      "input",
      "textarea",
      "img",
    ].includes(tag)
  )
    return;
  if (
    e.target.closest("button") ||
    e.target.closest("a") ||
    e.target.closest(".av")
  )
    return;

  // Remember which view we came from
  const active = document.querySelector(".view.active");
  _postDetailPrevView = active ? active.id.replace("view-", "") : "feed";

  const post = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  if (!post) return;

  renderPostDetail(post);
  // Save scroll position so we can restore it when going back
  _postDetailScrollY = window.scrollY;
  history.pushState(
    { view: "post-detail", postId, prevView: _postDetailPrevView },
    "",
    _viewToPath("post-detail", { postId }),
  );
  goTo("post-detail");
}

function closePostDetail() {
  const prev = _postDetailPrevView || "feed";
  // Don't re-trigger search reset side effects if going back to search
  if (prev === "search") {
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    const el = document.getElementById("view-search");
    if (el) el.classList.add("active");
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));
    const sn = document.getElementById("snav-search");
    if (sn) sn.classList.add("active");
    document
      .querySelectorAll(".mnav-item")
      .forEach((n) => n.classList.remove("active"));
    const mn = document.getElementById("mnav-search");
    if (mn) mn.classList.add("active");
    window.scrollTo(0, 0);
    history.pushState({ view: "search" }, "", "/search");
  } else if (prev === "feed") {
    // ── Seamless back-to-feed: switch view without any re-render ──
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    const feedEl = document.getElementById("view-feed");
    if (feedEl) feedEl.classList.add("active");

    // Restore nav highlights
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));
    const sn = document.getElementById("snav-feed");
    if (sn) sn.classList.add("active");
    document
      .querySelectorAll(".mnav-item")
      .forEach((n) => n.classList.remove("active"));
    const mn = document.getElementById("mnav-feed");
    if (mn) mn.classList.add("active");

    // Widen content for feed+aside layout
    const contentEl = document.querySelector(".content");
    if (contentEl) contentEl.classList.add("feed-active");

    // Restore topbar visibility
    const topbar = document.querySelector(".topbar");
    if (topbar) {
      topbar.classList.remove("topbar-hidden");
      topbar.style.display = "";
    }

    // Restore mobile nav
    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav) {
      mobileNav.style.display = "";
      mobileNav.classList.remove("nav-hidden");
    }

    // Restore scroll without any re-render
    requestAnimationFrame(() => {
      window.scrollTo({ top: _postDetailScrollY || 0, behavior: "instant" });
    });

    // Update history
    history.pushState({ view: "feed" }, "", "/");

    // Silent background refresh only (no renderFeed call)
    _backgroundRefreshFeed();
  } else {
    goTo(prev);
    // Restore scroll position after the view is visible
    requestAnimationFrame(() => {
      window.scrollTo({ top: _postDetailScrollY || 0, behavior: "instant" });
    });
  }
}

async function openOriginalPost(postId) {
  if (!postId) return;
  const active = document.querySelector(".view.active");
  _postDetailPrevView = active ? active.id.replace("view-", "") : "feed";
  try {
    // Always fetch from API so post is found even if not in current feed
    const res = await api("GET", `/api/posts/${postId}`);
    const post = res.data;
    if (!post) {
      showToast("Post not found.");
      return;
    }
    PostCache.putPost(post);
    renderPostDetail(post);
    history.pushState(
      { view: "post-detail", postId, prevView: _postDetailPrevView },
      "",
      _viewToPath("post-detail", { postId }),
    );
    goTo("post-detail");
  } catch (e) {
    showToast("Could not load original post.");
  }
}

function renderPostDetail(post) {
  resolvePostMedia(post);
  const liked =
    currentUser && post.likes && post.likes.includes(currentUser.id);
  const reposted =
    currentUser && post.reposts && post.reposts.includes(currentUser.id);
  const canDelete = currentUser && currentUser.id === post.userId;
  const color = stringToColor(post.author || "");

  const avHtml = post.authorPicture
    ? `<img src="${post.authorPicture}" alt="${escHtml((post.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
    : escHtml((post.author || "?").charAt(0));

  const detailDate = new Date(
    post.createdAt.includes("T")
      ? post.createdAt
      : post.createdAt.replace(" ", "T"),
  );
  const dateStr = detailDate.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  document.getElementById("post-detail-content").innerHTML = `
          <div class="post-detail-card">
            ${post.isRepost ? `<div class="echo-strip" style="margin-bottom:12px"><svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="14" height="14"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> ${escHtml(post.author || "")} echoed</div>` : ""}
            ${
              !(post.isRepost && !post.text)
                ? `<div class="post-detail-head">
              <div class="av" style="background:${post.authorPicture ? "transparent" : color};cursor:pointer;flex-shrink:0" onclick="viewProfile(${post.userId})">${avHtml}</div>
              <div class="post-detail-author">
                <span class="post-detail-name" onclick="viewProfile(${post.userId})">${escHtml(post.author || "")}</span>
                <span class="post-detail-time">${dateStr}</span>
              </div>
              <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
                ${canDelete ? `<button class="post-del" title="Edit post" style="color:var(--accent)" onclick="openEditPostModal(${post.id})"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ""}
                ${canDelete ? `<button class="post-del" onclick="deletePost(${post.id})"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>` : ""}
                ${
                  currentUser && currentUser.id !== post.userId
                    ? (() => {
                        const isFollowing = _followingSet.has(post.userId);
                        return `<button class="btn ${isFollowing ? "btn-outline" : "btn-primary"}" id="pd-follow-btn" style="font-size:12px;padding:6px 16px;border-radius:20px" data-following="${isFollowing}" onclick="toggleFollow(${post.userId}, this)">${isFollowing ? "Following" : "Follow"}</button>`;
                      })()
                    : ""
                }
              </div>
            </div>`
                : ""
            }

            ${post.text ? `<div class="post-detail-body">${linkifyHashtags(escHtml(post.text))}</div>` : ""}

            ${(() => {
              if (post.isRepost && post.originalPost && !post.text) {
                const op = post.originalPost;
                const opColor = stringToColor(op.author || "");
                const opAvHtml = op.authorPicture
                  ? `<img src="${op.authorPicture}" alt="${escHtml((op.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
                  : escHtml((op.author || "?").charAt(0));
                return `<div class="post-detail-head">
                  <div class="av" style="background:${op.authorPicture ? "transparent" : opColor};cursor:pointer;flex-shrink:0" onclick="viewProfile(${op.userId})">${opAvHtml}</div>
                  <div class="post-detail-author">
                    <span class="post-detail-name" onclick="viewProfile(${op.userId})">${escHtml(op.author || "")}</span>
                    <span class="post-detail-time">${formatFullDate(op.createdAt)}</span>
                  </div>
                </div>
                ${op.text ? `<div class="post-detail-body">${escHtml(op.text)}</div>` : ""}
                ${
                  op.video
                    ? `<div class="post-video-wrap" onclick="openVideoLightbox(this)" data-lb-video="${op.video}" data-lb-name="${escHtml(op.author)}" data-lb-picture="${escHtml(op.authorPicture || "")}" data-lb-user-id="${op.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(op.text || "")}" title="Watch video"><video src="${op.video}" preload="metadata" playsinline muted></video><div class="post-video-play-btn"><svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.45)"/><polygon points="22,16 42,28 22,40" fill="white"/></svg></div></div>`
                    : op.image
                      ? `<img class="post-detail-img lb-thumb" src="${op.image}" loading="lazy" onclick="openLightbox(this)" data-lb-name="${escHtml(op.author)}" data-lb-picture="${escHtml(op.authorPicture || "")}" data-lb-user-id="${op.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(op.text || "")}"/>`
                      : ""
                }`;
              } else if (post.isRepost && post.originalPost && post.text) {
                return `<div class="echo-embed" style="margin-bottom:14px;cursor:pointer" onclick="openOriginalPost(${post.originalPost.id})" title="View original post by ${escHtml(post.originalPost.author || "")}">
                  <div class="echo-embed-name">${escHtml(post.originalPost.author || "")}</div>
                  ${post.originalPost.text ? `<div class="echo-embed-text">${escHtml(post.originalPost.text)}</div>` : ""}
                  ${post.originalPost.video ? `<div class="post-video-wrap echo-embed-video" onclick="event.stopPropagation();openVideoLightbox(this)" data-lb-video="${post.originalPost.video}" data-lb-name="${escHtml(post.originalPost.author)}" data-lb-picture="${escHtml(post.originalPost.authorPicture || "")}" data-lb-user-id="${post.originalPost.userId || ""}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.originalPost.text || "")}" title="Watch video" style="margin-top:8px"><video src="${post.originalPost.video}" preload="metadata" playsinline muted></video><div class="post-video-play-btn"><svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.45)"/><polygon points="22,16 42,28 22,40" fill="white"/></svg></div></div>` : post.originalPost.image ? `<img class="post-detail-img echo-embed-img lb-thumb" src="${post.originalPost.image}" loading="lazy" data-lb-name="${escHtml(post.originalPost.author)}" data-lb-picture="${escHtml(post.originalPost.authorPicture || "")}" data-lb-user-id="${post.originalPost.userId || ""}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.originalPost.text || "")}" onclick="event.stopPropagation();openLightbox(this)" title="View full image"/>` : ""}
                </div>`;
              } else if (post.video) {
                return `<div class="post-video-wrap" onclick="openVideoLightbox(this)" data-lb-video="${post.video}" data-lb-name="${escHtml(post.author)}" data-lb-picture="${escHtml(post.authorPicture || "")}" data-lb-user-id="${post.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.text || "")}" title="Watch video"><video src="${post.video}" preload="metadata" playsinline muted></video><div class="post-video-play-btn"><svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="rgba(0,0,0,0.45)"/><polygon points="22,16 42,28 22,40" fill="white"/></svg></div></div>`;
              } else if (post.image) {
                return `<img class="post-detail-img lb-thumb" src="${post.image}" loading="lazy" onclick="openLightbox(this)" data-lb-name="${escHtml(post.author)}" data-lb-picture="${escHtml(post.authorPicture || "")}" data-lb-user-id="${post.userId}" data-lb-post-id="${post.id}" data-lb-caption="${escHtml(post.text || "")}"/>`;
              }
              return "";
            })()}

            <div class="post-detail-actions">
              ${(() => {
                const isNoQuoteRepost =
                  post.isRepost && post.originalPost && !post.text;
                const targetId = isNoQuoteRepost
                  ? post.originalPost.id
                  : post.id;
                const targetLikes = isNoQuoteRepost
                  ? post.originalPost.likes || []
                  : post.likes || [];
                const targetComments = isNoQuoteRepost
                  ? post.originalPost.comments || []
                  : post.comments || [];
                const targetReposts = isNoQuoteRepost
                  ? post.originalPost.reposts || []
                  : post.reposts || [];
                const targetLiked =
                  currentUser &&
                  targetLikes.some((r) => (r.userId || r) === currentUser.id);
                const targetReposted =
                  currentUser &&
                  targetReposts.some((r) => (r.userId || r) === currentUser.id);
                function _countAllComments(arr) {
                  return (arr || []).reduce(
                    (n, c) => n + 1 + _countAllComments(c.replies || []),
                    0,
                  );
                }
                return `<button class="act-btn like-btn${targetLiked ? " liked" : ""}" id="pd-like-btn" onclick="pdToggleLike(${targetId})">
                <svg fill="${targetLiked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                <span id="pd-like-count">${targetLikes.length || 0}</span>
              </button>
              <button class="act-btn" onclick="document.getElementById('post-detail-reply-input').focus()">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span>${_countAllComments(targetComments) || ""}</span>
              </button>
              <button class="act-btn repost-btn" onclick="openRepostAsQuote(event,${targetId})">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>
                  <span>${targetReposts.length || ""}</span>
                </button>`;
              })()}
            </div>
          </div>`;

  // Show reply bar only if logged in
  const replyBar = document.getElementById("post-detail-reply-bar");
  replyBar.classList.toggle("visible", !!currentUser);

  // Show skeleton loaders while comments are being painted
  const _commentSection = document.getElementById("post-detail-comments");
  if (_commentSection) {
    const _skel = (w1, w2) => `<div class="comment-skel-item">
            <div class="comment-skel-avatar"></div>
            <div class="comment-skel-body">
              <div class="comment-skel-name"></div>
              <div class="comment-skel-line long"></div>
              <div class="comment-skel-line short"></div>
            </div>
          </div>`;
    _commentSection.innerHTML = `<div class="post-detail-comments-section">
            ${[1, 2, 3].map(_skel).join("")}
          </div>`;
  }
  // Defer real render one frame so skeletons paint first
  requestAnimationFrame(() => renderPostDetailComments(post));

  // Sync follow button state from server (authoritative) — same logic as profile tab
  if (currentUser && currentUser.id !== post.userId) {
    (async () => {
      try {
        const res = await api("GET", `/api/users/${post.userId}/profile`);
        const isFollowing = res.data?.isFollowing || false;
        // Also keep _followingSet in sync
        if (isFollowing) _followingSet.add(post.userId);
        else _followingSet.delete(post.userId);
        const btn = document.getElementById("pd-follow-btn");
        if (btn) {
          btn.dataset.following = isFollowing ? "true" : "false";
          btn.textContent = isFollowing ? "Following" : "Follow";
          btn.className = `btn ${isFollowing ? "btn-outline" : "btn-primary"}`;
          btn.style.cssText =
            "font-size:12px;padding:6px 16px;border-radius:20px";
        }
      } catch (_) {}
    })();
  }

  // Store current post id for reply use
  document.getElementById("post-detail-reply-input").dataset.postId = post.id;
}

function renderPostDetailComments(post) {
  const comments = post.comments || [];
  const section = document.getElementById("post-detail-comments");

  if (!comments.length) {
    section.innerHTML = `<div class="post-detail-comments-section"><div class="post-detail-no-comments">No replies yet. Be the first! 💬</div></div>`;
    return;
  }

  function buildAvatar(c, size) {
    const col = stringToColor(c.author || "?");
    const inner = c.authorPicture
      ? `<img src="${escHtml(c.authorPicture)}" alt="${escHtml((c.author || "?").charAt(0))}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
      : escHtml((c.author || "?").charAt(0));
    return `<div class="av${size === "xs" ? " xs" : " sm"}" style="background:${c.authorPicture ? "transparent" : col};flex-shrink:0">${inner}</div>`;
  }

  function buildReplyBtn(c) {
    return `<button class="comment-reply-btn" data-author="${escHtml(c.author || "")}" data-id="${c.id}" onclick="startReplyTo(this.dataset.author, this.dataset.id)">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
            Reply
          </button>`;
  }

  // Recursively render a comment and its replies array
  function buildCommentNode(c, isNested) {
    const repliesArr = Array.isArray(c.replies) ? c.replies : [];
    const replyCount = repliesArr.length;
    const nestedId = `replies-${c.id}`;

    const nestedHtml = replyCount
      ? `<button class="view-replies-btn" onclick="toggleReplies('${nestedId}', this)" data-count="${replyCount}">
                <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                View ${replyCount} ${replyCount === 1 ? "reply" : "replies"}
              </button>
              <div class="nested-replies" id="${nestedId}" style="display:none">
                ${repliesArr.map((r) => buildCommentNode(r, true)).join("")}
              </div>`
      : "";

    if (isNested) {
      return `<div class="nested-reply-item">
              ${buildAvatar(c, "xs")}
              <div class="post-detail-comment-bubble" style="flex:1">
                <div class="post-detail-comment-name" style="cursor:pointer" onclick="viewProfile(${c.userId || "null"})">${escHtml(c.author || "Anonymous")}</div>
                <div class="post-detail-comment-text">${escHtml(c.text || "")}</div>
                ${c.createdAt ? `<div class="post-detail-comment-time">${formatTime(c.createdAt)}</div>` : ""}
                ${buildReplyBtn(c)}
                ${nestedHtml}
              </div>
            </div>`;
    }

    return `<div class="post-detail-comment-item">
            ${buildAvatar(c, "sm")}
            <div class="post-detail-comment-content">
              <div class="post-detail-comment-bubble">
                <div class="post-detail-comment-name" style="cursor:pointer" onclick="viewProfile(${c.userId || "null"})">${escHtml(c.author || "Anonymous")}</div>
                <div class="post-detail-comment-text">${escHtml(c.text || "")}</div>
              </div>
              ${c.createdAt ? `<div class="post-detail-comment-time">${formatTime(c.createdAt)}</div>` : ""}
              ${buildReplyBtn(c)}
              ${nestedHtml}
            </div>
          </div>`;
  }

  // Count total including all nested replies
  function countAll(arr) {
    return arr.reduce(
      (n, c) => n + 1 + countAll(Array.isArray(c.replies) ? c.replies : []),
      0,
    );
  }
  const totalCount = countAll(comments);

  section.innerHTML = `<div class="post-detail-comments-section">
          <div class="post-detail-comments-title">Replies (${totalCount})</div>
          ${comments.map((c) => buildCommentNode(c, false)).join("")}
        </div>`;
}

function toggleReplies(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "flex" : "none";
  const count = btn.dataset.count;
  btn.innerHTML = isHidden
    ? `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg> Hide ${count} ${count == 1 ? "reply" : "replies"}`
    : `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg> View ${count} ${count == 1 ? "reply" : "replies"}`;
}

async function pdToggleLike(postId) {
  if (!currentUser) {
    showToast("Log in to like posts.");
    goTo("login");
    return;
  }
  await toggleLike(postId);
  // Re-render the detail view. For no-quote reposts the like targets the
  // original post ID, so we look for a repost wrapper first so the
  // repost strip and header are preserved in the re-render.
  const repostWrapper = posts.find(
    (p) =>
      p.isRepost && !p.text && p.originalPost && p.originalPost.id === postId,
  );
  const post =
    repostWrapper ||
    posts.find((p) => p.id === postId) ||
    PostCache.getPost(postId);
  if (post) renderPostDetail(post);
}

// Find a comment by id recursively across a comments tree
function findCommentById(arr, id) {
  for (const c of arr || []) {
    if (c.id === id) return c;
    const found = findCommentById(c.replies || [], id);
    if (found) return found;
  }
  return null;
}

// Fire a reply notification to the author of the parent comment (silent — never throws)
async function sendReplyNotification(postId, parentId, replyText) {
  try {
    const post =
      posts.find((p) => p.id === postId) || PostCache.getPost(postId);
    const parent = post ? findCommentById(post.comments || [], parentId) : null;
    // Don't notify yourself
    if (!parent || !parent.userId || parent.userId === currentUser.id) return;
    await api("POST", "/api/notifications", {
      type: "reply",
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorPicture: currentUser.picture || null,
      recipientId: parent.userId,
      postId,
      postSnippet: replyText.slice(0, 80),
    });
    fetchUnreadCount();
  } catch (_) {
    /* silent — notifications are best-effort */
  }
}

async function postDetailAddComment() {
  const input = document.getElementById("post-detail-reply-input");
  const postId = parseInt(input.dataset.postId);
  const text = input.value.trim();
  if (!text || !postId) return;
  if (!currentUser) {
    showToast("Log in to reply.");
    goTo("login");
    return;
  }

  // FIX: use parentId (matches server field) instead of parentCommentId
  const parentId =
    input.dataset.parentId !== undefined && input.dataset.parentId !== ""
      ? parseInt(input.dataset.parentId)
      : null;

  try {
    const body = { userId: currentUser.id, text };
    if (parentId) body.parentId = parentId;

    const res = await api("POST", `/api/posts/${postId}/comment`, body);
    const newComment = res.data; // { id, parentId, author, text, replies?, createdAt }
    input.value = "";
    cancelReply();

    const post =
      posts.find((p) => p.id === postId) || PostCache.getPost(postId);
    if (post) {
      if (!Array.isArray(post.comments)) post.comments = [];
      const commentWithReplies = {
        ...newComment,
        replies: Array.isArray(newComment.replies) ? newComment.replies : [],
      };

      if (parentId) {
        // FIX: nest reply under its parent using the replies array
        function insertReply(arr, pid, reply) {
          for (const c of arr) {
            if (c.id === pid) {
              if (!Array.isArray(c.replies)) c.replies = [];
              c.replies.push(reply);
              return true;
            }
            if (Array.isArray(c.replies) && insertReply(c.replies, pid, reply))
              return true;
          }
          return false;
        }
        if (!insertReply(post.comments, parentId, commentWithReplies)) {
          post.comments.push(commentWithReplies);
        }
      } else {
        post.comments.push(commentWithReplies);
      }

      PostCache.putPost(post);
      renderPostDetailComments(post);

      // Update stat count — count all nested
      function countAll(arr) {
        return arr.reduce(
          (n, c) => n + 1 + countAll(Array.isArray(c.replies) ? c.replies : []),
          0,
        );
      }
      const stat = document.querySelector(
        "#post-detail-content .post-detail-stat:last-child strong",
      );
      if (stat) stat.textContent = countAll(post.comments);
    }
    showToast(parentId ? "Reply posted! 💬" : "Comment posted! 💬");
    if (parentId) sendReplyNotification(postId, parentId, text);
  } catch (e) {
    showToast("Failed to post reply: " + e.message);
  }
}

function startReplyTo(authorName, commentId) {
  const input = document.getElementById("post-detail-reply-input");
  const banner = document.getElementById("reply-to-banner");
  const label = document.getElementById("reply-to-label");

  // FIX: store as parentId to match what postDetailAddComment and the server expect
  input.dataset.parentId = commentId;
  label.innerHTML = `Replying to <strong>${escHtml(authorName)}</strong>`;
  banner.style.display = "flex";
  input.placeholder = `Reply to ${authorName}…`;
  input.focus();
  // Scroll input into view on mobile
  setTimeout(
    () => input.scrollIntoView({ behavior: "smooth", block: "center" }),
    100,
  );
}

function cancelReply() {
  const input = document.getElementById("post-detail-reply-input");
  const banner = document.getElementById("reply-to-banner");
  // FIX: delete parentId (was parentCommentId)
  delete input.dataset.parentId;
  input.placeholder = "Write a reply…";
  banner.style.display = "none";
}

function mobileOpenCompose() {
  if (!currentUser) {
    showToast("Log in to create a post.");
    goTo("login");
    return;
  }
  openComposeTab();
}

let _composePrevView = "feed";
let _composeTabPendingImage = null;
let _composeTabPendingVideo = null;
let _composeTabVideoCompressed = false; // true only when client compression succeeded

function openComposeTab() {
  // Remember where we came from
  const active = document.querySelector(".view.active");
  _composePrevView = active ? active.id.replace("view-", "") : "feed";

  // Set avatar
  const av = document.getElementById("compose-tab-av");
  if (av && currentUser) {
    if (currentUser.picture) {
      av.innerHTML = `<img src="${currentUser.picture}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`;
      av.style.background = "transparent";
    } else {
      av.textContent = (currentUser.name || "?").charAt(0).toUpperCase();
      av.style.background = stringToColor(currentUser.name || "");
    }
  }

  // Reset state
  document.getElementById("compose-tab-text").value = "";
  document.getElementById("compose-tab-char-count").textContent = "";
  removeComposeTabMedia();
  _resetLinkPreview();
  document.getElementById("compose-tab-submit").disabled = false;
  document.getElementById("compose-tab-submit").textContent = "Post";

  goTo("compose");
  setTimeout(() => document.getElementById("compose-tab-text").focus(), 150);
}

// ── Compose link preview ─────────────────────────────────────────
let _linkPreviewUrl = null;
let _linkPreviewDismissed = false;
let _linkPreviewTimer = null;

function composeTabDetectLink(text) {
  if (_linkPreviewDismissed) return;
  const match = text.match(/(?:https?:\/\/|(?<![/\w])www\.)[^\s]+/);
  const rawUrl = match ? match[0] : null;
  const url = rawUrl && rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
  if (url === _linkPreviewUrl) return;
  _linkPreviewUrl = url;
  clearTimeout(_linkPreviewTimer);
  if (!url) { _hideLinkPreview(); return; }
  _linkPreviewTimer = setTimeout(() => _fetchLinkPreview(url), 600);
}

async function _fetchLinkPreview(url) {
  const card = document.getElementById("compose-link-preview");
  if (!card) return;
  card.style.display = "block";
  card.innerHTML = '<div class="compose-link-preview-loading">Fetching preview…</div>';
  try {
    const res = await fetch(`${API}/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const title  = data.title || "";
    const desc   = data.description || "";
    const img    = data.image || "";
    const domain = new URL(url).hostname.replace(/^www\./, "");
    if (!title && !desc) { _hideLinkPreview(); return; }
    _renderLinkPreview({ title, desc, img, domain });
  } catch {
    _hideLinkPreview();
  }
}

function _renderLinkPreview({ title, desc, img, domain }) {
  const card = document.getElementById("compose-link-preview");
  if (!card) return;
  card.innerHTML = `
    <button class="compose-link-preview-dismiss" onclick="dismissLinkPreview()" aria-label="Remove preview">✕</button>
    <div class="compose-link-preview-img-wrap" id="compose-link-preview-img-wrap" style="display:${img ? 'block' : 'none'}">
      <img id="compose-link-preview-img" src="${img}" alt="" onerror="this.parentElement.style.display='none'"/>
    </div>
    <div class="compose-link-preview-body">
      <span class="compose-link-preview-domain">${domain}</span>
      <span class="compose-link-preview-title">${title}</span>
      ${desc ? `<span class="compose-link-preview-desc">${desc}</span>` : ""}
    </div>`;
  card.style.display = "block";
}

function _hideLinkPreview() {
  const card = document.getElementById("compose-link-preview");
  if (card) card.style.display = "none";
}

function dismissLinkPreview() {
  _linkPreviewDismissed = true;
  _hideLinkPreview();
}

function _resetLinkPreview() {
  _linkPreviewUrl = null;
  _linkPreviewDismissed = false;
  clearTimeout(_linkPreviewTimer);
  _hideLinkPreview();
}

// \u2500\u2500 Post-card link previews \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Fetches and renders link preview cards inside post cards that have
// a URL in their text but no image/video media.
const _postCardLpCache = {};  // url \u2192 {title,desc,img,domain} | null

function _initPostCardLinkPreviews() {
  const placeholders = document.querySelectorAll(".post-link-preview[data-preview-url]:not([data-lp-loaded])");
  if (!placeholders.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      observer.unobserve(el);
      _loadPostCardLinkPreview(el);
    });
  }, { rootMargin: "200px" });

  placeholders.forEach((el) => observer.observe(el));
}

async function _loadPostCardLinkPreview(el) {
  if (el.dataset.lpLoaded) return;
  el.dataset.lpLoaded = "1";
  const url = el.dataset.previewUrl;
  if (!url) { el.style.display = "none"; return; }

  // Cache hit
  if (_postCardLpCache[url] !== undefined) {
    _renderPostCardLinkPreview(el, url, _postCardLpCache[url]);
    return;
  }

  try {
    const res = await fetch(`${API}/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("failed");
    const data = await res.json();
    const title  = data.title || "";
    const desc   = data.description || "";
    const img    = data.image || "";
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    if (!title && !desc) {
      _postCardLpCache[url] = null;
      el.style.display = "none";
      return;
    }
    const preview = { title, desc, img, domain, url };
    _postCardLpCache[url] = preview;
    _renderPostCardLinkPreview(el, url, preview);
  } catch {
    _postCardLpCache[url] = null;
    el.style.display = "none";
  }
}

function _renderPostCardLinkPreview(el, url, data) {
  if (!data) { el.style.display = "none"; return; }
  const { title, desc, img, domain } = data;
  el.innerHTML = `
    <a class="post-link-preview-inner" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
      ${img ? `<div class="post-link-preview-img-wrap"><img src="${escHtml(img)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"/></div>` : ""}
      <div class="post-link-preview-body">
        <span class="compose-link-preview-domain">${escHtml(domain)}</span>
        <span class="compose-link-preview-title">${escHtml(title)}</span>
        ${desc ? `<span class="compose-link-preview-desc">${escHtml(desc)}</span>` : ""}
      </div>
    </a>`;
}

function closeComposeTab() {
  removeComposeTabMedia();
  _resetLinkPreview();
  // Reset progress bar
  const progressWrap = document.getElementById("compose-tab-progress");
  const progressBar = document.getElementById("compose-tab-progress-bar");
  if (progressWrap) progressWrap.classList.remove("active");
  if (progressBar) {
    progressBar.style.transition = "none";
    progressBar.style.width = "0%";
    setTimeout(() => {
      progressBar.style.transition = "";
    }, 50);
  }
  goTo(_composePrevView);
}

function handleComposeBackdropClick(e) {
  // On desktop the modal inner div sits inside the backdrop — close if user clicks the backdrop itself
  if (e.target === document.getElementById("view-compose")) closeComposeTab();
}

function composeTabInput(el) {
  const len = el.value.length;
  const MAX = 280;
  const counter = document.getElementById("compose-tab-char-count");
  if (len === 0) {
    counter.textContent = "";
    counter.className = "compose-tab-char-count";
  } else {
    counter.textContent = `${len} / ${MAX}`;
    counter.className =
      "compose-tab-char-count" +
      (len > MAX ? " over" : len > MAX * 0.85 ? " warn" : "");
  }
}

async function composeTabPreviewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("Image must be under 10 MB.");
    event.target.value = "";
    return;
  }
  _composeTabPendingVideo = null;
  const imgEl = document.getElementById("compose-tab-img-preview");
  const vidEl = document.getElementById("compose-tab-video-preview");
  const wrapEl = document.getElementById("compose-tab-media-preview");
  // Show raw instantly
  const rawUrl = URL.createObjectURL(file);
  imgEl.src = rawUrl;
  imgEl.style.display = "block";
  vidEl.style.display = "none";
  vidEl.src = "";
  wrapEl.style.display = "block";
  try {
    const compressed = await compressImage(file);
    _composeTabPendingImage = compressed; // store compressed File for FormData upload
    const compressedUrl = URL.createObjectURL(compressed);
    imgEl.onload = () => URL.revokeObjectURL(compressedUrl);
    imgEl.src = compressedUrl;
    URL.revokeObjectURL(rawUrl);
  } catch (err) {
    console.warn("[Circle] Image compression failed, using original:", err);
    _composeTabPendingImage = file;
  }
}

async function composeTabPreviewVideo(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 200 * 1024 * 1024) {
    showToast("Video must be under 200 MB.");
    return;
  }
  _composeTabPendingImage = null;

  const vidEl = document.getElementById("compose-tab-video-preview");
  const imgEl = document.getElementById("compose-tab-img-preview");
  const wrapEl = document.getElementById("compose-tab-media-preview");
  const progressWrap = document.getElementById("compose-tab-progress");
  const progressBar = document.getElementById("compose-tab-progress-bar");
  const submitBtn = document.getElementById("compose-tab-submit");

  // Show raw video immediately
  const rawUrl = URL.createObjectURL(file);
  vidEl.src = rawUrl;
  vidEl.style.display = "block";
  imgEl.style.display = "none";
  imgEl.src = "";
  wrapEl.style.display = "block";

  // Lock Post button, activate progress bar
  submitBtn.disabled = true;
  submitBtn.textContent = "Compressing…";
  progressWrap.classList.add("active");
  progressBar.style.width = "2%";

  _composeTabPendingVideo = file; // fallback
  _composeTabVideoCompressed = false;

  try {
    const compressed = await compressVideo(file, (pct) => {
      progressBar.style.width = pct + "%";
      submitBtn.textContent = pct < 100 ? `Compressing… ${pct}%` : "Post";
    });
    _composeTabPendingVideo = compressed;
    _composeTabVideoCompressed = true; // client compression succeeded
    URL.revokeObjectURL(rawUrl);
    vidEl.src = URL.createObjectURL(compressed);
  } catch (err) {
    console.warn("[Circle] Video compression failed, using original:", err);
    const msg = _ffmpegUnavailable
      ? "Compressor unavailable — uploading original video."
      : "Compression failed — uploading original.";
    showToast(msg);
  } finally {
    // Reset progress bar and restore button
    progressBar.style.width = "0%";
    progressWrap.classList.remove("active");
    submitBtn.disabled = false;
    submitBtn.textContent = "Post";
  }
}

function removeComposeTabMedia() {
  _composeTabPendingImage = null;
  _composeTabPendingVideo = null;
  _composeTabVideoCompressed = false;
  const img = document.getElementById("compose-tab-img-preview");
  const vid = document.getElementById("compose-tab-video-preview");
  if (img) {
    img.src = "";
    img.style.display = "none";
  }
  if (vid) {
    vid.pause();
    vid.src = "";
    vid.style.display = "none";
  }
  const wrap = document.getElementById("compose-tab-media-preview");
  if (wrap) wrap.style.display = "none";
  const ii = document.getElementById("compose-tab-img-input");
  const vi = document.getElementById("compose-tab-video-input");
  if (ii) ii.value = "";
  if (vi) vi.value = "";
}

async function createPostFromTab() {
  if (!currentUser) return;
  const text = document.getElementById("compose-tab-text").value.trim();
  if (!text && !_composeTabPendingImage && !_composeTabPendingVideo) {
    showToast("Write something or add a photo/video!");
    return;
  }
  const btn = document.getElementById("compose-tab-submit");
  const progressWrap = document.getElementById("compose-tab-progress");
  const progressBar = document.getElementById("compose-tab-progress-bar");

  // Start progress
  btn.disabled = true;
  btn.textContent = "Posting…";
  progressWrap.classList.add("active");
  progressBar.style.width = "15%";

  // Simulate progress stages while the request is in-flight
  let currentWidth = 15;
  const progressInterval = setInterval(() => {
    // Ease toward 85% but never reach it — the final jump happens on success
    const remaining = 85 - currentWidth;
    currentWidth += remaining * 0.12;
    progressBar.style.width = currentWidth + "%";
  }, 300);

  try {
    const fd = new FormData();
    fd.append("text", text);
    if (_composeTabPendingImage instanceof File)
      fd.append("image", _composeTabPendingImage);
    if (_composeTabPendingVideo instanceof File) {
      fd.append("video", _composeTabPendingVideo);
      fd.append("video_compressed", _composeTabVideoCompressed ? "1" : "0");
    }

    const res = await api("POST", "/api/posts", fd);

    clearInterval(progressInterval);
    // Jump to 100% then close
    progressBar.style.width = "100%";
    await new Promise((r) => setTimeout(r, 350));

    const newPost = res.data;
    PostCache.putPost(newPost);
    PostCache.invalidateFeed(currentFeedTab);
    posts.unshift(newPost);
    renderFeed();
    showToast("Posted! ✨");
    loadTrending(true);
    closeComposeTab();
  } catch (e) {
    clearInterval(progressInterval);
    // Drain back to 0 on failure
    progressBar.style.transition = "width 0.3s ease";
    progressBar.style.width = "0%";
    setTimeout(() => {
      progressWrap.classList.remove("active");
      progressBar.style.transition = "";
    }, 350);
    showToast("Error: " + e.message);
    btn.disabled = false;
    btn.textContent = "Post";
  }
}

function togglePw(fieldId, btn) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  btn.innerHTML = showing
    ? '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  input.focus();
}

/* ── Lazy-load Intersection Observer ──────────────────────────────
         Uses IntersectionObserver for a smooth fade-in on content images.
         Handles three cases:
           1. Images present in the DOM at parse time (static HTML)
           2. Images injected later by JS (posts, avatars, comments)
           3. Images inside views that are display:none when first observed
              — re-scanned whenever goTo() makes a view visible.
      ──────────────────────────────────────────────────────────────── */
/* ── Hide mobile nav on scroll down, reveal on scroll up ────────── */
(function initNavHide() {
  const nav = document.querySelector(".mobile-nav");
  if (!nav) return;
  let lastY = window.scrollY;
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;
        const scrollingDown = delta > 8;
        const scrollingUp = delta < -8;
        const onFeed = document
          .getElementById("view-feed")
          ?.classList.contains("active");
        const fab = document.getElementById("fab-create-btn");
        if (scrollingDown) {
          nav.classList.add("nav-hidden");
          if (fab) fab.classList.add("fab-hidden");
          if (onFeed)
            document.querySelector(".topbar")?.classList.add("topbar-hidden");
        } else if (scrollingUp) {
          nav.classList.remove("nav-hidden");
          if (fab) fab.classList.remove("fab-hidden");
          if (onFeed)
            document
              .querySelector(".topbar")
              ?.classList.remove("topbar-hidden");
        }
        lastY = currentY;
        ticking = false;
      });
    },
    { passive: true },
  );
})();

(function initLazyFade() {
  // These UI-critical images must always be visible instantly.
  const SKIP_IDS = new Set(["lb-img", "img-preview", "modal-orig-img"]);

  function shouldFade(img) {
    if (SKIP_IDS.has(img.id)) return false;
    if (!img.getAttribute("loading")) return false;
    return true;
  }

  function revealImg(img) {
    img.classList.remove("lazy");
    img.classList.add("loaded");
  }

  function scheduleReveal(img) {
    if (img.complete && img.naturalWidth > 0) {
      revealImg(img);
    } else {
      img.addEventListener("load", () => revealImg(img), { once: true });
      img.addEventListener("error", () => revealImg(img), { once: true });
    }
  }

  // IO fires when image scrolls into the 200px pre-load buffer
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        scheduleReveal(entry.target);
      });
    },
    { rootMargin: "200px 0px" },
  );

  function observeImg(img) {
    if (!shouldFade(img) || img.dataset.lazyObserved) return;
    img.dataset.lazyObserved = "1";

    // If the image or any ancestor is hidden (display:none), the IO
    // will never fire. Reveal immediately in that case so the image
    // is never stuck invisible when the view later becomes visible.
    function isHidden(el) {
      while (el && el !== document.body) {
        if (getComputedStyle(el).display === "none") return true;
        el = el.parentElement;
      }
      return false;
    }

    if (isHidden(img)) {
      // Don't apply fade — just ensure it shows when the view opens
      return;
    }

    img.classList.add("lazy");
    if (img.complete && img.naturalWidth > 0) {
      revealImg(img);
    } else {
      io.observe(img);
    }
  }

  // Scan a container (or whole doc) for unobserved lazy images
  function scanImages(root) {
    (root || document)
      .querySelectorAll('img[loading="lazy"]')
      .forEach(observeImg);
  }
  scanImages();

  // MutationObserver: cover images injected by JS after initial render
  const mo = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === "IMG") observeImg(node);
        else if (node.querySelectorAll) scanImages(node);
      });
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Hook into goTo so images in a newly-visible view get observed.
  // Images that were hidden when first scanned (isHidden → skipped)
  // are now in a visible container and will fade in correctly.
  const _origGoTo = window.goTo;
  window.goTo = function (view) {
    _origGoTo(view);
    // Let the view become visible in the next frame before scanning
    requestAnimationFrame(() => {
      const el = document.getElementById("view-" + view);
      if (el) {
        el.querySelectorAll('img[loading="lazy"]').forEach((img) => {
          if (img.dataset.lazyObserved) return;
          img.classList.add("lazy");
          img.dataset.lazyObserved = "1";
          if (img.complete && img.naturalWidth > 0) {
            revealImg(img);
          } else {
            io.observe(img);
          }
        });
      }
    });
  };
})();