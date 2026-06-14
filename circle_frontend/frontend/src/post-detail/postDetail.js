// ═══════════════════════════════════════════════════════════
//  POST DETAIL + COMPOSE — extracted from main.js
//  Load AFTER router.js and main.js globals are ready
//
//  Exports (globals): goToPostDetail, openPostDetail, closePostDetail,
//    openOriginalPost, renderPostDetail, renderPostDetailComments,
//    toggleReplies, pdToggleLike, findCommentById, postDetailAddComment,
//    startReplyTo, cancelReply, mobileOpenCompose, openComposeTab,
//    closeComposeTab, createPostFromTab, composeTabInput,
//    composeTabPreviewImage, composeTabPreviewVideo, removeComposeTabMedia,
//    composeTabDetectLink, dismissLinkPreview, handleComposeBackdropClick,
//    togglePw
// ═══════════════════════════════════════════════════════════

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