// ─────────────────────────────────────────────────────────────
//  search.js — CircleNet Search module
//
//  Depends on: api(), currentUser, posts, PostCache,
//              goTo(), showToast(), escHtml(), stringToColor(),
//              buildPostCard(), viewProfile(),
//              _followingSet, _viewToPath(), _updateMeta(),
//              _routes, _initPostCardLinkPreviews()
// ─────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────
let searchTab      = "posts";
let searchTimer    = null;       // debounce timer handle
let _searchAbort   = null;       // AbortController for in-flight request
let _searchPage    = 1;          // current pagination page
let _searchHasMore = false;      // whether more pages exist
let _searchLastQ   = "";         // last executed query (for load-more)

// LRU-style cache: key = "q|type|page" → { data, hasMore }
// Capped at 60 entries so it never grows unbounded.
const _searchCache    = new Map();
const SEARCH_CACHE_MAX = 60;

// ── Search history state ──────────────────────────────────────
let _searchHistory        = [];   // [{ id, query, tab, searched_at }]
let _searchHistoryEnabled = true; // mirrors user setting
let _historyVisible       = false;

function _cacheGet(key) {
  return _searchCache.get(key) ?? null;
}
function _cacheSet(key, val) {
  if (_searchCache.size >= SEARCH_CACHE_MAX) {
    _searchCache.delete(_searchCache.keys().next().value);
  }
  _searchCache.set(key, val);
}

// ── History helpers ──────────────────────────────────────────
async function loadSearchHistory() {
  if (!currentUser || !_searchHistoryEnabled) return;
  try {
    const res = await api('GET', '/api/search/history');
    _searchHistory = res.data ?? [];
  } catch (_) {}
}

async function _saveToHistory(q) {
  if (!currentUser || !_searchHistoryEnabled || q.length < 2) return;
  try {
    await api('POST', '/api/search/history', { query: q, tab: searchTab });
    // Update local cache — upsert by query+tab
    const idx = _searchHistory.findIndex(h => h.query === q && h.tab === searchTab);
    const entry = { query: q, tab: searchTab, searched_at: new Date().toISOString() };
    if (idx !== -1) {
      _searchHistory[idx] = { ..._searchHistory[idx], ...entry };
    } else {
      _searchHistory.unshift(entry);
      if (_searchHistory.length > 20) _searchHistory.pop();
    }
  } catch (_) {}
}

async function deleteHistoryEntry(id, query, tab) {
  try {
    if (id) {
      await api('DELETE', `/api/search/history/${id}`);
    }
    _searchHistory = _searchHistory.filter(
      h => !(h.query === query && h.tab === tab)
    );
    _renderHistoryDropdown();
  } catch (_) {}
}

async function clearSearchHistory() {
  try {
    await api('DELETE', '/api/search/history');
    _searchHistory = [];
    _renderHistoryDropdown();
    showToast('Search history cleared.');
  } catch (_) {}
}

function _renderHistoryDropdown() {
  const wrap = document.getElementById('search-history-dropdown');
  if (!wrap) return;

  const q = (document.getElementById('search-input')?.value || '').trim();
  const items = _searchHistory.filter(h =>
    !q || h.query.toLowerCase().includes(q.toLowerCase())
  );

  if (!_searchHistoryEnabled || !items.length) {
    wrap.classList.remove('open');
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <div class="sh-header">
      <span class="sh-title">Recent searches</span>
      <button class="sh-clear-btn" onclick="clearSearchHistory()">Clear all</button>
    </div>
    <ul class="sh-list">
      ${items.map(h => `
        <li class="sh-item" onclick="applyHistoryEntry('${escHtml(h.query)}','${h.tab}')">
          <svg class="sh-icon" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span class="sh-query">${escHtml(h.query)}</span>
          <span class="sh-tab-badge">${h.tab}</span>
          <button class="sh-del-btn" onclick="event.stopPropagation();deleteHistoryEntry(${h.id ?? 'null'},'${escHtml(h.query)}','${h.tab}')" title="Remove">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
      `).join('')}
    </ul>`;
  wrap.classList.add('open');
}

function applyHistoryEntry(q, tab) {
  const input = document.getElementById('search-input');
  if (input) input.value = q;
  if (tab !== searchTab) switchSearchTab(tab);
  _hideHistoryDropdown();
  _searchPage = 1;
  runSearch(q);
}

function _hideHistoryDropdown() {
  const wrap = document.getElementById('search-history-dropdown');
  if (wrap) {
    wrap.classList.remove('open');
    wrap.innerHTML = '';
  }
  _historyVisible = false;
}

function onSearchFocus() {
  const q = (document.getElementById('search-input')?.value || '').trim();
  if (q.length < 2 && _searchHistory.length && _searchHistoryEnabled) {
    _historyVisible = true;
    _renderHistoryDropdown();
    const trending = document.getElementById('search-trending-section');
    if (trending) trending.style.display = 'none';
  }
}

function onSearchBlur() {
  // Small delay so click on a history item fires first
  setTimeout(() => {
    _hideHistoryDropdown();
    const q = (document.getElementById('search-input')?.value || '').trim();
    if (q.length < 2) {
      const trending = document.getElementById('search-trending-section');
      if (trending) trending.style.display = 'block';
    }
  }, 180);
}

// ── Tab switcher ──────────────────────────────────────────────────
function switchSearchTab(tab) {
  searchTab = tab;
  document.getElementById("stab-posts").classList.toggle("active",  tab === "posts");
  document.getElementById("stab-people").classList.toggle("active", tab === "people");
  const q = document.getElementById("search-input").value.trim();
  _searchPage = 1;
  if (q.length >= 2) {
    const url = _viewToPath("search", { q, type: tab });
    history.replaceState({ view: "search", q, type: tab }, "", url);
    _updateMeta(_routes.find((r) => r.view === "search"), {}, { q, type: tab });
    runSearch(q);
  } else {
    renderSearchHint();
  }
}

// ── Input handler (debounced) ─────────────────────────────────
function onSearchInput() {
  clearTimeout(searchTimer);
  _searchAbort?.abort();
  _searchAbort = null;

  const q          = document.getElementById("search-input").value.trim();
  const stSection  = document.getElementById("search-trending-section");

  if (q.length < 2) {
    if (stSection) stSection.style.display = "block";
    history.replaceState({ view: "search" }, "", "/search");
    document.title = "Search · Circle";
    renderSearchHint();
    if (_searchHistory.length && _searchHistoryEnabled) {
      _historyVisible = true;
      _renderHistoryDropdown();
    }
    return;
  }
  // Filter history dropdown while typing
  if (_historyVisible) _renderHistoryDropdown();

  if (stSection) stSection.style.display = "none";
  searchTimer = setTimeout(() => {
    _searchPage = 1;
    const url = _viewToPath("search", { q, type: searchTab });
    history.replaceState({ view: "search", q, type: searchTab }, "", url);
    _updateMeta(_routes.find((r) => r.view === "search"), {}, { q, type: searchTab });
    _saveToHistory(q);
    _hideHistoryDropdown();
    runSearch(q);
  }, 300);
}

// ── Empty state ───────────────────────────────────────────────
function renderSearchHint() {
  document.getElementById("search-results").innerHTML =
    `<div class="search-hint"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Type to search ${searchTab === "posts" ? "posts" : "people"}</p></div>`;
}

// ── Skeletons ─────────────────────────────────────────────────
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

// ── Core search ───────────────────────────────────────────────
async function runSearch(q, loadMore = false) {
  if (!currentUser) {
    showToast("Log in to search.");
    goTo("login");
    return;
  }

  const box      = document.getElementById("search-results");
  const page     = loadMore ? _searchPage : 1;
  const cacheKey = `${q}|${searchTab}|${page}`;

  // Cache hit — paint instantly
  const cached = _cacheGet(cacheKey);
  if (cached) {
    if (loadMore) {
      await _appendSearchResults(cached.data, q);
    } else {
      await renderSearchResults(cached.data, q);
    }
    _searchHasMore = cached.hasMore;
    _searchLastQ   = q;
    _renderLoadMore(q);
    return;
  }

  // Show skeletons on fresh search; mini strip on load-more
  if (!loadMore) {
    box.innerHTML = searchTab === "posts"
      ? [0,1,2,3].map(_skelPost).join("")
      : [0,1,2,3,4].map(_skelPerson).join("");
  } else {
    const strip = document.createElement("div");
    strip.id = "search-load-more-skel";
    strip.innerHTML = searchTab === "posts"
      ? [0,1].map(_skelPost).join("")
      : [0,1].map(_skelPerson).join("");
    box.appendChild(strip);
  }

  _searchAbort?.abort();
  _searchAbort = new AbortController();

  try {
    const res = await api(
      "GET",
      `/api/search?q=${encodeURIComponent(q)}&type=${searchTab}&page=${page}&limit=20`,
      null,
      _searchAbort.signal,
    );

    document.getElementById("search-load-more-skel")?.remove();

    const resultData = res.data ?? [];
    const hasMore    = res.meta?.hasMore ?? resultData.length === 20;

    // Hydrate follow status from local set for people results
    if (searchTab === "people" && currentUser && resultData.length) {
      resultData.forEach((user) => {
        if (typeof user.isFollowing !== "boolean") {
          user.isFollowing = _followingSet.has(user.id);
        } else {
          if (user.isFollowing) _followingSet.add(user.id);
          else _followingSet.delete(user.id);
        }
      });
    }

    _cacheSet(cacheKey, { data: resultData, hasMore });
    _searchHasMore = hasMore;
    _searchLastQ   = q;

    if (loadMore) {
      await _appendSearchResults(resultData, q);
    } else {
      await renderSearchResults(resultData, q);
    }
    _renderLoadMore(q);
  } catch (e) {
    document.getElementById("search-load-more-skel")?.remove();
    if (e.name === "AbortError") return;
    box.innerHTML = `<div class="search-hint"><p style="color:var(--rose)">Error: ${escHtml(e.message)}</p></div>`;
  }
}

// ── Load more button ──────────────────────────────────────────
function _renderLoadMore(q) {
  document.getElementById("search-load-more-btn")?.remove();
  if (!_searchHasMore) return;
  const box = document.getElementById("search-results");
  const btn = document.createElement("button");
  btn.id            = "search-load-more-btn";
  btn.className     = "btn btn-ghost";
  btn.style.cssText = "width:100%;margin-top:16px;";
  btn.textContent   = "Load more";
  btn.onclick = () => {
    _searchPage++;
    btn.remove();
    runSearch(q, true);
  };
  box.appendChild(btn);
}

// ── Append results (load-more) ────────────────────────────────
async function _appendSearchResults(data, q) {
  if (!data || !data.length) return;
  const box  = document.getElementById("search-results");
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

// ── Highlight matched query text ──────────────────────────────
function highlight(text, q) {
  if (!text) return "";
  const safe  = escHtml(text);
  const safeQ = escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${safeQ})`, "gi"), '<mark class="hl">$1</mark>');
}

// ── Hydrate post results with full engagement data ────────────
async function _hydratePostResults(data) {
  await Promise.all(
    data.map(async (post) => {
      const cached = PostCache.getPost(post.id) || posts.find((p) => p.id === post.id);
      if (!cached) {
        try {
          const r    = await api("GET", `/api/posts/${post.id}`);
          const full = r.data || r;
          full.likes    = Array.isArray(full.likes)    ? full.likes    : [];
          full.reposts  = Array.isArray(full.reposts)  ? full.reposts  : [];
          full.comments = Array.isArray(full.comments) ? full.comments : [];
          PostCache.putPost(full);
          posts.unshift(full);
          Object.assign(post, full);
        } catch (_) {}
      } else {
        post.likes    = cached.likes;
        post.reposts  = cached.reposts;
        post.comments = cached.comments;
      }
      post.likes    = Array.isArray(post.likes)    ? post.likes    : [];
      post.reposts  = Array.isArray(post.reposts)  ? post.reposts  : [];
      post.comments = Array.isArray(post.comments) ? post.comments : [];
      PostCache.putPost(post);
      if (!posts.find((p) => p.id === post.id)) posts.unshift(post);
    }),
  );
}

// ── Build people cards HTML ───────────────────────────────────
function _buildPeopleCards(data, q) {
  return data.map((user) => {
    const color       = stringToColor(user.name || "");
    const nameInitial = (user.name || "?").charAt(0);
    const avHtml      = user.picture
      ? `<img src="${user.picture}" alt="${escHtml(nameInitial)}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
      : escHtml(nameInitial);
    const isOwnProfile   = currentUser && currentUser.id === user.id;
    const followBtnHtml  = !isOwnProfile && currentUser
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
  }).join("");
}

// ── Render full results (fresh search) ───────────────────────
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

// ── Follow / unfollow from search results ─────────────────────
async function searchFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  const isFollowing = btn.dataset.following === "true";
  const orig        = btn.textContent;
  btn.disabled      = true;
  btn.textContent   = "…";
  try {
    if (isFollowing) {
      await api("DELETE", "/api/unfollow/" + userId);
      _followingSet.delete(userId);
      btn.dataset.following = "false";
      btn.textContent       = "Follow";
      btn.classList.remove("btn-outline");
      btn.classList.add("btn-primary");
      showToast("Unfollowed.");
    } else {
      await api("POST", "/api/follow/" + userId);
      _followingSet.add(userId);
      btn.dataset.following = "true";
      btn.textContent       = "Following";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
      showToast("Following! 🎉");
    }
    // Invalidate cached people results so re-searches reflect new status
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