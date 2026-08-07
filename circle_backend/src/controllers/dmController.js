// controllers/dmController.js
// Handles all Direct Message HTTP requests with media support using Cloudinary

const dmModel    = require('../models/dmModel');
const { sendOk, sendError } = require('../middleware/response');
const { notifyConversation, notifyUser, isOnline } = require('../../wsServer');
const { uploadImage } = require('../middleware/upload');

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
async function sendMessage(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);
    const body           = (req.body.body || '').trim();
    const media          = req.body.media || null;

    if (!body && !media) {
      return sendError(res, 400, 'Message cannot be empty.');
    }
    if (body && body.length > 2000) {
      return sendError(res, 400, 'Message is too long (max 2000 characters).');
    }

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) {
      return sendError(res, 403, 'Access denied.');
    }

    const message = await dmModel.sendMessage(conversationId, userId, body, media);

    const recipientId = await dmModel.getOtherParticipant(conversationId, userId);
    if (recipientId) {
      notifyConversation(conversationId, userId, recipientId, message);
      
      if (!isOnline(recipientId)) {
        // Push notification logic here
      }
    }

    return sendOk(res, 201, 'Message sent.', message);
  } catch (err) {
    console.error('[DM] sendMessage error:', err);
    return sendError(res, 500, 'Failed to send message.');
  }
}

// ─── POST /api/dm/upload ──────────────────────────────────────
async function uploadMedia(req, res) {
  try {
    const userId = req.actorId;
    const file = req.file;

    if (!file) {
      return sendError(res, 400, 'No file uploaded.');
    }

    // File is already validated by multer middleware
    // File is in memory buffer from multer memoryStorage

    // Determine media type
    let mediaType = 'file';
    if (file.mimetype.startsWith('image/')) mediaType = 'image';
    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';

    // Upload to Cloudinary or local storage using your existing uploadImage function
    let fileUrl;
    let thumbnail = null;

    try {
      // Use your existing uploadImage function
      fileUrl = await uploadImage(file.buffer, file.originalname);
      
      // Generate thumbnail for images (Cloudinary handles this)
      if (mediaType === 'image' && fileUrl.includes('cloudinary')) {
        // Cloudinary thumbnail - add transformation
        thumbnail = fileUrl.replace('/upload/', '/upload/c_thumb,w_200,h_200/');
      } else if (mediaType === 'image') {
        // Local thumbnail - you'd need to generate one
        // For now, use the same URL
        thumbnail = fileUrl;
      }
    } catch (err) {
      console.error('[DM] Upload to storage failed:', err);
      return sendError(res, 500, 'Failed to upload file to storage.');
    }

    return sendOk(res, 200, 'File uploaded successfully.', {
      url: fileUrl,
      thumbnail: thumbnail,
      type: mediaType,
      name: file.originalname,
      size: file.size
    });
  } catch (err) {
    console.error('[DM] uploadMedia error:', err);
    return sendError(res, 500, 'Failed to upload file.');
  }
}

// ─── POST /api/dm/heartbeat ──────────────────────────────────
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
async function getPresence(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) return sendError(res, 403, 'Access denied.');

    const presence = await dmModel.getPresence(conversationId, userId);

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
async function markRead(req, res) {
  try {
    const userId         = req.actorId;
    const conversationId = Number(req.params.conversationId);

    const allowed = await dmModel.isParticipant(conversationId, userId);
    if (!allowed) {
      return sendError(res, 403, 'Access denied.');
    }

    await dmModel.markConversationRead(conversationId, userId);

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

// ─── PUT /api/dm/conversations/:conversationId/messages/:messageId ──
async function editMessage(req, res) {
  try {
    const userId    = req.actorId;
    const messageId = Number(req.params.messageId);
    const newBody   = (req.body.body || '').trim();

    if (!newBody) return sendError(res, 400, 'Body cannot be empty.');
    if (newBody.length > 2000) return sendError(res, 400, 'Message too long.');

    const updated = await dmModel.editMessage(messageId, userId, newBody);

    const recipientId = await dmModel.getOtherParticipant(updated.conversation_id, userId);
    if (recipientId) {
      notifyUser(recipientId, 'dm_edited', { 
        messageId, 
        conversationId: updated.conversation_id, 
        body: newBody 
      });
      notifyUser(userId, 'dm_edited', { 
        messageId, 
        conversationId: updated.conversation_id, 
        body: newBody 
      });
    }

    return sendOk(res, 200, 'Message edited.', updated);
  } catch (err) {
    console.error('[DM] editMessage error:', err);
    return sendError(res, 400, err.message || 'Failed to edit message.');
  }
}

// ─── DELETE /api/dm/conversations/:conversationId/messages/:messageId ──
async function deleteMessage(req, res) {
  try {
    const userId    = req.actorId;
    const messageId = Number(req.params.messageId);

    const result = await dmModel.deleteMessage(messageId, userId);

    const recipientId = await dmModel.getOtherParticipant(result.conversationId, userId);
    if (recipientId) {
      notifyUser(recipientId, 'dm_deleted', { 
        messageId, 
        conversationId: result.conversationId 
      });
      notifyUser(userId, 'dm_deleted', { 
        messageId, 
        conversationId: result.conversationId 
      });
    }

    return sendOk(res, 200, 'Message deleted.');
  } catch (err) {
    console.error('[DM] deleteMessage error:', err);
    return sendError(res, 400, err.message || 'Failed to delete message.');
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
  editMessage,
  deleteMessage,
  uploadMedia
};