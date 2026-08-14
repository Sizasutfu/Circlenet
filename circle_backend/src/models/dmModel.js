// models/dmModel.js
// All database queries for Direct Messages with E2E encryption support

const { db } = require('../config/db');

// ─── Helpers ────────────────────────────────────────────────

function _orderedPair(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

// ─── Conversations ───────────────────────────────────────────

async function getOrCreateConversation(userIdA, userIdB) {
  const [p1, p2] = _orderedPair(Number(userIdA), Number(userIdB));

  const [rows] = await db.query(
    `SELECT id, participant_one_id, participant_two_id, created_at
     FROM dm_conversations
     WHERE participant_one_id = ? AND participant_two_id = ?`,
    [p1, p2]
  );

  if (rows.length > 0) return rows[0];

  const [result] = await db.query(
    `INSERT INTO dm_conversations (participant_one_id, participant_two_id)
     VALUES (?, ?)`,
    [p1, p2]
  );

  return {
    id: result.insertId,
    participant_one_id: p1,
    participant_two_id: p2,
    created_at: new Date(),
  };
}

async function getInboxForUser(userId) {
  const uid = Number(userId);

  const [rows] = await db.query(
    `SELECT
       c.id,
       c.created_at,
       u.id          AS other_id,
       u.name        AS other_name,
       u.picture     AS other_picture,
       u.verified    AS other_verified,
       lm.body       AS last_message,
       lm.sender_id  AS last_sender_id,
       lm.created_at AS last_message_at,
       lm.media_type AS last_media_type,
       lm.media_url  AS last_media_url,
       lm.is_encrypted AS last_is_encrypted,
       COALESCE(unread.cnt, 0) AS unread_count
     FROM dm_conversations c
     JOIN users u ON u.id = IF(c.participant_one_id = ?, c.participant_two_id, c.participant_one_id)
     LEFT JOIN dm_messages lm ON lm.id = (
       SELECT id FROM dm_messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     )
     LEFT JOIN (
       SELECT conversation_id, COUNT(*) AS cnt
       FROM dm_messages
       WHERE is_read = 0 AND sender_id != ?
       GROUP BY conversation_id
     ) unread ON unread.conversation_id = c.id
     WHERE c.participant_one_id = ? OR c.participant_two_id = ?
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [uid, uid, uid, uid]
  );

  return rows;
}

async function isParticipant(conversationId, userId) {
  const [rows] = await db.query(
    `SELECT id FROM dm_conversations
     WHERE id = ?
       AND (participant_one_id = ? OR participant_two_id = ?)
     LIMIT 1`,
    [conversationId, userId, userId]
  );
  return rows.length > 0;
}

// ─── Messages ────────────────────────────────────────────────

async function getMessages(conversationId, requestingUserId, { limit = 10, beforeId = null } = {}) {
  const convId = Number(conversationId);
  const uid    = Number(requestingUserId);
  const lim    = Math.min(Number(limit) || 10, 100);

  await db.query(
    `UPDATE dm_messages
     SET is_read = 1
     WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
    [convId, uid]
  );

  const conditions = ['m.conversation_id = ?'];
  const params     = [convId];
  if (beforeId) {
    conditions.push('m.id < ?');
    params.push(Number(beforeId));
  }

  const [rows] = await db.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.name        AS sender_name,
       u.picture     AS sender_picture,
       m.body,
       m.media_type,
       m.media_url,
       m.media_thumbnail,
       m.media_name,
       m.media_size,
       m.is_read,
       m.is_encrypted,
       m.created_at,
       m.edited_at
     FROM dm_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [...params, lim + 1]
  );

  const hasMore = rows.length > lim;
  if (hasMore) rows.pop();
  rows.reverse();

  return { messages: rows, hasMore };
}

async function getNewMessages(conversationId, requestingUserId, afterId) {
  const convId = Number(conversationId);
  const uid    = Number(requestingUserId);

  await db.query(
    `UPDATE dm_messages
     SET is_read = 1
     WHERE conversation_id = ? AND sender_id != ? AND is_read = 0 AND id > ?`,
    [convId, uid, Number(afterId)]
  );

  const [rows] = await db.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.name        AS sender_name,
       u.picture     AS sender_picture,
       m.body,
       m.media_type,
       m.media_url,
       m.media_thumbnail,
       m.media_name,
       m.media_size,
       m.is_read,
       m.is_encrypted,
       m.created_at,
       m.edited_at
     FROM dm_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? AND m.id > ?
     ORDER BY m.created_at ASC`,
    [convId, Number(afterId)]
  );

  return rows;
}

async function sendMessage(conversationId, senderId, body, media = null) {
  const convId = Number(conversationId);
  const sid    = Number(senderId);

  let query = `INSERT INTO dm_messages (conversation_id, sender_id, body`;
  let values = [convId, sid, body.trim()];
  let placeholders = ['?', '?', '?'];

  if (media) {
    query += `, media_type, media_url, media_thumbnail, media_name, media_size`;
    values.push(
      media.media_type || 'file',
      media.media_url || null,
      media.media_thumbnail || null,
      media.media_name || null,
      media.media_size || null
    );
    placeholders.push('?', '?', '?', '?', '?');
  }

  query += `) VALUES (${placeholders.join(', ')})`;
  const [result] = await db.query(query, values);

  const [rows] = await db.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.name        AS sender_name,
       u.picture     AS sender_picture,
       m.body,
       m.media_type,
       m.media_url,
       m.media_thumbnail,
       m.media_name,
       m.media_size,
       m.is_read,
       m.is_encrypted,
       m.created_at,
       m.edited_at
     FROM dm_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = ?`,
    [result.insertId]
  );

  return rows[0];
}

async function saveEncryptedMessage(conversationId, senderId, body, media = null, encrypted = false) {
  const convId = Number(conversationId);
  const sid    = Number(senderId);

  let query = `INSERT INTO dm_messages (conversation_id, sender_id, body, is_encrypted`;
  let values = [convId, sid, body.trim(), encrypted ? 1 : 0];
  let placeholders = ['?', '?', '?', '?'];

  if (media) {
    query += `, media_type, media_url, media_thumbnail, media_name, media_size`;
    values.push(
      media.media_type || 'file',
      media.media_url || null,
      media.media_thumbnail || null,
      media.media_name || null,
      media.media_size || null
    );
    placeholders.push('?', '?', '?', '?', '?');
  }

  query += `) VALUES (${placeholders.join(', ')})`;
  const [result] = await db.query(query, values);

  const [rows] = await db.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       u.name        AS sender_name,
       u.picture     AS sender_picture,
       m.body,
       m.media_type,
       m.media_url,
       m.media_thumbnail,
       m.media_name,
       m.media_size,
       m.is_read,
       m.is_encrypted,
       m.created_at,
       m.edited_at
     FROM dm_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = ?`,
    [result.insertId]
  );

  return rows[0];
}

// ─── Presence ────────────────────────────────────────────────

async function touchPresence(userId) {
  await db.query(
    `UPDATE users SET last_seen_at = NOW() WHERE id = ?`,
    [Number(userId)]
  );
}

async function getPresence(conversationId, requestingUserId) {
  const convId = Number(conversationId);
  const uid    = Number(requestingUserId);

  const [rows] = await db.query(
    `SELECT
       u.last_seen_at,
       TIMESTAMPDIFF(SECOND, u.last_seen_at, NOW()) AS seconds_ago
     FROM dm_conversations c
     JOIN users u ON u.id = IF(c.participant_one_id = ?, c.participant_two_id, c.participant_one_id)
     WHERE c.id = ?
     LIMIT 1`,
    [uid, convId]
  );

  if (!rows.length) return { online: false, last_seen_at: null };

  const { last_seen_at, seconds_ago } = rows[0];
  const online = last_seen_at !== null && seconds_ago !== null && seconds_ago < 75;

  let isoString = null;
  if (last_seen_at) {
    if (last_seen_at instanceof Date) {
      isoString = last_seen_at.toISOString();
    } else {
      const s = String(last_seen_at);
      isoString = new Date(
        (s.includes('Z') || s.includes('+')) ? s : s.replace(' ', 'T') + 'Z'
      ).toISOString();
    }
  }

  return { online, last_seen_at: isoString };
}

async function editMessage(messageId, senderId, newBody) {
  const now = new Date();
  const [rows] = await db.query(
    `SELECT id, sender_id, created_at FROM dm_messages WHERE id = ? LIMIT 1`,
    [Number(messageId)]
  );
  if (!rows.length) throw new Error('Message not found.');
  if (rows[0].sender_id !== Number(senderId)) throw new Error('Not your message.');
  const ageMs = now - new Date(rows[0].created_at);
  if (ageMs > 24 * 60 * 60 * 1000) throw new Error('Edit window expired.');

  await db.query(
    `UPDATE dm_messages SET body = ?, edited_at = NOW() WHERE id = ?`,
    [newBody.trim(), Number(messageId)]
  );

  const [updated] = await db.query(
    `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.media_type, m.media_url, 
            m.media_thumbnail, m.media_name, m.media_size, m.is_read, m.is_encrypted,
            m.created_at, m.edited_at
     FROM dm_messages m WHERE m.id = ?`,
    [Number(messageId)]
  );
  return updated[0];
}

async function deleteMessage(messageId, senderId) {
  const [rows] = await db.query(
    `SELECT id, sender_id, created_at, conversation_id FROM dm_messages WHERE id = ? LIMIT 1`,
    [Number(messageId)]
  );
  if (!rows.length) throw new Error('Message not found.');
  if (rows[0].sender_id !== Number(senderId)) throw new Error('Not your message.');
  const ageMs = Date.now() - new Date(rows[0].created_at);
  if (ageMs > 24 * 60 * 60 * 1000) throw new Error('Delete window expired.');

  await db.query(`DELETE FROM dm_messages WHERE id = ?`, [Number(messageId)]);
  return { messageId: rows[0].id, conversationId: rows[0].conversation_id };
}

async function getTotalUnreadCount(userId) {
  const uid = Number(userId);

  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM dm_messages m
     JOIN dm_conversations c ON c.id = m.conversation_id
     WHERE m.is_read = 0
       AND m.sender_id != ?
       AND (c.participant_one_id = ? OR c.participant_two_id = ?)`,
    [uid, uid, uid]
  );

  return rows[0]?.total || 0;
}

async function markConversationRead(conversationId, userId) {
  await db.query(
    `UPDATE dm_messages
     SET is_read = 1
     WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
    [conversationId, userId]
  );
}

async function getReadStatus(messageIds) {
  if (!messageIds || !messageIds.length) return [];
  const ids = messageIds.map(Number).filter(Boolean);
  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id FROM dm_messages WHERE id IN (${placeholders}) AND is_read = 1`,
    ids
  );
  return rows.map(r => r.id);
}

async function getOtherParticipant(conversationId, userId) {
  const [rows] = await db.query(
    `SELECT IF(participant_one_id = ?, participant_two_id, participant_one_id) AS other_id
     FROM dm_conversations
     WHERE id = ?
       AND (participant_one_id = ? OR participant_two_id = ?)
     LIMIT 1`,
    [Number(userId), Number(conversationId), Number(userId), Number(userId)]
  );
  return rows[0]?.other_id ?? null;
}

// ─── E2E Key Management ──────────────────────────────────────

async function savePublicKey(userId, publicKey, keyVersion = 1) {
  // Save to key history
  await db.query(
    `INSERT INTO user_key_history (user_id, public_key, key_version, created_at)
     VALUES (?, ?, ?, NOW())`,
    [Number(userId), publicKey, Number(keyVersion)]
  );
  
  // Update user's current key
  await db.query(
    `UPDATE users SET public_key = ?, key_version = ?, key_updated_at = NOW()
     WHERE id = ?`,
    [publicKey, Number(keyVersion), Number(userId)]
  );
}

async function getPublicKey(userId, version = null) {
  let query = `SELECT public_key, key_version, created_at FROM user_key_history WHERE user_id = ?`;
  const params = [Number(userId)];
  
  if (version) {
    query += ` AND key_version = ? ORDER BY created_at DESC LIMIT 1`;
    params.push(Number(version));
  } else {
    query += ` ORDER BY key_version DESC, created_at DESC LIMIT 1`;
  }
  
  const [rows] = await db.query(query, params);
  return rows[0] || null;
}

async function getPublicKeyVersions(userId) {
  const [rows] = await db.query(
    `SELECT key_version, created_at FROM user_key_history 
     WHERE user_id = ? ORDER BY key_version DESC`,
    [Number(userId)]
  );
  return rows;
}

module.exports = {
  getOrCreateConversation,
  getInboxForUser,
  isParticipant,
  getMessages,
  getNewMessages,
  sendMessage,
  saveEncryptedMessage,
  getTotalUnreadCount,
  markConversationRead,
  touchPresence,
  getPresence,
  getReadStatus,
  getOtherParticipant,
  editMessage,
  deleteMessage,
  savePublicKey,
  getPublicKey,
  getPublicKeyVersions
};