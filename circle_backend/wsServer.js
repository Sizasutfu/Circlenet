// ============================================================
//  wsServer.js
//  Central WebSocket hub — attaches to your existing HTTP server.
//
//  USAGE in app.js / server.js:
//    const { attachWS } = require('./wsServer');
//    const server = app.listen(PORT);
//    attachWS(server);
//
//  Then anywhere in a controller:
//    const { notify, notifyConversation } = require('./wsServer');
// ============================================================

const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');

// ── Connection registries ────────────────────────────────────
// userId  → Set<WebSocket>   (one user can have multiple tabs)
const userSockets = new Map();

// conversationId → Set<userId>  (who is currently "in" this convo)
const activeConversations = new Map();

// ── Typing state ─────────────────────────────────────────────
// `${conversationId}:${userId}` → auto-clear timer
const typingTimers = new Map();

let wss = null;

// ── Attach to existing HTTP server ──────────────────────────
function attachWS(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // ── Auth: expect ?userId=<id> in the upgrade URL ─────────
    const { query } = url.parse(req.url, true);
    const userId = parseInt(query.userId);
    if (!userId) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    // ── Register socket ──────────────────────────────────────
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(ws);

    ws._userId = userId;
    console.log(`[WS] User ${userId} connected (${userSockets.get(userId).size} tabs)`);

    // ── Incoming message handler ─────────────────────────────
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      handleClientMessage(ws, userId, msg);
    });

    // ── Cleanup on disconnect ────────────────────────────────
    ws.on('close', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) userSockets.delete(userId);
      }

      // Remove from any active conversations
      for (const [convId, members] of activeConversations.entries()) {
        members.delete(userId);
        if (members.size === 0) activeConversations.delete(convId);
      }

      console.log(`[WS] User ${userId} disconnected`);
    });

    ws.on('error', (err) => console.error(`[WS] Socket error for user ${userId}:`, err));

    // Confirm connection to client
    send(ws, { type: 'connected', userId });
  });

  console.log('[WS] WebSocket server attached');
  return wss;
}

// ── Handle messages sent FROM the client ────────────────────
function handleClientMessage(ws, userId, msg) {
  switch (msg.type) {

    // Client tells us they opened a conversation view
    case 'join_conversation': {
      const convId = Number(msg.conversationId);
      if (!convId) return;
      if (!activeConversations.has(convId)) activeConversations.set(convId, new Set());
      activeConversations.get(convId).add(userId);
      break;
    }

    // Client tells us they left the conversation view
    case 'leave_conversation': {
      const convId = Number(msg.conversationId);
      if (!convId) return;
      activeConversations.get(convId)?.delete(userId);
      break;
    }

    // Client pings to stay alive (replaces the HTTP heartbeat endpoint)
    case 'ping':
      send(ws, { type: 'pong' });
      break;

    case 'typing': {
      const convId = Number(msg.conversationId);
      if (!convId) break;
      const key = `${convId}:${userId}`;
      if (typingTimers.has(key)) {
        clearTimeout(typingTimers.get(key));
        typingTimers.delete(key);
      }
      if (msg.isTyping) {
        _broadcastTyping(convId, userId, true);
        const timer = setTimeout(() => {
          _broadcastTyping(convId, userId, false);
          typingTimers.delete(key);
        }, 4000);
        typingTimers.set(key, timer);
      } else {
        _broadcastTyping(convId, userId, false);
      }
      break;
    }

    default:
      break;
  }
}

// ── Internal helpers ─────────────────────────────────────────
function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Push an event to ALL sockets belonging to a user.
 * @param {number} userId
 * @param {object} payload  - must include a `type` string field
 */
function notify(userId, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const ws of sockets) send(ws, payload);
}

/**
 * Push a new DM to both participants of a conversation.
 * If the recipient has the conversation open (activeConversations),
 * we also emit a `read_ack` back to the sender immediately.
 *
 * @param {number} conversationId
 * @param {number} senderId
 * @param {number} recipientId
 * @param {object} message  - the message row returned by dmModel.sendMessage
 */
function notifyConversation(conversationId, senderId, recipientId, message) {
  const payload = {
    type:           'new_dm',
    conversationId,
    message,
  };

  // Push to sender's other tabs (so they see their own message in real time)
  notify(senderId, payload);

  // Push to recipient
  notify(recipientId, payload);

  // If recipient is actively viewing this conversation, auto-ack as read
  const active = activeConversations.get(conversationId);
  if (active?.has(recipientId)) {
    notify(senderId, {
      type:           'message_seen',
      conversationId,
      messageId:      message.id,
      seenBy:         recipientId,
    });
  }
}

/**
 * Broadcast a notification event to a user.
 * Used by postController for likes, comments, reposts, follows, etc.
 *
 * @param {number} recipientId
 * @param {string} notifType    - 'like' | 'comment' | 'repost' | 'follow' | 'new_post'
 * @param {object} data         - { actorId, actorName, postId?, notifId? }
 */
function notifyUser(recipientId, notifType, data) {
  notify(recipientId, { type: 'notification', notifType, ...data });
}

/**
 * Check if a user has at least one open WebSocket connection.
 */
function isOnline(userId) {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

function _broadcastTyping(conversationId, typingUserId, isTyping) {
  const members = activeConversations.get(conversationId);
  if (!members) return;
  const payload = { type: 'typing', conversationId, userId: typingUserId, isTyping };
  for (const memberId of members) {
    if (memberId === typingUserId) continue;
    notify(memberId, payload);
  }
}

module.exports = { attachWS, notify, notifyConversation, notifyUser, isOnline };