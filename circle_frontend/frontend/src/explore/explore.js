// ─────────────────────────────────────────────────────────────
//  explore.js — CircleNet Explore module
//  Covers: Explore entry, hashtag linkifier, @mention lookup,
//          Topics, Topic feed, People, Trending, New Members
//
//  Depends on: api(), currentUser, posts, PostCache,
//              goTo(), viewProfile(), showToast(),
//              buildPostCard(), escHtml(), stringToColor(),
//              _followingSet, currentFeedTab, _masterPosts,
//              renderFeed(), _initPostCardLinkPreviews()
// ─────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────
let _exploreLoaded = false;

// Trending
let _trendingRaw      = [];
let _trendingCategory = "all";
let _trendingSort     = "hot";

// Topic feed
let _topicFeedCurrent = null;
let _topicFeedPage    = 1;
let _topicFeedMore    = true;
let _topicFeedLoading = false;

// New members
const FEED_NEW_LIMIT   = 3;
let _newMembers        = [];
let _newMembersLoaded  = false;
let _feedNewDismissed  = !!localStorage.getItem("circle_new_dismissed");
let _feedNewIndex      = 0;
let _dismissedNewIds   = new Set(
  JSON.parse(localStorage.getItem("circle_new_dismissed_ids") || "[]"),
);

// ── Explore entry point ───────────────────────────────────────
function loadExplore() {
  loadExplorePeople();
  loadExploreTopics();
  loadExploreTrending();
  if (currentUser) loadExploreNewMembers();
}

// ── Hashtag / URL / mention linkifier ────────────────────────
function linkifyHashtags(html) {
  // 1. Linkify http/https and protocol-relative URLs
  html = html.replace(
    /(?:https?:\/\/|\/\/)[-a-zA-Z0-9@:%._+~#=]{1,256}(?::[0-9]{1,5})?(?:[\/][-a-zA-Z0-9()@:%_+.~#?&\/=]*)?/g,
    (url) => {
      const href = url.startsWith("//") ? `http:${url}` : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="post-link" onclick="event.stopPropagation()">${url}</a>`;
    },
  );
  // 1b. Bare www. links
  html = html.replace(
    /(?<![\w\/:.])www\.[a-zA-Z0-9-]{1,256}\.[a-zA-Z]{2,}(?::[0-9]{1,5})?(?:[\/][-a-zA-Z0-9()@:%_+.~#?&\/=]*)?/g,
    (url) => `<a href="https://${url}" target="_blank" rel="noopener noreferrer" class="post-link" onclick="event.stopPropagation()">${url}</a>`,
  );
  // 2. @mentions
  html = html.replace(
    /(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]{1,30})/g,
    (match, username) =>
      `<a class="mention" href="javascript:void(0)" onclick="event.stopPropagation();searchAndViewProfile('${username}')">${match}</a>`,
  );
  // 3. #hashtags
  html = html.replace(
    /(?<!&)#([a-zA-Z][a-zA-Z0-9_]*)/g,
    (match, tag) =>
      `<span class="hashtag" onclick="event.stopPropagation();openTopicFeed('${tag.toLowerCase()}')">${match}</span>`,
  );
  return html;
}

// ── @mention profile lookup ───────────────────────────────────
async function searchAndViewProfile(username) {
  try {
    const res = await api("GET", `/api/search?q=${encodeURIComponent(username)}&type=people&page=1`);
    const users = res.data || res.users || res || [];
    const match = users.find(
      (u) => (u.username || u.name || "").toLowerCase() === username.toLowerCase(),
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

// ─────────────────────────────────────────────────────────────
//  TOPICS
// ─────────────────────────────────────────────────────────────

async function loadExploreTopics(force = false) {
  const list = document.getElementById("explore-topics-list");
  const btn  = document.getElementById("explore-topics-refresh");
  if (!list) return;

  if (btn) { btn.classList.add("spinning"); btn.disabled = true; }
  list.innerHTML = `<div class="explore-skeleton-row">${[1,2,3,4,5].map(() => '<div class="explore-skel-card" style="height:36px;width:100%"></div>').join("")}</div>`;

  try {
    const res    = await api("GET", "/api/topics?limit=20");
    const topics = res.data || [];

    if (!topics.length) {
      list.innerHTML = `<div class="explore-trending-empty">No topics yet — start posting with #hashtags!</div>`;
      return;
    }

    const VISIBLE   = 10;
    const renderRows = (items, offset = 0) =>
      items.map((t, i) => {
        const count = t.post_count >= 1000
          ? (t.post_count / 1000).toFixed(1) + "k"
          : t.post_count;
        return `<div class="topic-list-row" onclick="openTopicFeed('${escHtml(t.topic)}')">
          <span class="topic-list-rank">${offset + i + 1}</span>
          <span class="topic-list-name">#${escHtml(t.topic)}</span>
          <span class="topic-list-count">${count} posts</span>
        </div>`;
      }).join("");

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
    if (btn) { btn.classList.remove("spinning"); btn.disabled = false; }
  }
}

function toggleTopicDrawer(count) {
  const drawer = document.getElementById("topic-extra-drawer");
  const btn    = document.getElementById("topic-show-more-btn");
  if (!drawer || !btn) return;
  const isOpen = drawer.classList.toggle("open");
  btn.classList.toggle("open", isOpen);
  const svg = btn.querySelector("svg").outerHTML;
  btn.innerHTML = svg + (isOpen ? ` Show less` : ` Show ${count} more topics`);
  btn.onclick = () => toggleTopicDrawer(count);
}

// ─────────────────────────────────────────────────────────────
//  TOPIC FEED
// ─────────────────────────────────────────────────────────────

async function openTopicFeed(topic) {
  _topicFeedCurrent = topic;
  _topicFeedPage    = 1;
  _topicFeedMore    = true;
  _topicFeedLoading = false;

  if (currentUser) {
    api("POST", `/api/topics/${encodeURIComponent(topic)}/follow`).catch(() => {});
  }

  document.getElementById("topic-view-title").textContent    = `#${topic}`;
  document.getElementById("topic-view-subtitle").textContent = `Posts tagged with #${topic}`;
  document.getElementById("topic-feed-list").innerHTML       = "";

  goTo("topic");
  await _loadTopicFeedPage(true);
}

async function _loadTopicFeedPage(isFirst = false) {
  if (_topicFeedLoading || !_topicFeedMore) return;
  _topicFeedLoading = true;

  const list   = document.getElementById("topic-feed-list");
  const loader = document.getElementById("topic-feed-loader");
  if (loader) loader.style.display = "block";

  if (isFirst) {
    list.innerHTML = '<div class="explore-post-skeleton"></div><div class="explore-post-skeleton"></div><div class="explore-post-skeleton"></div>';
  }

  try {
    const res = await api("GET", `/api/topics/${_topicFeedCurrent}/posts?page=${_topicFeedPage}`);
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
window.addEventListener("scroll", () => {
  const v = document.getElementById("view-topic");
  if (!v || !v.classList.contains("active")) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    _loadTopicFeedPage();
  }
}, { passive: true });

// ─────────────────────────────────────────────────────────────
//  PEOPLE
// ─────────────────────────────────────────────────────────────

async function loadExplorePeople(force = false) {
  const list = document.getElementById("explore-people-list");
  const btn  = document.getElementById("explore-people-refresh");
  if (!list) return;

  if (!currentUser) {
    list.innerHTML = `<div class="explore-trending-empty">
      <button class="link" onclick="goTo('login')">Log in</button> to see people you may know.
    </div>`;
    return;
  }

  if (btn) { btn.classList.add("spinning"); btn.disabled = true; }
  list.innerHTML = `<div class="explore-skeleton-row">${[1,2,3,4].map(() => '<div class="explore-skel-card"></div>').join("")}</div>`;

  try {
    const res   = await api("GET", `/api/recommendations?userId=${currentUser.id}&limit=12`);
    const users = res.data || [];

    if (!users.length) {
      list.innerHTML = `<div class="explore-trending-empty">No suggestions right now. Interact with posts to get recommendations!</div>`;
      return;
    }

    list.innerHTML = `<div class="explore-people-scroll">${users.map((u) => buildExplorePersonCard(u)).join("")}</div>`;
  } catch (e) {
    list.innerHTML = `<div class="explore-trending-empty" style="color:var(--rose)">Could not load suggestions.</div>`;
  } finally {
    if (btn) { btn.classList.remove("spinning"); btn.disabled = false; }
  }
}

function buildExplorePersonCard(user) {
  const initial = (user.name || "?").charAt(0).toUpperCase();
  const color   = stringToColor(user.name);
  const avBg    = user.picture ? "transparent" : color;
  const avInner = user.picture
    ? `<img src="${escHtml(user.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
    : initial;
  const score = user.score || 0;
  const meta  = score > 0 ? `${score} interaction${score === 1 ? "" : "s"}` : "New member";
  return `<div class="explore-person-card" onclick="viewProfile(${user.id})">
    <div class="explore-person-av" style="background:${avBg}">${avInner}</div>
    <div class="explore-person-name" title="${escHtml(user.name)}">${escHtml(user.name)}</div>
    <div class="explore-person-meta">${meta}</div>
    <button class="explore-person-follow" onclick="event.stopPropagation();exploreFollow(${user.id},this)">Follow</button>
  </div>`;
}

async function exploreFollow(userId, btn) {
  if (!currentUser) { showToast("Log in to follow."); goTo("login"); return; }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following";
    btn.classList.add("following");
    _followingSet.add(userId);
    showToast("Following!");
    if (currentFeedTab === "following" && _masterPosts.length > 0) {
      posts = _masterPosts.filter(
        (p) => (currentUser && p.userId === currentUser.id) || _followingSet.has(p.userId),
      );
      renderFeed();
    }
  } catch (e) {
    showToast("Error: " + e.message);
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────
//  TRENDING
// ─────────────────────────────────────────────────────────────

function setTrendingCategory(category, btn) {
  _trendingCategory = category;
  document.querySelectorAll(".trending-route-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderTrendingList();
}

function setTrendingSort(sort, btn) {
  _trendingSort = sort;
  document.querySelectorAll(".trending-sort-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderTrendingList();
}

function renderTrendingList() {
  const list = document.getElementById("explore-trending-list");
  if (!list) return;

  let items = [..._trendingRaw];

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
  }

  switch (_trendingSort) {
    case "hot":
      items.sort((a, b) => {
        const engA = (a.likes?.length || 0) * 3 + (a.comments?.length || 0) * 2 + (a.reposts?.length || 0) * 2;
        const engB = (b.likes?.length || 0) * 3 + (b.comments?.length || 0) * 2 + (b.reposts?.length || 0) * 2;
        const ageA = Date.now() - new Date(a.createdAt);
        const ageB = Date.now() - new Date(b.createdAt);
        return (engB / (1 + ageB / 3600000)) - (engA / (1 + ageA / 3600000));
      });
      break;
    case "newest":
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case "top":
      items.sort((a, b) => {
        const eA = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.reposts?.length || 0);
        const eB = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.reposts?.length || 0);
        return eB - eA;
      });
      break;
  }

  const badge = document.getElementById("trending-count-badge");
  if (badge) badge.textContent = `${items.length} post${items.length !== 1 ? "s" : ""}`;

  if (!items.length) {
    list.innerHTML = `<div class="explore-trending-empty">🔍 No posts match this filter. Try a different category!</div>`;
    return;
  }

  list.innerHTML = items.map((p) => buildPostCard(p, false)).join("");
  _initPostCardLinkPreviews();
}

async function loadExploreTrending(force = false) {
  const list = document.getElementById("explore-trending-list");
  const btn  = document.getElementById("explore-trending-refresh");
  if (!list) return;

  if (btn) { btn.classList.add("spinning"); btn.disabled = true; }
  list.innerHTML = [1,2,3].map(() => `<div class="explore-post-skeleton"></div>`).join("");

  try {
    const res      = await api("GET", "/api/explore/trending");
    const trending = res.data || [];

    if (!trending.length) {
      _trendingRaw = [];
      list.innerHTML = `<div class="explore-trending-empty">🔥 No trending posts yet. Check back soon!</div>`;
      const badge = document.getElementById("trending-count-badge");
      if (badge) badge.textContent = "0 posts";
      return;
    }

    trending.forEach((post) => {
      post.likes    = Array.isArray(post.likes)    ? post.likes    : [];
      post.reposts  = Array.isArray(post.reposts)  ? post.reposts  : [];
      post.comments = Array.isArray(post.comments) ? post.comments : [];
      PostCache.putPost(post);
      if (!posts.find((p) => p.id === post.id)) posts.unshift(post);
    });

    _trendingRaw = trending;
    renderTrendingList();
  } catch (e) {
    list.innerHTML = `<div class="explore-trending-empty" style="color:var(--rose)">Could not load trending posts.</div>`;
  } finally {
    if (btn) { btn.classList.remove("spinning"); btn.disabled = false; }
  }
}

// ─────────────────────────────────────────────────────────────
//  NEW MEMBERS
// ─────────────────────────────────────────────────────────────

function _joinedAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Joined today";
  if (diff === 1) return "Joined yesterday";
  return `Joined ${diff} days ago`;
}

function _saveDismissed() {
  localStorage.setItem("circle_new_dismissed_ids", JSON.stringify([..._dismissedNewIds]));
}

async function loadNewMembers(force = false) {
  if (!currentUser) return;
  if (_newMembersLoaded && !force) return;
  try {
    const res  = await api("GET", "/api/users/new-members?limit=20");
    _newMembers = (res.data || []).filter((u) => {
      if (u.id === currentUser.id) return false;
      const days = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
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
  return _newMembers
    .filter((u) => !_dismissedNewIds.has(u.id))
    .slice(0, FEED_NEW_LIMIT);
}

function _injectFeedNewCards() {
  const feedList = document.getElementById("feed-list");
  if (!feedList) return;
  feedList.querySelectorAll(".feed-new-card").forEach((el) => el.remove());
  const toShow    = _visibleNewMembers();
  if (!toShow.length) return;
  const postCards = feedList.querySelectorAll(".post-card");
  const anchor    = postCards[Math.min(2, postCards.length - 1)];
  if (!anchor) return;
  [...toShow].reverse().forEach((u) => {
    const temp = document.createElement("div");
    temp.innerHTML = buildFeedNewCard(u);
    anchor.insertAdjacentElement("afterend", temp.firstElementChild);
  });
  document.querySelectorAll(".feed-new-card").forEach((el, i) => {
    setTimeout(() => el.classList.add("visible"), 120 + i * 180);
  });
}

function buildFeedNewCard(u) {
  const initial = (u.name || "?").charAt(0).toUpperCase();
  const color   = stringToColor(u.name || "");
  const avBg    = u.picture ? "transparent" : color;
  const avInner = u.picture
    ? `<img src="${escHtml(u.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
    : initial;
  const bioHtml = u.bio ? `<div class="feed-new-bio">${escHtml(u.bio)}</div>` : "";
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
    el.style.transition  = "opacity .22s, max-height .3s";
    el.style.opacity     = "0";
    el.style.maxHeight   = el.offsetHeight + "px";
    requestAnimationFrame(() => {
      el.style.maxHeight    = "0";
      el.style.marginBottom = "0";
      el.style.overflow     = "hidden";
    });
    setTimeout(() => el.remove(), 320);
  }
}

async function feedNewFollow(userId, btn) {
  if (!currentUser) { showToast("Log in to follow."); goTo("login"); return; }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following ✓";
    btn.classList.add("following");
    showToast("You're now following them! 🎉");
    setTimeout(() => dismissFeedNew(userId), 800);
  } catch (e) {
    showToast("Error: " + e.message);
    btn.disabled = false;
  }
}

async function loadExploreNewMembers(force = false) {
  const section = document.getElementById("explore-new-section");
  const list    = document.getElementById("explore-new-list");
  const btn     = document.getElementById("explore-new-refresh");
  if (!section || !list) return;

  if (btn) { btn.classList.add("spinning"); btn.disabled = true; }

  try {
    let members = _newMembers;
    if (!_newMembersLoaded || force) {
      const res = await api("GET", "/api/users/new-members?limit=20");
      members = (res.data || []).filter((u) => {
        if (u.id !== currentUser?.id) return false;
        const days = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
        return days <= 3;
      });
      _newMembers       = members;
      _newMembersLoaded = true;
    }

    if (!members.length) { section.style.display = "none"; return; }

    section.style.display = "block";
    list.innerHTML = `<div class="explore-people-scroll">${members.map((u) => {
      const initial = (u.name || "?").charAt(0).toUpperCase();
      const color   = stringToColor(u.name || "");
      const avBg    = u.picture ? "transparent" : color;
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
    }).join("")}</div>`;
  } catch (e) {
    if (section) section.style.display = "none";
  } finally {
    if (btn) { btn.classList.remove("spinning"); btn.disabled = false; }
  }
}

async function exploreNewFollow(userId, btn) {
  if (!currentUser) { showToast("Log in to follow."); goTo("login"); return; }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent  = "Following ✓";
    btn.style.opacity = "0.7";
    showToast("You're now following them! 🎉");
    _newMembers = _newMembers.filter((u) => u.id !== userId);
  } catch (e) {
    showToast("Error: " + e.message);
    btn.disabled = false;
  }
}