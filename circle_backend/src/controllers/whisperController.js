// ============================================================
//  controllers/whisperController.js
//  Handles all Anonymous Whisper HTTP requests.
//  Real-time delivery (if needed) can be added via wsServer.
// ============================================================

const WhisperModel = require('../models/whisperModel');
const { sendOk, sendError } = require('../middleware/response');
// const { notifyUser } = require('../../wsServer'); // optional for future

// ─── GET /api/whisper/profile/:username ─────────────────────────
async function getProfile(req, res) {
  try {
    const { username } = req.params;
    const user = await WhisperModel.getRecipientByUsername(username);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }
    return sendOk(res, 200, 'Profile fetched.', {
      username: user.username,
      name: user.name,
      avatar: user.avatar || null,
      whisperEnabled: !!user.whisperEnabled,
    });
  } catch (err) {
    console.error('[Whisper] getProfile error:', err);
    return sendError(res, 500, 'Failed to fetch profile.');
  }
}

// ─── POST /api/whisper/send/:username ───────────────────────────
async function sendMessage(req, res) {
  try {
    const { username } = req.params;
    let { message } = req.body;

    if (!message || typeof message !== 'string') {
      return sendError(res, 400, 'Message is required.');
    }
    message = message.trim();
    if (message.length < 1) {
      return sendError(res, 400, 'Message cannot be empty.');
    }
    if (message.length > 500) {
      return sendError(res, 400, 'Message too long (max 500 characters).');
    }

    const recipientId = await WhisperModel.getEnabledRecipientId(username);
    if (!recipientId) {
      return sendError(res, 404, 'User not found or not accepting messages.');
    }

    const senderIp = req.ip;
    await WhisperModel.insertAnonymousMessage(recipientId, message, senderIp);
    return sendOk(res, 200, 'Message sent.');
  } catch (err) {
    console.error('[Whisper] sendMessage error:', err);
    return sendError(res, 500, 'Failed to send message.');
  }
}

// ─── GET /api/whisper/settings ──────────────────────────────────
async function getSettings(req, res) {
  console.log('[Whisper] actorId:', req.actorId);
 
  try {
    const userId = req.actorId;
    let settings = await WhisperModel.getUserSettings(userId);
   
    console.log('[Whisper] raw settings:', settings);

    if (!settings) {
      await WhisperModel.upsertSettings(userId, false);
      settings = await WhisperModel.getUserSettings(userId);
    }

    return sendOk(res, 200, 'Settings fetched.', {
      enabled: !!settings.enabled,
      link_slug: settings.link_slug,
    });
  } catch (err) {
    console.error('[Whisper] getSettings error:', err);
    return sendError(res, 500, 'Failed to fetch settings.');
  }
}


// ─── PATCH /api/whisper/settings ────────────────────────────────
async function updateSettings(req, res) {
  try {
    console.log('[Whisper] body.enabled:', req.body.enabled, typeof req.body.enabled);
    const userId = req.actorId;
    const enabled = Boolean(req.body.enabled);
    await WhisperModel.upsertSettings(userId, enabled);
    return sendOk(res, 200, 'Settings updated.', { enabled });
  } catch (err) {
    console.error('[Whisper] updateSettings error:', err);
    return sendError(res, 500, 'Failed to update settings.');
  }
}

// ─── GET /api/whisper/inbox ─────────────────────────────────────
async function getInbox(req, res) {
  try {
    const userId = req.actorId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor ? parseInt(req.query.cursor) : null;

    const rows = await WhisperModel.getInboxMessages(userId, limit, cursor);
    const hasMore = rows.length > limit;
    const messages = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    return sendOk(res, 200, 'Inbox fetched.', {
      messages: messages.map(m => ({
        id: m.id,
        message: m.message,
        is_reported: !!m.is_reported,
        posted_as: m.posted_as || null,
        created_at: m.created_at,
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error('[Whisper] getInbox error:', err);
    return sendError(res, 500, 'Failed to fetch inbox.');
  }
}

// ─── DELETE /api/whisper/:id ────────────────────────────────────
async function deleteMessage(req, res) {
  try {
    const userId = req.actorId;
    const messageId = parseInt(req.params.id);
    const affected = await WhisperModel.softDeleteMessage(messageId, userId);
    if (affected === 0) {
      return sendError(res, 404, 'Message not found.');
    }
    return sendOk(res, 200, 'Message deleted.');
  } catch (err) {
    console.error('[Whisper] deleteMessage error:', err);
    return sendError(res, 500, 'Failed to delete message.');
  }
}

// ─── POST /api/whisper/:id/report ───────────────────────────────
async function reportMessage(req, res) {
  try {
    const userId = req.actorId;
    const messageId = parseInt(req.params.id);
    const affected = await WhisperModel.reportMessage(messageId, userId);
    if (affected === 0) {
      return sendError(res, 404, 'Message not found.');
    }
    return sendOk(res, 200, 'Message reported.');
  } catch (err) {
    console.error('[Whisper] reportMessage error:', err);
    return sendError(res, 500, 'Failed to report message.');
  }
}

// ─── POST /api/whisper/:id/post ─────────────────────────────────
// Accepts multipart image + text; creates a post from the whisper.
async function createPostFromWhisper(req, res) {
  try {
    const userId = req.actorId;
    const messageId = parseInt(req.params.id);
    const text = (req.body.text || '').trim();

    if (!text) {
      return sendError(res, 400, 'Reply text is required.');
    }
    if (!req.file) {
      return sendError(res, 400, 'Card image is required.');
    }

    const newPost = await WhisperModel.createPostFromWhisper(
      userId,
      messageId,
      text,
      req.file.buffer
    );

    return sendOk(res, 201, 'Post created from whisper.', newPost);
  } catch (err) {
    // Handle specific business errors
    if (err.message === 'Message not found') {
      return sendError(res, 404, err.message);
    }
    if (err.message === 'Already posted') {
      return sendError(res, 409, err.message);
    }
    if (err.message === 'Image upload failed') {
      return sendError(res, 500, err.message);
    }
    console.error('[Whisper] createPostFromWhisper error:', err);
    return sendError(res, 500, 'Failed to create post from whisper.');
  }
}

module.exports = {
  getProfile,
  sendMessage,
  getSettings,
  updateSettings,
  getInbox,
  deleteMessage,
  reportMessage,
  createPostFromWhisper,
};