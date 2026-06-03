// ═══════════════════════════════════════════════════════════════
//  FEED STATE  —  single source of truth, never mutated directly
// ═══════════════════════════════════════════════════════════════
let posts = [],           // posts currently rendered in the feed
    currentUser = null,
    pendingImageDataUrl = null,
    pendingVideoDataUrl = null,
    pendingVideoCompressed = false,
    repostTargetId = null;

// FeedController owns all feed state. Nothing outside it should
// read/write these — use the public methods instead.
// Register service worker for PWA + push notification functionality
let _swRegistration = null;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        _swRegistration = registration;
        // Listen for messages from SW (e.g. notification clicks)
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data && event.data.type === "NOTIFICATION_CLICK") {
            _handlePushNotifClick(event.data);
          }
        });
        // Sync push toggle once SW is ready
        _syncPushToggle();
      })
      .catch(() => {
        /* SW registration failed silently */
      });
  });
}

const Feed = (() => {
  // ── Internal state ────────────────────────────────────────────
  const _state = {
    tab: "global",          // "global" | "following"
    page: 1,
    hasMore: true,
    loading: false,         // TRUE while a fetch is in flight
    posts: [],              // displayed posts
    masterPosts: [],        // full global set (used for tab filtering)
    scrollY: { global: 0, following: 0 },
    pageState: {            // pagination cursor per tab
      global:    { page: 1, hasMore: true },
      following: { page: 1, hasMore: true },
    },
  };

  // ── Following set (who current user follows) ──────────────────
  const _followingSet = new Set();
  let _followingSetLoaded = false;

  async function _loadFollowingSet() {
    if (!currentUser) {
      _followingSet.clear();
      _followingSetLoaded = false;
      return;
    }
    try {
      const res = await api("GET", `/api/users/${currentUser.id}/following`);
      const list = res.data || res.following || res || [];
      _followingSet.clear();
      list.forEach((u) => _followingSet.add(u.id || u));
    } catch (e) {
      // non-critical
    } finally {
      _followingSetLoaded = true;
    }
  }

  // ── Live polling ──────────────────────────────────────────────
  let _liveTimer = null;
  let _liveQueue = [];
  let _liveSeenIds = new Set();
  const LIVE_INTERVAL = 30_000;

  // ── Prefetch ──────────────────────────────────────────────────
  let _scrollObserver = null;
  let _prefetchObserver = null;
  let _prefetching = false;

  // ── Fetch sequence guard (prevents race conditions) ───────────
  let _fetchSeq = 0;
  let _activeTabAtFetch = null;

  // ── Skeleton HTML ─────────────────────────────────────────────
  function _skelHTML() {
    return [0, 1, 2].map((i) => `
      <div class="skel-card" style="animation-delay:${i * 0.12}s">
        <div class="skel-row">
          <div class="skel-av"></div>
          <div class="skel-meta">
            <div class="skel-line w-40 h-14"></div>
            <div class="skel-line w-60"></div>
          </div>
        </div>
        <div class="skel-body">
          <div class="skel-line w-90 h-14"></div>
          <div class="skel-line w-75"></div>
          <div class="skel-line w-50"></div>
        </div>
        ${i === 0 ? '<div class="skel-media"></div>' : ""}
        <div class="skel-actions">
          <div class="skel-btn"></div>
          <div class="skel-btn"></div>
          <div class="skel-btn"></div>
        </div>
      </div>`).join("");
  }

  // ── Normalise API response into { posts[], hasMore } ──────────
  function _normalise(res) {
    const payload = res.data ?? res;
    if (Array.isArray(payload)) {
      return { posts: payload, hasMore: payload.length > 0 };
    }
    if (Array.isArray(payload?.posts)) {
      return { posts: payload.posts, hasMore: payload.hasMore ?? payload.posts.length > 0 };
    }
    return { posts: [], hasMore: false };
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    const c = document.getElementById("feed-list");
    if (!c) return;

    // ── GUARD: never show empty state while a fetch is in flight ──
    if (!_state.posts.length) {
      if (_state.loading) return;   // THE KEY FIX — no "Nothing here yet" flash

      if (_state.tab === "following") {
        c.innerHTML = `<div class="empty">
          <div class="empty-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
          <h3>No posts yet</h3>
          <p>Follow people to see their posts here.</p>
          <button class="btn btn-primary" style="margin-top:14px;padding:10px 24px;border-radius:20px;font-size:14px" onclick="Feed.switchTab('global')">Explore Global Feed</button>
        </div>`;
      } else {
        c.innerHTML = `<div class="empty"><div class="empty-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div><h3>Nothing here yet</h3><p>Be the first to post something!</p></div>`;
      }
      return;
    }

    const parts = _state.posts.map((p) => buildPostCard(p));

    // Inject inline suggestions card after 5th post if not dismissed
    if (!_feedSugDismissed && currentUser && parts.length >= 5) {
      parts.splice(5, 0, buildFeedSugCard());
    }
    // Inject new member card between positions 3-5 if not dismissed
    if (!_feedNewDismissed && currentUser && _newMembers.length) {
      const member = _newMembers[_feedNewIndex % _newMembers.length];
      if (member) {
        const injectAt = Math.floor(Math.random() * 3) + 3;
        parts.splice(Math.min(injectAt, parts.length), 0, buildFeedNewCard(member));
      }
    }

    c.innerHTML = parts.join("");
    _initPostCardLinkPreviews();
  }

  // ── Update scroll sentinel (infinite scroll trigger) ──────────
  function _updateSentinel() {
    let s = document.getElementById("feed-sentinel");
    if (!_state.hasMore) {
      if (s) s.remove();
      _cleanPrefetch();
      return;
    }
    if (!s) {
      s = document.createElement("div");
      s.id = "feed-sentinel";
      s.style.cssText = "height:40px;width:100%";
      document.getElementById("feed-list").appendChild(s);
    }
    if (_scrollObserver) _scrollObserver.disconnect();
    _scrollObserver = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) _fetchMore(); },
      { rootMargin: "800px" }
    );
    _scrollObserver.observe(s);
    _setupPrefetch();
  }

  // ── Prefetch observer ─────────────────────────────────────────
  function _cleanPrefetch() {
    if (_prefetchObserver) { _prefetchObserver.disconnect(); _prefetchObserver = null; }
    _prefetching = false;
  }

  function _setupPrefetch() {
    _cleanPrefetch();
    const cards = document.querySelectorAll("#feed-list .post-card");
    if (cards.length < 4) return;
    const anchor = cards[Math.floor(cards.length * 0.6)];
    if (!anchor) return;
    _prefetchObserver = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || _prefetching || _state.loading || !_state.hasMore) return;
      if (PostCache.getFeedPage(_state.tab, _state.page)) return;
      _prefetching = true;
      _prefetchPage().finally(() => { _prefetching = false; });
    }, { rootMargin: "0px" });
    _prefetchObserver.observe(anchor);
  }

  async function _prefetchPage() {
    if (!_state.hasMore || _state.loading) return;
    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=${_state.page}`);
      const { posts: newPosts, hasMore } = _normalise(res);
      PostCache.storeFeedPage(_state.tab, _state.page, newPosts, hasMore);
    } catch (e) { /* silent — fetchMore will retry on scroll */ }
  }

  // ── Core fetch: first page ────────────────────────────────────
  async function _fetchFirstPage() {
    if (_state.loading) return;

    const thisFetch = ++_fetchSeq;
    _activeTabAtFetch = _state.tab;

    const c = document.getElementById("feed-list");

    // Check cache — paint instantly if fresh
    const cached = PostCache.getFeedPage(_state.tab, 1);
    if (cached) {
      _state.posts = cached.posts;
      posts = _state.posts;
      if (_state.tab === "global") _state.masterPosts = [...cached.posts];
      _state.hasMore = cached.hasMore;
      _state.page = 2;
      _state.pageState[_state.tab].page = 2;
      _state.pageState[_state.tab].hasMore = cached.hasMore;
      _state.loading = false;
      _render();
      _updateSentinel();
      _backgroundRefresh();
      return;
    }

    // No cache — show skeletons then fetch
    _state.loading = true;
    c.innerHTML = _skelHTML();

    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=1`);

      // Race condition guard: if tab changed during request, discard result
      if (thisFetch !== _fetchSeq || _activeTabAtFetch !== _state.tab) {
        return;
      }

      let { posts: newPosts, hasMore } = _normalise(res);

      // New user fallback: personalised feed empty, show trending
      if (!newPosts.length && _state.tab === "global" && currentUser) {
        const fb = await api("GET", "/api/posts?feed=trending&page=1");
        const n = _normalise(fb);
        newPosts = n.posts;
        hasMore = n.hasMore;
      }

      // Filter reposts on global tab (only from followed users)
      if (currentUser && _state.tab !== "following" && _followingSetLoaded) {
        newPosts = newPosts.filter((p) => !p.isRepost || _followingSet.has(p.userId));
      }

      PostCache.storeFeedPage(_state.tab, 1, newPosts, hasMore);
      _state.posts = newPosts;
      posts = _state.posts;
      if (_state.tab === "global") _state.masterPosts = [...newPosts];
      _state.hasMore = hasMore;
      _state.page = 2;
      _state.pageState[_state.tab].page = 2;
      _state.pageState[_state.tab].hasMore = hasMore;

      newPosts.forEach((p) => _liveSeenIds.add(p.id));
      _render();
      _startLivePolling();
    } catch (e) {
      // Error path: try stale cache rather than showing "Nothing here yet"
      const stale = PostCache.getFeedPage(_state.tab, 1);
      if (stale?.posts?.length) {
        _state.posts = stale.posts;
        posts = _state.posts;
        _state.hasMore = stale.hasMore;
        _state.page = 2;
        showOfflineBanner();
        _render();
      } else {
        c.innerHTML = `<div class="empty"><div class="empty-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>You're offline</h3><p>No cached posts available yet. Connect to the internet to load your feed.</p></div>`;
        showOfflineBanner();
      }
    } finally {
      _state.loading = false;
    }
  }

  // ── Core fetch: next pages (infinite scroll) ──────────────────
  async function _fetchMore() {
    if (_state.loading || !_state.hasMore) return;

    const thisFetch = ++_fetchSeq;
    _activeTabAtFetch = _state.tab;

    // Serve from cache if available
    const cached = PostCache.getFeedPage(_state.tab, _state.page);
    if (cached) {
      _state.posts = [..._state.posts, ...cached.posts];
      posts = _state.posts;
      _state.hasMore = cached.hasMore;
      _state.page++;
      const c = document.getElementById("feed-list");
      const frag = document.createDocumentFragment();
      const addedCards = [];
      cached.posts.forEach((p) => {
        const d = document.createElement("div");
        d.innerHTML = buildPostCard(p);
        const card = d.firstElementChild;
        if (card) { frag.appendChild(card); addedCards.push(card); }
      });
      c.appendChild(frag);
      _mixLivePosts(addedCards, c);
      _updateSentinel();
      return;
    }

    _state.loading = true;

    // Show inline skeleton cards for pages 2+
    const c = document.getElementById("feed-list");
    const oldSentinel = document.getElementById("feed-sentinel");
    if (oldSentinel) oldSentinel.remove();
    const skelIds = [0, 1, 2].map((i) => {
      const id = `feed-skel-${Date.now()}-${i}`;
      const el = document.createElement("div");
      el.id = id;
      el.className = "skel-card";
      el.style.animationDelay = `${i * 0.12}s`;
      el.innerHTML = `
        <div class="skel-row"><div class="skel-av"></div><div class="skel-meta">
          <div class="skel-line w-40 h-14"></div><div class="skel-line w-60"></div>
        </div></div>
        <div class="skel-body">
          <div class="skel-line w-90 h-14"></div>
          <div class="skel-line w-75"></div>
          <div class="skel-line w-50"></div>
        </div>
        <div class="skel-actions">
          <div class="skel-btn"></div><div class="skel-btn"></div><div class="skel-btn"></div>
        </div>`;
      c.appendChild(el);
      return id;
    });

    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=${_state.page}`);

      // Race condition guard: discard if tab changed
      if (thisFetch !== _fetchSeq || _activeTabAtFetch !== _state.tab) {
        skelIds.forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
        _state.loading = false;
        _updateSentinel();
        return;
      }

      let { posts: newPosts, hasMore } = _normalise(res);

      if (currentUser && _state.tab !== "following" && _followingSetLoaded) {
        newPosts = newPosts.filter((p) => !p.isRepost || _followingSet.has(p.userId));
      }

      skelIds.forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });

      PostCache.storeFeedPage(_state.tab, _state.page, newPosts, hasMore);
      _state.posts = [..._state.posts, ...newPosts].slice(-100);
      posts = _state.posts;
      if (_state.tab === "global") _state.masterPosts = [..._state.posts];
      _state.hasMore = hasMore;
      _state.page++;
      _state.pageState[_state.tab].page = _state.page;
      _state.pageState[_state.tab].hasMore = hasMore;

      const frag = document.createDocumentFragment();
      const addedCards = [];
      newPosts.forEach((p) => {
        _liveSeenIds.add(p.id);
        const d = document.createElement("div");
        d.innerHTML = buildPostCard(p);
        const card = d.firstElementChild;
        if (card) { frag.appendChild(card); addedCards.push(card); }
      });
      c.appendChild(frag);
      _mixLivePosts(addedCards, c);
    } catch (e) {
      skelIds.forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
    } finally {
      _state.loading = false;
      _updateSentinel();
    }
  }

  // ── Background refresh (stale-while-revalidate) ───────────────
  async function _backgroundRefresh() {
    // Do not refresh when page is hidden
    if (document.hidden) return;

    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=1`);
      const { posts: fresh, hasMore } = _normalise(res);

      // Prevent caching empty first page
      if (!(fresh.length === 0 && !hasMore)) {
        PostCache.storeFeedPage(_state.tab, 1, fresh, hasMore);
      }

      if (feedTab === "global") {
        // Merge new posts with existing masterPosts (preserve older posts)
        const merged = [...fresh];
        _state.masterPosts.forEach(p => {
          if (!merged.some(fp => fp.id === p.id)) merged.push(p);
        });
        _state.masterPosts = merged;
      }

      // Patch like/comment/repost counts silently
      fresh.forEach((fp) => {
        const existing = _state.posts.find((p) => p.id === fp.id);
        if (existing) {
          existing.likes    = fp.likes;
          existing.comments = fp.comments;
          existing.reposts  = fp.reposts;
          PostCache.putPost(existing);
        }
      });

      // Queue truly-new posts as a banner instead of wiping the DOM with _render()
      const currentTopIds = _state.posts.slice(0, fresh.length).map(p => p.id).join(',');
      const freshTopIds = fresh.map(p => p.id).join(',');
      if (currentTopIds !== freshTopIds && feedTab === "global") {
        const newPosts = fresh.filter((p) => !_liveSeenIds.has(p.id));
        if (newPosts.length) {
          newPosts.forEach((p) => _liveSeenIds.add(p.id));
          _liveQueue = [...newPosts, ..._liveQueue];
          _showNewPostsBanner(_liveQueue.length);
        }
      }
    } catch (e) { /* silent */ }
  }

  // ── Live polling ──────────────────────────────────────────────
  function _startLivePolling() {
    if (_liveTimer) return;
    _state.posts.forEach((p) => _liveSeenIds.add(p.id));
    _liveTimer = setInterval(_pollForNew, LIVE_INTERVAL);
  }

  function _stopLivePolling() {
    if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; }
    _liveQueue = [];
    _liveSeenIds = new Set();
    document.getElementById("new-posts-banner")?.remove();
  }

  async function _pollForNew() {
    if (!document.getElementById("view-feed")?.classList.contains("active")) return;
    if (document.hidden) return; // skip when tab is hidden

    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=1`);
      const { posts: fresh } = _normalise(res);
      let truly_new = fresh.filter((p) => !_liveSeenIds.has(p.id));
      if (currentUser && _state.tab !== "following") {
        truly_new = truly_new.filter((p) => !p.isRepost || _followingSet.has(p.userId));
      }
      if (!truly_new.length) return;
      truly_new.forEach((p) => _liveSeenIds.add(p.id));
      _liveQueue = [...truly_new, ..._liveQueue];
      _showNewPostsBanner(_liveQueue.length);
    } catch (_) { /* retry next interval */ }
  }

  function _drainQueueToTop(feedList) {
    if (!_liveQueue.length) return;
    const toInsert = _liveQueue.splice(0);
    _state.posts = [...toInsert, ..._state.posts];
    posts = _state.posts;
    const frag = document.createDocumentFragment();
    toInsert.reverse().forEach((p) => {
      const d = document.createElement("div");
      d.innerHTML = buildPostCard(p);
      const card = d.firstElementChild;
      if (card) {
        card.style.animation = "livePostIn 0.4s cubic-bezier(0.34,1.4,0.64,1)";
        frag.prepend(card);
      }
    });
    const firstCard = feedList.querySelector(".post-card");
    if (firstCard) feedList.insertBefore(frag, firstCard);
    else feedList.prepend(frag);
    _initPostCardLinkPreviews();
  }

  function _mixLivePosts(newCards, feedList) {
    if (!_liveQueue.length || !newCards.length) return;
    const MIX_PER_PAGE = 2;
    const toMix = _liveQueue.splice(0, MIX_PER_PAGE);
    toMix.forEach((p) => {
      if (!_state.posts.some((existing) => existing.id === p.id)) {
        _state.posts.push(p);
        posts = _state.posts;
      }
      const d = document.createElement("div");
      d.innerHTML = buildPostCard(p);
      const card = d.firstElementChild;
      if (!card) return;
      card.style.animation = "livePostIn 0.4s cubic-bezier(0.34,1.4,0.64,1)";
      const insertAfter = newCards[Math.min(1, newCards.length - 1)];
      if (insertAfter?.nextSibling) feedList.insertBefore(card, insertAfter.nextSibling);
      else feedList.appendChild(card);
    });
  }

  function _showNewPostsBanner(count) {
    let banner = document.getElementById("new-posts-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "new-posts-banner";
      banner.style.cssText = `
        position: sticky; top: 12px; z-index: 50; margin: 0 auto 12px;
        max-width: 100px; background: var(--accent); color: #fff;
        border-radius: 999px; padding: 10px 20px; font-size: 14px;
        font-weight: 600; text-align: center; cursor: pointer;
        box-shadow: 0 4px 16px var(--accent-glow);
        animation: livePostIn 0.3s cubic-bezier(0.34,1.4,0.64,1);
      `;
      banner.onclick = () => {
        const feedList = document.getElementById("feed-list");
        if (feedList) _drainQueueToTop(feedList);
        banner.remove();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      const feedList = document.getElementById("feed-list");
      if (feedList) feedList.parentNode.insertBefore(banner, feedList);
    }
    banner.textContent = `↑ ${count} new posts`;
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    // Called by goTo('feed') — restores feed without wiping it
    resume() {
      const feedList = document.getElementById("feed-list");
      const hasRenderedDOM = feedList &&
        feedList.children.length > 0 &&
        !feedList.querySelector(".skel-card");

      if (_state.posts.length > 0 && hasRenderedDOM) {
        _updateSentinel();
        requestAnimationFrame(() => {
          window.scrollTo({ top: _state.scrollY[_state.tab] || 0, behavior: "instant" });
        });
        _backgroundRefresh();
        return;
      }

      // Don't start a second fetch if one is already in flight
      if (_state.loading) return;

      _fetchFirstPage();
    },

    // Full load from scratch (first visit, logout)
    load() {
      _state.page = 1;
      _state.hasMore = true;
      _state.loading = false;
      _fetchFirstPage();
    },

    // Switch between global/following tabs
    switchTab(tab) {
      if (!currentUser && tab === "following") {
        showToast("Log in to see posts from people you follow.");
        goTo("login");
        return;
      }

      // Invalidate all ongoing fetches
      _fetchSeq++;

      // Clear trending filter on tab switch
      if (_activeFilter) {
        _activeFilter = null;
        document.getElementById("trending-filter-bar").style.display = "none";
      }

      // Save scroll position of the tab we're leaving
      _state.scrollY[_state.tab] = window.scrollY;

      // Update tab UI and legacy global
      _state.tab = tab;
      currentFeedTab = tab;
      document.getElementById("ftab-global").classList.toggle("active", tab === "global");
      document.getElementById("ftab-following").classList.toggle("active", tab === "following");

      // In-memory tab switch: filter without a network call
      // Skip if switching to "following" and the set isn't loaded yet — fall through to fetch
      if (_state.masterPosts.length > 0 && !(tab === "following" && !_followingSetLoaded)) {
        const ps = _state.pageState[tab];
        _state.page    = ps.page;
        _state.hasMore = ps.hasMore;
        _state.loading = false;

        if (tab === "following") {
          _state.posts = _state.masterPosts.filter(
            (p) => (currentUser && p.userId === currentUser.id) || _followingSet.has(p.userId)
          );
        } else {
          _state.posts = [..._state.masterPosts];
        }
        posts = _state.posts;

        _render();
        _updateSentinel();
        requestAnimationFrame(() => {
          window.scrollTo({ top: _state.scrollY[tab] || 0, behavior: "instant" });
        });
        _backgroundRefresh();
        loadTrending(true);
        return;
      }

      // No master posts — check cache before going blank
      const cached = PostCache.getFeedPage(tab, 1);
      if (cached) {
        _state.posts = cached.posts;
        posts = _state.posts;
        if (tab === 'global') _state.masterPosts = [...cached.posts];
        _state.hasMore = cached.hasMore;
        _state.page = 2;
        _state.pageState[tab].page = 2;
        _state.pageState[tab].hasMore = cached.hasMore;
        _state.loading = false;
        _render();
        _updateSentinel();
        _backgroundRefresh();
      } else {
        _state.page    = 1;
        _state.hasMore = true;
        _state.loading = false;
        _state.posts   = [];
        posts = [];
        _fetchFirstPage();
      }
      loadTrending(true);
    },

    // Save scroll position when navigating away from feed
    saveScroll() { _state.scrollY[_state.tab] = window.scrollY; },

    // Called after post creation/deletion to re-render
    renderFeed: _render,

    // Called by infinite scroll machinery
    fetchMore: _fetchMore,
    updateSentinel: _updateSentinel,

    // Stop live polling (navigating away from feed)
    stopLivePolling: _stopLivePolling,

    // Called on logout: wipe all feed state
    reset() {
      _stopLivePolling();
      _cleanPrefetch();
      if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
      _state.tab     = "global";
      _state.page    = 1;
      _state.hasMore = true;
      _state.loading = false;
      _state.posts   = [];
      _state.masterPosts = [];
      _state.scrollY = { global: 0, following: 0 };
      _state.pageState = {
        global:    { page: 1, hasMore: true },
        following: { page: 1, hasMore: true },
      };
      posts = [];
      currentFeedTab = "global";
    },

    // Load following set after login
    loadFollowingSet: _loadFollowingSet,

    // Read-only state accessors for legacy code
    get tab()                { return _state.tab; },
    get loading()            { return _state.loading; },
    get hasMore()            { return _state.hasMore; },
    get page()               { return _state.page; },
    get followingSet()       { return _followingSet; },
    get followingSetLoaded() { return _followingSetLoaded; },
  };
})();

// ── Legacy global shims ────────────────────────────────────────────
// These keep the rest of the codebase (profile, groups, suggestions etc.)
// working without changes. They proxy into Feed state so everything stays in sync.
let currentFeedTab = "global";
const _followingSet = Feed.followingSet;     // same Set reference — no duplication
// Proxy into Feed so this always reflects _loadFollowingSet()'s result
Object.defineProperty(window, "_followingSetLoaded", {
  get() { return Feed.followingSetLoaded; },
  configurable: true,
});
let _masterPosts = [];                       // kept for any external references
let _feedScrollY = 0;
const _tabState = {
  global:    { scrollY: 0, page: 1, hasMore: true },
  following: { scrollY: 0, page: 1, hasMore: true },
};
let feedPage = 1, feedHasMore = true, feedLoading = false;

/* ═══════════════════════════════════════════════════════════════
   POST CACHE  —  in-memory + localStorage persistence
   ═══════════════════════════════════════════════════════════════
   Key rules:
     • storeFeedPage() is the ONLY method that writes to localStorage.
     • invalidateFeed() is in-memory ONLY — it NEVER calls _save().
       Persisting the emptied feed index to localStorage causes
       "Nothing here yet" on the next page refresh if the API fetch
       hasn't completed yet. The TTL handles stale data; storeFeedPage()
       persists fresh data once the network fetch succeeds.
   ═══════════════════════════════════════════════════════════════ */
const PostCache = (() => {
  const STORAGE_KEY = "circle_post_cache_v1";
  const TTL_MS = 5 * 60 * 1000;
  const MAX_STORED = 30;

  const _byId = new Map();
  const _feeds = {};
  const _profiles = {};

  let _saveTimer = null;
  function _save() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      try {
        const recent = [..._byId.values()]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, MAX_STORED)
          .map(p => ({ ...p, imageUrl: null, videoUrl: null, image: null, video: null }));
        const payload = { posts: recent, feeds: _feeds, profiles: _profiles, savedAt: Date.now() };
        const serialized = JSON.stringify(payload);
        if (serialized.length < 4 * 1024 * 1024) {
          localStorage.setItem(STORAGE_KEY, serialized);
        }
      } catch (e) {
        try {
          const fallback = [..._byId.values()]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10)
            .map(p => ({ ...p, imageUrl: null, videoUrl: null, image: null, video: null }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            posts: fallback, feeds: {}, profiles: {}, savedAt: Date.now()
          }));
        } catch (_) {}
      }
    }, 200);
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { posts: stored, feeds, profiles } = JSON.parse(raw);
      if (Array.isArray(stored)) stored.forEach((p) => _byId.set(p.id, p));
      if (feeds) Object.assign(_feeds, feeds);
      if (profiles) Object.assign(_profiles, profiles);
    } catch (e) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
  }

  function _feedKey(tab, page) { return `${tab}|${page}`; }
  function _isStale(ts) { return !ts || Date.now() - ts > TTL_MS; }

  return {
    init() { _load(); },

    storeFeedPage(tab, page, newPosts, hasMore) {
      // Do NOT cache an empty first page – it causes "disappearing feed" on refresh
      if (page === 1 && newPosts.length === 0 && !hasMore) {
        // If there is already a non-empty cached version, keep it
        const existing = _feeds[_feedKey(tab, 1)];
        if (existing && existing.ids.length > 0) return;
      }

      // Do NOT let a shorter hasMore:false response overwrite a larger warm cache —
      // this prevents a stale/partial refresh from cutting off infinite scroll.
      if (page === 1 && !hasMore) {
        const existing = _feeds[_feedKey(tab, 1)];
        if (existing && existing.ids.length > newPosts.length) return;
      }

      newPosts.forEach((p) => _byId.set(p.id, p));
      _feeds[_feedKey(tab, page)] = { ids: newPosts.map((p) => p.id), ts: Date.now(), hasMore };
      _save();
    },

    getFeedPage(tab, page) {
      const entry = _feeds[_feedKey(tab, page)];
      if (!entry || _isStale(entry.ts)) return null;
      const resolved = entry.ids.map((id) => _byId.get(id)).filter(Boolean);
      if (resolved.length !== entry.ids.length) return null;
      return { posts: resolved, hasMore: entry.hasMore };
    },

    isFeedPageFresh(tab, page) {
      const entry = _feeds[_feedKey(tab, page)];
      return entry && !_isStale(entry.ts);
    },

    storeProfile(userId, profilePosts) {
      profilePosts.forEach((p) => _byId.set(p.id, p));
      _profiles[userId] = { ids: profilePosts.map((p) => p.id), ts: Date.now() };
      _save();
    },

    getProfile(userId) {
      const entry = _profiles[userId];
      if (!entry || _isStale(entry.ts)) return null;
      return entry.ids.map((id) => _byId.get(id)).filter(Boolean);
    },

    getPost(id) {
      const p = _byId.get(id) || null;
      if (p) resolvePostMedia(p);
      return p;
    },

    putPost(post) { _byId.set(post.id, post); _save(); },

    removePost(id) {
      _byId.delete(id);
      Object.keys(_feeds).forEach((k) => {
        _feeds[k].ids = _feeds[k].ids.filter((i) => i !== id);
      });
      Object.keys(_profiles).forEach((k) => {
        _profiles[k].ids = _profiles[k].ids.filter((i) => i !== id);
      });
      _save();
    },

    patchPost(id, patchFn) {
      const post = _byId.get(id);
      if (post) { patchFn(post); _save(); }
    },

    // ── CRITICAL: NEVER calls _save() ────────────────────────────
    // Persisting the emptied feed index to localStorage causes the
    // "Nothing here yet" flash on the next page refresh.
    // The TTL handles stale data. storeFeedPage() persists fresh data
    // once the network fetch succeeds.
    // NEVER calls _save() — see PostCache header for why
    invalidateFeed(tab) {
      Object.keys(_feeds).forEach((k) => {
        if (k.startsWith(tab + "|")) delete _feeds[k];
      });
    },

    clear() {
      _byId.clear();
      Object.keys(_feeds).forEach((k) => delete _feeds[k]);
      Object.keys(_profiles).forEach((k) => delete _profiles[k]);
      if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    },

    stats() {
      return {
        posts: _byId.size,
        feedKeys: Object.keys(_feeds).length,
        profiles: Object.keys(_profiles).length,
      };
    },
  };
})();
/* END PostCache ════════════════════════════════════════════════ */