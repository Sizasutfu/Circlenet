// models/commentModel.js
const { db } = require('../config/db');

// ── Get a single comment with user info ──
async function getCommentById(commentId, userId = null) {
  const [[row]] = await db.query(
    `SELECT c.*, u.name, u.username, u.picture, u.verified
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
      avatar: row.picture,       // alias so clients expecting `avatar` work
      verified: !!row.verified,
    },
  };
}

// ── Get direct replies for a comment ──
async function getReplies(commentId, userId = null) {
  const [rows] = await db.query(
    `SELECT c.*, u.name, u.username, u.picture, u.verified
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
      avatar: row.picture,
      verified: !!row.verified,
    },
  }));
}

// ── Create a reply (nested comment) ──
async function createReply(userId, parentId, text) {
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
    `SELECT c.*, u.name, u.username, u.picture, u.verified
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
      avatar: newReply.picture,
      verified: !!newReply.verified,
    },
  };
}

// ── Get all comments for a post (flat list with user data) ──
async function getCommentsByPostId(postId) {
  const [rows] = await db.query(
    `SELECT c.*, u.name, u.username, u.picture, u.verified
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [postId]
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
      avatar: row.picture,
      verified: !!row.verified,
    },
  }));
}

// ── Nest a flat list of comments into a parent → replies tree ──
// Pure function — no DB access. Each comment is expected to have
// `id` and `parentId` fields. Any comment whose parentId is null
// or points to a missing comment becomes a root.
function nestComments(flatComments) {
  const byId = {};
  const roots = [];

  // First pass: index by ID
  flatComments.forEach(c => {
    byId[String(c.id)] = { ...c, replies: [] };
  });

  // Second pass: link children to parents
  Object.values(byId).forEach(c => {
    const pid = c.parentId != null ? String(c.parentId) : null;
    if (pid && byId[pid]) {
      byId[pid].replies.push(c);
    } else {
      roots.push(c);
    }
  });

  return roots;
}

module.exports = {
  getCommentById,
  getReplies,
  createReply,
  getCommentsByPostId,
  nestComments,
};