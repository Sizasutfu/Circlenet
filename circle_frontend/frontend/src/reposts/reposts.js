// ─────────────────────────────────────────────────────────────
//  reposts.js — CircleNet Reposts & Quote modal module
//
//  Depends on: api(), currentUser, posts, PostCache,
//              goTo(), showToast(), resolveMediaUrl(), renderFeed(),
//              _lbUpdateActions() (lightbox, optional),
//              closeNotifPanel(), reportTargetPostId (global)
//
//  Note: `repostTargetId` is a shared global declared elsewhere
//  (post-detail / compose state).
// ─────────────────────────────────────────────────────────────

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
  document.getElementById("modal-orig-text").textContent   = orig.text || "";
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

// ── Global Escape key handler: closes repost popover, quote modal,
//    notification panel, and report modal ────────────────────────
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