/**
 * partials.js
 * Fetches every HTML partial and injects it into the page shell,
 * then fires the custom event "partials:ready" so other scripts
 * (main.js, router.js, etc.) know the DOM is fully populated.
 *
 * Load order in index.html:
 *   <script src="/src/partials.js" defer></script>
 *   ... all other <script> tags also defer or are at bottom ...
 *   <script src="/main.js"></script>   ← still loads last
 */

(function () {
  // Each entry: { id: target element id, src: partial path }
  const PARTIALS = [
    { id: 'shell-sidebar',       src: '/src/partials/sidebar.html' },
    { id: 'shell-feed',          src: '/src/partials/view-feed.html' },
    { id: 'shell-explore',       src: '/src/partials/view-explore.html' },
    { id: 'shell-groups',        src: '/src/partials/view-groups.html' },
    { id: 'shell-search',        src: '/src/partials/view-search.html' },
    { id: 'shell-auth',          src: '/src/partials/view-auth.html' },
    { id: 'shell-profile',       src: '/src/partials/view-profile.html' },
    { id: 'shell-messages',      src: '/src/partials/view-messages.html' },
    { id: 'shell-post-detail',   src: '/src/partials/view-post-detail.html' },
    { id: 'shell-mobile-nav',    src: '/src/partials/mobile-nav.html' },
    { id: 'shell-overlays',      src: '/src/partials/overlays.html' },
  ];

  async function loadPartial({ id, src }) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[partials] Mount point #${id} not found — skipping ${src}`);
      return;
    }
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      el.innerHTML = await res.text();
    } catch (err) {
      console.error(`[partials] Failed to load ${src}:`, err);
    }
  }

  async function loadAll() {
    // Load all partials in parallel for speed
    await Promise.all(PARTIALS.map(loadPartial));
    document.dispatchEvent(new CustomEvent('partials:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll);
  } else {
    loadAll();
  }
})();
