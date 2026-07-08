// models/CommentModel.js
const { db } = require('../config/db');

// ── Get a single comment with user info ──
async function getCommentById(commentId, userId = null) {
  const [[row]] = await db.query(
    `SELECT c.*, u.name, u.username, u.picture
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [commentId]
  );
  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    postId: row.post_id,
    parentId: row.parent_id,
    user: {
      id: row.user_id,
      name: row.name,
      username: row.username,
      picture: row.picture,
    },
  };
}

// ── Get replies for a comment ──
async function getReplies(commentId, userId = null) {
  const [rows] = await db.query(
    `SELECT c.*, u.name, u.username, u.picture
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.parent_id = ?
     ORDER BY c.created_at ASC`,
    [commentId]
  );
  return rows.map(row => ({
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    postId: row.post_id,
    parentId: row.parent_id,
    user: {
      id: row.user_id,
      name: row.name,
      username: row.username,
      picture: row.picture,
    },
  }));
}

// ── Create a reply (nested comment) ──
async function createReply(userId, parentId, text) {
  // First get the post_id from the parent comment
  const [[parent]] = await db.query(
    `SELECT post_id FROM comments WHERE id = ?`,
    [parentId]
  );
  if (!parent) throw new Error('Parent comment not found');

  const postId = parent.post_id;
  const [result] = await db.query(
    `INSERT INTO comments (post_id, user_id, text, parent_id, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [postId, userId, text, parentId]
  );

  const [[newReply]] = await db.query(
    `SELECT c.*, u.name, u.username, u.picture
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [result.insertId]
  );

  return {
    id: newReply.id,
    text: newReply.text,
    createdAt: newReply.created_at,
    postId: newReply.post_id,
    parentId: newReply.parent_id,
    user: {
      id: newReply.user_id,
      name: newReply.name,
      username: newReply.username,
      picture: newReply.picture,
    },
  };
}

module.exports = { getCommentById, getReplies, createReply };