// ─────────────────────────────────────────────────────────────
//  comments.js — CircleNet Comments module
//
//  Depends on: api(), currentUser, posts, PostCache,
//              goTo(), showToast(), escHtml(), stringToColor()
// ─────────────────────────────────────────────────────────────

/* COMMENTS  */

// ── Toggle the comments panel open/closed ──────────────────────
function toggleComments(postId) {
  document
    .querySelector(`[data-post-id="${postId}"] .comments-panel`)
    .classList.toggle("open");
}

// ── Submit a new comment or reply ───────────────────────────────
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
    const ce = document.querySelector(`[data-post-id="${postId}"] .comment-count`);
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

// ── Re-render the comment list for a post ──────────────────────
function renderCommentList(postId) {
  const post  = posts.find((p) => p.id === postId) || PostCache.getPost(postId);
  const panel = document.querySelector(`[data-post-id="${postId}"] .comments-panel`);
  if (!panel || !post) return;
  panel.querySelector(".comment-list").innerHTML = buildCommentItems(post.comments);
}

// ── Build comment/reply HTML ────────────────────────────────────
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