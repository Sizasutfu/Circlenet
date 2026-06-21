/* Auth, Theme, OTP & Session → auth/auth.js */


/* Settings → settings/settings.js */

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



/* ── Edit Post ────────────────────────────────────────────────── */
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
    // Feed API returns likes as a plain number — normalise to array before mutating
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
    currentUser && Array.isArray(post.likes) && post.likes.includes(currentUser.id);
  const btnHtml = `<svg fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg><span>${(post.likes && post.likes.length) || ""}</span>`;
  // data-post-id may be on the card wrapper (feed) or the button itself (detail) — handle both
  document.querySelectorAll(`[data-post-id="${postId}"]`).forEach((el) => {
    const btn = el.classList.contains("like-btn") ? el : el.querySelector(".like-btn");
    if (!btn) return;
    btn.className = "act-btn like-btn" + (liked ? " liked" : "");
    btn.innerHTML = btnHtml;
  });
}


/* Comments → comments/comments.js */


/* Reposts & Quote modal → reposts/reposts.js */

/* Image & Video → media/media.js */

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


/* Profile functions → profile/profile.js */

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


/* Profile picture / avatar / follow → profile/profile.js */



/* Search → search/search.js */

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


/* Suggested users → suggested-users/suggested-users.js */

/* Explore + New Members → explore/explore.js */


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



/*  BOOT*/
document.addEventListener('partials:ready', function () {
(function boot() {
  PostCache.init(); // hydrate from localStorage
  // Feed freshness is managed by the 5-min TTL in PostCache.
  // Invalidating here caused an empty feed flash on refresh because the
  // feed index was wiped before loadPosts() could paint from cache.
  applyTheme(localStorage.getItem("circle_theme") || "dark");

  // Rehydrate session BEFORE anything that might call api() (e.g. DM.init).
  // Calling api()-dependent code before currentUser is set caused requests
  // to go out without X-User-Id, 401, and wipe an otherwise-valid session.
  try {
    const s = localStorage.getItem("circle_user");
    if (s) setCurrentUser(JSON.parse(s));
    // If user object is gone, clear any stale token too
    if (!s) localStorage.removeItem("circle_token");
  } catch (e) {
    localStorage.removeItem("circle_user");
    localStorage.removeItem("circle_token");
  }

  _populateDialSelects(); // fill country code dropdowns
  DM.init(); // load inbox from backend (no-ops if not logged in)

  // If arriving via redirect from an external login flow, preserve it for post-login navigation.
  const incomingRedirect = new URLSearchParams(window.location.search).get("redirect");
  if (incomingRedirect) {
    try {
      const url = new URL(incomingRedirect, window.location.origin);
      if (url.origin === window.location.origin) {
        sessionStorage.setItem("_redirectAfterLogin", url.pathname + url.search + url.hash);
      }
    } catch (e) {
      // ignore invalid redirect URLs
    }
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
        } else if (_initState.view === "whisper-send" && _initState.username) {
          goTo("whisper-send");
          WhisperSend.init(_initState.username);
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
        if (redir.startsWith("/")) {
          location.href = redir;
          return;
        }
        if (redir.startsWith(window.location.origin)) {
          location.href = redir;
          return;
        }
        const redirState = _pathToState(redir);
        if (redirState.view !== "feed") {
          _historyNavigating = false;
          goTo(redirState.view, redirState);
        }
      }
    }, 700);
  }

  // ── Router listeners (popstate + push-notif deep-link) ──────
  Router.initListeners();

  // Show the global feed tab even for guests
  const ftGuest = document.getElementById("feed-tabs");
  if (ftGuest && !currentUser) {
    ftGuest.style.display = "flex";
    const ftFollowing = document.getElementById("ftab-following");
    if (ftFollowing) ftFollowing.style.opacity = "0.5";
  }

  loadPosts();
  loadTrending();
})();

/* ── POST DETAIL + COMPOSE — moved to post-detail.js */

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
    // Hide mobile nav & FAB when on messages
    const _mnav = document.querySelector('.mobile-nav');
    const _fab  = document.getElementById('fab-create-btn');
    const _onMsg = view === 'messages';
    if (_mnav) _mnav.style.display = _onMsg ? 'none' : '';
    if (_fab)  _fab.style.display  = _onMsg ? 'none' : '';
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

});