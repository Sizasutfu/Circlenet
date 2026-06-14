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

         External globals required (from main.js):
           - api(method, path, body?)   — authenticated fetch wrapper
           - currentUser                — { id, ... } | null
         ═══════════════════════════════════════════════════════════════ */
const E2E = (() => {
  const STORE_KEY = "circle_e2e_keypair"; // localStorage key
  let _myKeyPair = null; // CryptoKeyPair (this device)
  let _sharedKeys = {}; // { userId: CryptoKey }

  // ── Helpers ─────────────────────────────────────────────
  function _b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function _unb64(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  // ── Generate or load this device's ECDH key-pair ────────
  async function ensureMyKeys() {
    if (_myKeyPair) return _myKeyPair;
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      try {
        const { pub, priv } = JSON.parse(stored);
        const publicKey = await crypto.subtle.importKey(
          "spki",
          _unb64(pub),
          { name: "ECDH", namedCurve: "P-256" },
          true,
          [],
        );
        const privateKey = await crypto.subtle.importKey(
          "pkcs8",
          _unb64(priv),
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveKey"],
        );
        _myKeyPair = { publicKey, privateKey };
        return _myKeyPair;
      } catch (e) {
        /* corrupt — regenerate */
      }
    }
    _myKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"],
    );
    // Persist to localStorage
    const pub = _b64(
      await crypto.subtle.exportKey("spki", _myKeyPair.publicKey),
    );
    const priv = _b64(
      await crypto.subtle.exportKey("pkcs8", _myKeyPair.privateKey),
    );
    localStorage.setItem(STORE_KEY, JSON.stringify({ pub, priv }));
    return _myKeyPair;
  }

  // ── Upload our public key to server ─────────────────────
  // PUT /api/users/:id/publickey  { publicKey: "<b64 spki>" }
  async function publishMyPublicKey() {
    if (!currentUser) return;
    try {
      const kp = await ensureMyKeys();
      const pub = _b64(await crypto.subtle.exportKey("spki", kp.publicKey));
      await api("PUT", `/api/users/${currentUser.id}/publickey`, {
        publicKey: pub,
      });
    } catch (e) {
      /* server may not support yet — silently ignore */
    }
  }

  // ── Fetch a peer's public key from server ───────────────
  // GET /api/users/:id/publickey  → { publicKey: "<b64 spki>" }
  async function _fetchPeerKey(userId) {
    try {
      const res = await api("GET", `/api/users/${userId}/publickey`);
      const b64 = res.data?.publicKey || res.publicKey;
      if (!b64) return null;
      return await crypto.subtle.importKey(
        "spki",
        _unb64(b64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        [],
      );
    } catch (e) {
      return null;
    }
  }

  // ── Derive (or return cached) shared AES-GCM key ────────
  async function _sharedKey(peerUserId) {
    if (_sharedKeys[peerUserId]) return _sharedKeys[peerUserId];
    const kp = await ensureMyKeys();
    const peerPub = await _fetchPeerKey(peerUserId);
    if (!peerPub) return null;
    const key = await crypto.subtle.deriveKey(
      { name: "ECDH", public: peerPub },
      kp.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    _sharedKeys[peerUserId] = key;
    return key;
  }

  // ── Encrypt plaintext → "e2e:<b64(iv+ct)>" ──────────────
  async function encrypt(peerUserId, plaintext) {
    const key = await _sharedKey(peerUserId);
    if (!key) return plaintext; // fall back to plaintext
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    const blob = new Uint8Array(12 + ct.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(ct), 12);
    return "e2e:" + _b64(blob.buffer);
  }

  // ── Decrypt "e2e:…" → plaintext ─────────────────────────
  async function decrypt(peerUserId, body) {
    if (!body || !body.startsWith("e2e:")) return body;
    try {
      const key = await _sharedKey(peerUserId);
      if (!key) return "[🔒 Encrypted — open conversation to decrypt]";
      const blob = _unb64(body.slice(4));
      const iv = blob.slice(0, 12);
      const ct = blob.slice(12);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch (e) {
      return "[🔒 Encrypted message]";
    }
  }

  // ── Clear cached shared keys (e.g. on logout) ───────────
  function clearCache() {
    _sharedKeys = {};
    _myKeyPair = null;
  }

  // ── Check if E2E is active for a peer ────────────────────
  async function isEnabled(peerUserId) {
    const key = await _sharedKey(peerUserId);
    return !!key;
  }

  return {
    ensureMyKeys,
    publishMyPublicKey,
    encrypt,
    decrypt,
    clearCache,
    isEnabled,
  };
})();

/* ═══════════════════════════════════════════════════════════════
         DIRECT MESSAGES  —  localStorage-backed private messaging
         ═══════════════════════════════════════════════════════════════
         External globals required (from main.js):
           - api(method, path, body?)   — authenticated fetch wrapper
           - currentUser                — { id, ... } | null
           - goTo(view)                 — client-side router
           - showToast(msg)             — toast notification helper
           - escHtml(str)               — HTML-escape utility
           - stringToColor(str)         — avatar background colour
           - CircleWS                   — WebSocket client (optional)
           - E2E                        — encryption module (above)
         ═══════════════════════════════════════════════════════════════ */
const DM = (() => {
  // State
  let _inbox = []; // rows from GET /api/dm/inbox
  let _activeConvId = null;
  let _activeOther = null;
  let _messages = [];
  let _inboxFilter = "";
  let _polling = null;
  let _sending = false;

  // Pagination state
  let _cursor = null; // id of the oldest loaded message (for load-more)
  let _hasMore = false; // whether older messages exist on the server
  let _latestId = null; // id of the newest loaded message (for polling)
  let _loadingMore = false; // guard against concurrent load-more calls

  // Presence & heartbeat state
  let _heartbeatTimer = null; // interval for POST /api/dm/heartbeat
  let _presenceTimer = null; // interval for GET .../presence
  let _peerOnline = false; // last known peer status

  // Typing indicator state
  let _typingTimeout = null;   // debounce timer for outgoing typing events
  let _isTypingOut   = false;  // are we currently flagged as typing to the server

  // ── Time helpers ────────────────────────────────────────
  function _fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function _fmtDate(ts) {
    const d = new Date(ts),
      now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function _fmtPreviewTime(ts) {
    if (!ts) return "";
    const d = new Date(ts),
      now = new Date();
    return d.toDateString() === now.toDateString()
      ? _fmtTime(ts)
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // ── Load inbox from backend ─────────────────────────────
  // GET /api/dm/inbox
  let _prevInboxSnapshot = {}; // convId -> last_message_at, to detect new messages
  async function _loadInbox() {
    if (!currentUser) return;
    try {
      const res = await api("GET", "/api/dm/inbox");
      const newInbox = Array.isArray(res.data) ? res.data : [];

      // Detect new incoming messages and update badge + play tone
      if (Object.keys(_prevInboxSnapshot).length > 0) {
        let newCount = 0;
        let toneTriggered = false;
        for (const conv of newInbox) {
          const prev = _prevInboxSnapshot[conv.id];
          const isActiveConv = conv.id === _activeConvId;
          const isFromOther = conv.last_sender_id !== currentUser.id;
          const isNewer =
            !prev || conv.last_message_at !== prev.last_message_at;
          if (!isActiveConv && isFromOther && isNewer && conv.last_message_at) {
            newCount++;
            if (!toneTriggered) {
              _msgTone.play();
              toneTriggered = true;
            }
          }
        }
        if (newCount > 0) _refreshBadge(newCount);
      }

      // Update snapshot
      _prevInboxSnapshot = {};
      for (const conv of newInbox) {
        _prevInboxSnapshot[conv.id] = { last_message_at: conv.last_message_at };
      }

      _inbox = newInbox;
      renderInbox();
    } catch (e) {
      _inbox = [];
    }
  }

  // ── Message tone ────────────────────────────────────────
  const _msgTone = (function () {
    const audio = new Audio("message tone.wav");
    return {
      play() {
        try {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } catch (_) {}
      },
    };
  })();

  // ── Polling ─────────────────────────────────────────────
  function _startPolling() {
    _stopPolling();
    _polling = setInterval(async () => {
      if (!currentUser) return;
      await _loadInbox();
      if (_activeConvId) {
        await _pollNewMessages(_activeConvId);
        await _fetchPresence(_activeConvId); // piggyback on 4s cycle for responsive status
      }
    }, 4000);
  }
  function _stopPolling() {
    if (_polling) {
      clearInterval(_polling);
      _polling = null;
    }
  }

  // ── Heartbeat — keep current user's presence alive ───────
  function _startHeartbeat() {
    _stopHeartbeat();
    // Fire immediately, then every 30 s
    _sendHeartbeat();
    _heartbeatTimer = setInterval(_sendHeartbeat, 30_000);
  }
  function _stopHeartbeat() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
  }
  async function _sendHeartbeat() {
    if (!currentUser) return;
    try {
      await api("POST", "/api/dm/heartbeat");
    } catch (_) {}
  }

  // ── Presence polling — update peer status in header ──────
  function _startPresencePolling(convId) {
    _stopPresencePolling();
    _fetchPresence(convId); // immediate
    _presenceTimer = setInterval(() => _fetchPresence(convId), 30_000);
  }
  function _stopPresencePolling() {
    if (_presenceTimer) {
      clearInterval(_presenceTimer);
      _presenceTimer = null;
    }
  }
  async function _fetchPresence(convId) {
    if (!currentUser || !convId) return;
    try {
      const res = await api("GET", `/api/dm/conversations/${convId}/presence`);
      const { online, last_seen_at } = res.data;
      _peerOnline = online;
      _updateStatusEl(online, last_seen_at);
    } catch (_) {}
  }
  function _updateStatusEl(online, lastSeenAt) {
    const el = document.getElementById("dm-chat-status");
    if (!el) return;
    el.style.display = "flex";
    if (online) {
      el.textContent = "Active now";
      el.className = "dm-chat-head-status online";
    } else if (lastSeenAt) {
      const diff = Date.now() - new Date(lastSeenAt).getTime();
      const mins = Math.floor(diff / 60_000);
      const hrs = Math.floor(diff / 3_600_000);
      const days = Math.floor(diff / 86_400_000);
      let label;
      if (mins < 1) label = "Active just now";
      else if (mins < 60) label = `Active ${mins}m ago`;
      else if (hrs < 24) label = `Active ${hrs}h ago`;
      else label = `Active ${days}d ago`;
      el.textContent = label;
      el.className = "dm-chat-head-status";
    } else {
      el.textContent = "Offline";
      el.className = "dm-chat-head-status";
    }
  }

  // ── Render inbox list ───────────────────────────────────
  function renderInbox() {
    const list = document.getElementById("dm-conv-list");
    if (!currentUser) {
      list.innerHTML =
        '<div class="dm-conv-empty"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="36" height="36"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>Log in to use messages</p></div>';
      return;
    }
    const q = _inboxFilter.toLowerCase();
    const convs = _inbox.filter(
      (c) => !q || (c.other_name || "").toLowerCase().includes(q),
    );
    if (!convs.length) {
      list.innerHTML =
        '<div class="dm-conv-empty"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="36" height="36"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>No conversations yet.<br/>Start one!</p></div>';
      return;
    }

    // Render synchronously first; then async-decrypt e2e previews
    const renderConv = (conv, plainPreview) => {
      const unread = conv.unread_count || 0;
      const preview =
        plainPreview !== undefined
          ? plainPreview
          : conv.last_message
            ? (conv.last_sender_id === currentUser.id ? "You: " : "") +
              conv.last_message
            : "No messages yet";
      const timeStr = _fmtPreviewTime(conv.last_message_at);
      const initial = (conv.other_name || "?").charAt(0).toUpperCase();
      const color = stringToColor(conv.other_name || "");
      const avHtml = conv.other_picture
        ? `<div class="av sm" style="background:transparent;overflow:hidden;flex-shrink:0"><img src="${conv.other_picture}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${initial}"/></div>`
        : `<div class="av sm" style="background:${color};flex-shrink:0">${initial}</div>`;
      return `<div class="dm-conv-item${unread ? " unread" : ""}${conv.id === _activeConvId ? " active" : ""}" id="dm-conv-${conv.id}" onclick="DM.openConv(${conv.id})">
              ${avHtml}
              <div class="dm-conv-info">
                <div class="dm-conv-name">${escHtml(conv.other_name || "")}</div>
                <div class="dm-conv-preview">${escHtml((preview || "").slice(0, 60))}</div>
              </div>
              <div class="dm-conv-meta">
                ${timeStr ? `<div class="dm-conv-time">${timeStr}</div>` : ""}
                ${unread ? `<div class="dm-unread-dot"></div>` : ""}
              </div>
            </div>`;
    };

    list.innerHTML = convs.map((conv) => renderConv(conv)).join("");

    // Async: decrypt e2e last_message previews
    convs.forEach(async (conv) => {
      if (
        conv.last_message &&
        conv.last_message.startsWith("e2e:") &&
        conv.other_id
      ) {
        const plain = await E2E.decrypt(conv.other_id, conv.last_message);
        const sender = conv.last_sender_id === currentUser.id ? "You: " : "";
        const el = document.getElementById(`dm-conv-${conv.id}`);
        if (el) {
          const previewEl = el.querySelector(".dm-conv-preview");
          if (previewEl)
            previewEl.textContent = ("🔒 " + sender + plain).slice(0, 60);
        }
      }
    });

    _refreshBadge();
  }

  // ── Open a conversation ─────────────────────────────────
  async function openConv(cid) {
    if (!currentUser) {
      goTo("login");
      return;
    }
    _activeConvId = cid;
    const row = _inbox.find((c) => c.id == cid);
    _activeOther = row
      ? { name: row.other_name, picture: row.other_picture, id: row.other_id }
      : { name: "…", picture: null, id: null };

    document.getElementById("dm-inbox").classList.add("hidden-mobile");
    document.getElementById("dm-chat").classList.add("visible-mobile");

    const avEl = document.getElementById("dm-chat-av");
    if (_activeOther.picture) {
      avEl.style.background = "transparent";
      avEl.innerHTML = `<img src="${_activeOther.picture}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${_activeOther.name.charAt(0)}"/>`;
    } else {
      avEl.innerHTML = _activeOther.name.charAt(0).toUpperCase();
      avEl.style.background = stringToColor(_activeOther.name);
    }
    document.getElementById("dm-chat-name").textContent = _activeOther.name;
    // Reset status while we load presence
    const statusEl = document.getElementById("dm-chat-status");
    if (statusEl) {
      statusEl.style.display = "none";
      statusEl.textContent = "";
    }
    document.getElementById("dm-chat-empty").style.display = "none";
    document.getElementById("dm-chat-active").style.display = "flex";
    document.getElementById("dm-messages").innerHTML =
      `<div style="text-align:center;padding:40px 16px;color:var(--txt3);font-size:13.5px">Loading…</div>`;

    // Show/update E2E badge in header
    let e2eBadge = document.getElementById("dm-e2e-badge");
    if (!e2eBadge) {
      e2eBadge = document.createElement("span");
      e2eBadge.id = "dm-e2e-badge";
      e2eBadge.style.cssText =
        "display:none;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--green);background:var(--green-bg);border:1px solid var(--green);border-radius:20px;padding:2px 9px;cursor:default;";
      e2eBadge.title = "Messages in this conversation are end-to-end encrypted";
      e2eBadge.innerHTML = "🔒 End-to-end encrypted";
      const nameEl = document.getElementById("dm-chat-name");
      if (nameEl && nameEl.parentNode) nameEl.parentNode.appendChild(e2eBadge);
    }

    // Check if E2E is available for this peer
    if (_activeOther.id) {
      E2E.isEnabled(_activeOther.id).then((enabled) => {
        e2eBadge.style.display = enabled ? "inline-flex" : "none";
      });
    }

    // Reset pagination state for the new conversation
    _messages = [];
    _cursor = null;
    _hasMore = false;
    _latestId = null;
    _loadingMore = false;

    await _fetchMessages(cid, true);
    _startPolling();
    _startHeartbeat();   // keep current user's presence alive
    _fetchPresence(cid); // immediate fetch on open
    // Tell WebSocket server we are viewing this conversation
    if (typeof CircleWS !== "undefined") CircleWS.joinConversation(cid);
  }

  // ── Fetch messages (initial load or conversation switch) ──
  // GET /api/dm/conversations/:id/messages?limit=10
  async function _fetchMessages(cid, markRead) {
    try {
      const res = await api(
        "GET",
        `/api/dm/conversations/${cid}/messages?limit=10`,
      );
      const { messages: msgs, hasMore } = res.data;

      // Determine peer user id for decryption
      const otherUserId = _inbox.find((c) => c.id == cid)?.other_id;

      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m._plain) return m;
          if (m.body && m.body.startsWith("e2e:") && otherUserId) {
            return { ...m, _plain: await E2E.decrypt(otherUserId, m.body) };
          }
          return { ...m, _plain: m.body };
        }),
      );

      _messages = decrypted;
      _hasMore = hasMore;
      _cursor = decrypted.length ? decrypted[0].id : null;
      _latestId = decrypted.length ? decrypted[decrypted.length - 1].id : null;

      _renderMessages(decrypted);

      if (markRead) {
        const row = _inbox.find((c) => c.id == cid);
        if (row) row.unread_count = 0;
        renderInbox();
      }
    } catch (e) {
      if (markRead)
        document.getElementById("dm-messages").innerHTML =
          `<div style="text-align:center;padding:40px 16px;color:var(--rose);font-size:13.5px">Failed to load messages.</div>`;
    }
  }

  // ── Load earlier messages (prepend) ──────────────────────
  // GET /api/dm/conversations/:id/messages?limit=10&before_id=<cursor>
  async function _loadMore() {
    if (!_activeConvId || !_hasMore || _loadingMore || !_cursor) return;
    _loadingMore = true;

    const btn = document.getElementById("dm-load-more-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Loading…";
    }

    try {
      const res = await api(
        "GET",
        `/api/dm/conversations/${_activeConvId}/messages?limit=10&before_id=${_cursor}`,
      );
      const { messages: msgs, hasMore } = res.data;

      const otherUserId = _inbox.find((c) => c.id == _activeConvId)?.other_id;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m._plain) return m;
          if (m.body && m.body.startsWith("e2e:") && otherUserId) {
            return { ...m, _plain: await E2E.decrypt(otherUserId, m.body) };
          }
          return { ...m, _plain: m.body };
        }),
      );

      // Prepend older messages and update cursor
      _messages = [...decrypted, ..._messages];
      _hasMore = hasMore;
      _cursor = decrypted.length ? decrypted[0].id : _cursor;

      // Preserve scroll position after prepend
      const el = document.getElementById("dm-messages");
      const prevH = el.scrollHeight;
      _renderMessages(_messages, false);
      el.scrollTop += el.scrollHeight - prevH;
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "↑ Load earlier messages";
      }
    } finally {
      _loadingMore = false;
    }
  }

  // ── Poll for new messages only (after _latestId) ─────────
  // GET /api/dm/conversations/:id/messages/new?after_id=<latestId>
  async function _pollNewMessages(cid) {
    if (!_latestId) {
      // No messages loaded yet — do a full fetch instead
      await _fetchMessages(cid, false);
      return;
    }
    try {
      const res = await api(
        "GET",
        `/api/dm/conversations/${cid}/messages/new?after_id=${_latestId}`,
      );
      const msgs = Array.isArray(res.data) ? res.data : [];
      if (!msgs.length) {
        // No new messages — check if peer read ours
        await _patchReadTicks();
        return;
      }

      const otherUserId = _inbox.find((c) => c.id == cid)?.other_id;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m._plain) return m;
          if (m.body && m.body.startsWith("e2e:") && otherUserId) {
            return { ...m, _plain: await E2E.decrypt(otherUserId, m.body) };
          }
          return { ...m, _plain: m.body };
        }),
      );

      // Play tone for new incoming messages
      const hasIncoming = decrypted.some((m) => m.sender_id !== currentUser.id);
      if (hasIncoming) _msgTone.play();

      _messages = [..._messages, ...decrypted];
      _latestId = decrypted[decrypted.length - 1].id;
      _renderMessages(_messages);
      await _patchReadTicks();
    } catch (_) {}
  }

  // ── Patch "Seen" label without a full re-render ────────────
  // Called every poll cycle. Asks the server which of our sent
  // messages have actually been read — no guessing.
  async function _patchReadTicks() {
    // Collect IDs of our sent messages that are not yet marked read in local state
    const unreadSentIds = _messages
      .filter(
        (m) =>
          m.sender_id === currentUser.id &&
          !m.is_read &&
          !String(m.id).startsWith("tmp_"),
      )
      .map((m) => m.id);

    if (!unreadSentIds.length) return;

    try {
      const res = await api("POST", "/api/dm/read-status", {
        ids: unreadSentIds,
      });
      const readIds = new Set(res.data?.readIds || []);
      if (!readIds.size) return;

      // Update local state
      _messages = _messages.map((m) =>
        readIds.has(m.id) ? { ...m, is_read: 1 } : m,
      );

      // Find the last sent message id (for placing the single "Seen" label)
      let lastSentId = null;
      for (let i = _messages.length - 1; i >= 0; i--) {
        if (
          _messages[i].sender_id === currentUser.id &&
          !String(_messages[i].id).startsWith("tmp_")
        ) {
          lastSentId = _messages[i].id;
          break;
        }
      }

      // Remove stale Seen labels
      document.querySelectorAll(".dm-seen-label").forEach((el) => el.remove());

      // Only show "Seen" if the last sent message is read
      if (!lastSentId) return;
      const lastMsg = _messages.find((m) => m.id === lastSentId);
      if (!lastMsg?.is_read) return;

      const msgEl = document.querySelector(
        `.dm-msg[data-msg-id="${lastSentId}"]`,
      );
      if (!msgEl) return;
      const seen = document.createElement("div");
      seen.className = "dm-seen-label";
      seen.textContent = "Seen";
      msgEl.appendChild(seen);
    } catch (_) {}
  }

  // ── Render message bubbles ──────────────────────────────
  // Backend fields: sender_id, body, created_at
  // scrollToBottom=true on initial load; false when prepending older messages.
 function _renderMessages(msgs, scrollToBottom = true) {
  const el = document.getElementById("dm-messages");
  if (!msgs.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 16px;color:var(--txt3);font-size:13.5px">Send a message to start the conversation ✨</div>`;
    return;
  }
  let lastDate = "";
  let lastSentId = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (
      msgs[i].sender_id === currentUser.id &&
      !String(msgs[i].id).startsWith("tmp_")
    ) {
      lastSentId = msgs[i].id;
      break;
    }
  }

  const bubbles = msgs
    .map((msg) => {
      const mine    = msg.sender_id === currentUser.id;
      const dateStr = _fmtDate(msg.created_at);
      let divider   = "";
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        divider  = `<div class="dm-date-divider">${dateStr}</div>`;
      }

      const displayText   = msg._plain !== undefined ? msg._plain : msg.body;
      const isE2E         = msg.body && msg.body.startsWith("e2e:");
      const isTmp         = String(msg.id).startsWith("tmp_");
      const withinWindow  = (Date.now() - new Date(msg.created_at)) < 24 * 60 * 60 * 1000;
      const editedLabel   = msg.edited_at ? `<span class="dm-edited-label">edited</span>` : "";

      let seenLabel = "";
      if (mine && !isTmp && msg.id === lastSentId && !!msg.is_read) {
        seenLabel = `<div class="dm-seen-label">Seen</div>`;
      }

      const menuHtml = mine && withinWindow && !isTmp ? `
        <div class="dm-msg-menu">
          <button class="dm-msg-menu-btn" onclick="DM._openMsgMenu(event, ${msg.id})">⋯</button>
          <div class="dm-msg-menu-dropdown" id="dm-msg-menu-${msg.id}">
            <button onclick="DM._startEdit(${msg.id})">Edit</button>
            <button onclick="DM._deleteMsg(${msg.id})">Delete</button>
          </div>
        </div>` : "";

      return `${divider}<div class="dm-msg ${mine ? "mine" : "theirs"}" data-msg-id="${msg.id}">
        <div class="dm-bubble-wrap">
          ${menuHtml}
          <div class="dm-bubble">
            <span class="dm-bubble-text">${escHtml(displayText || "").replace(/\n/g, "<br>")}</span>
            ${editedLabel}
            <span class="dm-bubble-time">${_fmtTime(msg.created_at)}${isE2E ? ' <span title="End-to-end encrypted" style="opacity:0.7">🔒</span>' : ""}</span>
          </div>
        </div>${seenLabel}
      </div>`;
    })
    .join("");

  const loadMoreBtn = _hasMore
    ? `<button id="dm-load-more-btn" onclick="DM.loadMore()" style="
          display:block;margin:12px auto 6px;padding:7px 18px;
          background:var(--accent-bg);color:var(--accent);
          border:1px solid var(--accent);border-radius:20px;
          font-size:12.5px;font-weight:600;cursor:pointer;
          transition:background var(--tr),opacity var(--tr);"
          onmouseover="this.style.background='var(--accent)';this.style.color='#fff';"
          onmouseout="this.style.background='var(--accent-bg)';this.style.color='var(--accent)';">
          ↑ Load earlier messages
        </button>`
    : "";

  el.innerHTML = loadMoreBtn + bubbles;
  if (scrollToBottom) el.scrollTop = el.scrollHeight;
}

  const _recentlySentIds = new Set();

// ── Send a message ──────────────────────────────────────
// POST /api/dm/conversations/:id/messages  { body }
async function sendMessage() {
  if (!currentUser || !_activeConvId || _sending) return;
  const input = document.getElementById("dm-compose-input");
  const text = input.value.trim();
  if (!text) return;
  _sending = true;
  _emitTypingStop();

  const tempId = "tmp_" + Date.now();
  const tempMsg = {
    id: tempId,
    sender_id: currentUser.id,
    body: text,
    created_at: new Date().toISOString(),
    _plain: text,
  };
  _messages = [..._messages, tempMsg];
  _renderMessages(_messages);
  input.value = "";
  input.style.height = "";

  try {
    const otherUserId = _inbox.find((c) => c.id == _activeConvId)?.other_id;
    const wireBody = otherUserId ? await E2E.encrypt(otherUserId, text) : text;

    const res = await api(
      "POST",
      `/api/dm/conversations/${_activeConvId}/messages`,
      { body: wireBody },
    );
    const saved = res.data || res;
    _messages = _messages.filter((m) => m.id !== tempId);
    if (saved && saved.id) {
      saved._plain = text;
      _messages.push(saved);
      _latestId = saved.id;
      _recentlySentIds.add(saved.id); // ← skip WS echo
      setTimeout(() => _recentlySentIds.delete(saved.id), 5000);
    }
    _renderMessages(_messages);
    await _loadInbox();
  } catch (e) {
    showToast("Failed to send: " + e.message);
    _messages = _messages.filter((m) => m.id !== tempId);
    _renderMessages(_messages);
  } finally {
    _sending = false;
  }
}

  // ── Badge ───────────────────────────────────────────────
  // Local unread counter — only cleared when user opens the messages view
  let _localUnread = 0;

  function _refreshBadge(delta) {
    if (delta) _localUnread = Math.max(0, _localUnread + delta);
    const count = _localUnread;
    const badge = document.getElementById("snav-dm-badge");
    if (badge) {
      badge.textContent = count > 9 ? "9+" : count;
      badge.classList.toggle("show", count > 0);
    }
    const mbadge = document.getElementById("mnav-dm-badge");
    if (mbadge) {
      mbadge.textContent = count > 9 ? "9+" : count;
      mbadge.classList.toggle("show", count > 0);
    }
    const tbadge = document.getElementById("topbar-dm-badge");
    if (tbadge) {
      tbadge.textContent = count > 9 ? "9+" : count;
      tbadge.classList.toggle("show", count > 0);
    }
  }

  function clearDMBadge() {
    _localUnread = 0;
    _refreshBadge();
  }

  function filterInbox() {
    _inboxFilter = document.getElementById("dm-inbox-search").value;
    renderInbox();
  }
  function updateDMBadge() {
    _refreshBadge();
  }

  // ── Start conversation from profile / picker ────────────
  // POST /api/dm/conversations  { recipientId }
  async function startConvWithUser(user) {
    if (!currentUser) {
      goTo("login");
      return;
    }
    try {
      const res = await api("POST", "/api/dm/conversations", {
        recipientId: user.id,
      });
      const conv = res.data || res;
      if (!conv || !conv.id) throw new Error("Invalid response.");
      if (!_inbox.find((c) => c.id === conv.id)) {
        _inbox.unshift({
          id: conv.id,
          other_id: user.id,
          other_name: user.name,
          other_picture: user.picture || null,
          last_message: null,
          last_sender_id: null,
          last_message_at: null,
          unread_count: 0,
          created_at: conv.created_at || new Date().toISOString(),
        });
      }
      goTo("messages");
      setTimeout(() => openConv(conv.id), 60);
    } catch (e) {
      showToast("Could not open conversation: " + e.message);
    }
  }

  // ── Typing indicator helpers ─────────────────────────────

  // Called by wsClient when the OTHER user's typing state changes.
  function _setTyping(isTyping) {
    const el = document.getElementById("dm-typing-indicator");
    if (el) el.style.display = isTyping ? "flex" : "none";
  }

  // Emit our own typing state to the server (debounced).
  function _emitTypingStart() {
    if (!_activeConvId || typeof CircleWS === "undefined" || !CircleWS.isAlive()) return;
    if (!_isTypingOut) {
      _isTypingOut = true;
      CircleWS.sendTyping(_activeConvId, true);
    }
    clearTimeout(_typingTimeout);
    _typingTimeout = setTimeout(_emitTypingStop, 2000);
  }

  function _emitTypingStop() {
    clearTimeout(_typingTimeout);
    _typingTimeout = null;
    if (_isTypingOut) {
      _isTypingOut = false;
      if (_activeConvId && typeof CircleWS !== "undefined" && CircleWS.isAlive()) {
        CircleWS.sendTyping(_activeConvId, false);
      }
    }
  }

  // ── Message menu ─────────────────────────────────────────────
  function _openMsgMenu(e, msgId) {
    e.stopPropagation();
    document.querySelectorAll(".dm-msg-menu-dropdown.open").forEach((d) => {
      if (d.id !== `dm-msg-menu-${msgId}`) d.classList.remove("open");
    });
    document.getElementById(`dm-msg-menu-${msgId}`)?.classList.toggle("open");
  }
  // Close menus on outside click
  document.addEventListener("click", () => {
    document.querySelectorAll(".dm-msg-menu-dropdown.open")
      .forEach((d) => d.classList.remove("open"));
  });

  // ── Edit ──────────────────────────────────────────────────────
  function _startEdit(msgId) {
    document.getElementById(`dm-msg-menu-${msgId}`)?.classList.remove("open");
    const msg = _messages.find((m) => m.id === msgId);
    if (!msg) return;
    const bubbleText = document.querySelector(`.dm-msg[data-msg-id="${msgId}"] .dm-bubble-text`);
    if (!bubbleText) return;
    const original = msg._plain || msg.body;
    bubbleText.innerHTML = `
      <textarea class="dm-edit-input" id="dm-edit-${msgId}">${escHtml(original)}</textarea>
      <div class="dm-edit-actions">
        <button onclick="DM._confirmEdit(${msgId})">Save</button>
        <button onclick="DM._cancelEdit(${msgId})">Cancel</button>
      </div>`;
    const ta = document.getElementById(`dm-edit-${msgId}`);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); _confirmEdit(msgId); }
      if (e.key === "Escape") _cancelEdit(msgId);
    });
  }

  async function _confirmEdit(msgId) {
    const ta = document.getElementById(`dm-edit-${msgId}`);
    if (!ta) return;
    const newText = ta.value.trim();
    if (!newText) return;

    const otherUserId = _inbox.find((c) => c.id == _activeConvId)?.other_id;
    const wireBody = otherUserId ? await E2E.encrypt(otherUserId, newText) : newText;

    try {
      await api("PATCH", `/api/dm/conversations/${_activeConvId}/messages/${msgId}`, { body: wireBody });
      _messages = _messages.map((m) =>
        m.id === msgId
          ? { ...m, _plain: newText, body: wireBody, edited_at: new Date().toISOString() }
          : m
      );
      _renderMessages(_messages, false);
    } catch (e) {
      showToast("Failed to edit: " + e.message);
      _cancelEdit(msgId);
    }
  }

  function _cancelEdit(msgId) {
    const msg = _messages.find((m) => m.id === msgId);
    if (!msg) return;
    const bubbleText = document.querySelector(`.dm-msg[data-msg-id="${msgId}"] .dm-bubble-text`);
    if (bubbleText) {
      const original = msg._plain || msg.body;
      bubbleText.innerHTML = escHtml(original).replace(/\n/g, "<br>");
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async function _deleteMsg(msgId) {
    document.getElementById(`dm-msg-menu-${msgId}`)?.classList.remove("open");
    if (!confirm("Delete this message for everyone?")) return;
    try {
      await api("DELETE", `/api/dm/conversations/${_activeConvId}/messages/${msgId}`);
      _messages = _messages.filter((m) => m.id !== msgId);
      _renderMessages(_messages, false);
    } catch (e) {
      showToast("Failed to delete: " + e.message);
    }
  }

  // ── WS edit/delete hooks (called by wsClient.js) ─────────────
  function _wsInjectEdit(convId, msgId, newBody) {
    _messages = _messages.map((m) =>
      m.id === msgId
        ? { ...m, _plain: newBody, edited_at: new Date().toISOString() }
        : m
    );
    if (_activeConvId === convId) _renderMessages(_messages, false);
  }

  function _wsInjectDelete(convId, msgId) {
    _messages = _messages.filter((m) => m.id !== msgId);
    if (_activeConvId === convId) _renderMessages(_messages, false);
  }

  // ── WebSocket injection hooks (called by ws-client.js) ──────
  // Appends a message that arrived via WS into the open chat view.
  async function _wsInjectMessage(convId, message) {
  if (_activeConvId !== convId) return;
  if (message.sender_id === currentUser.id) return; // ← we render our own
  if (_messages.find(m => m.id === message.id)) return;

  const otherUserId = _inbox.find(c => c.id == convId)?.other_id;
  if (message.body?.startsWith("e2e:") && otherUserId) {
    message._plain = await E2E.decrypt(otherUserId, message.body);
  } else {
    message._plain = message.body;
  }

  _messages = [..._messages, message];
  _latestId = message.id;
  _renderMessages(_messages);
  api("PATCH", `/api/dm/conversations/${convId}/read`).catch(() => {});
}

  // Refreshes the inbox preview row for a conversation after a WS new_dm event.
  function _wsRefreshInbox(convId, message) {
    const conv = _inbox.find(c => c.id === convId);
    if (conv) {
      conv.last_message    = message.body;
      conv.last_sender_id  = message.sender_id;
      conv.last_message_at = message.created_at;
      if (message.sender_id !== currentUser.id && convId !== _activeConvId) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
    } else {
      // Conversation not in inbox yet (first ever message) — reload fully
      _loadInbox();
      return;
    }
    renderInbox();
  }

  return {
    init: _loadInbox,
    renderInbox,
    openConv,
    sendMessage,
    filterInbox,
    updateDMBadge,
    clearDMBadge,
    startConvWithUser,
    loadMore: _loadMore,
    getActiveConvId: () => _activeConvId,
    stopHeartbeat: _stopHeartbeat,
    startHeartbeat: _startHeartbeat,
    _tonePlay: () => _msgTone.play(),
    _wsInjectMessage,
    _wsRefreshInbox,
    _setTyping,
    _emitTypingStart,
    _emitTypingStop,
    _openMsgMenu,
    _startEdit,
    _confirmEdit,
    _cancelEdit,
    _deleteMsg,
    _wsInjectEdit,
    _wsInjectDelete,
  };
})();

/* ── DM UI helpers — thin wrappers called from HTML event handlers ── */
function dmFilterInbox() {
  DM.filterInbox();
}
function dmSendMessage() {
  DM.sendMessage();
}
function dmAutoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
  DM._emitTypingStart(); // user is actively typing
}
function dmSendOnEnter(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    DM.sendMessage();
  }
}
function dmBackToInbox() {
  // Leave the WS conversation room before going back
  const _leavingConv = DM.getActiveConvId();
  if (_leavingConv && typeof CircleWS !== "undefined") CircleWS.leaveConversation(_leavingConv);
  DM._emitTypingStop(); // clear any in-flight typing event
  DM.stopHeartbeat(); // no longer in an active conversation
  document.getElementById("dm-inbox").classList.remove("hidden-mobile");
  document.getElementById("dm-chat").classList.remove("visible-mobile");
}

/* ── New DM modal ── */
let _dmSearchDebounce = null;
function openNewDMModal() {
  if (!currentUser) {
    goTo("login");
    return;
  }
  document.getElementById("dm-new-modal").classList.add("open");
  document.getElementById("dm-new-search").value = "";
  document.getElementById("dm-new-results").innerHTML =
    '<div class="dm-new-empty">Search for someone to message</div>';
  setTimeout(() => document.getElementById("dm-new-search").focus(), 80);
}
function closeNewDMModal() {
  document.getElementById("dm-new-modal").classList.remove("open");
}
function dmSearchPeople() {
  const q = document.getElementById("dm-new-search").value.trim();
  const res = document.getElementById("dm-new-results");
  if (!q) {
    res.innerHTML =
      '<div class="dm-new-empty">Search for someone to message</div>';
    return;
  }
  clearTimeout(_dmSearchDebounce);
  res.innerHTML = '<div class="dm-new-empty">Searching…</div>';
  _dmSearchDebounce = setTimeout(async () => {
    try {
      const data = await api(
        "GET",
        `/api/users?search=${encodeURIComponent(q)}&limit=8`,
      );
      let users = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      users = users.filter((u) => u.id !== currentUser.id).slice(0, 8);
      if (!users.length) {
        res.innerHTML = '<div class="dm-new-empty">No users found</div>';
        return;
      }
      res.innerHTML = users
        .map((u) => {
          const initial = (u.name || "?").charAt(0).toUpperCase();
          const color = stringToColor(u.name || "");
          const avHtml = u.picture
            ? `<div class="av sm" style="background:transparent;overflow:hidden;flex-shrink:0"><img src="${u.picture}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${initial}"/></div>`
            : `<div class="av sm" style="background:${color};flex-shrink:0">${initial}</div>`;
          return `<div class="dm-new-result" data-user="${escHtml(JSON.stringify(u))}" onclick="dmPickUser(this)">
                ${avHtml}
                <div class="dm-new-result-info">
                  <div class="dm-new-result-name">${escHtml(u.name || "")}</div>
                  <div class="dm-new-result-email">${escHtml(u.email || "")}</div>
                </div>
              </div>`;
        })
        .join("");
    } catch (e) {
      res.innerHTML =
        '<div class="dm-new-empty">Search failed — try again</div>';
    }
  }, 300);
}
function dmPickUser(el) {
  try {
    const u = JSON.parse(el.dataset.user);
    closeNewDMModal();
    DM.startConvWithUser(u);
  } catch (e) {
    console.error("dmPickUser error:", e);
  }
}