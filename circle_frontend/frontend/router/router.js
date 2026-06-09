// ═══════════════════════════════════════════════════════════
//  CIRCLE ROUTER  — client-side routing engine
//  Extracted from main.js — load AFTER api.js, BEFORE main.js
// ═══════════════════════════════════════════════════════════

// Internal flag — prevents popstate handler from pushing duplicate entries
let _historyNavigating = false;

// Views that should never create a history entry (auth guards / redirects)
const _noHistoryViews = new Set(["login", "register", "reset", "new-password"]);

// ── Navigation stack for back button ────────────────────────────
// Tracks the sequence of views visited so goBack() can return to the previous one.
// Feed is the root — back from any view goes at least to feed.
const _navStack = ["feed"];

function goBack() {
  if (_navStack.length > 1) {
    _navStack.pop();
    const prev = _navStack[_navStack.length - 1];
    _historyNavigating = true;
    goTo(prev);
    _historyNavigating = false;
  } else {
    _historyNavigating = true;
    goTo("feed");
    _historyNavigating = false;
  }
}

function _updateBackButtons(view) {
  const showBack = view !== "feed" && !_noHistoryViews.has(view);
  document.querySelectorAll(".back-btn").forEach((btn) => {
    btn.style.display = showBack ? "" : "none";
  });
}

// ── Route table ──────────────────────────────────────────────
// Each entry: { path, view, auth?, noAuth?, title }
//   auth   — true = redirect to /login if not logged in
//   noAuth — true = redirect to /  if already logged in
//   title  — static string OR function(params, query) → string
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
  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement("meta");
    ogUrl.setAttribute("property", "og:url");
    document.head.appendChild(ogUrl);
  }
  ogUrl.setAttribute("content", window.location.href);
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
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  el.classList.add("active");
  document.title = "Not Found · Circle";
  history.replaceState({ view: "404" }, "", window.location.pathname);
}

// ── View transition animation ────────────────────────────────
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

// ═══════════════════════════════════════════════════════════
//  goTo — main navigation function
// ═══════════════════════════════════════════════════════════
window.goTo = function goTo(view, _opts = {}) {
  // ── Route guard ──────────────────────────────────────────
  const matched = _routes.find((r) => r.view === view);
  if (matched) {
    const guard = _runGuards(matched);
    if (!guard.allow) {
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

  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const viewEl = document.getElementById("view-" + view);
  if (!viewEl) {
    _show404();
    return;
  }
  viewEl.classList.add("active");
  _animateViewIn(viewEl);

  // Widen content for feed and messages views
  const contentEl = document.querySelector(".content");
  if (contentEl) {
    contentEl.classList.toggle("feed-active", view === "feed");
    contentEl.classList.toggle("messages-active", view === "messages");
  }

  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  const sn = document.getElementById("snav-" + view);
  if (sn) sn.classList.add("active");

  document.querySelectorAll(".mnav-item").forEach((n) => n.classList.remove("active"));
  const mn = document.getElementById("mnav-" + view);
  if (mn) mn.classList.add("active");

  // Topbar: only visible on feed
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
    DM.stopHeartbeat();
  }
  if (view === "messages") {
    if (!currentUser) {
      goTo("login");
      return;
    }
    DM.init();
    DM.clearDMBadge();
    DM.startHeartbeat();
  }

  if (view === "feed") {
    resumeFeed();
    if (typeof Live !== "undefined") Live.loadActiveSessions();
  }
  if (view !== "feed") _stopLivePolling();
  if (view === "profile") renderProfile();
  if (view === "feed" && currentUser && !_suggestionsLoaded) loadSuggestions();
  if (view === "feed" && currentUser && !_newMembersLoaded) loadNewMembers();
  if (view === "feed") loadTrending();
  if (view === "feed" && !currentUser) {
    const sw = document.getElementById("suggestions-widget");
    if (sw) sw.style.display = "none";
    const ft = document.getElementById("feed-tabs");
    if (ft) ft.style.display = "flex";
    const ftFollowing = document.getElementById("ftab-following");
    if (ftFollowing) ftFollowing.style.opacity = "0.5";
  }
  if (view === "settings") populateSettings();
  if (view === "explore") loadExplore();
  if (view === "groups") loadGroups();
  if (view === "articles") { window.location.href = "https://www.circlenet.social/articles"; return; }
  if (view === "search") {
    searchTab = "posts";
    document.getElementById("search-input").value = "";
    renderSearchHint();
    var stSection = document.getElementById("search-trending-section");
    if (stSection) stSection.style.display = "block";
    loadTrending();
  }

  if (view !== "feed") window.scrollTo(0, 0);

  // ── Navigation stack ────────────────────────────────────────
  if (!_historyNavigating) {
    if (_navStack[_navStack.length - 1] !== view) {
      if (_navStack.length >= 20) _navStack.shift();
      _navStack.push(view);
    }
  }

  _updateBackButtons(view);

  // ── History API ──────────────────────────────────────────────
  if (!_historyNavigating && !_noHistoryViews.has(view)) {
    const state = { view, ..._opts };
    const url = _viewToPath(view, _opts);
    history.pushState(state, "", url);
  }

  // ── Update page title + og meta ──────────────────────────────
  if (matched) {
    const query = Object.fromEntries(
      new URLSearchParams(window.location.search),
    );
    _updateMeta(matched, _opts, query);
  }

  // ── Inject copy-link button on shareable views ───────────────
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

// ═══════════════════════════════════════════════════════════
//  Router boot listeners
//  Call Router.initListeners() from inside boot() in main.js
//  after currentUser and core state are ready.
// ═══════════════════════════════════════════════════════════
const Router = {
  /**
   * Wire up the popstate (browser back) handler and cold-start
   * push-notification deep-link handler.
   * Must be called from inside boot() after currentUser is set.
   */
  initListeners() {
    // ── Android / browser back button ────────────────────────
    window.addEventListener("popstate", (e) => {
      const state = e.state;
      if (!state || !state.view) return;
      _historyNavigating = true;
      try {
        if (state.view === "profile") {
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

    // ── Cold-start push notification deep-link ────────────────
    // When the user taps a notification while the app is closed the SW
    // opens a new tab with a hash like #notif:post:42 or #notif:profile:7.
    const _coldHash = window.location.hash;
    if (_coldHash && _coldHash.startsWith("#notif:")) {
      history.replaceState(
        { view: "feed" },
        "",
        window.location.pathname + window.location.search,
      );
      const parts = _coldHash.slice(1).split(":");
      const _coldTarget = parts[1];
      const _coldId = parts[2];

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
  },

  // Expose internals for external modules that need them
  matchRoute: _matchRoute,
  pathToState: _pathToState,
  viewToPath: _viewToPath,
  setPageTitle: _setPageTitle,
};