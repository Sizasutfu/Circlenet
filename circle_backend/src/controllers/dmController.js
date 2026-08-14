// controllers/dmController.js
// Handles all Direct Message HTTP requests with E2E encryption support

const dmModel    = require('../models/dmModel');
const { sendOk, sendError } = require('../middleware/response');
const { notifyConversation, notifyUser, isOnline } = require('../../wsServer');
const { uploadMediaWithMetadata } = require('../middleware/upload');

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

    // Check if the body is encrypted
    const isEncrypted = body.startsWith('e2e:');

    // Process media if it exists
    let processedMedia = null;
    if (media) {
      processedMedia = {
        media_type: media.type || media.media_type || 'file',
        media_url: media.url || media.media_url,
        media_thumbnail: media.thumbnail || media.media_thumbnail || null,
        media_name: media.name || media.media_name || 'file',
        media_size: media.size || media.media_size || null,
      };
    }

    // Save the message
    const message = await dmModel.saveEncryptedMessage(
      conversationId, 
      userId, 
      body, 
      processedMedia, 
      isEncrypted
    );

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

    try {
      // Use the uploadMediaWithMetadata function from middleware
      const result = await uploadMediaWithMetadata(
        file.buffer,
        file.originalname,
        file.mimetype,
        { folder: 'dm_media' }
      );
      
      return sendOk(res, 200, 'File uploaded successfully.', result);
    } catch (err) {
      console.error('[DM] Upload to storage failed:', err);
      return sendError(res, 500, 'Failed to upload file to storage.');
    }
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

// ─── E2E Encryption Endpoints ─────────────────────────────────

// POST /api/dm/e2e/encrypt
async function encryptMessage(req, res) {
  try {
    const userId = req.actorId;
    const { peerUserId, plaintext } = req.body;

    if (!peerUserId || !plaintext) {
      return sendError(res, 400, 'peerUserId and plaintext are required.');
    }

    const e2e = require('../lib/e2e');
    const encrypted = await e2e.encrypt(peerUserId, plaintext, req.apiClient);
    
    return sendOk(res, 200, 'Message encrypted.', { encrypted });
  } catch (err) {
    console.error('[DM] encryptMessage error:', err);
    return sendError(res, 500, 'Failed to encrypt message.');
  }
}

// POST /api/dm/e2e/decrypt
async function decryptMessage(req, res) {
  try {
    const userId = req.actorId;
    const { peerUserId, encryptedText } = req.body;

    if (!peerUserId || !encryptedText) {
      return sendError(res, 400, 'peerUserId and encryptedText are required.');
    }

    const e2e = require('../lib/e2e');
    const decrypted = await e2e.decrypt(peerUserId, encryptedText, req.apiClient);
    
    return sendOk(res, 200, 'Message decrypted.', { decrypted });
  } catch (err) {
    console.error('[DM] decryptMessage error:', err);
    return sendError(res, 500, 'Failed to decrypt message.');
  }
}

// GET /api/dm/e2e/status/:userId
async function getE2EStatus(req, res) {
  try {
    const userId = req.actorId;
    const peerUserId = Number(req.params.userId);

    if (!peerUserId || isNaN(peerUserId)) {
      return sendError(res, 400, 'Invalid user ID.');
    }

    const e2e = require('../lib/e2e');
    const enabled = await e2e.isEnabled(peerUserId, req.apiClient);
    
    return sendOk(res, 200, 'E2E status fetched.', { enabled });
  } catch (err) {
    console.error('[DM] getE2EStatus error:', err);
    return sendError(res, 500, 'Failed to fetch E2E status.');
  }
}

// POST /api/dm/e2e/rotate-keys
async function rotateKeys(req, res) {
  try {
    const userId = req.actorId;
    const e2e = require('../lib/e2e');
    await e2e.rotateMyKeys(userId, req.apiClient);
    return sendOk(res, 200, 'Keys rotated successfully.');
  } catch (err) {
    console.error('[DM] rotateKeys error:', err);
    return sendError(res, 500, 'Failed to rotate keys.');
  }
}

// GET /api/dm/e2e/public-key
async function getPublicKey(req, res) {
  try {
    const userId = req.actorId;
    const keyData = await dmModel.getPublicKey(userId);
    
    if (!keyData) {
      return sendOk(res, 200, 'No public key found.', { publicKey: null });
    }
    
    return sendOk(res, 200, 'Public key fetched.', {
      publicKey: keyData.public_key,
      version: keyData.key_version,
      createdAt: keyData.created_at
    });
  } catch (err) {
    console.error('[DM] getPublicKey error:', err);
    return sendError(res, 500, 'Failed to fetch public key.');
  }
}

// PUT /api/dm/e2e/public-key
async function updatePublicKey(req, res) {
  try {
    const userId = req.actorId;
    const { publicKey, keyVersion } = req.body;

    if (!publicKey) {
      return sendError(res, 400, 'publicKey is required.');
    }

    await dmModel.savePublicKey(userId, publicKey, keyVersion || 1);
    return sendOk(res, 200, 'Public key updated.');
  } catch (err) {
    console.error('[DM] updatePublicKey error:', err);
    return sendError(res, 500, 'Failed to update public key.');
  }
}

// GET /api/dm/e2e/key-versions
async function getKeyVersions(req, res) {
  try {
    const userId = req.actorId;
    const versions = await dmModel.getPublicKeyVersions(userId);
    return sendOk(res, 200, 'Key versions fetched.', { versions });
  } catch (err) {
    console.error('[DM] getKeyVersions error:', err);
    return sendError(res, 500, 'Failed to fetch key versions.');
  }
}

// GET /api/dm/e2e/public-key/:userId
async function getPeerPublicKey(req, res) {
  try {
    const userId = req.actorId;
    const peerUserId = Number(req.params.userId);
    const version = req.query.version ? Number(req.query.version) : null;

    if (!peerUserId || isNaN(peerUserId)) {
      return sendError(res, 400, 'Invalid user ID.');
    }

    const keyData = await dmModel.getPublicKey(peerUserId, version);
    
    if (!keyData) {
      return sendError(res, 404, 'Public key not found.');
    }
    
    return sendOk(res, 200, 'Public key fetched.', {
      publicKey: keyData.public_key,
      version: keyData.key_version,
      createdAt: keyData.created_at
    });
  } catch (err) {
    console.error('[DM] getPeerPublicKey error:', err);
    return sendError(res, 500, 'Failed to fetch public key.');
  }
}

module.exports = {
  getInbox,
  getUnreadCount,
  openConversation,
  getMessages,
  getNewMessages,
  sendMessage,
  uploadMedia,
  markRead,
  heartbeat,
  getPresence,
  getReadStatus,
  editMessage,
  deleteMessage,
  encryptMessage,
  decryptMessage,
  getE2EStatus,
  rotateKeys,
  getPublicKey,
  updatePublicKey,
  getKeyVersions,
  getPeerPublicKey
};