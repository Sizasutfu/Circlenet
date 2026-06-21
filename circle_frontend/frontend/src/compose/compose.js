/* ── COMPOSE — create post + edit post modal ─────────────────────
   Extracted from main.js. Depends on globals defined elsewhere:
     currentUser, posts, currentFeedTab, PostCache, api,
     showToast, removeMedia, renderFeed, renderProfile, renderPostDetail,
     pendingImageDataUrl, pendingVideoDataUrl, pendingVideoCompressed
   ─────────────────────────────────────────────────────────────────── */

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