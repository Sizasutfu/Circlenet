// ============================================================
//  models/whisperModel.js
//  All database queries for Anonymous Whispers
// ============================================================

const { db } = require('../config/db');
const crypto = require('crypto');
const sharp = require('sharp');
const { uploadImage } = require('../middleware/upload');

// ─── Configuration (can be moved to a central config) ──────
const IP_HASH_SALT = process.env.IP_HASH_SALT || 'whisper-salt-change-me';
const CARD_IMAGE_WIDTH = 1200;
const PNG_COMPRESSION_LEVEL = 8;

// ─── Helpers ────────────────────────────────────────────────

/**
 * Hash an IP address for privacy (one-way, salted).
 */
function _hashIp(ip) {
  return crypto.createHash('sha256').update(ip + IP_HASH_SALT).digest('hex');
}

// ─── Public Profile & Sending ───────────────────────────────

/**
 * Get recipient's public info + whether they accept whispers.
 * Returns { id, username, name, avatar, whisperEnabled } or null.
 */
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

/**
 * Get recipient ID only if they have whispers enabled.
 * Returns id or null.
 */
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

/**
 * Insert an anonymous message (stores hashed IP).
 * Returns insertId.
 */
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

// ─── Whisper Settings ────────────────────────────────────────

/**
 * Get user's whisper settings.
 * Returns { enabled, link_slug, updated_at } or null.
 */
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

/**
 * Create or update whisper settings (only toggle enabled; slug is immutable).
 * If row doesn't exist, creates with slug = username (or userId fallback).
 */
async function upsertSettings(userId, enabled) {
  // First check if we already have a slug
  let existing = await getUserSettings(userId);
  let linkSlug = existing?.link_slug;

  if (!linkSlug) {
    // First time – generate slug from username
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

// ─── Inbox (Messages) ────────────────────────────────────────

/**
 * Fetch paginated anonymous messages for a user (cursor-based, id DESC).
 * Returns rows (may have one extra for "hasMore" detection).
 */
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

/**
 * Soft delete a message (only recipient can delete).
 * Returns number of affected rows.
 */
async function softDeleteMessage(messageId, userId) {
  const [result] = await db.query(
    `UPDATE anonymous_messages
     SET is_deleted = 1
     WHERE id = ? AND recipient_id = ? AND is_deleted = 0`,
    [messageId, userId]
  );
  return result.affectedRows;
}

/**
 * Report a message (flag for moderation).
 * Returns affected rows.
 */
async function reportMessage(messageId, userId) {
  const [result] = await db.query(
    `UPDATE anonymous_messages
     SET is_reported = 1
     WHERE id = ? AND recipient_id = ? AND is_deleted = 0`,
    [messageId, userId]
  );
  return result.affectedRows;
}

// ─── Post Creation from Whisper (transactional) ─────────────

/**
 * Get a single whisper with row lock (FOR UPDATE) inside a transaction.
 * Used by createPostFromWhisper.
 */
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

/**
 * Link a whisper to a post ID.
 */
async function setWhisperPostedAs(connection, messageId, postId) {
  await connection.query(
    `UPDATE anonymous_messages SET posted_as = ? WHERE id = ?`,
    [postId, messageId]
  );
}

/**
 * Create a new post in the posts table (type = 'whisper').
 * Returns insertId.
 */
async function createPost(connection, userId, text, imageUrl) {
  const [result] = await connection.query(
    `INSERT INTO posts
       (user_id, text, image, post_type, created_at)
     VALUES (?, ?, ?, 'whisper', NOW())`,
    [userId, text, imageUrl]
  );
  return result.insertId;
}

/**
 * Fetch a full post by ID (with author info and empty likes/comments arrays).
 * Returns post object or null.
 */
async function getPostById(connection, postId) {
  const [rows] = await connection.query(
    `SELECT
       p.id, p.text, p.image, p.post_type, p.created_at,
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

/**
 * Main transaction: compress image, upload, create post, link whisper.
 * Returns the full post object.
 * Throws human-readable errors: "Message not found", "Already posted", "Image upload failed".
 */
async function createPostFromWhisper(userId, messageId, text, imageBuffer) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify and lock the whisper
    const whisper = await getWhisperForUpdate(connection, messageId, userId);
    if (!whisper) throw new Error('Message not found');
    if (whisper.posted_as) throw new Error('Already posted');

    // 2. Compress image
    const compressedBuffer = await sharp(imageBuffer)
      .resize({ width: CARD_IMAGE_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: PNG_COMPRESSION_LEVEL })
      .toBuffer();

    const compressedFile = {
      buffer: compressedBuffer,
      originalname: `whisper-${messageId}.png`,
      mimetype: 'image/png',
    };

    // 3. Upload to configured storage (S3, Cloudinary, etc.)
    let imageUrl;
    try {
      imageUrl = await uploadImage(compressedFile);
    } catch (uploadErr) {
      throw new Error('Image upload failed');
    }

    // 4. Create the post
    const postId = await createPost(connection, userId, text, imageUrl);

    // 5. Link whisper to post
    await setWhisperPostedAs(connection, messageId, postId);

    await connection.commit();

    // 6. Fetch and return the full post
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
  // The following are exposed only for potential future use; not required by controller
  // but kept for completeness.
  getWhisperForUpdate,
  setWhisperPostedAs,
  createPost,
  getPostById,
};