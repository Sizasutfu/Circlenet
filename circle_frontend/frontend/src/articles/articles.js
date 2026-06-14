/* ═══════════════════════════════════════════════════════════════
   ARTICLES FEED  — Circle-native blog integration
   Supports slug‑based URLs (/articles/your-article-slug)
   ═══════════════════════════════════════════════════════════════ */
const ArticlesFeed = (() => {
  let _articles = [];        // full list from API
  let _filtered = [];        // after search + tag
  let _page = 1;
  let _loaded = false;
  let _activeTag = '';
  let _searchTerm = '';
  const PER_PAGE = 6;
  const PLACEHOLDER_IMG = 'https://placehold.co/600x340/111116/7c6bff?text=Article';

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Helper: safely get a working image URL with fallback
  function _getImageUrl(coverImage) {
    if (!coverImage || typeof coverImage !== 'string') return PLACEHOLDER_IMG;
    // Prevent relative paths that might break – optionally convert to absolute if needed
    // (assuming your API returns absolute URLs – if not, you may prepend a base URL here)
    return coverImage;
  }

  function _buildCard(art, delay) {
    const tags = (art.tags || []).slice(0,2);
    const tagsHTML = tags.map(t => `<span class="art-card-tag">${_esc(t)}</span>`).join('');
    const coverUrl = _getImageUrl(art.coverImage);
    const likedClass = art.userLiked ? 'liked' : '';
    const echoedClass = art.userEchoed ? 'echoed' : '';
    const dateStr = art.createdAt ? new Date(art.createdAt).toLocaleDateString() : '';
    const authorName = art.author || 'Anonymous';
    const authorPicture = art.authorPicture || null;
    const avatarInitial = authorName.charAt(0).toUpperCase();
    const avatarUrl = authorPicture || `https://placehold.co/56/7c6bff/fff?text=${avatarInitial}`;
    const articleSlug = art.slug;

    return `
      <div class="art-card" style="animation-delay:${delay}ms" onclick="ArticlesFeed.openArticle('${articleSlug}')">
        <img class="art-card-cover" 
             src="${_esc(coverUrl)}" 
             loading="lazy"
             onerror="this.onerror=null; this.src='${PLACEHOLDER_IMG}';"
             alt="${_esc(art.title)}" />
        <div class="art-card-body">
          <div class="art-card-meta">
            <span class="art-card-date">${_esc(dateStr)}</span>
            <div class="art-card-tags">${tagsHTML}</div>
          </div>
          <div class="art-card-title">${_esc(art.title)}</div>
          <div class="art-card-excerpt">${_esc(art.excerpt || (art.content || '').slice(0,120))}</div>
          <div class="art-card-footer">
            <div class="art-card-author">
              <img class="art-card-author-av" 
                   src="${_esc(avatarUrl)}" 
                   loading="lazy"
                   onerror="this.onerror=null; this.src='https://placehold.co/56/7c6bff/fff?text=${avatarInitial}';"
                   alt="${_esc(avatarInitial)}" />
              <span class="art-card-author-name">${_esc(authorName)}</span>
            </div>
            <div class="art-card-actions" onclick="event.stopPropagation()">
              <button class="art-act-btn ${likedClass}" onclick="ArticlesFeed.toggleLike(${art.id})">
                <svg fill="${art.userLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
                <span>${art.like_count || 0}</span>
              </button>
              <button class="art-act-btn ${echoedClass}" onclick="ArticlesFeed.toggleEcho(${art.id})">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/>
                </svg>
                <span>${art.echo_count || 0}</span>
              </button>
              <button class="art-act-btn" onclick="ArticlesFeed.openArticle('${articleSlug}')">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span>${art.comment_count || 0}</span>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function _render() {
    const grid = document.getElementById('art-grid');
    if (!grid) return;
    const totalPages = Math.max(1, Math.ceil(_filtered.length / PER_PAGE));
    _page = Math.min(_page, totalPages);
    const start = (_page - 1) * PER_PAGE;
    const slice = _filtered.slice(start, start + PER_PAGE);

    if (!slice.length) {
      grid.innerHTML = `<div class="art-empty">No articles found</div>`;
    } else {
      grid.innerHTML = slice.map((a, i) => _buildCard(a, i * 45)).join('');
    }

    const prevBtn = document.getElementById('art-prev-btn');
    const nextBtn = document.getElementById('art-next-btn');
    const pageInfo = document.getElementById('art-page-info');
    if (prevBtn) prevBtn.disabled = _page <= 1;
    if (nextBtn) nextBtn.disabled = _page >= totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${_page} of ${totalPages}`;
  }

  function _applyFilter() {
    let filtered = [..._articles];
    if (_searchTerm) {
      const term = _searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(term) ||
        (a.excerpt || '').toLowerCase().includes(term) ||
        (a.author || '').toLowerCase().includes(term)
      );
    }
    if (_activeTag) {
      filtered = filtered.filter(a => (a.tags || []).includes(_activeTag));
    }
    _filtered = filtered;
    _page = 1;
    _render();
  }

  async function _fetchAll() {
    let all = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      try {
        const res = await api('GET', `/api/articles?page=${page}&limit=20`);
        const { articles, hasMore: more } = res.data;
        all.push(...articles);
        hasMore = more;
        page++;
      } catch (e) { break; }
    }
    return all;
  }

  async function _populateFilters() {
    const allTags = new Set();
    _articles.forEach(a => (a.tags || []).forEach(t => allTags.add(t)));
    const tags = Array.from(allTags).sort();

    const sel = document.getElementById('art-tag-filter');
    const pills = document.getElementById('art-category-pills');
    if (!sel || !pills) return;

    sel.innerHTML = '<option value="">All Topics</option>';
    tags.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });

    pills.innerHTML = tags.slice(0,5).map(t =>
      `<button class="art-cat-pill${_activeTag === t ? ' active' : ''}" onclick="ArticlesFeed.filterTag('${_esc(t)}')">${_esc(t)}</button>`
    ).join('');
  }

  return {
    async init() {
      if (_loaded) { _render(); return; }
      const grid = document.getElementById('art-grid');
      if (!grid) return;
      grid.innerHTML = '<div class="art-skel"></div>'.repeat(6);
      _articles = await _fetchAll();
      _filtered = [..._articles];
      _loaded = true;
      await _populateFilters();
      _render();
    },
    search(val) {
      _searchTerm = val.trim().toLowerCase();
      _applyFilter();
    },
    filterTag(tag) {
      _activeTag = (_activeTag === tag) ? '' : tag;
      const sel = document.getElementById('art-tag-filter');
      if (sel) sel.value = _activeTag;
      _populateFilters(); // re-render pills active state
      _applyFilter();
    },
    prevPage() { if (_page > 1) { _page--; _render(); window.scrollTo(0,0); } },
    nextPage() {
      const totalPages = Math.max(1, Math.ceil(_filtered.length / PER_PAGE));
      if (_page < totalPages) { _page++; _render(); window.scrollTo(0,0); }
    },
    async toggleLike(articleId) {
      if (!currentUser) { goTo('login'); return; }
      try {
        const res = await api('POST', `/api/articles/${articleId}/like`);
        const article = _articles.find(a => a.id === articleId);
        if (article) {
          article.userLiked = res.data.liked;
          article.like_count = res.data.likes;
        }
        _render();
      } catch (e) { showToast(e.message); }
    },
    async toggleEcho(articleId) {
      if (!currentUser) { goTo('login'); return; }
      try {
        const res = await api('POST', `/api/articles/${articleId}/echo`);
        const article = _articles.find(a => a.id === articleId);
        if (article) {
          article.userEchoed = res.data.echoed;
          article.echo_count = res.data.echoes;
        }
        _render();
      } catch (e) { showToast(e.message); }
    },
    openArticle(articleSlug) {
      window.open(`/articles/${articleSlug}`, '_blank', 'noopener');
    }
  };
})();