const { db } = require('../config/db');

async function getLatestRequest(userId) {
  const [rows] = await db.query(
    `SELECT id, full_name AS fullName, category, reason, links, email,
            status, admin_note AS adminNote,
            reviewed_at AS reviewedAt, created_at AS createdAt
     FROM verification_requests
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getPendingRequest(userId) {
  const [rows] = await db.query(
    `SELECT id FROM verification_requests
     WHERE user_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function createRequest(userId, { fullName, category, reason, links, email }) {
  const [result] = await db.query(
    `INSERT INTO verification_requests
       (user_id, full_name, category, reason, links, email)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, fullName, category, reason, links, email]
  );
  return result.insertId;
}

async function getRequestById(id) {
  const [rows] = await db.query(
    `SELECT r.*, u.username, u.name AS userName, u.email AS userEmail, u.picture
     FROM verification_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function listRequests(status = 'pending', page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(
    `SELECT r.id, r.user_id AS userId, r.full_name AS fullName,
            r.category, r.reason, r.links, r.email,
            r.status, r.admin_note AS adminNote,
            r.reviewed_at AS reviewedAt, r.created_at AS createdAt,
            u.username, u.name AS userName, u.email AS userEmail, u.picture
     FROM verification_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.status = ?
     ORDER BY r.created_at ASC
     LIMIT ? OFFSET ?`,
    [status, limit, offset]
  );

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM verification_requests WHERE status = ?',
    [status]
  );

  return { requests: rows, total, page, limit };
}

async function reviewRequest(id, status, adminId, adminNote) {
  await db.query(
    `UPDATE verification_requests
     SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [status, adminNote, adminId, id]
  );
}

module.exports = {
  getLatestRequest,
  getPendingRequest,
  createRequest,
  getRequestById,
  listRequests,
  reviewRequest,
};