

/* Profile picture / avatar / follow → profile/profile.js */

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
  return `<div class="notif-item${n.isRead ? "" : " unread"}" onclick="onNotifClick(${n.id}, ${n.postId || "null"}, '${n.type}', ${n.actorId || "null"}, ${n.sessionId ? `'${n.sessionId}'` : "null"})">
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

async function onNotifClick(notifId, postId, type, actorId, sessionId) {
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
  } else if (type === "live" && sessionId) {
    // Try to open the live stream; fall back to feed if it has ended
    if (typeof Live !== "undefined") {
      Live.watchSession(sessionId).catch(() => goTo("feed"));
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
