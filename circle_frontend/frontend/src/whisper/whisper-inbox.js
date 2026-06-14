/* ═══════════════════════════════════════════════════════════════
   WHISPER INBOX  —  Author's anonymous message inbox
   ═══════════════════════════════════════════════════════════════
   Renders inside:  #view-whisper-inbox  (add to index.html)
   Auth required — redirects to login if no session.

   External globals (main.js / config/api.js):
     - API            — base URL string
     - currentUser    — { id, username, name, ... } | null
     - api(method, path, body?)  — authenticated fetch wrapper
     - showToast(msg) — global toast helper
     - goTo(view)     — router navigation
     - goBack()       — router back

   Router integration (router.js):
     Call  WhisperInbox.open()  when user navigates to whisper-inbox.
   ═══════════════════════════════════════════════════════════════ */

const WhisperInbox = (() => {

  /* ── State ───────────────────────────────────────────────────── */
  let _messages  = [];   // cached inbox items
  let _cursor    = null; // for pagination
  let _loading   = false;
  let _hasMore   = true;

  /* ── API calls ───────────────────────────────────────────────── */
  async function _fetchMessages(cursor = null) {
    const qs  = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const res = await api("GET", `/api/whisper/inbox${qs}`);
    return res; // { messages: [...], nextCursor, hasMore }
  }

  async function _deleteMessage(id) {
    await api("DELETE", `/api/whisper/${id}`);
    _messages = _messages.filter(m => m.id !== id);
  }

  async function _reportMessage(id) {
    await api("POST", `/api/whisper/${id}/report`);
  }

  async function _updateSettings(enabled) {
    await api("PATCH", "/api/whisper/settings", { enabled });
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _esc(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function _relativeTime(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ── Build one message card ──────────────────────────────────── */
  function _buildCard(msg) {
    return `
      <div class="whisper-card" data-id="${msg.id}" style="
        background:var(--card);
        border:1px solid var(--border);
        border-radius:16px;
        padding:16px;
        margin-bottom:12px;
        border-left:3px solid var(--accent);
        transition:opacity 0.2s;
      ">
        <!-- Header row -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
          <div style="
            display:inline-flex;align-items:center;gap:6px;
            background:var(--accent-soft);color:var(--accent);
            font-size:12px;font-weight:700;
            padding:3px 10px;border-radius:30px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Anonymous
          </div>
          <span style="font-size:12px;color:var(--text-muted)">${_relativeTime(msg.created_at)}</span>
        </div>

        <!-- Message text -->
        <div style="
          font-size:15px;
          color:var(--text);
          line-height:1.6;
          margin-bottom:14px;
          white-space:pre-wrap;
          word-break:break-word;
        ">${_esc(msg.message)}</div>

        <!-- Actions -->
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
          <button
            class="btn btn-ghost whisper-reply-btn"
            data-id="${msg.id}"
            style="font-size:13px;padding:7px 14px;border-radius:30px;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Reply &amp; Post
          </button>
          <button
            class="btn btn-ghost whisper-delete-btn"
            data-id="${msg.id}"
            style="font-size:13px;padding:7px 12px;border-radius:30px;color:var(--text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
          <button
            class="btn btn-ghost whisper-report-btn"
            data-id="${msg.id}"
            style="font-size:13px;padding:7px 12px;border-radius:30px;color:var(--text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  /* ── Render empty state ──────────────────────────────────────── */
  function _renderEmpty(list) {
    list.innerHTML = `
      <div style="text-align:center;padding:60px 16px;color:var(--text-muted)">
        <div style="font-size:44px;margin-bottom:12px">💬</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;color:var(--text)">No whispers yet</div>
        <div style="font-size:14px;line-height:1.6">
          Share your link and let people send you anonymous messages.
        </div>
      </div>`;
  }

  /* ── Render skeleton loaders ──────────────────────────────────── */
  function _renderSkeletons(list, count = 3) {
    list.innerHTML = Array.from({ length: count }, () => `
      <div style="
        background:var(--card);border:1px solid var(--border);border-radius:16px;
        padding:16px;margin-bottom:12px;border-left:3px solid var(--border2);">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <div class="skeleton" style="width:90px;height:22px;border-radius:30px"></div>
          <div class="skeleton" style="width:50px;height:16px;border-radius:8px"></div>
        </div>
        <div class="skeleton" style="width:100%;height:14px;border-radius:6px;margin-bottom:8px"></div>
        <div class="skeleton" style="width:75%;height:14px;border-radius:6px;margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <div class="skeleton" style="width:110px;height:32px;border-radius:30px"></div>
          <div class="skeleton" style="width:36px;height:32px;border-radius:30px"></div>
          <div class="skeleton" style="width:36px;height:32px;border-radius:30px"></div>
        </div>
      </div>`).join("");
  }

  /* ── Bind list events (delegation) ──────────────────────────── */
  function _bindListEvents(list) {
    list.addEventListener("click", async e => {
      const replyBtn  = e.target.closest(".whisper-reply-btn");
      const deleteBtn = e.target.closest(".whisper-delete-btn");
      const reportBtn = e.target.closest(".whisper-report-btn");

      if (replyBtn) {
        const id  = parseInt(replyBtn.dataset.id);
        const msg = _messages.find(m => m.id === id);
        if (msg) _openComposer(msg);
        return;
      }

      if (deleteBtn) {
        const id   = parseInt(deleteBtn.dataset.id);
        const card = list.querySelector(`.whisper-card[data-id="${id}"]`);
        if (!confirm("Delete this message? This can't be undone.")) return;
        try {
          card && (card.style.opacity = "0.4");
          await _deleteMessage(id);
          card?.remove();
          showToast("Message deleted.");
          if (_messages.length === 0) _renderEmpty(list);
        } catch (err) {
          card && (card.style.opacity = "1");
          showToast("Failed to delete: " + err.message);
        }
        return;
      }

      if (reportBtn) {
        const id = parseInt(reportBtn.dataset.id);
        try {
          await _reportMessage(id);
          showToast("Reported — thanks for keeping Circle safe. 🛡️");
          reportBtn.disabled = true;
          reportBtn.style.opacity = "0.4";
        } catch (err) {
          showToast("Failed to report: " + err.message);
        }
      }
    });
  }

  /* ── Load more (pagination) ───────────────────────────────────── */
  async function _loadMore(list, loadMoreBtn) {
    if (_loading || !_hasMore) return;
    _loading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading…";

    try {
      const res = await _fetchMessages(_cursor);
      const incoming = res.messages || [];
      _messages.push(...incoming);
      _cursor  = res.nextCursor || null;
      _hasMore = res.hasMore || false;

      incoming.forEach(msg => {
        const tmp = document.createElement("div");
        tmp.innerHTML = _buildCard(msg);
        list.appendChild(tmp.firstElementChild);
      });

      loadMoreBtn.style.display = _hasMore ? "block" : "none";
    } catch (err) {
      showToast("Failed to load more: " + err.message);
    } finally {
      _loading = false;
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Load more";
    }
  }

  /* ── Reply composer (inline modal) ──────────────────────────── */
  function _openComposer(msg) {
    // Remove any existing composer
    document.getElementById("whisper-composer-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "whisper-composer-overlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:900;
      background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
      display:flex;align-items:flex-end;justify-content:center;
      padding:0 0 env(safe-area-inset-bottom,0);
      animation:fadeIn 0.15s ease;
    `;

    overlay.innerHTML = `
      <div style="
        background:var(--card);
        border:1px solid var(--border);
        border-radius:24px 24px 0 0;
        padding:20px 20px 32px;
        width:100%;
        max-width:600px;
        box-shadow:0 -8px 40px rgba(0,0,0,0.3);
        animation:slideUp 0.2s ease;
      ">
        <!-- Handle + close -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:15px;font-weight:800;color:var(--text)">✍️ Reply &amp; Post</div>
          <button id="whisper-composer-close" style="
            background:var(--card-hover,var(--bg));border:none;cursor:pointer;
            width:30px;height:30px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Anon message preview (the card that will be the image) -->
        <div style="
          background:linear-gradient(135deg,#1a1030 0%,#2d1a4a 100%);
          border:1px solid #3b2a6e;
          border-radius:16px;
          padding:16px;
          margin-bottom:14px;
        ">
          <div style="
            font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
            color:#a78bfa;margin-bottom:8px;display:flex;align-items:center;gap:5px">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Whisper on Circle
          </div>
          <div style="font-size:15px;color:#e2d9f3;font-style:italic;line-height:1.6;word-break:break-word">
            "${_esc(msg.message)}"
          </div>
        </div>

        <!-- Reply textarea -->
        <div style="margin-bottom:14px">
          <textarea
            id="whisper-reply-input"
            rows="3"
            maxlength="500"
            placeholder="Your reply… this becomes the post caption"
            style="
              width:100%;
              background:var(--bg);
              border:1.5px solid var(--accent);
              border-radius:14px;
              padding:12px 14px;
              font-size:15px;
              color:var(--text);
              font-family:inherit;
              resize:none;
              outline:none;
              line-height:1.55;
            "
          ></textarea>
          <div style="text-align:right;font-size:12px;color:var(--text-muted);margin-top:4px">
            <span id="whisper-reply-count">500 left</span>
          </div>
        </div>

        <!-- Post button -->
        <button
          id="whisper-post-btn"
          class="btn"
          style="
            width:100%;
            background:var(--accent);
            color:#fff;
            border:none;
            border-radius:40px;
            padding:13px;
            font-size:15px;
            font-weight:700;
            cursor:pointer;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:8px;
          ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Post to Circle feed
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Focus reply textarea
    setTimeout(() => document.getElementById("whisper-reply-input")?.focus(), 80);

    // Char counter
    document.getElementById("whisper-reply-input")
      .addEventListener("input", function () {
        document.getElementById("whisper-reply-count").textContent =
          (500 - this.value.length) + " left";
      });

    // Close on overlay backdrop click
    overlay.addEventListener("click", e => {
      if (e.target === overlay) overlay.remove();
    });
    document.getElementById("whisper-composer-close")
      .addEventListener("click", () => overlay.remove());

    // Post button
    document.getElementById("whisper-post-btn")
      .addEventListener("click", () => _handlePost(msg, overlay));
  }

  /* ── Post handler — calls whisper-composer.js via WhisperComposer ── */
  async function _handlePost(msg, overlay) {
    const replyInput = document.getElementById("whisper-reply-input");
    const postBtn    = document.getElementById("whisper-post-btn");
    const replyText  = replyInput?.value.trim();

    if (!replyText) {
      replyInput.style.borderColor = "var(--rose)";
      replyInput.focus();
      showToast("Add a reply before posting.");
      return;
    }

    postBtn.disabled = true;
    postBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Posting…`;

    try {
      // WhisperComposer handles card image generation + post creation.
      // Falls back to text-only post if composer not loaded.
      if (typeof WhisperComposer !== "undefined") {
        await WhisperComposer.post(msg, replyText);
      } else {
        await api("POST", `/api/whisper/${msg.id}/post`, { replyText });
      }

      overlay.remove();
      showToast("Posted to your Circle feed! 🚀");

      // Mark card as posted in the list
      const card = document.querySelector(`.whisper-card[data-id="${msg.id}"]`);
      if (card) {
        const replyBtn = card.querySelector(".whisper-reply-btn");
        if (replyBtn) {
          replyBtn.textContent = "✓ Posted";
          replyBtn.disabled = true;
          replyBtn.style.opacity = "0.5";
        }
      }
    } catch (err) {
      showToast("Failed to post: " + err.message);
      postBtn.disabled = false;
      postBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Post to Circle feed`;
    }
  }

  /* ── Render the full inbox view ───────────────────────────────── */
  function _render(container, whisperEnabled) {
    // --- FIXED: Build a valid public link for sending whispers ---
    // Assumes a frontend route /whisper/send/:username exists (to be created)
    // If not, you can temporarily disable the banner or use a static URL.
    let publicLink = "#";
    let showBanner = false;
    if (currentUser && currentUser.username) {
      // Use a proper public-facing route (e.g., /whisper/send/username)
      publicLink = `${window.location.origin}/whisper/send/${currentUser.username}`;
      showBanner = true;
    } else if (currentUser && !currentUser.username) {
      console.warn("WhisperInbox: currentUser.username missing – cannot build public link.");
      showBanner = false;
    }

    container.innerHTML = `
      <!-- Page header -->
      <div class="page-header">
        <div>
          <button class="back-btn" onclick="goBack()" id="back-btn-whisper-inbox">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1><em>Whisper Inbox</em></h1>
          <p>Anonymous messages from your audience</p>
        </div>
        <!-- Settings toggle -->
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;color:var(--text-muted);font-weight:600">Accepting</span>
          <div
            id="whisper-enabled-toggle"
            role="switch"
            aria-checked="${whisperEnabled}"
            style="
              width:44px;height:24px;
              background:${whisperEnabled ? "var(--accent)" : "var(--border2)"};
              border-radius:100px;
              position:relative;cursor:pointer;
              transition:background 0.2s;flex-shrink:0;
            ">
            <div style="
              width:20px;height:20px;background:#fff;border-radius:50%;
              position:absolute;top:2px;
              left:${whisperEnabled ? "22px" : "2px"};
              transition:left 0.2s;
              box-shadow:0 1px 3px rgba(0,0,0,0.3);
            "></div>
          </div>
        </div>
      </div>

      ${showBanner ? `
      <!-- Public link banner (now points to a send page, not private inbox) -->
      <div style="
        background:var(--card);
        border:1px solid var(--border);
        border-radius:14px;
        padding:12px 16px;
        margin-bottom:20px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
      ">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">Your Whisper link</div>
          <div style="font-size:13px;font-family:monospace;color:var(--accent);word-break:break-all">${_esc(publicLink)}</div>
        </div>
        <button
          id="whisper-copy-link"
          class="btn btn-ghost"
          style="font-size:13px;padding:8px 16px;border-radius:30px;font-weight:700;white-space:nowrap;flex-shrink:0">
          Copy link
        </button>
      </div>
      ` : `
      <div style="margin-bottom:20px;padding:12px;background:var(--bg-soft);border-radius:14px;color:var(--text-muted);font-size:13px">
        ⚠️ Unable to generate your public whisper link. Please update your username in settings.
      </div>
      `}

      <!-- Message list -->
      <div id="whisper-message-list"></div>

      <!-- Load more -->
      <button
        id="whisper-load-more"
        class="btn btn-ghost"
        style="
          display:none;width:100%;margin-top:4px;
          border-radius:30px;padding:11px;font-size:14px;font-weight:600;">
        Load more
      </button>
    `;

    // Inject skeleton while fetching
    const list = container.querySelector("#whisper-message-list");
    _renderSkeletons(list);

    // Copy link (only if banner exists)
    if (showBanner) {
      container.querySelector("#whisper-copy-link").addEventListener("click", () => {
        navigator.clipboard.writeText(publicLink).catch(() => {});
        showToast("Whisper link copied! 🔗");
      });
    }

    // Enable/disable toggle
    let _enabled = whisperEnabled;
    const toggle = container.querySelector("#whisper-enabled-toggle");
    const dot    = toggle.querySelector("div");
    toggle.addEventListener("click", async () => {
      _enabled = !_enabled;
      toggle.style.background  = _enabled ? "var(--accent)" : "var(--border2)";
      dot.style.left            = _enabled ? "22px" : "2px";
      toggle.setAttribute("aria-checked", _enabled);
      try {
        await _updateSettings(_enabled);
        showToast(_enabled ? "Now accepting whispers 💬" : "Whispers paused.");
      } catch (err) {
        // Revert on error
        _enabled = !_enabled;
        toggle.style.background = _enabled ? "var(--accent)" : "var(--border2)";
        dot.style.left           = _enabled ? "22px" : "2px";
        toggle.setAttribute("aria-checked", _enabled);
        showToast("Failed to update settings: " + err.message);
      }
    });

    // Load more button
    const loadMoreBtn = container.querySelector("#whisper-load-more");
    loadMoreBtn.addEventListener("click", () => _loadMore(list, loadMoreBtn));

    // Bind list click delegation
    _bindListEvents(list);

    // Fetch initial messages
    _fetchMessages().then(res => {
      _messages = res.messages || [];
      _cursor   = res.nextCursor || null;
      _hasMore  = res.hasMore || false;

      list.innerHTML = "";

      if (_messages.length === 0) {
        _renderEmpty(list);
      } else {
        _messages.forEach(msg => {
          const tmp = document.createElement("div");
          tmp.innerHTML = _buildCard(msg);
          list.appendChild(tmp.firstElementChild);
        });
      }

      loadMoreBtn.style.display = _hasMore ? "block" : "none";
    }).catch(err => {
      list.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--rose)">
          <div style="font-size:32px;margin-bottom:10px">⚠️</div>
          <div style="font-size:14px">${_esc(err.message || "Failed to load messages.")}</div>
          <button
            class="btn btn-ghost"
            style="margin-top:14px;border-radius:30px;padding:8px 20px;font-size:13px"
            onclick="WhisperInbox.open()">
            Retry
          </button>
        </div>`;
    });
  }

  /* ── Public: open the inbox view ─────────────────────────────── */
  async function open() {
    if (!currentUser) {
      goTo("login");
      return;
    }

    // Reset pagination state on each open
    _messages = [];
    _cursor   = null;
    _loading  = false;
    _hasMore  = true;

    const container = document.getElementById("view-whisper-inbox");
    if (!container) return;

    goTo("whisper-inbox");

    // Fetch whisper settings (enabled flag) before rendering
    let whisperEnabled = false;
    try {
      const settings = await api("GET", "/api/whisper/settings");
      whisperEnabled  = settings.enabled ?? false;
    } catch (_) {
      // Non-fatal — default to disabled if settings fetch fails
    }

    _render(container, whisperEnabled);
  }

  return { open };
})();