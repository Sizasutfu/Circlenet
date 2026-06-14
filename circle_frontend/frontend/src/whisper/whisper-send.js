

const WhisperSend = (() => {
  /* ── Rate-limit guard (client-side) ────────────────────────────
     Prevents the same browser session spamming one recipient.
     The real limit lives on the backend (IP-based).               */
  const _SEND_KEY  = "whisper_sends"; // localStorage key
  const _MAX_SENDS = 30;               // per recipient per hour
  const _WINDOW_MS = 60 * 60 * 1000; // 1 hour

  function _canSend(username) {
    try {
      const raw   = localStorage.getItem(_SEND_KEY);
      const store = raw ? JSON.parse(raw) : {};
      const now   = Date.now();
      const log   = (store[username] || []).filter(ts => now - ts < _WINDOW_MS);
      if (log.length >= _MAX_SENDS) return false;
      log.push(now);
      store[username] = log;
      localStorage.setItem(_SEND_KEY, JSON.stringify(store));
      return true;
    } catch (_) {
      return true; // storage unavailable — let backend decide
    }
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function _esc(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function _setLoading(btn, yes) {
    btn.disabled = yes;
    btn.innerHTML = yes
      ? `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>`
      : `Send anonymously <span style="font-size:16px">🤫</span>`;
  }

  /* ── API call (no auth token) ────────────────────────────────── */
  async function _sendMessage(username, payload) {
    const res = await fetch(`${API}/api/whisper/send/${encodeURIComponent(username)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to send message.");
    return data;
  }

  /* ── Fetch recipient's public whisper profile ────────────────── */
 async function _fetchProfile(username) {
    const res = await fetch(`${API}/api/whisper/profile/${encodeURIComponent(username)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || "User not found.");
    // If the response has a 'data' property, use it; otherwise assume flat structure
    return json.data || json;
}

  /* ── Render states ───────────────────────────────────────────── */
  function _renderSkeleton(container) {
    container.innerHTML = `
      <div style="padding:48px 0;text-align:center;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 16px"></div>
        <div style="font-size:14px">Loading...</div>
      </div>`;
  }

  function _renderNotFound(container) {
    container.innerHTML = `
      <div style="padding:48px 16px;text-align:center;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">🔍</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">User not found</div>
        <div style="font-size:14px">This whisper link may be invalid or the account was deleted.</div>
      </div>`;
  }

  function _renderDisabled(container, name) {
    container.innerHTML = `
      <div style="padding:48px 16px;text-align:center;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">🔒</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${_esc(name)} isn't accepting messages</div>
        <div style="font-size:14px">They've turned off anonymous messages for now.</div>
      </div>`;
  }

  function _renderSuccess(container, name) {
    container.innerHTML = `
      <div style="padding:48px 16px;text-align:center;">
        <div style="font-size:44px;margin-bottom:12px">🤫</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px;color:var(--text)">Message sent!</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:20px">
          ${_esc(name)} will see it anonymously. Your identity is safe.
        </div>
        <button
          id="whisper-send-another"
          class="btn"
          style="background:var(--accent);color:#fff;border-radius:40px;padding:10px 24px;font-weight:700;font-size:14px;border:none;cursor:pointer">
          Send another
        </button>
      </div>`;
    document.getElementById("whisper-send-another")
      ?.addEventListener("click", () => _renderForm(container, _lastProfile));
  }

  /* ── Main form renderer ──────────────────────────────────────── */
  let _lastProfile = null;

  function _renderForm(container, profile) {
    _lastProfile = profile;

    // Avatar: either an img or initial letter
    const avatarHtml = profile.avatar
      ? `<img
           src="${_esc(profile.avatar)}"
           alt="${_esc((profile.name || profile.username).charAt(0))}"
           style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"
           onerror="this.parentElement.style.background='var(--accent)';this.parentElement.innerHTML='${_esc((profile.name || profile.username).charAt(0).toUpperCase())}'"
         />`
      : _esc((profile.name || profile.username).charAt(0).toUpperCase());

    container.innerHTML = `
      <!-- Recipient header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="
          width:44px;height:44px;border-radius:50%;flex-shrink:0;
          background:var(--accent);color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-size:18px;font-weight:800;overflow:hidden">
          ${avatarHtml}
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px">Send an anonymous message to</div>
          <div style="font-size:16px;font-weight:800;color:var(--text)">
            ${_esc(profile.name || profile.username)}
            <span style="font-weight:500;color:var(--text-muted);font-size:14px">@${_esc(profile.username)}</span>
          </div>
        </div>
      </div>

      <!-- Message textarea -->
      <div style="margin-bottom:16px">
        <textarea
          id="whisper-message-input"
          rows="5"
          maxlength="500"
          placeholder="Write your anonymous message… be kind 💜"
          style="
            width:100%;
            background:var(--bg);
            border:1.5px solid var(--border);
            border-radius:14px;
            padding:14px;
            font-size:15px;
            color:var(--text);
            font-family:inherit;
            resize:none;
            outline:none;
            transition:border-color 0.15s;
            line-height:1.55;
          "
          oninput="
            document.getElementById('whisper-char-count').textContent = (500 - this.value.length) + ' left';
            this.style.borderColor = this.value.length > 0 ? 'var(--accent)' : 'var(--border)';
          "
        ></textarea>
        <div style="text-align:right;font-size:12px;color:var(--text-muted);margin-top:4px">
          <span id="whisper-char-count">500 left</span>
        </div>
      </div>

      <!-- Send button -->
      <button
        id="whisper-send-btn"
        class="btn"
        style="
          width:100%;
          background:var(--accent);
          color:#fff;
          border:none;
          border-radius:40px;
          padding:13px 20px;
          font-size:15px;
          font-weight:700;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          transition:background 0.2s, transform 0.15s;
        "
        onmouseover="this.style.background='var(--accent-2,#6d28d9)'"
        onmouseout="this.style.background='var(--accent)'"
      >
        Send anonymously <span style="font-size:16px">🤫</span>
      </button>

      <!-- Privacy note -->
      <div style="
        margin-top:14px;
        text-align:center;
        font-size:12px;
        color:var(--text-muted);
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        Your identity is completely hidden from ${_esc(profile.name || profile.username)}
      </div>
    `;

    document.getElementById("whisper-send-btn")
      .addEventListener("click", () => _handleSend(container, profile));

    // Allow Ctrl/Cmd+Enter to submit
    document.getElementById("whisper-message-input")
      .addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          _handleSend(container, profile);
        }
      });
  }

  /* ── Send handler ────────────────────────────────────────────── */
  async function _handleSend(container, profile) {
    const input   = document.getElementById("whisper-message-input");
    const sendBtn = document.getElementById("whisper-send-btn");
    const message = input?.value.trim();

    if (!message) {
      input.style.borderColor = "var(--rose)";
      input.focus();
      showToast("Message can't be empty.");
      return;
    }
    if (message.length > 500) {
      showToast("Message is too long (max 500 characters).");
      return;
    }
    if (!_canSend(profile.username)) {
      showToast("You've sent too many messages recently. Try again in an hour.");
      return;
    }

    _setLoading(sendBtn, true);

    try {
      await _sendMessage(profile.username, { message });
      _renderSuccess(container, profile.name || profile.username);
    } catch (err) {
      showToast(err.message || "Failed to send. Please try again.");
      _setLoading(sendBtn, false);
      input.style.borderColor = "var(--rose)";
    }
  }

  /* ── Public init ─────────────────────────────────────────────── */
  async function init(username) {
    // Expect a <div id="view-whisper-send"> in the DOM, or fall back to app root
    const container =
      document.getElementById("view-whisper-send") ||
      document.getElementById("app");

    if (!container) return;

    // Header (Circle branding + back link)
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "max-width:520px;margin:0 auto;padding:24px 16px 48px";
    wrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
        <a href="/" style="
          display:flex;align-items:center;gap:6px;
          color:var(--text-muted);text-decoration:none;font-size:13px;font-weight:600;
          background:var(--card);border:1px solid var(--border);
          padding:6px 12px;border-radius:30px;transition:background 0.15s">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Circle
        </a>
        <div style="
          font-size:20px;font-weight:800;
          background:linear-gradient(135deg,var(--accent) 0%,var(--accent-2,#a78bfa) 100%);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          background-clip:text;">
          💬 Whisper
        </div>
      </div>
      <div
        id="whisper-send-card"
        style="
          background:var(--card);
          border:1px solid var(--border);
          border-radius:20px;
          padding:24px;
          box-shadow:var(--shadow);
        ">
      </div>
    `;

    container.innerHTML = "";
    container.appendChild(wrapper);

    const card = wrapper.querySelector("#whisper-send-card");
    _renderSkeleton(card);

    try {
      const profile = await _fetchProfile(username);
      if (!profile.whisperEnabled) {
        _renderDisabled(card, profile.name || profile.username);
      } else {
        _renderForm(card, profile);
      }
    } catch (err) {
      _renderNotFound(card);
    }
  }

  return { init };
})();