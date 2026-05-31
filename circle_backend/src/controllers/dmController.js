// ============================================================
//  controllers/dmController.js
//  Handles all Direct Message HTTP requests.
//  Real-time delivery is handled by wsServer.js — HTTP routes
//  remain as a fallback and for initial page-load fetches.
// ============================================================

const dmModel    = require('../models/dmModel');
const { sendOk, sendError } = require('../middleware/response');
const { notifyConversation, notifyUser, isOnline } = require('../../wsServer');

// ─── GET /api/dm/inbox ───────────────────────────────────────
async function getInbox(req, res) {
  try {
    const userId = req.actorId;
    const conversations = await dmModel.getInboxForUser(userId);
    return sendOk(res, 200, 'Inbox fetched.', conversations);
  } catch (err) {
    console.error('[DM] getInbox error:', err);
    return sendError(res, 500, 'Failed to fetch inbox.');
  }
}

// ─── GET /api/dm/unread-count ────────────────────────────────
async function getUnreadCount(req, res) {
  try {
    const userId = req.actorId;
    const count  = await dmModel.getTotalUnreadCount(userId);
    return sendOk(res, 200, 'Unread count fetched.', { count });
  } catch (err) {
    console.error('[DM] getUnreadCount error:', err);
    return sendError(res, 500, 'Failed to fetch unread count.');
  }
}

// ─── POST /api/dm/conversations ──────────────────────────────
async function openConversation(req, res) {
  try {
    const userId      = req.actorId;
    const recipientId = Number(req.body.recipientId);

    if (!recipientId || isNaN(recipientId)) {
      return sendError(res, 400, 'recipientId is required.');
    }
    if (recipientId === userId) {
      return sendError(res, 400, 'You cannot message yourself.');
    }

    const conversation = await dmModel.getOrCreateConversation(userId, recipientId);
    return sendOk(res, 200, 'Conversation ready.', conversation);
  } catch (err) {
    console.error('[DM] openConversation error:', err);
    return sendError(res, 500, 'Failed to open conversation.');
  }
}

// ─── GET /api/dm/conversations/:conversationId/messages ──────
async function getMessages(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) {
      return sendError(res, 403, 'Access denied.');
    }

    const limit    = Math.min(parseInt(req.query.limit) || 10, 100);
    const beforeId = req.query.before_id ? Number(req.query.before_id) : null;

    const result = await dmModel.getMessages(conversationId, userId, { limit, beforeId });
    return sendOk(res, 200, 'Messages fetched.', result);
  } catch (err) {
    console.error('[DM] getMessages error:', err);
    return sendError(res, 500, 'Failed to fetch messages.');
  }
}

// ─── GET /api/dm/conversations/:conversationId/messages/new ──
// Kept as a fallback for clients that can't use WebSocket
// (e.g. a background tab or a failed WS connection).
async function getNewMessages(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);
    const afterId        = Number(req.query.after_id);

    if (!afterId || isNaN(afterId)) {
      return sendError(res, 400, 'after_id query param is required.');
    }

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) {
      return sendError(res, 403, 'Access denied.');
    }

    const messages = await dmModel.getNewMessages(conversationId, userId, afterId);
    return sendOk(res, 200, 'New messages fetched.', messages);
  } catch (err) {
    console.error('[DM] getNewMessages error:', err);
    return sendError(res, 500, 'Failed to fetch new messages.');
  }
}

// ─── POST /api/dm/conversations/:conversationId/messages ─────
// Saves the message, then pushes it to both participants via WS.
async function sendMessage(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);
    const body           = (req.body.body || '').trim();

    if (!body) {
      return sendError(res, 400, 'Message body cannot be empty.');
    }
    if (body.length > 2000) {
      return sendError(res, 400, 'Message is too long (max 2000 characters).');
    }

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) {
      return sendError(res, 403, 'Access denied.');
    }

    const message = await dmModel.sendMessage(conversationId, userId, body);

    // ── Real-time delivery ───────────────────────────────────
    // Get the other participant to push the message to them.
    const recipientId = await dmModel.getOtherParticipant(conversationId, userId);
    if (recipientId) {
      notifyConversation(conversationId, userId, recipientId, message);

      // Only send a push notification if the recipient is NOT online via WS.
      // If they're online they already got the message above — no need to ping twice.
      if (!isOnline(recipientId)) {
        // Your existing PushModel logic can go here if you want app-level push
        // when the recipient has the app closed entirely.
        // e.g. await PushModel.sendPushToUser(recipientId, 'new_dm', ...)
      }
    }

    return sendOk(res, 201, 'Message sent.', message);
  } catch (err) {
    console.error('[DM] sendMessage error:', err);
    return sendError(res, 500, 'Failed to send message.');
  }
}

// ─── POST /api/dm/heartbeat ──────────────────────────────────
// Still available for clients on HTTP fallback mode.
// WebSocket-connected clients should send a `ping` frame instead.
async function heartbeat(req, res) {
  try {
    await dmModel.touchPresence(req.actorId);
    return sendOk(res, 200, 'ok');
  } catch (err) {
    console.error('[DM] heartbeat error:', err);
    return sendError(res, 500, 'Heartbeat failed.');
  }
}

// ─── GET /api/dm/conversations/:conversationId/presence ──────
// Returns { online, last_seen_at } for the OTHER participant.
// `online` is now derived from the live WS registry first,
// falling back to the DB timestamp if they're not on WS.
async function getPresence(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) return sendError(res, 403, 'Access denied.');

    const presence = await dmModel.getPresence(conversationId, userId);

    // Override `online` with the live WS state if available
    const otherId = await dmModel.getOtherParticipant(conversationId, userId);
    if (otherId) {
      presence.online = isOnline(otherId);
    }

    return sendOk(res, 200, 'Presence fetched.', presence);
  } catch (err) {
    console.error('[DM] getPresence error:', err);
    return sendError(res, 500, 'Failed to fetch presence.');
  }
}

// ─── PATCH /api/dm/conversations/:conversationId/read ────────
// Marks messages as read AND notifies the sender via WS.
async function markRead(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) {
      return sendError(res, 403, 'Access denied.');
    }

    await dmModel.markConversationRead(conversationId, userId);

    // ── Notify the sender that their messages were read ──────
    const senderId = await dmModel.getOtherParticipant(conversationId, userId);
    if (senderId) {
      notifyUser(senderId, 'dm_read', {
        conversationId,
        readBy: userId,
      });
    }

    return sendOk(res, 200, 'Marked as read.');
  } catch (err) {
    console.error('[DM] markRead error:', err);
    return sendError(res, 500, 'Failed to mark as read.');
  }
}

// ─── POST /api/dm/read-status ────────────────────────────────
async function getReadStatus(req, res) {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return sendOk(res, 200, 'No ids.', { readIds: [] });

    const readIds = await dmModel.getReadStatus(ids);
    return sendOk(res, 200, 'Read status fetched.', { readIds });
  } catch (err) {
    console.error('[DM] getReadStatus error:', err);
    return sendError(res, 500, 'Failed to fetch read status.');
  }
}

module.exports = {
  getInbox,
  getUnreadCount,
  openConversation,
  getMessages,
  getNewMessages,
  sendMessage,
  markRead,
  heartbeat,
  getPresence,
  getReadStatus,
};