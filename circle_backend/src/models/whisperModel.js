// models/whisperModel.js
const { db } = require('../config/db');
const crypto = require('crypto');
const sharp = require('sharp');
const { uploadImage } = require('../middleware/upload');

// ─── Configuration ──────────────────────────────────────────────
const IP_HASH_SALT = process.env.IP_HASH_SALT || 'whisper-salt-change-me';
const CARD_IMAGE_WIDTH = 1200;
const PNG_COMPRESSION_LEVEL = 8;

// ─── Helpers ────────────────────────────────────────────────────

function _hashIp(ip) {
  return crypto.createHash('sha256').update(ip + IP_HASH_SALT).digest('hex');
}

// ─── Public Profile & Sending ───────────────────────────────────

async function getRecipientByUsername(username) {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.name, u.picture AS avatar,
            COALESCE(ws.enabled, 0) AS whisperEnabled
     FROM users u
     LEFT JOIN user_whisper_settings ws ON ws.user_id = u.id
     WHERE u.username = ?
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function getEnabledRecipientId(username) {
  const [rows] = await db.query(
    `SELECT u.id
     FROM users u
     JOIN user_whisper_settings ws ON ws.user_id = u.id
     WHERE u.username = ? AND ws.enabled = 1
     LIMIT 1`,
    [username]
  );
  return rows[0]?.id || null;
}

async function insertAnonymousMessage(recipientId, message, senderIp) {
  const hashedIp = _hashIp(senderIp);
  const [result] = await db.query(
    `INSERT INTO anonymous_messages
       (recipient_id, message, sender_ip_hash, is_reported, is_deleted, created_at)
     VALUES (?, ?, ?, 0, 0, NOW())`,
    [recipientId, message, hashedIp]
  );
  return result.insertId;
}

// ─── Whisper Settings ───────────────────────────────────────────

async function getUserSettings(userId) {
  const [rows] = await db.query(
    `SELECT enabled, link_slug, updated_at
     FROM user_whisper_settings
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function upsertSettings(userId, enabled) {
  let existing = await getUserSettings(userId);
  let linkSlug = existing?.link_slug;

  if (!linkSlug) {
    const [userRows] = await db.query(
      "SELECT username FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    linkSlug = userRows[0]?.username || String(userId);
  }

  const [result] = await db.query(
    `INSERT INTO user_whisper_settings (user_id, enabled, link_slug, updated_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = NOW()`,
    [userId, enabled ? 1 : 0, linkSlug]
  );
  return result;
}

// ─── Inbox (Messages) ───────────────────────────────────────────

async function getInboxMessages(userId, limit, cursor) {
  const cursorClause = cursor ? "AND m.id < ?" : "";
  const params = cursor
    ? [userId, cursor, limit + 1]
    : [userId, limit + 1];

  const [rows] = await db.query(
    `SELECT id, message, is_reported, posted_as, created_at
     FROM anonymous_messages
     WHERE recipient_id = ?
       AND is_deleted = 0
       ${cursorClause}
     ORDER BY id DESC
     LIMIT ?`,
    params
  );
  return rows;
}

async function softDeleteMessage(messageId, userId) {
  const [result] = await db.query(
    `UPDATE anonymous_messages
     SET is_deleted = 1
     WHERE id = ? AND recipient_id = ? AND is_deleted = 0`,
    [messageId, userId]
  );
  return result.affectedRows;
}

async function reportMessage(messageId, userId) {
  const [result] = await db.query(
    `UPDATE anonymous_messages
     SET is_reported = 1
     WHERE id = ? AND recipient_id = ? AND is_deleted = 0`,
    [messageId, userId]
  );
  return result.affectedRows;
}

// ─── Post Creation from Whisper (transactional) ─────────────────

async function getWhisperForUpdate(connection, messageId, userId) {
  const [rows] = await connection.query(
    `SELECT id, posted_as
     FROM anonymous_messages
     WHERE id = ? AND recipient_id = ? AND is_deleted = 0
     FOR UPDATE`,
    [messageId, userId]
  );
  return rows[0] || null;
}

async function setWhisperPostedAs(connection, messageId, postId) {
  await connection.query(
    `UPDATE anonymous_messages SET posted_as = ? WHERE id = ?`,
    [postId, messageId]
  );
}

async function createPost(connection, userId, text, imageUrl) {
  // ✅ Removed `post_type` – it doesn't exist in your posts table
  const [result] = await connection.query(
    `INSERT INTO posts
       (user_id, text, image, created_at)
     VALUES (?, ?, ?, NOW())`,
    [userId, text, imageUrl]
  );
  return result.insertId;
}

async function getPostById(connection, postId) {
  // ✅ Removed `post_type` – it doesn't exist in your posts table
  const [rows] = await connection.query(
    `SELECT
       p.id, p.text, p.image, p.created_at,
       u.id AS author_id, u.name AS author, u.username,
       u.picture AS authorPicture,
       0 AS likes_count, 0 AS comments_count
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = ?
     LIMIT 1`,
    [postId]
  );
  if (!rows.length) return null;
  return {
    ...rows[0],
    likes: [],
    comments: [],
    reposts: [],
  };
}

async function createPostFromWhisper(userId, messageId, text, imageBuffer) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const whisper = await getWhisperForUpdate(connection, messageId, userId);
    if (!whisper) throw new Error('Message not found');
    if (whisper.posted_as) throw new Error('Already posted');

    // Compress image
    const compressedBuffer = await sharp(imageBuffer)
      .resize({ width: CARD_IMAGE_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: PNG_COMPRESSION_LEVEL })
      .toBuffer();

    // Upload the image using the shared function (Cloudinary or local)
    const imageUrl = await uploadImage(compressedBuffer, `whisper-${messageId}.png`);

    const postId = await createPost(connection, userId, text, imageUrl);
    await setWhisperPostedAs(connection, messageId, postId);

    await connection.commit();

    const newPost = await getPostById(connection, postId);
    return newPost;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  getRecipientByUsername,
  getEnabledRecipientId,
  insertAnonymousMessage,
  getUserSettings,
  upsertSettings,
  getInboxMessages,
  softDeleteMessage,
  reportMessage,
  createPostFromWhisper,
};