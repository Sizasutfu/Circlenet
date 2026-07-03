// ============================================================
//  controllers/whisperController.js
//  Handles all Anonymous Whisper HTTP requests.
// ============================================================

const crypto = require('crypto');
const { db } = require('../config/db');
const WhisperModel = require('../models/whisperModel');
const { sendOk, sendError } = require('../middleware/response');

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

// ─── GET /api/whisper/profile-by-slug/:slug ─────────────────────
async function getProfileBySlug(req, res) {
  try {
    const { slug } = req.params;
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.name, u.picture AS avatar,
              COALESCE(ws.enabled, 0) AS whisperEnabled
       FROM user_whisper_settings ws
       JOIN users u ON u.id = ws.user_id
       WHERE ws.link_slug = ?
       LIMIT 1`,
      [slug]
    );
    if (!rows.length) {
      return sendError(res, 404, 'User not found.');
    }
    const user = rows[0];
    return sendOk(res, 200, 'Profile fetched.', {
      username: user.username,
      name: user.name,
      avatar: user.avatar || null,
      whisperEnabled: !!user.whisperEnabled,
    });
  } catch (err) {
    console.error('[Whisper] getProfileBySlug error:', err);
    return sendError(res, 500, 'Failed to fetch profile.');
  }
}

// ─── POST /api/whisper/send-by-slug/:slug ────────────────────────
async function sendMessageBySlug(req, res) {
  try {
    const { slug } = req.params;
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

    const [rows] = await db.query(
      `SELECT ws.user_id
       FROM user_whisper_settings ws
       WHERE ws.link_slug = ? AND ws.enabled = 1
       LIMIT 1`,
      [slug]
    );
    if (!rows.length) {
      return sendError(res, 404, 'User not found or not accepting messages.');
    }
    const recipientId = rows[0].user_id;

    const senderIp = req.ip;
    await WhisperModel.insertAnonymousMessage(recipientId, message, senderIp);
    return sendOk(res, 200, 'Message sent.');
  } catch (err) {
    console.error('[Whisper] sendMessageBySlug error:', err);
    return sendError(res, 500, 'Failed to send message.');
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
  try {
    const userId = req.actorId;
    let settings = await WhisperModel.getUserSettings(userId);

    if (!settings) {
      // No settings row – create one with a new UUID slug
      const newSlug = crypto.randomUUID();
      await WhisperModel.upsertSettings(userId, false, newSlug);
      settings = await WhisperModel.getUserSettings(userId);
    } else if (!settings.link_slug) {
      // Row exists but slug is null – generate and update
      const newSlug = crypto.randomUUID();
      await db.query(
        `UPDATE user_whisper_settings SET link_slug = ? WHERE user_id = ?`,
        [newSlug, userId]
      );
      settings.link_slug = newSlug;
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
    const userId = req.actorId;
    const enabled = Boolean(req.body.enabled);
    await WhisperModel.upsertSettings(userId, enabled);
    return sendOk(res, 200, 'Settings updated.', { enabled });
  } catch (err) {
    console.error('[Whisper] updateSettings error:', err);
    return sendError(res, 500, 'Failed to update settings.');
  }
}

// ─── POST /api/whisper/settings/regenerate-slug ──────────────────────
async function regenerateSlug(req, res) {
  try {
    const userId = req.actorId;
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const newSlug = crypto.randomUUID();

    const [updateResult] = await db.query(
      `UPDATE user_whisper_settings SET link_slug = ?, updated_at = NOW() WHERE user_id = ?`,
      [newSlug, userId]
    );

    if (updateResult.affectedRows === 0) {
      // No row existed – insert one (enabled default false)
      await db.query(
        `INSERT INTO user_whisper_settings (user_id, enabled, link_slug, updated_at)
         VALUES (?, 0, ?, NOW())`,
        [userId, newSlug]
      );
    }

    return sendOk(res, 200, 'Slug regenerated.', { link_slug: newSlug });
  } catch (err) {
    console.error('[Whisper] regenerateSlug error:', err);
    return sendError(res, 500, 'Failed to regenerate slug.');
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
async function createPostFromWhisper(req, res) {
  try {
    const userId = req.actorId || req.userId;
    console.log('[Whisper] createPostFromWhisper - userId:', userId);
    console.log('[Whisper] req.file:', req.file);
    console.log('[Whisper] req.body.text:', req.body.text);

    if (!userId) {
      return sendError(res, 401, 'You must be logged in to do that.');
    }

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
  regenerateSlug,
  getInbox,
  deleteMessage,
  reportMessage,
  createPostFromWhisper,
  getProfileBySlug,
  sendMessageBySlug,
};