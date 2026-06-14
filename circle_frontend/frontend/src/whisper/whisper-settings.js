/* ═══════════════════════════════════════════════════════════════
   WHISPER SETTINGS  —  Section injected into #view-settings
   ═══════════════════════════════════════════════════════════════
   Does NOT create a new view. Injects a <div class="settings-section">
   into the existing settings page, just above the danger zone,
   matching Circle's exact settings-row / toggle pattern.

   Call  WhisperSettings.init()  inside  populateSettings()
   in main.js — it fetches settings and renders the section once.

   External globals (main.js / config/api.js):
     - API             — base URL string
     - currentUser     — { id, username, ... } | null
     - api(method, path, body?)
     - showToast(msg)
   ═══════════════════════════════════════════════════════════════ */

const WhisperSettings = (() => {

  const SECTION_ID = "whisper-settings-section";

  /* ── API ─────────────────────────────────────────────────────── */
  async function _fetchSettings() {
    return api("GET", "/api/whisper/settings");
    // returns { enabled: bool, link_slug: string }
  }

  async function _patchEnabled(enabled) {
    return api("PATCH", "/api/whisper/settings", { enabled });
  }

  /* ── Build the section HTML ──────────────────────────────────── */
  function _buildSection(settings) {
    const { enabled, link_slug } = settings;
    const publicLink = `${window.location.origin}/@${link_slug}/inbox`;

    return `
      <div class="settings-section" id="${SECTION_ID}">
        <div class="settings-section-title">💬 Whisper</div>

        <!-- Enable / disable row -->
        <div class="settings-row">
          <div class="settings-row-icon purple">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div class="settings-row-body">
            <div class="settings-row-title">Accept anonymous messages</div>
            <div class="settings-row-sub">
              Anyone with your link can send you a message anonymously
            </div>
          </div>
          <div class="settings-row-end">
            <label class="toggle">
              <input
                type="checkbox"
                id="whisper-enabled-checkbox"
                ${enabled ? "checked" : ""}
              />
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </label>
          </div>
        </div>

        <!-- Public link row (visible only when enabled) -->
        <div
          id="whisper-link-row"
          style="display:${enabled ? "block" : "none"};padding:0 16px 16px;">
          <div style="
            background:var(--bg);
            border:1px solid var(--border);
            border-radius:12px;
            padding:12px 14px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            flex-wrap:wrap;
          ">
            <div style="min-width:0">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted,var(--txt3));text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">
                Your Whisper link
              </div>
              <div style="
                font-size:13px;
                font-family:monospace;
                color:var(--accent);
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
              " id="whisper-public-link-text">${_esc(publicLink)}</div>
            </div>
            <button
              id="whisper-copy-link-btn"
              class="btn btn-ghost"
              style="font-size:13px;padding:7px 14px;border-radius:30px;font-weight:700;white-space:nowrap;flex-shrink:0">
              Copy
            </button>
          </div>

          <!-- Quick shortcut to inbox -->
          <button
            id="whisper-open-inbox-btn"
            class="btn btn-ghost"
            style="
              width:100%;
              margin-top:10px;
              border-radius:12px;
              padding:11px;
              font-size:14px;
              font-weight:600;
              display:flex;
              align-items:center;
              justify-content:center;
              gap:8px;
            ">
            <svg width="15" height="15" fill="none" stroke="currentColor"
              stroke-width="2.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 17H2a3 3 0 01-3-3V7a3 3 0 013-3h18a3 3 0 013 3v7a3 3 0 01-3 3z"/>
              <polyline points="22 7 12 13 2 7"/>
            </svg>
            Open Whisper Inbox
          </button>
        </div>

        <!-- Inbox shortcut when disabled (condensed) -->
        <div
          id="whisper-inbox-shortcut-disabled"
          style="display:${enabled ? "none" : "block"};padding:0 16px 16px;">
          <button
            id="whisper-open-inbox-btn-2"
            class="btn btn-ghost"
            style="
              width:100%;
              border-radius:12px;
              padding:11px;
              font-size:14px;
              font-weight:600;
              display:flex;
              align-items:center;
              justify-content:center;
              gap:8px;
              color:var(--text-muted,var(--txt3));
            ">
            <svg width="15" height="15" fill="none" stroke="currentColor"
              stroke-width="2.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 17H2a3 3 0 01-3-3V7a3 3 0 013-3h18a3 3 0 013 3v7a3 3 0 01-3 3z"/>
              <polyline points="22 7 12 13 2 7"/>
            </svg>
            View past messages
          </button>
        </div>

      </div>
    `;
  }

  /* ── Bind events after injection ─────────────────────────────── */
  function _bindEvents(settings) {
    let _enabled = settings.enabled;
    const publicLink = `${window.location.origin}/@${settings.link_slug}/inbox`;

    // Toggle
    const checkbox = document.getElementById("whisper-enabled-checkbox");
    const linkRow  = document.getElementById("whisper-link-row");
    const disabledRow = document.getElementById("whisper-inbox-shortcut-disabled");

    checkbox?.addEventListener("change", async () => {
      const next = checkbox.checked;
      checkbox.disabled = true;

      try {
        await _patchEnabled(next);
        _enabled = next;
        linkRow.style.display     = next ? "block" : "none";
        disabledRow.style.display = next ? "none"  : "block";
        showToast(next ? "Whisper inbox enabled 💬" : "Whisper inbox paused.");
      } catch (err) {
        // Revert
        checkbox.checked = _enabled;
        showToast("Failed to update: " + err.message);
      } finally {
        checkbox.disabled = false;
      }
    });

    // Copy link (both buttons share the same action)
    function _copyLink() {
      navigator.clipboard.writeText(publicLink).catch(() => {});
      showToast("Whisper link copied! 🔗");
    }
    document.getElementById("whisper-copy-link-btn")
      ?.addEventListener("click", _copyLink);

    // Open inbox buttons
    function _openInbox() {
      if (typeof WhisperInbox !== "undefined") {
        WhisperInbox.open();
      } else {
        showToast("Whisper inbox not loaded.");
      }
    }
    document.getElementById("whisper-open-inbox-btn")
      ?.addEventListener("click", _openInbox);
    document.getElementById("whisper-open-inbox-btn-2")
      ?.addEventListener("click", _openInbox);
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _esc(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function _renderSkeleton(target) {
    const section = document.createElement("div");
    section.id = SECTION_ID;
    section.className = "settings-section";
    section.innerHTML = `
      <div class="settings-section-title">💬 Whisper</div>
      <div class="settings-row">
        <div class="skeleton" style="width:36px;height:36px;border-radius:10px;flex-shrink:0"></div>
        <div class="settings-row-body">
          <div class="skeleton" style="width:160px;height:14px;border-radius:6px;margin-bottom:6px"></div>
          <div class="skeleton" style="width:220px;height:12px;border-radius:6px"></div>
        </div>
        <div class="skeleton" style="width:44px;height:24px;border-radius:30px;flex-shrink:0"></div>
      </div>`;
    target.insertAdjacentElement("beforebegin", section);
  }

  /* ── Public: init ─────────────────────────────────────────────── */
  async function init() {
    if (!currentUser) return;

    // Remove any existing section (handles re-entry into settings)
    document.getElementById(SECTION_ID)?.remove();

    // Inject before the danger zone
    const dangerZone = document.querySelector("#view-settings .danger-zone");
    if (!dangerZone) return;

    // Show skeleton while fetching
    _renderSkeleton(dangerZone);

    try {
      const settings = await _fetchSettings();

      // Replace skeleton with real section
      document.getElementById(SECTION_ID)?.remove();
      dangerZone.insertAdjacentHTML("beforebegin", _buildSection(settings));
      _bindEvents(settings);
    } catch (err) {
      // On error just remove skeleton silently — non-fatal
      document.getElementById(SECTION_ID)?.remove();
      console.warn("[WhisperSettings] failed to load:", err.message);
    }
  }

  return { init };
})();