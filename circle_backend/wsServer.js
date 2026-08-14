// ============================================================
//  wsServer.js
//  Central WebSocket hub — attaches to your existing HTTP server.
// ============================================================

const { WebSocketServer, WebSocket } = require('ws');
function LiveModel() { return require('./src/models/liveModel'); }

const userSockets = new Map();
const activeConversations = new Map();
const liveRooms = new Map(); // sessionId -> { broadcasters: [], viewers: Map, likeCount, collaborationEnabled }
const typingTimers = new Map();
const pendingRequests = new Map(); // sessionId -> Set of userId (requesting viewers)
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
      // Clean up live rooms
      for (const [sessionId, room] of liveRooms.entries()) {
        // Remove from broadcasters
        const idx = room.broadcasters.findIndex(b => b.userId === userId);
        if (idx !== -1) {
          room.broadcasters.splice(idx, 1);
          if (room.broadcasters.length === 0) {
            _endLiveRoom(sessionId).catch(err => console.error(`[WS] Failed to auto-end live session ${sessionId}:`, err));
          } else {
            _broadcastToRoom(sessionId, {
              type: 'live:broadcaster_left',
              broadcasterId: userId,
              broadcasterCount: room.broadcasters.length,
            });
            const viewerCount = room.viewers.size;
            LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});
            _broadcastToRoom(sessionId, { type: 'live:viewer_count', count: viewerCount });
          }
          break;
        }
        // Remove from viewers
        if (room.viewers.has(userId)) {
          const viewer = room.viewers.get(userId);
          const name = viewer?.name || 'Someone';
          room.viewers.delete(userId);
          const viewerCount = room.viewers.size;
          LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});
          _broadcastToRoom(sessionId, {
            type: 'live:viewer_left',
            sessionId,
            viewerId: userId,
            viewerCount,
          });
          _broadcastToRoom(sessionId, {
            type: 'live:chat_message',
            sessionId,
            isSystem: true,
            text: `${name} left`,
          });
          break;
        }
      }
      // Clean pending requests
      for (const [sessionId, set] of pendingRequests.entries()) {
        set.delete(userId);
        if (set.size === 0) pendingRequests.delete(sessionId);
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
    // ─── Live: started (from host) ──────────────────────────────
    case 'live:started': {
      const { sessionId, collaborationEnabled, hostId, broadcasterName, broadcasterAvatar } = msg;
      if (!sessionId || !hostId) break;
      let room = liveRooms.get(sessionId);
      if (room) {
        room.collaborationEnabled = !!collaborationEnabled;
      } else {
        const hostSockets = userSockets.get(hostId);
        const hostWs = hostSockets ? ([...hostSockets].find(s => s.readyState === WebSocket.OPEN) ?? null) : null;
        liveRooms.set(sessionId, {
          broadcasters: [{ userId: hostId, ws: hostWs, name: broadcasterName || 'Host', avatar: broadcasterAvatar || '' }],
          viewers: new Map(),
          likeCount: 0,
          collaborationEnabled: !!collaborationEnabled,
        });
      }
      // Clear pending requests for this session
      pendingRequests.delete(sessionId);
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
      if (room) _relayToRoom(sessionId, msg, userId);
      break;
    }
    case 'live:reaction': {
      const { sessionId } = msg;
      if (!sessionId) break;
      _relayToRoom(sessionId, msg, userId);
      break;
    }
    case 'live:offer':
    case 'live:answer':
    case 'live:ice_candidate': {
      const { sessionId, to } = msg;
      if (!sessionId || !to) break;
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
    // ─── Collaborative: request/approve/reject ──────────────
    case 'live:become_broadcaster': {
      const { sessionId } = msg;
      if (!sessionId) break;
      _handleBecomeBroadcaster(ws, userId, sessionId);
      break;
    }
    case 'live:approve_broadcaster': {
      const { sessionId, targetUserId } = msg;
      if (!sessionId || !targetUserId) break;
      _handleApproveBroadcaster(ws, userId, sessionId, targetUserId);
      break;
    }
    case 'live:reject_broadcaster': {
      const { sessionId, targetUserId } = msg;
      if (!sessionId || !targetUserId) break;
      _handleRejectBroadcaster(ws, userId, sessionId, targetUserId);
      break;
    }
    // ─── Direct call signaling ───
    case 'call:start':
    case 'call:accept':
    case 'call:ice':
    case 'call:end': {
      const { to } = msg;
      if (!to) break;
      const payload = { ...msg, from: userId };
      delete payload.to;
      notify(to, payload);
      break;
    }
    // ─── Post interaction handlers ───
    case 'like_update': {
      const { postId, count, userIds } = msg;
      if (!postId) break;
      // Broadcast to all connected clients
      broadcastToAll({
        type: 'like_update',
        postId,
        count,
        userIds,
      });
      break;
    }
    case 'repost_update': {
      const { postId, count, userIds } = msg;
      if (!postId) break;
      broadcastToAll({
        type: 'repost_update',
        postId,
        count,
        userIds,
      });
      break;
    }
    case 'comment_update': {
      const { postId, count } = msg;
      if (!postId) break;
      broadcastToAll({
        type: 'comment_update',
        postId,
        count,
      });
      break;
    }
    case 'post_counts': {
      const { postId, likes, comments, reposts } = msg;
      if (!postId) break;
      broadcastToAll({
        type: 'post_counts',
        postId,
        likes,
        comments,
        reposts,
      });
      break;
    }
    default:
      break;
  }
}

// ─── Collaborative helpers ─────────────────────────────────────

// Viewer requests to become broadcaster – notifies all broadcasters
async function _handleBecomeBroadcaster(ws, userId, sessionId) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  if (!room.collaborationEnabled) {
    notify(userId, { type: 'live:error', text: 'Collaboration is not enabled for this stream' });
    return;
  }
  if (room.broadcasters.find(b => b.userId === userId)) return;
  if (room.viewers.has(userId)) {
    // Check if already pending
    let pending = pendingRequests.get(sessionId);
    if (!pending) pending = new Set();
    if (pending.has(userId)) return; // already requested
    pending.add(userId);
    pendingRequests.set(sessionId, pending);
    // Get user info
    const viewer = room.viewers.get(userId);
    const name = viewer?.name || 'Anonymous';
    // Notify all broadcasters
    _broadcastToRoom(sessionId, {
      type: 'live:request_broadcast',
      sessionId,
      userId,
      userName: name,
      userAvatar: viewer?.avatar || '',
    });
  }
}

// Broadcaster approves a request
async function _handleApproveBroadcaster(ws, approverId, sessionId, targetUserId) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  // Check if approver is a broadcaster
  if (!room.broadcasters.find(b => b.userId === approverId)) return;
  // Check if target is a viewer and has a pending request
  if (!room.viewers.has(targetUserId)) return;
  let pending = pendingRequests.get(sessionId);
  if (!pending || !pending.has(targetUserId)) return;
  // Check limit
  if (room.broadcasters.length >= 4) {
    notify(targetUserId, { type: 'live:error', text: 'Broadcaster limit reached' });
    pending.delete(targetUserId);
    if (pending.size === 0) pendingRequests.delete(sessionId);
    return;
  }
  // Remove from viewers
  const viewer = room.viewers.get(targetUserId);
  room.viewers.delete(targetUserId);
  // Add to broadcasters
  const newBroadcaster = {
    userId: targetUserId,
    ws: userSockets.get(targetUserId) ? ([...userSockets.get(targetUserId)].find(s => s.readyState === WebSocket.OPEN) ?? null) : null,
    name: viewer?.name || 'Anonymous',
    avatar: viewer?.avatar || '',
  };
  room.broadcasters.push(newBroadcaster);
  // Remove from pending
  pending.delete(targetUserId);
  if (pending.size === 0) pendingRequests.delete(sessionId);
  // Notify everyone
  _broadcastToRoom(sessionId, {
    type: 'live:new_broadcaster',
    broadcasterId: targetUserId,
    broadcasterName: newBroadcaster.name,
    broadcasterAvatar: newBroadcaster.avatar,
    broadcasterCount: room.broadcasters.length,
  });
  // Send existing broadcasters to the new one
  const existing = room.broadcasters
    .filter(b => b.userId !== targetUserId)
    .map(b => ({ userId: b.userId, name: b.name, avatar: b.avatar }));
  notify(targetUserId, { type: 'live:existing_broadcasters', broadcasters: existing });
  // Update viewer count
  const viewerCount = room.viewers.size;
  LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});
  _broadcastToRoom(sessionId, { type: 'live:viewer_count', count: viewerCount });
  // Notify the requester that they are approved
  notify(targetUserId, { type: 'live:request_approved', sessionId });
}

// Broadcaster rejects a request
async function _handleRejectBroadcaster(ws, rejectorId, sessionId, targetUserId) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  if (!room.broadcasters.find(b => b.userId === rejectorId)) return;
  let pending = pendingRequests.get(sessionId);
  if (!pending || !pending.has(targetUserId)) return;
  pending.delete(targetUserId);
  if (pending.size === 0) pendingRequests.delete(sessionId);
  // Notify the requester
  notify(targetUserId, { type: 'live:request_rejected', sessionId });
}

// ── Live helpers ──────────────────────────────────────────────
function _broadcastToRoom(sessionId, payload, excludeUserId = null) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  for (const b of room.broadcasters) {
    if (b.userId !== excludeUserId && b.ws) send(b.ws, payload);
  }
  for (const [viewerId, viewer] of room.viewers) {
    if (viewerId !== excludeUserId) send(viewer.ws, payload);
  }
}

async function _handleViewerJoin(ws, userId, msg) {
  const { sessionId } = msg;
  if (!sessionId) return;
  const viewerName = msg.viewerName || 'Anonymous';

  let room = liveRooms.get(sessionId);
  if (!room) {
    try {
      const session = await LiveModel().getSession(sessionId);
      if (!session || session.status !== 'active') return;
      const hostSockets = userSockets.get(session.hostId);
      const hostWs = hostSockets ? ([...hostSockets].find(s => s.readyState === WebSocket.OPEN) ?? null) : null;
      room = {
        broadcasters: [{ userId: session.hostId, ws: hostWs, name: session.broadcasterName || 'Host', avatar: session.broadcasterAvatar || '' }],
        viewers: new Map(),
        likeCount: 0,
        collaborationEnabled: !!session.collaborationEnabled,
      };
      liveRooms.set(sessionId, room);
    } catch { return; }
  }

  if (room.broadcasters.find(b => b.userId === userId)) return;
  if (room.viewers.has(userId)) {
    room.viewers.set(userId, { ws, name: viewerName });
  } else {
    room.viewers.set(userId, { ws, name: viewerName });
  }

  const viewerCount = room.viewers.size;
  await LiveModel().setViewerCount(sessionId, viewerCount).catch(() => {});

  for (const b of room.broadcasters) {
    if (b.ws) {
      send(b.ws, {
        type: 'live:viewer_joined',
        sessionId,
        viewerId: userId,
        viewerName,
        viewerCount,
      });
    }
  }

  _broadcastToRoom(sessionId, {
    type: 'live:viewer_count',
    sessionId,
    count: viewerCount,
  });

  _broadcastToRoom(sessionId, {
    type: 'live:chat_message',
    sessionId,
    isSystem: true,
    text: `${viewerName} joined`,
  });

  const currentBroadcasters = room.broadcasters.map(b => ({
    userId: b.userId,
    name: b.name,
    avatar: b.avatar,
  }));
  send(ws, { type: 'live:current_broadcasters', broadcasters: currentBroadcasters });
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

  for (const b of room.broadcasters) {
    if (b.ws) {
      send(b.ws, {
        type: 'live:viewer_left',
        sessionId,
        viewerId: userId,
        viewerCount,
      });
    }
  }

  _broadcastToRoom(sessionId, {
    type: 'live:viewer_count',
    sessionId,
    count: viewerCount,
  });

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
  for (const b of room.broadcasters) {
    if (b.userId !== excludeUserId && b.ws) send(b.ws, payload);
  }
  for (const [viewerId, viewer] of room.viewers) {
    if (viewerId !== excludeUserId) send(viewer.ws, payload);
  }
}

function _relayToUser(sessionId, toUserId, payload) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  const b = room.broadcasters.find(b => b.userId === toUserId);
  if (b && b.ws) { send(b.ws, payload); return; }
  const viewer = room.viewers.get(toUserId);
  if (viewer) send(viewer.ws, payload);
}

async function _endLiveRoom(sessionId) {
  const room = liveRooms.get(sessionId);
  if (!room) return;
  await LiveModel().endSession(sessionId).catch(() => {});
  for (const b of room.broadcasters) {
    if (b.ws) send(b.ws, { type: 'live:ended', sessionId });
  }
  for (const viewer of room.viewers.values()) {
    send(viewer.ws, { type: 'live:ended', sessionId });
  }
  liveRooms.delete(sessionId);
  pendingRequests.delete(sessionId);
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
  const payload = { type: 'new_dm', conversationId, message };
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
  const { sessionId, hostId, broadcasterName, broadcasterAvatar, title, collaborationEnabled } = session;
  const hostSockets = userSockets.get(hostId);
  const hostWs = hostSockets ? ([...hostSockets].find(s => s.readyState === WebSocket.OPEN) ?? null) : null;
  liveRooms.set(sessionId, {
    broadcasters: [{ userId: hostId, ws: hostWs, name: broadcasterName || 'Host', avatar: broadcasterAvatar || '' }],
    viewers: new Map(),
    likeCount: 0,
    collaborationEnabled: !!collaborationEnabled,
  });
  pendingRequests.delete(sessionId);
  const payload = { type: 'live:started', ...session };
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) send(ws, payload);
  }
  console.log(`[WS] Live started: ${sessionId} by user ${hostId} (collab: ${collaborationEnabled})`);
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