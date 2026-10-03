// ============================================================
//  models/trackModel.js
//  All database queries for music tracks.
// ============================================================

const { db } = require('../config/db');

async function create({ userId, title, artist, fileName, mimeType, sizeBytes, durationSec }) {
  const [result] = await db.query(
    `INSERT INTO tracks
       (user_id, title, artist, file_name, mime_type, size_bytes, duration_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, title, artist || null, fileName, mimeType, sizeBytes, durationSec || null]
  );
  return result.insertId;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM tracks WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Newest first. Fetches limit + 1 rows so the caller can tell if there is a next page.
async function list({ userId = null, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = '';

  if (userId) {
    where = 'WHERE user_id = ?';
    params.push(userId);
  }

  params.push(limit + 1, offset);

  const [rows] = await db.query(
    `SELECT * FROM tracks ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    params
  );

  const hasMore = rows.length > limit;
  return { tracks: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

async function incrementPlayCount(id) {
  await db.query('UPDATE tracks SET play_count = play_count + 1 WHERE id = ?', [id]);
}

async function remove(id) {
  await db.query('DELETE FROM tracks WHERE id = ?', [id]);
}

module.exports = { create, getById, list, incrementPlayCount, remove };