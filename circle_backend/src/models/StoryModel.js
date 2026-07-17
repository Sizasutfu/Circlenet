// models/StoryModel.js
const { db } = require('../config/db');

const StoryModel = {

  // ── Create a story ──────────────────────────────────────
  async createStory(userId, text, image, video) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [result] = await db.query(
      `INSERT INTO stories (user_id, text, image, video, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, text || null, image || null, video || null, expiresAt]
    );
    return result.insertId;
  },

  // ── Get active stories for a specific user ─────────────
  async getActiveStoriesForUser(userId) {
    const [rows] = await db.query(
      `SELECT id, user_id, text, image, video, created_at
       FROM stories
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  // ── Get active stories for multiple users (e.g., followed users) ──
  async getActiveStoriesByUsers(userIds, limit = 10) {
    if (!userIds.length) return [];
    const ph = userIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT s.id, s.user_id, s.text, s.image, s.video, s.created_at,
              u.name AS author, u.picture AS authorPicture
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id IN (${ph}) AND s.expires_at > NOW()
       ORDER BY s.created_at DESC
       LIMIT ?`,
      [...userIds, limit]
    );
    return rows;
  },

  // ── Get a single story by ID (with author info) ────────
  async getStoryById(storyId) {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS author, u.picture AS authorPicture
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > NOW()`,
      [storyId]
    );
    return rows[0] || null;
  },

  // ── Delete a story (only if owned by user) ─────────────
  async deleteStory(storyId, userId) {
    const [result] = await db.query(
      'DELETE FROM stories WHERE id = ? AND user_id = ?',
      [storyId, userId]
    );
    return result.affectedRows > 0;
  },

  // ── Clean expired stories (cron job) ───────────────────
  async deleteExpiredStories() {
    const [result] = await db.query('DELETE FROM stories WHERE expires_at <= NOW()');
    return result.affectedRows;
  },
};

module.exports = StoryModel;