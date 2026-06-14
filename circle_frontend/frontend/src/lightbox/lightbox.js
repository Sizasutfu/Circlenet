/* ═══════════════════════════════════════════
   lightbox.js — extracted from main.js
   Depends on globals: posts, currentUser, PostCache, api,
   escHtml, stringToColor, formatTime, showToast, goTo,
   viewProfile, openQuoteModal, sendReplyNotification
   ═══════════════════════════════════════════ */

/* PROFILE PICTURE LIGHTBOX (other users) */
function openProfilePicLightbox(picUrl, userName) {
  // Reuse the existing lightbox overlay in a minimal "profile pic" mode:
  // no carousel controls, no post actions — just the photo + a name chip.
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbVid = document.getElementById("lb-video");
  const lbActs = document.getElementById("lb-actions");
  const lbHint = document.getElementById("lb-hint");
  const lbPrev = document.getElementById("lb-prev");
  const lbNext = document.getElementById("lb-next");
  const lbCtr = document.getElementById("lb-counter");
  const lbProf = document.getElementById("lb-profile");
  const lbCommPanel = document.getElementById("lb-comments-panel");
  const lbRepPanel = document.getElementById("lb-report-panel");

  // Hide everything that doesn't apply to a standalone avatar view
  if (lbVid) {
    lbVid.pause && lbVid.pause();
    lbVid.style.display = "none";
    lbVid.src = "";
  }
  if (lbActs) lbActs.style.display = "none";
  if (lbHint) lbHint.style.opacity = "0";
  if (lbPrev) lbPrev.style.display = "none";
  if (lbNext) lbNext.style.display = "none";
  if (lbCtr) lbCtr.style.display = "none";
  if (lbCommPanel) {
    lbCommPanel.style.display = "none";
  }
  if (lbRepPanel) {
    lbRepPanel.style.display = "none";
  }

  // Show the profile chip with just the user's name (no nav to their profile
  // since we're already on it)
  if (lbProf) {
    lbProf.style.display = "flex";
    lbProf.onclick = null;
    lbProf.style.cursor = "default";
    lbProf.onmouseover = null;
    lbProf.onmouseout = null;
    lbProf.innerHTML = `<span style="font-size:14px;font-weight:700;color:#fff;letter-spacing:-0.2px">${escHtml(userName)}'s photo</span>`;
  }

  // Display the avatar full-size
  lbImg.style.display = "";
  lbImg.style.transition = "none";
  lbImg.style.transform = "scale(0.88)";
  lbImg.style.opacity = "0";
  lbImg.src = picUrl;

  lb.style.display = "flex";
  lb.style.opacity = "0";
  lb.style.transition = "opacity 0.18s ease";
  document.body.style.overflow = "hidden";

  // Mark the lightbox so closeLightbox() knows to restore lb-actions
  lb.dataset.profilePicMode = "1";

  requestAnimationFrame(() => {
    lb.style.opacity = "1";
    lbImg.style.transition =
      "transform 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.2s ease";
    lbImg.style.transform = "scale(1)";
    lbImg.style.opacity = "1";
  });
}

/* ═══════════════════════════════════════════
         LIGHTBOX — image viewer
      ═══════════════════════════════════════════ */

/* ── State ── */
// _lbItems: [{type:'image'|'video', src, meta:{name,picture,userId,postId,caption}}]
let _lbItems = [],
  _lbIndex = 0,
  _lbScale = 1,
  _lbOrigin = null;
let _lbDragStartX = 0,
  _lbDragStartY = 0,
  _lbTranslateX = 0,
  _lbTranslateY = 0;
let _lbPinchStartDist = 0,
  _lbPointers = new Map();
let _lbSwipeStartX = 0,
  _lbSwiping = false,
  _lbAnimating = false;
// Legacy aliases kept so other code referencing them still works
let _lbMeta = [];
let _lbPostId = null;
// Computed helpers
function _lbCurrent() {
  return _lbItems[_lbIndex] || null;
}
function _lbIsVideo() {
  const c = _lbCurrent();
  return c && c.type === "video";
}

/* ── Render profile chip ── */
function _lbRenderProfile(idx) {
  const item = _lbItems[idx] || null;
  const meta = (item && item.meta) || {};
  const chip = document.getElementById("lb-profile");
  const av = document.getElementById("lb-profile-av");
  const nm = document.getElementById("lb-profile-name");
  if (!meta.name) {
    chip.style.display = "none";
  } else {
    nm.textContent = meta.name;
    // Parse to number so strict equality works in viewProfile/renderProfile
    const uid = meta.userId ? parseInt(meta.userId, 10) : null;
    chip.onclick = function () {
      closeLightbox();
      // Wait for the lightbox fade-out (180ms) before navigating
      if (uid)
        setTimeout(function () {
          viewProfile(uid);
        }, 200);
    };
    if (meta.picture) {
      av.innerHTML =
        '<img src="' +
        meta.picture +
        '" alt="' +
        escHtml(meta.name.charAt(0)) +
        '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>';
      av.style.background = "transparent";
    } else {
      av.innerHTML = escHtml(meta.name.charAt(0).toUpperCase());
      av.style.background = stringToColor(meta.name);
    }
    chip.style.display = "flex";
    chip.style.animation = "none";
    chip.offsetHeight;
    chip.style.animation =
      "lbFadeSlideDown 0.3s cubic-bezier(0.34,1.4,0.64,1) both";
  }

  // ── Caption ──
  const captionEl = document.getElementById("lb-caption");
  if (captionEl) {
    const cap = meta.caption || "";
    if (cap) {
      captionEl.textContent = cap;
      captionEl.style.display = "block";
    } else {
      captionEl.style.display = "none";
    }
  }

  // ── Action buttons (like / comment / repost) ──
  _lbPostId = meta ? meta.postId || null : null;
  _lbUpdateActions();
}

/* ── Update lightbox action counts and liked state ── */
function _lbUpdateActions() {
  const actionsEl = document.getElementById("lb-actions");
  if (!actionsEl) return;
  if (!_lbPostId) {
    actionsEl.style.display = "none";
    return;
  }
  actionsEl.style.display = "flex";

  const post =
    PostCache.getPost(_lbPostId) || posts.find((p) => p.id === _lbPostId);
  if (!post) return;

  const liked =
    currentUser &&
    Array.isArray(post.likes) &&
    post.likes.includes(currentUser.id);
  const likeBtn = document.getElementById("lb-like-btn");
  const likeIcon = document.getElementById("lb-like-icon");
  const likeCount = document.getElementById("lb-like-count");
  const reposted =
    currentUser &&
    Array.isArray(post.reposts) &&
    post.reposts.includes(currentUser.id);
  const repostBtn = document.getElementById("lb-repost-btn");

  if (likeBtn) {
    if (liked) {
      likeBtn.classList.add("lb-liked");
      likeBtn.style.background = "rgba(255,95,122,0.35)";
      likeBtn.style.borderColor = "rgba(255,95,122,0.5)";
      likeIcon.setAttribute("fill", "#ff5f7a");
      likeIcon.setAttribute("stroke", "#ff5f7a");
    } else {
      likeBtn.classList.remove("lb-liked");
      likeBtn.style.background = "rgba(255,255,255,0.1)";
      likeBtn.style.borderColor = "rgba(255,255,255,0.15)";
      likeIcon.setAttribute("fill", "none");
      likeIcon.setAttribute("stroke", "currentColor");
    }
  }
  if (likeCount)
    likeCount.textContent = Array.isArray(post.likes) ? post.likes.length : 0;

  const commentCount = document.getElementById("lb-comment-count");
  if (commentCount) {
    function _lbCountAll(a) {
      return (a || []).reduce(
        (n, c) => n + 1 + _lbCountAll(c.replies || []),
        0,
      );
    }
    commentCount.textContent = _lbCountAll(post.comments);
  }

  const repostCount = document.getElementById("lb-repost-count");
  if (repostCount)
    repostCount.textContent = Array.isArray(post.reposts)
      ? post.reposts.length
      : 0;

  if (repostBtn) {
    if (reposted) {
      repostBtn.style.background = "none";
      repostBtn.style.color = "#22d48f";
    } else {
      repostBtn.style.background = "none";
      repostBtn.style.color = "#fff";
    }
  }
}

/* ── Lightbox like toggle ── */
async function lbToggleLike() {
  if (!currentUser) {
    showToast("Log in to like.");
    closeLightbox();
    goTo("login");
    return;
  }
  if (!_lbPostId) return;
  // Re-use the existing toggleLike machinery if available
  const cardLikeBtn = document.querySelector(
    `.act-btn[data-post-id="${_lbPostId}"].like-btn`,
  );
  if (cardLikeBtn) {
    cardLikeBtn.click();
    setTimeout(_lbUpdateActions, 300);
    return;
  }
  // Fallback: call API directly
  const post =
    PostCache.getPost(_lbPostId) || posts.find((p) => p.id === _lbPostId);
  if (!post) return;
  const alreadyLiked =
    Array.isArray(post.likes) && post.likes.includes(currentUser.id);
  try {
    await api("POST", `/api/posts/${_lbPostId}/like`);
    PostCache.patchPost(_lbPostId, (p) => {
      if (!Array.isArray(p.likes)) p.likes = [];
      if (alreadyLiked) p.likes = p.likes.filter((id) => id !== currentUser.id);
      else p.likes.push(currentUser.id);
    });
    const cached = PostCache.getPost(_lbPostId);
    if (cached) {
      const idx = posts.findIndex((p) => p.id === _lbPostId);
      if (idx >= 0) posts[idx] = cached;
    }
    _lbUpdateActions();
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

/* ── Lightbox TikTok-style comment panel ── */
function lbOpenComments() {
  if (!_lbPostId) return;
  const panel = document.getElementById("lb-comments-panel");
  if (!panel) return;

  // Populate composer avatar
  const composeAv = document.getElementById("lb-compose-av");
  if (composeAv && currentUser) {
    if (currentUser.picture) {
      composeAv.style.background = "transparent";
      composeAv.innerHTML = `<img src="${currentUser.picture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" alt="${(currentUser.name || "?").charAt(0)}"/>`;
    } else {
      composeAv.innerHTML = (currentUser.name || "?").charAt(0).toUpperCase();
      composeAv.style.background = stringToColor(currentUser.name || "");
    }
  } else if (composeAv) {
    composeAv.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    composeAv.style.background = "rgba(255,255,255,0.1)";
  }

  // Show panel with slide-up animation (close report panel if open)
  lbCloseReport && lbCloseReport();
  panel.style.display = "flex";
  panel.style.animation = "none";
  panel.offsetHeight; // reflow
  panel.style.animation =
    "lbCommentsSlideUp 0.32s cubic-bezier(0.34,1.2,0.64,1) both";

  // Nudge the actions bar left so it doesn't overlap the panel
  const actions = document.getElementById("lb-actions");
  if (actions) {
    actions.style.transition = "right 0.3s cubic-bezier(0.34,1.2,0.64,1)";
    actions.style.right = Math.min(420, window.innerWidth) + 20 + "px";
  }

  _lbRenderComments();
  setTimeout(() => document.getElementById("lb-comment-input")?.focus(), 350);
}

function lbCloseComments() {
  lbCancelReply();
  const panel = document.getElementById("lb-comments-panel");
  if (!panel) return;
  panel.style.transition = "transform 0.22s ease, opacity 0.22s ease";
  panel.style.transform = "translateY(100%)";
  panel.style.opacity = "0";
  setTimeout(() => {
    panel.style.display = "none";
    panel.style.transform = "";
    panel.style.opacity = "";
  }, 230);
  // Restore actions position
  const actions = document.getElementById("lb-actions");
  if (actions) {
    actions.style.right = "20px";
  }
}

function _lbRenderComments() {
  const post =
    PostCache.getPost(_lbPostId) || posts.find((p) => p.id === _lbPostId);
  const list = document.getElementById("lb-comments-list");
  const header = document.getElementById("lb-comments-count-header");
  if (!list) return;

  const comments = post?.comments || [];
  function _lbHdrCount(a) {
    return (a || []).reduce((n, c) => n + 1 + _lbHdrCount(c.replies || []), 0);
  }
  const _totalComments = _lbHdrCount(comments);
  if (header) header.textContent = _totalComments ? `(${_totalComments})` : "";

  if (!comments.length) {
    list.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:rgba(255,255,255,0.25);padding:40px 20px;text-align:center">
              <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="40" height="40">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <div style="font-size:14px;font-weight:600">No comments yet</div>
              <div style="font-size:12px;opacity:0.7">Be the first to comment</div>
            </div>`;
    return;
  }

  function buildLbAvatar(c, size) {
    const col = stringToColor(c.author || "?");
    const bg = c.authorPicture ? "transparent" : col;
    const inner = c.authorPicture
      ? `<img src="${escHtml(c.authorPicture)}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
      : escHtml((c.author || "?").charAt(0).toUpperCase());
    const dim = size === "sm" ? 26 : 34;
    return `<div class="lb-comment-av" style="background:${bg};width:${dim}px;height:${dim}px;flex-shrink:0">${inner}</div>`;
  }

  function buildLbNode(c, isNested) {
    const repliesArr = Array.isArray(c.replies) ? c.replies : [];
    const replyCount = repliesArr.length;
    const nestedId = `lb-replies-${c.id}`;
    const timeStr = c.createdAt ? formatTime(c.createdAt) : "";

    const nestedHtml = replyCount
      ? `<button class="lb-view-replies-btn" onclick="lbToggleReplies('${nestedId}', this)" data-count="${replyCount}">
                <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                View ${replyCount} ${replyCount === 1 ? "reply" : "replies"}
               </button>
               <div class="lb-nested-replies" id="${nestedId}">
                 ${repliesArr.map((r) => buildLbNode(r, true)).join("")}
               </div>`
      : "";

    const replyBtn = `<button class="lb-comment-reply-btn" onclick="lbStartReply('${escHtml(c.author || "")}', ${c.id})">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
            Reply
          </button>`;

    if (isNested) {
      return `<div class="lb-comment-item" style="padding:8px 0 8px 4px">
              ${buildLbAvatar(c, "sm")}
              <div class="lb-comment-body">
                <div class="lb-comment-author">${escHtml(c.author || "Anonymous")}</div>
                <div class="lb-comment-text">${escHtml(c.text || "")}</div>
                ${timeStr ? `<div class="lb-comment-time">${timeStr}</div>` : ""}
                ${replyBtn}
                ${nestedHtml}
              </div>
            </div>`;
    }

    return `<div class="lb-comment-item">
            ${buildLbAvatar(c, "lg")}
            <div class="lb-comment-body">
              <div class="lb-comment-author">${escHtml(c.author || "Anonymous")}</div>
              <div class="lb-comment-text">${escHtml(c.text || "")}</div>
              ${timeStr ? `<div class="lb-comment-time">${timeStr}</div>` : ""}
              ${replyBtn}
              ${nestedHtml}
            </div>
          </div>`;
  }

  list.innerHTML = comments.map((c) => buildLbNode(c, false)).join("");
  list.scrollTop = list.scrollHeight;
}

let _lbReplyToId = null;

function lbStartReply(author, commentId) {
  _lbReplyToId = commentId;
  const banner = document.getElementById("lb-reply-to-banner");
  const nameEl = document.getElementById("lb-reply-to-name");
  if (banner) banner.classList.add("visible");
  if (nameEl) nameEl.textContent = author;
  const input = document.getElementById("lb-comment-input");
  if (input) {
    input.placeholder = `Reply to ${author}…`;
    input.focus();
  }
}

function lbCancelReply() {
  _lbReplyToId = null;
  const banner = document.getElementById("lb-reply-to-banner");
  if (banner) banner.classList.remove("visible");
  const input = document.getElementById("lb-comment-input");
  if (input) {
    input.placeholder = "Add a comment…";
    input.focus();
  }
}

function lbToggleReplies(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const isHidden = el.style.display === "none" || el.style.display === "";
  el.style.display = isHidden ? "flex" : "none";
  const count = btn.dataset.count;
  btn.innerHTML = isHidden
    ? `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12" height="12"><polyline points="18 15 12 9 6 15"/></svg> Hide ${count} ${count == 1 ? "reply" : "replies"}`
    : `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg> View ${count} ${count == 1 ? "reply" : "replies"}`;
}

async function lbSubmitComment() {
  if (!currentUser) {
    showToast("Log in to comment.");
    lbCloseComments();
    closeLightbox();
    goTo("login");
    return;
  }
  const input = document.getElementById("lb-comment-input");
  const text = input?.value.trim();
  if (!text || !_lbPostId) return;

  input.value = "";
  input.disabled = true;

  try {
    const res = await api("POST", `/api/posts/${_lbPostId}/comment`, {
      userId: currentUser.id,
      text,
      parentId: _lbReplyToId || undefined,
    });
    const newComment = res.data;
    const post = posts.find((p) => p.id === _lbPostId);
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
    // Reset reply state
    const _sentReplyToId = _lbReplyToId;
    lbCancelReply();
    // Send reply notification if this was a reply
    if (_sentReplyToId) sendReplyNotification(_lbPostId, _sentReplyToId, text);
    // Update feed card comment count if visible
    function countAll(arr) {
      return (arr || []).reduce((n, c) => n + 1 + countAll(c.replies || []), 0);
    }
    const ce = document.querySelector(
      `[data-post-id="${_lbPostId}"] .comment-count`,
    );
    if (ce && post) ce.textContent = countAll(post.comments) || "";
    const lbCc = document.getElementById("lb-comment-count");
    if (lbCc && post) lbCc.textContent = countAll(post.comments);
    _lbRenderComments();
  } catch (e) {
    showToast("Error: " + e.message);
    if (input) input.value = text;
  } finally {
    if (input) input.disabled = false;
    input?.focus();
  }
}

/* ── Lightbox inline Report Panel ── */
let _lbSelectedReason = null;

function lbOpenReport() {
  if (!_lbPostId) return;
  if (!currentUser) {
    showToast("Log in to report posts.");
    return;
  }

  // Reset state
  _lbSelectedReason = null;
  document
    .querySelectorAll(".lb-report-reason-btn")
    .forEach((b) => b.classList.remove("selected"));
  const otherWrap = document.getElementById("lb-report-other-wrap");
  const otherText = document.getElementById("lb-report-other-text");
  const submitBtn = document.getElementById("lb-report-submit-btn");
  if (otherWrap) otherWrap.style.display = "none";
  if (otherText) otherText.value = "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.4";
    submitBtn.style.cursor = "not-allowed";
    submitBtn.textContent = "Submit Report";
  }

  const panel = document.getElementById("lb-report-panel");
  if (!panel) return;
  // Close comments panel if open
  lbCloseComments();
  panel.style.display = "flex";
  panel.style.animation = "none";
  panel.offsetHeight;
  panel.style.animation =
    "lbCommentsSlideUp 0.32s cubic-bezier(0.34,1.2,0.64,1) both";

  // Nudge actions left
  const actions = document.getElementById("lb-actions");
  if (actions) {
    actions.style.transition = "right 0.3s cubic-bezier(0.34,1.2,0.64,1)";
    actions.style.right = Math.min(420, window.innerWidth) + 20 + "px";
  }
}

function lbCloseReport() {
  const panel = document.getElementById("lb-report-panel");
  if (!panel) return;
  panel.style.transition = "transform 0.22s ease, opacity 0.22s ease";
  panel.style.transform = "translateY(100%)";
  panel.style.opacity = "0";
  setTimeout(() => {
    panel.style.display = "none";
    panel.style.transform = "";
    panel.style.opacity = "";
  }, 230);
  const actions = document.getElementById("lb-actions");
  if (actions) actions.style.right = "20px";
}

function lbSelectReason(btn, reason) {
  document
    .querySelectorAll(".lb-report-reason-btn")
    .forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
  _lbSelectedReason = reason;

  const otherWrap = document.getElementById("lb-report-other-wrap");
  if (otherWrap)
    otherWrap.style.display = reason === "Other" ? "block" : "none";

  const submitBtn = document.getElementById("lb-report-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
  }
}

async function lbSubmitReport() {
  if (!_lbPostId || !_lbSelectedReason) return;
  let reason = _lbSelectedReason;
  if (reason === "Other") {
    const other = document.getElementById("lb-report-other-text")?.value.trim();
    if (!other || other.length < 5) {
      showToast("Please describe the issue (min 5 chars).");
      return;
    }
    reason = other;
  }
  const btn = document.getElementById("lb-report-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Submitting…";
    btn.style.opacity = "0.6";
  }
  try {
    await api("POST", "/api/admin/reports", { postId: _lbPostId, reason });
    lbCloseReport();
    showToast("Report submitted. Thank you! ✅");
  } catch (e) {
    showToast("Error: " + e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Submit Report";
      btn.style.opacity = "1";
    }
  }
}

/* ── Lightbox repost dropdown ── */
function lbToggleRepost() {
  if (!_lbPostId || !currentUser) {
    if (!currentUser) showToast("Log in to Echo.");
    return;
  }
  openQuoteModal(_lbPostId);
}

function lbCloseRepost() {} // no-op — menu no longer exists

/* ── Open (image) ── */
/* ── Collect all feed media (images + videos) in DOM order ── */
function collectFeedMedia() {
  const items = [];
  document
    .querySelectorAll(
      ".post-img[data-lb-name], .echo-embed-img[data-lb-name], .post-video-wrap[data-lb-video]",
    )
    .forEach((el) => {
      if (el.dataset.lbVideo) {
        items.push({
          type: "video",
          src: el.dataset.lbVideo,
          meta: {
            name: el.dataset.lbName || null,
            picture: el.dataset.lbPicture || null,
            userId: el.dataset.lbUserId || null,
            postId: el.dataset.lbPostId
              ? parseInt(el.dataset.lbPostId, 10)
              : null,
            caption: el.dataset.lbCaption || null,
          },
        });
      } else {
        items.push({
          type: "image",
          src: el.src,
          meta: {
            name: el.dataset.lbName || null,
            picture: el.dataset.lbPicture || null,
            userId: el.dataset.lbUserId || null,
            postId: el.dataset.lbPostId
              ? parseInt(el.dataset.lbPostId, 10)
              : null,
            caption: el.dataset.lbCaption || null,
          },
        });
      }
    });
  return items;
}

/* ── Show the correct media element for current item ── */
function _lbShowItem() {
  const item = _lbCurrent();
  if (!item) return;
  const lbImg = document.getElementById("lb-img");
  const lbVid = document.getElementById("lb-video");
  if (item.type === "video") {
    lbImg.style.display = "none";
    lbImg.src = "";
    lbVid.style.display = "block";
    lbVid.src = item.src;
    lbVid.style.opacity = "0";
    lbVid.style.transition = "opacity 0.22s ease";
    requestAnimationFrame(() => {
      lbVid.style.opacity = "1";
      lbVid.play().catch(() => {});
    });
  } else {
    lbVid.pause && lbVid.pause();
    lbVid.style.display = "none";
    lbVid.src = "";
    lbImg.style.display = "";
    lbImg.src = item.src;
  }
  // Update counter
  const counter = document.getElementById("lb-counter");
  if (_lbItems.length > 1) {
    counter.textContent = `${_lbIndex + 1} / ${_lbItems.length}`;
    counter.style.display = "flex";
  } else {
    counter.style.display = "none";
  }
  // Hint: show for images only
  const hint = document.getElementById("lb-hint");
  if (hint) hint.style.opacity = item.type === "image" ? "1" : "0";
  _lbRenderProfile(_lbIndex);
}

/* ── Open lightbox from an image thumbnail ── */
function openLightbox(imgEl) {
  _lbItems = collectFeedMedia();
  const clickedSrc = imgEl.src;
  _lbIndex = _lbItems.findIndex(
    (it) => it.type === "image" && it.src === clickedSrc,
  );
  if (_lbIndex < 0) _lbIndex = 0;
  _lbScale = 1;
  _lbTranslateX = 0;
  _lbTranslateY = 0;
  _lbOrigin = imgEl.getBoundingClientRect();

  const lb = document.getElementById("lightbox");

  // Clear any leftover profile-pic mode state so the username chip and
  // action buttons render correctly for this post's lightbox.
  if (lb.dataset.profilePicMode) delete lb.dataset.profilePicMode;
  const lbActsReset = document.getElementById("lb-actions");
  if (lbActsReset) lbActsReset.style.display = "none"; // _lbRenderProfile will show if needed

  const lbImg = document.getElementById("lb-img");
  const lbVid = document.getElementById("lb-video");
  lbVid.pause && lbVid.pause();
  lbVid.style.display = "none";
  lbVid.src = "";
  lbImg.style.display = "";
  lb.style.display = "flex";

  // Hero entry animation
  const ox = _lbOrigin.left + _lbOrigin.width / 2 - window.innerWidth / 2;
  const oy = _lbOrigin.top + _lbOrigin.height / 2 - window.innerHeight / 2;
  const sx = _lbOrigin.width / window.innerWidth;
  const sy = _lbOrigin.height / window.innerHeight;
  lbImg.style.transition = "none";
  lbImg.style.transform = `translate(${ox}px,${oy}px) scale(${sx},${sy})`;
  lbImg.style.opacity = "0";
  lbImg.src = _lbItems[_lbIndex].src;
  lbImg.onload = () => {
    requestAnimationFrame(() => {
      lbImg.style.transition =
        "transform 0.38s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease";
      lbImg.style.transform = "translate(0,0) scale(1)";
      lbImg.style.opacity = "1";
    });
  };
  if (lbImg.complete) lbImg.onload();

  lb.style.opacity = "0";
  lb.style.transition = "opacity 0.18s ease";
  requestAnimationFrame(() => {
    lb.style.opacity = "1";
  });
  document.body.style.overflow = "hidden";

  const counter = document.getElementById("lb-counter");
  if (_lbItems.length > 1) {
    counter.textContent = `${_lbIndex + 1} / ${_lbItems.length}`;
    counter.style.display = "flex";
  } else counter.style.display = "none";
  document.getElementById("lb-prev").style.display = "none";
  document.getElementById("lb-next").style.display = "none";
  _lbRenderProfile(_lbIndex);

  const hint = document.getElementById("lb-hint");
  if (hint) {
    hint.style.opacity = "1";
    clearTimeout(hint._t);
    hint._t = setTimeout(() => (hint.style.opacity = "0"), 3000);
  }
}

/* ── Open lightbox from a video wrap ── */
function openVideoLightbox(wrapEl) {
  const videoSrc = wrapEl.dataset.lbVideo;
  if (!videoSrc) return;
  _lbItems = collectFeedMedia();
  _lbIndex = _lbItems.findIndex(
    (it) => it.type === "video" && it.src === videoSrc,
  );
  if (_lbIndex < 0) _lbIndex = 0;
  _lbScale = 1;
  _lbTranslateX = 0;
  _lbTranslateY = 0;

  const lb = document.getElementById("lightbox");

  // Clear any leftover profile-pic mode state so the username chip and
  // action buttons render correctly for this post's lightbox.
  if (lb.dataset.profilePicMode) delete lb.dataset.profilePicMode;
  const lbActsReset2 = document.getElementById("lb-actions");
  if (lbActsReset2) lbActsReset2.style.display = "none"; // _lbRenderProfile will show if needed

  lb.style.display = "flex";
  lb.style.opacity = "0";
  lb.style.transition = "opacity 0.18s ease";
  requestAnimationFrame(() => {
    lb.style.opacity = "1";
  });
  document.body.style.overflow = "hidden";
  document.getElementById("lb-hint").style.opacity = "0";
  document.getElementById("lb-prev").style.display = "none";
  document.getElementById("lb-next").style.display = "none";
  _lbShowItem();
}

/* ── Navigate to any adjacent item (image or video) ── */
function lbGoTo(newIdx) {
  if (_lbAnimating || newIdx < 0 || newIdx >= _lbItems.length) return;
  _lbAnimating = true;
  const dir = newIdx > _lbIndex ? 1 : -1;
  const ud = _lbNavAxis === "ud";
  const lbImg = document.getElementById("lb-img");
  const lbVid = document.getElementById("lb-video");
  const fromVideo = _lbIsVideo();
  const toItem = _lbItems[newIdx];

  // Slide out along the chosen axis
  const outEl = fromVideo ? lbVid : lbImg;
  const outTranslate = ud
    ? `translateY(${-dir * 60}px)`
    : `translateX(${-dir * 60}px)`;
  outEl.style.transition = "opacity 0.18s ease, transform 0.2s ease";
  outEl.style.opacity = "0";
  outEl.style.transform = outTranslate;
  if (fromVideo) lbVid.pause();

  setTimeout(() => {
    _lbIndex = newIdx;
    _lbScale = 1;
    _lbTranslateX = 0;
    _lbTranslateY = 0;
    outEl.style.transition = "none";
    outEl.style.transform = "";

    if (toItem.type === "video") {
      lbImg.style.display = "none";
      lbImg.src = "";
      lbVid.style.display = "block";
      lbVid.src = toItem.src;
      lbVid.style.opacity = "0";
      lbVid.style.transform = ud
        ? `translateY(${dir * 60}px)`
        : `translateX(${dir * 60}px)`;
      requestAnimationFrame(() => {
        lbVid.style.transition =
          "opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.2,0.64,1)";
        lbVid.style.opacity = "1";
        lbVid.style.transform = ud ? "translateY(0)" : "translateX(0)";
        lbVid.play().catch(() => {});
        setTimeout(() => {
          _lbAnimating = false;
        }, 300);
      });
    } else {
      lbVid.pause && lbVid.pause();
      lbVid.style.display = "none";
      lbVid.src = "";
      lbImg.style.display = "";
      lbImg.src = toItem.src;
      lbImg.style.opacity = "0.2";
      lbImg.style.transform = ud
        ? `translateY(${dir * 60}px) scale(0.88)`
        : `translateX(${dir * 60}px) scale(0.88)`;
      requestAnimationFrame(() => {
        lbImg.style.transition =
          "transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease";
        lbImg.style.transform = ud
          ? "translateY(0) scale(1)"
          : "translateX(0) scale(1)";
        lbImg.style.opacity = "1";
        setTimeout(() => {
          _lbAnimating = false;
        }, 320);
      });
    }

    const counter = document.getElementById("lb-counter");
    if (_lbItems.length > 1) {
      counter.textContent = `${_lbIndex + 1} / ${_lbItems.length}`;
      counter.style.display = "flex";
    } else counter.style.display = "none";
    document.getElementById("lb-prev").style.display = "none";
    document.getElementById("lb-next").style.display = "none";
    _lbRenderProfile(_lbIndex);
  }, 200);
}

// Legacy alias so any remaining references still work
function lbGoToVideo(newIdx) {
  lbGoTo(newIdx);
}

function closeLightbox() {
  // Close repost menu if open
  lbCloseRepost();
  // Also close comment panel and report panel if open
  const panel = document.getElementById("lb-comments-panel");
  if (panel) {
    panel.style.display = "none";
    panel.style.transform = "";
    panel.style.opacity = "";
  }
  const reportPanel = document.getElementById("lb-report-panel");
  if (reportPanel) {
    reportPanel.style.display = "none";
    reportPanel.style.transform = "";
    reportPanel.style.opacity = "";
  }
  const actions = document.getElementById("lb-actions");
  if (actions) actions.style.right = "20px";

  const lb = document.getElementById("lightbox");

  // If we were in profile-pic mode, clean up the mode flag and restore
  // the profile chip's hover handlers for the next regular lightbox open.
  if (lb.dataset.profilePicMode) {
    delete lb.dataset.profilePicMode;
    const lbProf = document.getElementById("lb-profile");
    if (lbProf) {
      // Restore the chip's child structure that openProfilePicLightbox replaced
      // with plain text, so _lbRenderProfile can write to lb-profile-av / lb-profile-name.
      lbProf.innerHTML = `<div id="lb-profile-av" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:var(--accent);display:grid;place-items:center;font-family:var(--font-head);font-size:13px;font-weight:800;color:#fff;overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,0.18)"></div><div><div id="lb-profile-name" style="font-family:var(--font-head);font-size:13px;font-weight:800;color:#fff;line-height:1.2;white-space:nowrap"></div><div style="font-size:11px;color:rgba(255,255,255,0.5)">View profile</div></div>`;
      lbProf.style.display = "none";
      lbProf.style.cursor = "";
      lbProf.onclick = null;
      lbProf.onmouseover = function () {
        this.style.background = "rgba(255,255,255,0.12)";
        this.style.transform = "scale(1.03)";
      };
      lbProf.onmouseout = function () {
        this.style.background = "rgba(0,0,0,0.55)";
        this.style.transform = "scale(1)";
      };
    }
  }

  lb.style.transition = "opacity 0.18s ease";
  lb.style.opacity = "0";
  setTimeout(() => {
    lb.style.display = "none";
    lb.style.opacity = "";
    document.body.style.overflow = "";
    _lbScale = 1;
    _lbTranslateX = 0;
    _lbTranslateY = 0;
    _lbPostId = null;
    const lbImg = document.getElementById("lb-img");
    lbImg.style.transform = "";
    lbImg.style.transition = "";
    lbImg.style.display = "";
    // Stop & reset video
    const lbVid = document.getElementById("lb-video");
    lbVid.pause();
    lbVid.src = "";
    lbVid.style.display = "none";
    _lbItems = [];
    // Hide caption & actions
    const captionEl = document.getElementById("lb-caption");
    if (captionEl) captionEl.style.display = "none";
    const actionsEl = document.getElementById("lb-actions");
    if (actionsEl) actionsEl.style.display = "none";
  }, 180);
}

function lbDownload() {
  const item = _lbCurrent();
  if (!item) return;
  const a = document.createElement("a");
  a.href = item.src;
  a.download = item.type === "video" ? "video.mp4" : "image.jpg";
  a.target = "_blank";
  a.click();
}

function lbShare() {
  const item = _lbCurrent();
  if (!item) return;
  const src = item.src;
  if (navigator.share) {
    navigator.share({ url: src }).catch(() => {});
  } else {
    navigator.clipboard
      .writeText(src)
      .then(() =>
        showToast(
          _lbCurrent() && _lbCurrent().type === "video"
            ? "Video URL copied!"
            : "Image URL copied!",
        ),
      );
  }
}

/* ── Lightbox nav axis: 'lr' = left/right (default), 'ud' = up/down ── */
let _lbNavAxis = localStorage.getItem("circle_lb_nav_axis") || "lr";

function lbSetNavAxis(axis) {
  _lbNavAxis = axis;
  localStorage.setItem("circle_lb_nav_axis", axis);
  _lbSyncNavAxisSetting();
}

function _lbSyncNavAxisSetting() {
  const lrBtn = document.getElementById("lb-nav-lr-btn");
  const udBtn = document.getElementById("lb-nav-ud-btn");
  const isLR = _lbNavAxis === "lr";
  [lrBtn, udBtn].forEach((btn) => {
    if (!btn) return;
    btn.style.borderColor = "var(--border2)";
    btn.style.background = "var(--card)";
    btn.style.color = "var(--txt2)";
  });
  const activeBtn = isLR ? lrBtn : udBtn;
  if (activeBtn) {
    activeBtn.style.borderColor = "var(--accent)";
    activeBtn.style.background = "var(--accent-bg)";
    activeBtn.style.color = "var(--accent)";
  }
  // Update hint text
  const hint = document.getElementById("lb-hint");
  if (hint)
    hint.textContent = isLR
      ? "Swipe or scroll ← → to navigate · Pinch to zoom · Double-click to reset"
      : "Swipe or scroll ↑ ↓ to navigate · Pinch to zoom · Double-click to reset";
}

// Sync on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _lbSyncNavAxisSetting);
} else {
  _lbSyncNavAxisSetting();
}

/* ── Touch / Pointer events for zoom & swipe ── */
function lbPointerDown(e) {
  _lbPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_lbPointers.size === 1) {
    _lbSwipeStartX = e.clientX;
    _lbSwipeStartY = e.clientY;
    _lbDragStartX = e.clientX - _lbTranslateX;
    _lbDragStartY = e.clientY - _lbTranslateY;
    _lbSwiping = _lbIsVideo() ? true : _lbScale <= 1;
  } else if (_lbPointers.size === 2) {
    _lbSwiping = false;
    const pts = [..._lbPointers.values()];
    _lbPinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  }
}

function lbPointerMove(e) {
  if (_lbIsVideo()) return;
  _lbPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const lbImg = document.getElementById("lb-img");
  if (_lbPointers.size === 2) {
    const pts = [..._lbPointers.values()];
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const newScale = Math.min(
      5,
      Math.max(1, _lbScale * (dist / _lbPinchStartDist)),
    );
    _lbPinchStartDist = dist;
    _lbScale = newScale;
    lbImg.style.transition = "none";
    lbImg.style.transform = `translate(${_lbTranslateX}px, ${_lbTranslateY}px) scale(${_lbScale})`;
  } else if (_lbPointers.size === 1 && _lbScale > 1) {
    _lbTranslateX = e.clientX - _lbDragStartX;
    _lbTranslateY = e.clientY - _lbDragStartY;
    lbImg.style.transition = "none";
    lbImg.style.transform = `translate(${_lbTranslateX}px, ${_lbTranslateY}px) scale(${_lbScale})`;
  }
}

function lbPointerUp(e) {
  const startX = _lbSwipeStartX;
  const startY = _lbSwipeStartY || 0;
  _lbPointers.delete(e.pointerId);
  if (_lbPointers.size === 0 && _lbSwiping) {
    if (_lbScale <= 1 || _lbIsVideo()) {
      if (_lbNavAxis === "ud") {
        const dy = e.clientY - startY;
        if (Math.abs(dy) > 55) lbGoTo(_lbIndex + (dy < 0 ? 1 : -1));
      } else {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 55) lbGoTo(_lbIndex + (dx < 0 ? 1 : -1));
      }
    }
    _lbSwiping = false;
  }
}

/* ── Wheel: navigate on chosen axis, zoom on the other ── */
function lbWheel(e) {
  e.preventDefault();
  // Both axes use scroll to navigate; for LR mode horizontal scroll navigates,
  // vertical scroll zooms (images only). For UD mode vertical scroll navigates.
  const isUD = _lbNavAxis === "ud";
  const navDelta = isUD ? e.deltaY : e.deltaX;
  const zoomDelta = isUD ? e.deltaX : e.deltaY;

  // Navigate if the user scrolled on the navigation axis
  if (Math.abs(navDelta) > Math.abs(zoomDelta) || isUD) {
    if (!lbWheel._t) {
      lbGoTo(_lbIndex + (navDelta > 0 ? 1 : -1));
      lbWheel._t = setTimeout(() => {
        lbWheel._t = null;
      }, 350);
    }
    return;
  }

  // Otherwise zoom (images only, LR mode vertical scroll)
  if (_lbIsVideo()) return;
  const lbImg = document.getElementById("lb-img");
  _lbScale = Math.min(5, Math.max(1, _lbScale * (zoomDelta < 0 ? 1.12 : 0.9)));
  if (_lbScale <= 1) {
    _lbTranslateX = 0;
    _lbTranslateY = 0;
  }
  lbImg.style.transition = "transform 0.12s ease";
  lbImg.style.transform = `translate(${_lbTranslateX}px, ${_lbTranslateY}px) scale(${_lbScale})`;
}

/* ── Double tap/click to reset zoom ── */
function lbDblClick() {
  if (_lbIsVideo()) return;
  const lbImg = document.getElementById("lb-img");
  _lbScale = _lbScale > 1 ? 1 : 2.2;
  _lbTranslateX = 0;
  _lbTranslateY = 0;
  lbImg.style.transition = "transform 0.3s cubic-bezier(0.34,1.2,0.64,1)";
  lbImg.style.transform = _lbScale > 1 ? `scale(${_lbScale})` : "none";
}

/* ── Keyboard ── */
document.addEventListener("keydown", (e) => {
  const lb = document.getElementById("lightbox");
  if (lb.style.display !== "flex") return;
  if (e.key === "Escape") closeLightbox();
  if (_lbNavAxis === "ud") {
    if (e.key === "ArrowDown") lbGoTo(_lbIndex + 1);
    if (e.key === "ArrowUp") lbGoTo(_lbIndex - 1);
  } else {
    if (e.key === "ArrowRight") lbGoTo(_lbIndex + 1);
    if (e.key === "ArrowLeft") lbGoTo(_lbIndex - 1);
  }
});

/* ── Collect all images from feed for gallery context ── */
// Legacy stubs — collectFeedMedia() is now used internally
function collectFeedImages() {
  return collectFeedMedia()
    .filter((i) => i.type === "image")
    .map((i) => i.src);
}
function collectFeedVideos() {
  return [];
}