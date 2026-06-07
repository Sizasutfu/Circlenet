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
      window._followingSetLoaded = false;
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
      window._followingSetLoaded = true;
    }
  }

  // ── Helper: deduplicate posts array by ID ─────────────────────
  function _dedupPosts(postsArray) {
    const seen = new Set();
    return postsArray.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
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

  // ── Expected page size (used for hasMore heuristic) ───────────
  const PAGE_SIZE = 10;

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
    let posts = [];
    let explicitHasMore = null;

    if (Array.isArray(payload)) {
      posts = payload;
      if (typeof res.hasMore === 'boolean') explicitHasMore = res.hasMore;
      else if (typeof res.data?.hasMore === 'boolean') explicitHasMore = res.data.hasMore;
    } else if (Array.isArray(payload?.posts)) {
      posts = payload.posts;
      if (typeof payload.hasMore === 'boolean') explicitHasMore = payload.hasMore;
      else if (typeof res.hasMore === 'boolean') explicitHasMore = res.hasMore;
    } else {
      return { posts: [], hasMore: false };
    }

    let hasMore;
    if (explicitHasMore !== null) {
      hasMore = explicitHasMore;
    } else {
      hasMore = posts.length >= PAGE_SIZE;
    }

    return { posts, hasMore };
  }

  // ── Live strip preservation ───────────────────────────────────
  // Detaches #live-feed-strip before any innerHTML write so it isn't
  // destroyed, then re-prepends it after. Falls back to a global
  // getElementById lookup to handle the async race where
  // loadActiveSessions() creates the strip after _saveLiveStrip ran.
  function _saveLiveStrip(c) {
    const strip = c.querySelector('#live-feed-strip') || null;
    if (strip) strip.remove(); // detach safely before innerHTML wipe
    return strip;
  }
  function _restoreLiveStrip(c, strip) {
    if (strip) {
      if (!c.contains(strip)) c.prepend(strip);
      return;
    }
    // loadActiveSessions() may have created the strip asynchronously
    // while a render was in flight — pick it up if it exists outside c.
    const orphan = document.getElementById('live-feed-strip');
    if (orphan && !c.contains(orphan)) c.prepend(orphan);
  }

  // ── Render ────────────────────────────────────────────────────
  function _render() {
    const c = document.getElementById("feed-list");
    if (!c) return;
    const liveStrip = _saveLiveStrip(c);

    if (!_state.posts.length) {
      if (_state.loading) return;

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
      _restoreLiveStrip(c, liveStrip);
      return;
    }

    const parts = _state.posts.map((p) => buildPostCard(p));

    if (!_feedSugDismissed && currentUser && parts.length >= 5) {
      parts.splice(5, 0, buildFeedSugCard());
    }
    if (!_feedNewDismissed && currentUser && _newMembers.length) {
      const member = _newMembers[_feedNewIndex % _newMembers.length];
      if (member) {
        const injectAt = Math.floor(Math.random() * 3) + 3;
        parts.splice(Math.min(injectAt, parts.length), 0, buildFeedNewCard(member));
      }
    }

    c.innerHTML = parts.join("");
    _restoreLiveStrip(c, liveStrip);
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
      const feedList = document.getElementById("feed-list");
      if (feedList) feedList.appendChild(s);
      else return;
    }
    if (_scrollObserver) _scrollObserver.disconnect();
    _scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !_state.loading && _state.hasMore) {
          _fetchMore();
        }
      },
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
    } catch (e) { /* silent */ }
  }

  // ── Core fetch: first page ────────────────────────────────────
  async function _fetchFirstPage() {
    if (_state.loading) return;

    const thisFetch = ++_fetchSeq;
    _activeTabAtFetch = _state.tab;

    const c = document.getElementById("feed-list");

    const cached = PostCache.getFeedPage(_state.tab, 1);
    if (cached && cached.posts.length > 0) {
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

    _state.loading = true;
    const _liveStripSkel = _saveLiveStrip(c);
    c.innerHTML = _skelHTML();
    _restoreLiveStrip(c, _liveStripSkel);

    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=1`);

      if (thisFetch !== _fetchSeq || _activeTabAtFetch !== _state.tab) {
        return;
      }

      let { posts: newPosts, hasMore } = _normalise(res);

      // New user fallback – try trending (Fix 1)
      if (!newPosts.length && _state.tab === "global" && currentUser) {
        const fb = await api("GET", "/api/posts?feed=trending&page=1");
        const n = _normalise(fb);
        newPosts = n.posts;
        hasMore = n.hasMore;
      }

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
      _updateSentinel();
      _startLivePolling();
    } catch (e) {
      const stale = PostCache.getFeedPage(_state.tab, 1);
      if (stale?.posts?.length) {
        _state.posts = stale.posts;
        posts = _state.posts;
        _state.hasMore = stale.hasMore;
        _state.page = 2;
        showOfflineBanner();
        _render();
        _updateSentinel();
      } else {
        const _liveStripOffline = _saveLiveStrip(c);
        c.innerHTML = `<div class="empty"><div class="empty-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>You're offline</h3><p>No cached posts available yet. Connect to the internet to load your feed.</p></div>`;
        _restoreLiveStrip(c, _liveStripOffline);
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

    const cached = PostCache.getFeedPage(_state.tab, _state.page);
    if (cached && cached.posts.length > 0) {
      // Deduplicate before merging
      const combined = _dedupPosts([..._state.posts, ...cached.posts]);
      _state.posts = combined;
      posts = _state.posts;
      _state.hasMore = cached.hasMore;
      _state.page++;
      const c = document.getElementById("feed-list");
      const frag = document.createDocumentFragment();
      const addedCards = [];
      cached.posts.forEach((p) => {
        // Only add card if it's not already in DOM (by checking state after dedup)
        const alreadyInState = _state.posts.some(existing => existing.id === p.id);
        if (alreadyInState && _state.posts.indexOf(p) < _state.posts.length - cached.posts.length) {
          return; // skip if it was already present before this merge
        }
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

      if (thisFetch !== _fetchSeq || _activeTabAtFetch !== _state.tab) {
        skelIds.forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
        return;
      }

      let { posts: newPosts, hasMore } = _normalise(res);

      if (currentUser && _state.tab !== "following" && _followingSetLoaded) {
        newPosts = newPosts.filter((p) => !p.isRepost || _followingSet.has(p.userId));
      }

      skelIds.forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });

      PostCache.storeFeedPage(_state.tab, _state.page, newPosts, hasMore);
      // Deduplicate before merging
      const combined = _dedupPosts([..._state.posts, ...newPosts]);
      _state.posts = combined.slice(-100); // keep last 100 to avoid memory bloat
      posts = _state.posts;
      if (_state.tab === "global") _state.masterPosts = [..._state.posts];
      _state.hasMore = hasMore;
      _state.page++;
      _state.pageState[_state.tab].page = _state.page;
      _state.pageState[_state.tab].hasMore = hasMore;

      const frag = document.createDocumentFragment();
      const addedCards = [];
      // Only add cards that are truly new (not already present in DOM)
      newPosts.forEach((p) => {
        if (!_state.posts.some(existing => existing.id === p.id)) return; // safety check
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
    if (document.hidden) return;

    try {
      const feedTab = currentUser ? _state.tab : "global";
      const res = await api("GET", `/api/posts?feed=${feedTab}&page=1`);
      const { posts: fresh, hasMore } = _normalise(res);

      if (!(fresh.length === 0 && !hasMore)) {
        PostCache.storeFeedPage(_state.tab, 1, fresh, hasMore);
      }

      if (feedTab === "global") {
        const merged = [...fresh];
        _state.masterPosts.forEach(p => {
          if (!merged.some(fp => fp.id === p.id)) merged.push(p);
        });
        _state.masterPosts = merged;
      }

      fresh.forEach((fp) => {
        const existing = _state.posts.find((p) => p.id === fp.id);
        if (existing) {
          existing.likes    = fp.likes;
          existing.comments = fp.comments;
          existing.reposts  = fp.reposts;
          PostCache.putPost(existing);
        }
      });

      const newPosts = fresh.filter(p => !_liveSeenIds.has(p.id));
      if (newPosts.length > 0 && feedTab === "global") {
        newPosts.forEach(p => _liveSeenIds.add(p.id));
        _liveQueue = [...newPosts, ..._liveQueue];
        _showNewPostsBanner(_liveQueue.length);
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
    if (document.hidden) return;

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
    // Deduplicate against existing posts before prepending
    const existingIds = new Set(_state.posts.map(p => p.id));
    const uniqueNew = toInsert.filter(p => !existingIds.has(p.id));
    if (uniqueNew.length === 0) return;
    _state.posts = [...uniqueNew, ..._state.posts];
    posts = _state.posts;
    const frag = document.createDocumentFragment();
    uniqueNew.reverse().forEach((p) => {
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
      if (!_state.posts.some(existing => existing.id === p.id)) {
        _state.posts.push(p);
        posts = _state.posts;
        const d = document.createElement("div");
        d.innerHTML = buildPostCard(p);
        const card = d.firstElementChild;
        if (!card) return;
        card.style.animation = "livePostIn 0.4s cubic-bezier(0.34,1.4,0.64,1)";
        const insertAfter = newCards[Math.min(1, newCards.length - 1)];
        if (insertAfter?.nextSibling) feedList.insertBefore(card, insertAfter.nextSibling);
        else feedList.appendChild(card);
      }
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

      if (_state.loading) return;
      _fetchFirstPage();
    },

    load() {
      _state.page = 1;
      _state.hasMore = true;
      _state.loading = false;
      _fetchFirstPage();
    },

    switchTab(tab) {
      if (!currentUser && tab === "following") {
        showToast("Log in to see posts from people you follow.");
        goTo("login");
        return;
      }

      _fetchSeq++;

      if (_activeFilter) {
        _activeFilter = null;
        document.getElementById("trending-filter-bar").style.display = "none";
      }

      _state.scrollY[_state.tab] = window.scrollY;
      _state.tab = tab;
      currentFeedTab = tab;
      document.getElementById("ftab-global").classList.toggle("active", tab === "global");
      document.getElementById("ftab-following").classList.toggle("active", tab === "following");

      if (_state.masterPosts.length > 0 && (tab !== "following" || _followingSetLoaded)) {
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

        if (_state.posts.length === 0 && _state.masterPosts.length > 0) {
          _state.page = 1;
          _state.hasMore = true;
          _state.posts = [];
          posts = [];
          _fetchFirstPage();
          loadTrending(true);
          return;
        }

        _render();
        _updateSentinel();
        requestAnimationFrame(() => {
          window.scrollTo({ top: _state.scrollY[tab] || 0, behavior: "instant" });
        });
        _backgroundRefresh();
        loadTrending(true);
        return;
      }

      const cached = PostCache.getFeedPage(tab, 1);
      if (cached && cached.posts.length > 0) {
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

    saveScroll() { _state.scrollY[_state.tab] = window.scrollY; },
    renderFeed: _render,
    fetchMore: _fetchMore,
    updateSentinel: _updateSentinel,
    stopLivePolling: _stopLivePolling,

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

    loadFollowingSet: _loadFollowingSet,

    get tab()                { return _state.tab; },
    get loading()            { return _state.loading; },
    get hasMore()            { return _state.hasMore; },
    get page()               { return _state.page; },
    get followingSet()       { return _followingSet; },
    get followingSetLoaded() { return _followingSetLoaded; },
  };
})();

// Legacy shims
let currentFeedTab = "global";
const _followingSet = Feed.followingSet;
let _followingSetLoaded = false;
let _masterPosts = [];
let _feedScrollY = 0;
const _tabState = {
  global:    { scrollY: 0, page: 1, hasMore: true },
  following: { scrollY: 0, page: 1, hasMore: true },
};
let feedPage = 1, feedHasMore = true, feedLoading = false;

/* ═══════════════════════════════════════════════════════════════
   POST CACHE
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
      if (page === 1 && !hasMore) {
        const existing = _feeds[_feedKey(tab, 1)];
        if (existing && existing.ids.length > newPosts.length) return;
      }
      if (page === 1 && newPosts.length === 0 && !hasMore) {
        const existing = _feeds[_feedKey(tab, 1)];
        if (existing && existing.ids.length > 0) return;
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