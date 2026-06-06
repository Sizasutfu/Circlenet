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

// Lazy-require LiveModel to avoid circular dependency at module load time.
// By the time any live WS message arrives, all modules are initialised.
function LiveModel() { return require('./src/models/LiveModel'); }

// ── Connection registries ────────────────────────────────────
// userId  → Set<WebSocket>   (one user can have multiple tabs)
const userSockets = new Map();

// conversationId → Set<userId>  (who is currently "in" this convo)
const activeConversations = new Map();

// ── Live video rooms ─────────────────────────────────────────
// sessionId → {
//   hostId:   number,
//   hostWs:   WebSocket,          ← the host's active socket
//   viewers:  Map<userId, WebSocket>
// }
const liveRooms = new Map();

// ── Typing state ─────────────────────────────────────────────
// `${conversationId}:${userId}` → auto-clear timer
const typingTimers = new Map();

let wss = null;

// ── Attach to existing HTTP server ──────────────────────────
function attachWS(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // ── Auth: expect ?userId=<id> in the upgrade URL ─────────
    // ✅ FIXED: no more url.parse()
    const queryIndex = req.url.indexOf('?');
    const searchParams = new URLSearchParams(queryIndex !== -1 ? req.url.slice(queryIndex) : '');
    const userId = parseInt(searchParams.get('userId'));

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

      // ── Live: if this socket was a host, end their session ──
      for (const [sessionId, room] of liveRooms.entries()) {
        if (room.hostId === userId && room.hostWs === ws) {
          _endLiveRoom(sessionId).catch(err =>
            console.error(`[WS] Failed to auto-end live session ${sessionId}:`, err)
          );
          break;
        }
      }

      // ── Live: if this socket was a viewer, remove them ──────
      for (const [sessionId, room] of liveRooms.entries()) {
        if (room.viewers.has(userId)) {
          room.viewers.delete(userId);
          const viewerCount = room.viewers.size;
          LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});
          send(room.hostWs, {
            type: 'live:viewer_left',
            sessionId,
            viewerId: userId,
            viewerCount,
          });
          break;
        }
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

    // ── Live video ───────────────────────────────────────────

    case 'live:viewer_join':
      _handleViewerJoin(ws, userId, msg);
      break;

    case 'live:viewer_leave':
      _handleViewerLeave(userId, msg);
      break;

    // Chat message → relay to everyone in the room except sender
    case 'live:chat_message': {
      const { sessionId } = msg;
      if (!sessionId) break;
      // Keep hostWs current in case host reconnected or has multiple tabs (bug #8)
      const room = liveRooms.get(sessionId);
      if (room && room.hostId === userId) room.hostWs = ws;
      _relayToRoom(sessionId, msg, userId);
      break;
    }

    // Reaction → relay to everyone in the room except sender
    case 'live:reaction': {
      const { sessionId } = msg;
      if (!sessionId) break;
      const reactionRoom = liveRooms.get(sessionId);
      if (reactionRoom && reactionRoom.hostId === userId) reactionRoom.hostWs = ws;
      _relayToRoom(sessionId, msg, userId);
      break;
    }

    // WebRTC signaling — point-to-point relay
    case 'live:offer':
    case 'live:answer':
    case 'live:ice_candidate': {
      const { sessionId, to } = msg;
      if (!sessionId || !to) break;
      // Refresh hostWs if this signal is from the host (bug #8)
      const sigRoom = liveRooms.get(sessionId);
      if (sigRoom && sigRoom.hostId === userId) sigRoom.hostWs = ws;
      _relayToUser(sessionId, to, { ...msg, from: userId });
      break;
    }

    default:
      break;
  }
}

// ── Live video helpers ───────────────────────────────────────

/**
 * Viewer joins a live room.
 * Creates the room entry if the host hasn't sent a message yet
 * (host socket is registered when broadcastLiveStarted runs).
 */
async function _handleViewerJoin(ws, userId, msg) {
  const { sessionId } = msg;
  if (!sessionId) return;

  const room = liveRooms.get(sessionId);
  if (!room) {
    // Session exists in DB but host socket not yet tracked — fetch and register
    try {
      const session = await LiveModel().getSession(sessionId);
      if (!session || session.status !== 'active') return;
      // Hydrate hostWs from the live registry so the offer can be sent (bug #5)
      const hostSockets = userSockets.get(session.hostId);
      const hostWs = hostSockets ? [...hostSockets][0] : null;
      liveRooms.set(sessionId, {
        hostId:  session.hostId,
        hostWs,
        viewers: new Map([[userId, ws]]),
      });
    } catch { return; }
  } else {
    room.viewers.set(userId, ws);
  }

  const updatedRoom    = liveRooms.get(sessionId);
  const viewerCount    = updatedRoom.viewers.size;

  await LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});

  // Tell the host a new viewer joined (triggers WebRTC offer)
  if (updatedRoom.hostWs) {
    send(updatedRoom.hostWs, {
      type:        'live:viewer_joined',
      sessionId,
      viewerId:    userId,
      viewerName:  msg.viewerName || null,
      viewerCount,
    });
  }
}

/**
 * Viewer leaves a live room voluntarily.
 */
async function _handleViewerLeave(userId, msg) {
  const { sessionId } = msg;
  if (!sessionId) return;

  const room = liveRooms.get(sessionId);
  if (!room) return;

  room.viewers.delete(userId);
  const viewerCount = room.viewers.size;

  await LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});

  if (room.hostWs) {
    send(room.hostWs, { type: 'live:viewer_left', sessionId, viewerId: userId, viewerCount });
  }
}

/**
 * Relay a message to every socket in the room (host + all viewers).
 */
function _relayToRoom(sessionId, payload, excludeUserId = null) {
  const room = liveRooms.get(sessionId);
  if (!room) return;

  if (room.hostWs && room.hostId !== excludeUserId) {
    send(room.hostWs, payload);
  }
  for (const [viewerId, vws] of room.viewers.entries()) {
    if (viewerId !== excludeUserId) send(vws, payload);
  }
}

/**
 * Relay a message to ONE specific user in the room.
 */
function _relayToUser(sessionId, toUserId, payload) {
  const room = liveRooms.get(sessionId);
  if (!room) return;

  if (room.hostId === toUserId && room.hostWs) {
    send(room.hostWs, payload);
    return;
  }
  const vws = room.viewers.get(toUserId);
  if (vws) send(vws, payload);
}

/**
 * End a live room: update DB, notify all viewers, clean up map.
 * Called when host disconnects or by broadcastLiveEnded.
 */
async function _endLiveRoom(sessionId) {
  const room = liveRooms.get(sessionId);
  if (!room) return;

  await LiveModel().endSession(sessionId).catch(() => {});

  // Notify all viewers the stream ended
  for (const vws of room.viewers.values()) {
    send(vws, { type: 'live:ended', sessionId });
  }

  liveRooms.delete(sessionId);
  console.log(`[WS] Live session ended: ${sessionId}`);
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

/**
 * Called by liveController after a session is created in the DB.
 * Notifies ALL connected users so their feed cards update in real time.
 * Also registers the host socket in liveRooms.
 *
 * @param {object} session  - full session row from LiveModel.createSession()
 */
function broadcastLiveStarted(session) {
  const { sessionId, hostId } = session;

  // Register the host's current socket in the room
  const hostSockets = userSockets.get(hostId);
  const hostWs      = hostSockets ? [...hostSockets][0] : null;

  liveRooms.set(sessionId, {
    hostId,
    hostWs,
    viewers: new Map(),
  });

  // Broadcast to every connected user
  const payload = { type: 'live:started', ...session };
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) send(ws, payload);
  }

  console.log(`[WS] Live started: ${sessionId} by user ${hostId}`);
}

/**
 * Called by liveController after POST /api/live/end.
 * Tears down the room and notifies all viewers.
 *
 * @param {string} sessionId
 */
function broadcastLiveEnded(sessionId) {
  _endLiveRoom(sessionId).catch(err =>
    console.error(`[WS] broadcastLiveEnded error for ${sessionId}:`, err)
  );
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

module.exports = { attachWS, notify, notifyConversation, notifyUser, isOnline, broadcastLiveStarted, broadcastLiveEnded };