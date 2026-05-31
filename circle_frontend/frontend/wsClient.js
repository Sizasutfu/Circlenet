/* ================================================================
   ws-client.js  —  Circle real-time WebSocket client
   Load this AFTER main.js in your HTML:
     <script src="ws-client.js"></script>

   What it does:
   - Connects to the WS server using the JWT from localStorage
   - On `new_dm`      → appends message to open chat, plays tone,
                        updates inbox + badge without HTTP polling
   - On `notification`→ bumps the notif badge, plays tone
   - On `message_seen`→ patches "Seen" label instantly
   - On `dm_read`     → patches "Seen" label when peer reads
   - Presence (online/offline) driven by WS connection registry
   - Replaces the DM polling interval while WS is connected
   - Falls back gracefully to polling if WS drops
   ================================================================ */

(function () {
  /* ── Config ─────────────────────────────────────────────── */
  // Derive WS URL from the API base. API is declared in your HTML
  // as a global (e.g. const API = "http://localhost:5000").
  // We swap http(s):// for ws(s)://
  function _wsUrl() {
    const base = (typeof API !== "undefined" ? API : window.location.origin);
    return base.replace(/^http/, "ws") + "/ws";
  }

  /* ── State ──────────────────────────────────────────────── */
  let _socket        = null;
  let _reconnectMs   = 1500;
  let _pingInterval  = null;
  let _connected     = false;
  let _wsAlive       = false;   // true while a healthy socket exists

  /* ── Public API ─────────────────────────────────────────── */
  window.CircleWS = {
    connect,
    disconnect,
    joinConversation,
    leaveConversation,
    isAlive: () => _wsAlive,
  };

  /* ── Connect ─────────────────────────────────────────────── */
  function connect() {
    const token = localStorage.getItem("circle_token");
    if (!token) return;                        // not logged in, skip
    if (_socket && _socket.readyState <= WebSocket.OPEN) return;

    _socket = new WebSocket(`${_wsUrl()}?token=${token}`);

    _socket.addEventListener("open", _onOpen);
    _socket.addEventListener("message", _onMessage);
    _socket.addEventListener("close", _onClose);
    _socket.addEventListener("error", (e) => console.warn("[WS] error", e));
  }

  function disconnect() {
    _stopPing();
    _wsAlive = false;
    if (_socket) { _socket.close(); _socket = null; }
  }

  /* ── Conversation tracking ───────────────────────────────── */
  function joinConversation(convId) {
    _send({ type: "join_conversation", conversationId: convId });
  }
  function leaveConversation(convId) {
    _send({ type: "leave_conversation", conversationId: convId });
  }

  /* ── Socket event handlers ──────────────────────────────── */
  function _onOpen() {
    console.log("[WS] Connected ✓");
    _wsAlive     = true;
    _connected   = true;
    _reconnectMs = 1500;
    _startPing();

    // If user has a conversation open, re-join it after reconnect
    const activeConvId = typeof DM !== "undefined" ? DM.getActiveConvId() : null;
    if (activeConvId) joinConversation(activeConvId);
  }

  function _onClose(e) {
    _wsAlive   = false;
    _connected = false;
    _stopPing();
    console.warn(`[WS] Closed (${e.code}). Retry in ${_reconnectMs}ms`);
    if (e.code === 4001) return;               // auth failure — don't retry
    if (!localStorage.getItem("circle_token")) return; // logged out
    setTimeout(connect, _reconnectMs);
    _reconnectMs = Math.min(_reconnectMs * 2, 30_000);
  }

  function _onMessage(event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {

      // ── New direct message ───────────────────────────────
      case "new_dm":
        _handleNewDM(msg);
        break;

      // ── Notification (like, comment, repost, new_post) ──
      case "notification":
        _handleNotification(msg);
        break;

      // ── Sender sees "Seen" when recipient is in-chat ────
      case "message_seen":
        _handleMessageSeen(msg);
        break;

      // ── Sender sees "Seen" when recipient calls markRead ─
      case "dm_read":
        _handleDMRead(msg);
        break;

      case "pong":
        break;                               // keep-alive acknowledged

      default:
        break;
    }
  }

  /* ── Handler: new_dm ────────────────────────────────────── */
  async function _handleNewDM(msg) {
    const { conversationId, message } = msg;
    if (!currentUser || !message) return;

    const isFromMe = message.sender_id === currentUser.id;
    const isActiveConv = (typeof DM !== "undefined") &&
                         DM.getActiveConvId() === conversationId;

    // ── Decrypt if E2E ──────────────────────────────────────
    if (message.body && message.body.startsWith("e2e:")) {
      try {
        // Find the other user id from the inbox
        const conv = (DM._inbox || []).find(c => c.id === conversationId);
        const otherId = conv?.other_id;
        if (otherId) {
          message._plain = await E2E.decrypt(otherId, message.body);
        }
      } catch (_) {}
    }
    if (!message._plain) message._plain = message.body;

    // ── If this conversation is open, append the bubble ─────
    if (isActiveConv && typeof DM !== "undefined") {
      // Push into DM's internal _messages array via a private helper
      // We expose a small hook from the DM module (added below)
      if (typeof DM._wsInjectMessage === "function") {
        DM._wsInjectMessage(conversationId, message);
      }
    }

    // ── If message is from someone else, update inbox + badge
    if (!isFromMe) {
      // Play message tone
      try { DM._tonePlay(); } catch (_) {}

      if (!isActiveConv) {
        // Bump badge
        if (typeof DM !== "undefined") DM.updateDMBadge(1);
      }
    }

    // ── Refresh inbox preview row ─────────────────────────
    if (typeof DM !== "undefined") DM._wsRefreshInbox(conversationId, message);
  }

  /* ── Handler: notification ──────────────────────────────── */
  function _handleNotification(msg) {
    if (!currentUser) return;

    // Bump the notification badge by 1
    const badges = [
      document.getElementById("topbar-notif-badge"),
      document.getElementById("snav-notif-badge"),
    ];
    badges.forEach(b => {
      if (!b) return;
      const current = parseInt(b.textContent) || 0;
      const next = current + 1;
      b.textContent = next > 99 ? "99+" : next;
      b.classList.add("show");
    });

    // Play tone (reuse the existing DM tone — same sound, different context)
    try { DM._tonePlay(); } catch (_) {}

    // Show a subtle toast for certain types
    const toastTypes = { like: "❤️", comment: "💬", repost: "🔁", follow: "👤", new_post: "📣" };
    const emoji = toastTypes[msg.notifType];
    if (emoji && msg.actorName) {
      const copy = {
        like:     `${msg.actorName} liked your post`,
        comment:  `${msg.actorName} commented on your post`,
        repost:   `${msg.actorName} echoed your post`,
        follow:   `${msg.actorName} started following you`,
        new_post: `${msg.actorName} posted something new`,
      };
      if (copy[msg.notifType]) showToast(`${emoji} ${copy[msg.notifType]}`);
    }

    // If the notifications panel is currently open, silently prepend the item
    const panel = document.getElementById("notif-panel");
    if (panel && panel.classList.contains("open")) {
      fetchNotifications(true);
    }
  }

  /* ── Handler: message_seen (real-time ack from open chat) ── */
  function _handleMessageSeen(msg) {
    const { conversationId, messageId } = msg;
    if (!currentUser) return;
    if (typeof DM === "undefined") return;
    if (DM.getActiveConvId() !== conversationId) return;

    // Remove old Seen labels, add fresh one on the target message
    document.querySelectorAll(".dm-seen-label").forEach(el => el.remove());
    const msgEl = document.querySelector(`.dm-msg[data-msg-id="${messageId}"]`);
    if (msgEl) {
      const seen = document.createElement("div");
      seen.className = "dm-seen-label";
      seen.textContent = "Seen";
      msgEl.appendChild(seen);
    }
  }

  /* ── Handler: dm_read (markRead called by the other side) ── */
  function _handleDMRead(msg) {
    // Same effect as message_seen but triggered by the HTTP markRead endpoint
    // Find the last sent message visible in the chat and label it Seen
    if (!currentUser) return;
    if (typeof DM === "undefined") return;
    if (DM.getActiveConvId() !== msg.conversationId) return;

    const sentMsgs = document.querySelectorAll(".dm-msg.mine");
    if (!sentMsgs.length) return;
    document.querySelectorAll(".dm-seen-label").forEach(el => el.remove());
    const last = sentMsgs[sentMsgs.length - 1];
    const seen = document.createElement("div");
    seen.className = "dm-seen-label";
    seen.textContent = "Seen";
    last.appendChild(seen);
  }

  /* ── Keep-alive ping ────────────────────────────────────── */
  function _startPing() {
    _stopPing();
    _pingInterval = setInterval(() => _send({ type: "ping" }), 25_000);
  }
  function _stopPing() {
    clearInterval(_pingInterval);
    _pingInterval = null;
  }

  function _send(payload) {
    if (_socket && _socket.readyState === WebSocket.OPEN) {
      _socket.send(JSON.stringify(payload));
    }
  }

  /* ── Auto-connect on DOMContentLoaded ───────────────────── */
  // If a token already exists (page refresh while logged in), connect right away.
  document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("circle_token")) connect();
  });

})();


/* ================================================================
   DM MODULE EXTENSIONS
   Add these two small methods to the DM IIFE return object
   in main.js so ws-client.js can drive it.

   In main.js, find the `return { ... }` at the end of the DM IIFE
   (around line 6418) and add these two properties:

     _wsInjectMessage: _wsInjectMessage,
     _wsRefreshInbox:  _wsRefreshInbox,

   Then add these two functions inside the DM IIFE (before the return):
================================================================ */

/*
  // ── Called by ws-client when a new_dm event arrives ──────
  function _wsInjectMessage(convId, message) {
    if (_activeConvId !== convId) return;

    // Don't double-add a message we sent ourselves via the HTTP path
    if (_messages.find(m => m.id === message.id)) return;

    _messages = [..._messages, message];
    _latestId = message.id;
    _renderMessages(_messages);

    // Mark as read since the user is looking at it
    api("PATCH", `/api/dm/conversations/${convId}/read`).catch(() => {});
  }

  // ── Called by ws-client to refresh an inbox row preview ──
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
      // New conversation not yet in inbox — reload it
      _loadInbox();
      return;
    }
    renderInbox();
  }
*/


/* ================================================================
   setCurrentUser / logout HOOKS
   In main.js, add these two lines:

   In setCurrentUser(user), after startNotifPolling():
     if (user) CircleWS.connect();

   In logout(), after stopNotifPolling():
     CircleWS.disconnect();

   In DM.openConv(cid), after _startPolling():
     CircleWS.joinConversation(cid);

   In dmBackToInbox() or anywhere you call _stopPolling():
     CircleWS.leaveConversation(DM.getActiveConvId());
================================================================ */