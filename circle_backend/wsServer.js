// ============================================================
//  wsServer.js
//  Central WebSocket hub — attaches to your existing HTTP server.
// ============================================================

const { WebSocketServer, WebSocket } = require('ws');
function LiveModel() { return require('./src/models/LiveModel'); }

const userSockets = new Map();
const activeConversations = new Map();
const liveRooms = new Map();
const typingTimers = new Map();
let wss = null;

function attachWS(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const queryIndex = req.url.indexOf('?');
    const searchParams = new URLSearchParams(queryIndex !== -1 ? req.url.slice(queryIndex) : '');
    const userId = parseInt(searchParams.get('userId'));
    if (!userId) { ws.close(4001, 'Unauthorized'); return; }
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(ws);
    ws._userId = userId;
    console.log(`[WS] User ${userId} connected (${userSockets.get(userId).size} tabs)`);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      handleClientMessage(ws, userId, msg);
    });

    ws.on('close', () => {
      const sockets = userSockets.get(userId);
      if (sockets) { sockets.delete(ws); if (sockets.size === 0) userSockets.delete(userId); }
      for (const [convId, members] of activeConversations.entries()) {
        members.delete(userId);
        if (members.size === 0) activeConversations.delete(convId);
      }
      for (const [sessionId, room] of liveRooms.entries()) {
        if (room.hostId === userId && room.hostWs === ws) {
          _endLiveRoom(sessionId).catch(err => console.error(`[WS] Failed to auto-end live session ${sessionId}:`, err));
          break;
        }
      }
      for (const [sessionId, room] of liveRooms.entries()) {
        if (room.viewers.has(userId)) {
          const viewer = room.viewers.get(userId);
          const name = viewer?.name || 'Someone';
          room.viewers.delete(userId);
          const viewerCount = room.viewers.size;
          LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});
          // Broadcast viewer left and system message
          _broadcastToRoom(sessionId, { type: 'live:viewer_left', sessionId, viewerId: userId, viewerCount });
          _broadcastToRoom(sessionId, {
            type: 'live:chat_message',
            sessionId,
            isSystem: true,
            text: `${name} left`,
          });
          break;
        }
      }
      console.log(`[WS] User ${userId} disconnected`);
    });

    ws.on('error', (err) => console.error(`[WS] Socket error for user ${userId}:`, err));
    send(ws, { type: 'connected', userId });
  });
  console.log('[WS] WebSocket server attached');
  return wss;
}

function handleClientMessage(ws, userId, msg) {
  switch (msg.type) {
    case 'join_conversation': {
      const convId = Number(msg.conversationId);
      if (!convId) return;
      if (!activeConversations.has(convId)) activeConversations.set(convId, new Set());
      activeConversations.get(convId).add(userId);
      break;
    }
    case 'leave_conversation': {
      const convId = Number(msg.conversationId);
      if (!convId) return;
      activeConversations.get(convId)?.delete(userId);
      break;
    }
    case 'ping':
      send(ws, { type: 'pong' });
      break;
    case 'typing': {
      const convId = Number(msg.conversationId);
      if (!convId) break;
      const key = `${convId}:${userId}`;
      if (typingTimers.has(key)) { clearTimeout(typingTimers.get(key)); typingTimers.delete(key); }
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
    case 'live:viewer_join':
      _handleViewerJoin(ws, userId, msg);
      break;
    case 'live:viewer_leave':
      _handleViewerLeave(userId, msg);
      break;
    case 'live:chat_message': {
      const { sessionId } = msg;
      if (!sessionId) break;
      const room = liveRooms.get(sessionId);
      if (room && room.hostId === userId) room.hostWs = ws;
      _relayToRoom(sessionId, msg, userId);
      break;
    }
    case 'live:reaction': {
      const { sessionId } = msg;
      if (!sessionId) break;
      const reactionRoom = liveRooms.get(sessionId);
      if (reactionRoom && reactionRoom.hostId === userId) reactionRoom.hostWs = ws;
      _relayToRoom(sessionId, msg, userId);
      break;
    }
    case 'live:offer':
    case 'live:answer':
    case 'live:ice_candidate': {
      const { sessionId, to } = msg;
      if (!sessionId || !to) break;
      const sigRoom = liveRooms.get(sessionId);
      if (sigRoom && sigRoom.hostId === userId) sigRoom.hostWs = ws;
      _relayToUser(sessionId, to, { ...msg, from: userId });
      break;
    }
    case 'live:like': {
      const { sessionId } = msg;
      if (!sessionId) break;
      const room = liveRooms.get(sessionId);
      if (!room) break;
      if (!room.likeCount) room.likeCount = 0;
      room.likeCount += 1;
      _broadcastToRoom(sessionId, {
        type: 'live:like_count',
        sessionId,
        count: room.likeCount,
      });
      break;
    }

    // ─── NEW: Direct Call Signaling ──────────────────────────────
    case 'call:start':
    case 'call:accept':
    case 'call:ice':
    case 'call:end': {
      const { to } = msg;
      if (!to) break;
      // Forward to the target user, attaching the sender's ID
      const payload = { ...msg, from: userId };
      delete payload.to; // optional cleanup
      notify(to, payload);
      break;
    }

    default:
      break;
  }
}

// ── Live helpers ──────────────────────────────────────────────
function _broadcastToRoom(sessionId, payload, excludeUserId = null) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  if (room.hostWs && room.hostId !== excludeUserId) send(room.hostWs, payload);
  for (const [viewerId, viewer] of room.viewers) {
    if (viewerId !== excludeUserId) send(viewer.ws, payload);
  }
}

async function _handleViewerJoin(ws, userId, msg) {
  const { sessionId } = msg;
  if (!sessionId) return;
  const viewerName = msg.viewerName || 'Anonymous';

  const room = liveRooms.get(sessionId);
  if (!room) {
    try {
      const session = await LiveModel().getSession(sessionId);
      if (!session || session.status !== 'active') return;
      const hostSockets = userSockets.get(session.hostId);
      const hostWs = hostSockets ? ([...hostSockets].find(s => s.readyState === WebSocket.OPEN) ?? null) : null;
      liveRooms.set(sessionId, {
        hostId: session.hostId,
        hostWs,
        viewers: new Map([[userId, { ws, name: viewerName }]]),
        likeCount: 0,
      });
    } catch { return; }
  } else {
    room.viewers.set(userId, { ws, name: viewerName });
  }

  const updatedRoom = liveRooms.get(sessionId);
  const viewerCount = updatedRoom.viewers.size;
  await LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});

  if (!updatedRoom.hostWs || updatedRoom.hostWs.readyState !== WebSocket.OPEN) {
    const freshSockets = userSockets.get(updatedRoom.hostId);
    updatedRoom.hostWs = freshSockets ? ([...freshSockets].find(s => s.readyState === WebSocket.OPEN) ?? null) : null;
  }

  // Tell the host a new viewer joined – triggers WebRTC offer
  if (updatedRoom.hostWs) {
    send(updatedRoom.hostWs, {
      type: 'live:viewer_joined',
      sessionId,
      viewerId: userId,
      viewerName,
      viewerCount,
    });
  }

  // Broadcast updated viewer count to EVERYONE in the room
  _broadcastToRoom(sessionId, {
    type: 'live:viewer_count',
    sessionId,
    count: viewerCount,
  });

  // Broadcast system message: "User joined"
  _broadcastToRoom(sessionId, {
    type: 'live:chat_message',
    sessionId,
    isSystem: true,
    text: `${viewerName} joined`,
  });
}

async function _handleViewerLeave(userId, msg) {
  const { sessionId } = msg;
  if (!sessionId) return;
  const room = liveRooms.get(sessionId);
  if (!room) return;
  const viewer = room.viewers.get(userId);
  const name = viewer?.name || 'Someone';
  room.viewers.delete(userId);
  const viewerCount = room.viewers.size;
  await LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});

  if (room.hostWs) {
    send(room.hostWs, {
      type: 'live:viewer_left',
      sessionId,
      viewerId: userId,
      viewerCount,
    });
  }

  _broadcastToRoom(sessionId, {
    type: 'live:viewer_count',
    sessionId,
    count: viewerCount,
  });

  // Broadcast system message: "User left"
  _broadcastToRoom(sessionId, {
    type: 'live:chat_message',
    sessionId,
    isSystem: true,
    text: `${name} left`,
  });
}

function _relayToRoom(sessionId, payload, excludeUserId = null) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  if (room.hostWs && room.hostId !== excludeUserId) send(room.hostWs, payload);
  for (const [viewerId, viewer] of room.viewers) {
    if (viewerId !== excludeUserId) send(viewer.ws, payload);
  }
}

function _relayToUser(sessionId, toUserId, payload) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  if (room.hostId === toUserId && room.hostWs) {
    send(room.hostWs, payload);
    return;
  }
  const viewer = room.viewers.get(toUserId);
  if (viewer) send(viewer.ws, payload);
}

async function _endLiveRoom(sessionId) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  await LiveModel().endSession(sessionId).catch(() => {});
  for (const viewer of room.viewers.values()) {
    send(viewer.ws, { type: 'live:ended', sessionId });
  }
  liveRooms.delete(sessionId);
  console.log(`[WS] Live session ended: ${sessionId}`);
}

// ── Internal helpers ──────────────────────────────────────────
function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function notify(userId, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const ws of sockets) send(ws, payload);
}

function notifyConversation(conversationId, senderId, recipientId, message) {
  const payload = {
    type: 'new_dm',
    conversationId,
    message,
  };
  notify(senderId, payload);
  notify(recipientId, payload);
  const active = activeConversations.get(conversationId);
  if (active?.has(recipientId)) {
    notify(senderId, {
      type: 'message_seen',
      conversationId,
      messageId: message.id,
      seenBy: recipientId,
    });
  }
}

function notifyUser(recipientId, notifType, data) {
  notify(recipientId, { type: 'notification', notifType, ...data });
}

function isOnline(userId) {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

function broadcastLiveStarted(session) {
  const { sessionId, hostId } = session;
  const hostSockets = userSockets.get(hostId);
  const hostWs = hostSockets ? ([...hostSockets].find(s => s.readyState === WebSocket.OPEN) ?? null) : null;
  liveRooms.set(sessionId, {
    hostId,
    hostWs,
    viewers: new Map(),
    likeCount: 0,
  });
  const payload = { type: 'live:started', ...session };
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) send(ws, payload);
  }
  console.log(`[WS] Live started: ${sessionId} by user ${hostId}`);
}

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

function broadcastToAll(payload) {
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) {
      send(ws, payload);
    }
  }
}

module.exports = {
  attachWS,
  notify,
  notifyConversation,
  notifyUser,
  isOnline,
  broadcastLiveStarted,
  broadcastLiveEnded,
  broadcastToAll,
};