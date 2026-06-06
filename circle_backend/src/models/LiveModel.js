// ============================================================
//  models/LiveModel.js
//  Database logic for CircleNet's Live Video feature.
//
//  Sessions are ephemeral: status flips to 'ended' when the
//  host calls POST /api/live/end OR when their socket closes.
//  Chat messages and reactions are never persisted — WS only.
// ============================================================

const { db }  = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// ── Create a new live session ─────────────────────────────
/**
 * @param {number} hostId
 * @param {string} title
 * @returns {Promise<object>}  Full session row with host info
 */
async function createSession(hostId, title) {
  const id = uuidv4();

  await db.query(
    `INSERT INTO live_sessions (id, host_id, title, status, viewer_count, started_at)
     VALUES (?, ?, ?, 'active', 0, NOW())`,
    [id, hostId, title]
  );

  return getSession(id);
}

// ── End a session ─────────────────────────────────────────
/**
 * Sets status → ended, records ended_at.
 * Caller must verify hostId matches before calling.
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}  true if a row was updated
 */
async function endSession(sessionId) {
  const [result] = await db.query(
    `UPDATE live_sessions
     SET status = 'ended', ended_at = NOW()
     WHERE id = ? AND status = 'active'`,
    [sessionId]
  );
  return result.affectedRows > 0;
}

// ── Get all currently active sessions ────────────────────
/**
 * Used by GET /api/live/active to populate feed cards.
 * Joins users table for broadcaster name + avatar.
 *
 * @returns {Promise<object[]>}
 */
async function getActiveSessions() {
  const [rows] = await db.query(
    `SELECT
       s.id              AS sessionId,
       s.title,
       s.viewer_count    AS viewerCount,
       s.started_at      AS startedAt,
       s.host_id         AS hostId,
       u.name            AS broadcasterName,
       u.picture         AS broadcasterAvatar
     FROM live_sessions s
     JOIN users u ON u.id = s.host_id
     WHERE s.status = 'active'
     ORDER BY s.started_at DESC`
  );
  return rows;
}

// ── Get a single session by ID ────────────────────────────
/**
 * Returns null if the session doesn't exist.
 *
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
async function getSession(sessionId) {
  const [[row]] = await db.query(
    `SELECT
       s.id              AS sessionId,
       s.title,
       s.status,
       s.viewer_count    AS viewerCount,
       s.started_at      AS startedAt,
       s.ended_at        AS endedAt,
       s.host_id         AS hostId,
       u.name            AS broadcasterName,
       u.picture         AS broadcasterAvatar
     FROM live_sessions s
     JOIN users u ON u.id = s.host_id
     WHERE s.id = ?`,
    [sessionId]
  );
  return row ?? null;
}

// ── Get a host's current active session (if any) ─────────
/**
 * Used by startSession to prevent duplicate streams per host.
 *
 * @param {number} hostId
 * @returns {Promise<object|null>}
 */
async function getActiveSessionByHost(hostId) {
  const [[row]] = await db.query(
    `SELECT id AS sessionId FROM live_sessions
     WHERE host_id = ? AND status = 'active'
     LIMIT 1`,
    [hostId]
  );
  return row ?? null;
}

// ── Update viewer count ───────────────────────────────────
/**
 * Called from wsServer whenever a viewer joins or leaves.
 * GREATEST(0, …) guards against going negative.
 *
 * @param {string} sessionId
 * @param {number} count  Absolute viewer count (not a delta)
 */
async function setViewerCount(sessionId, count) {
  await db.query(
    `UPDATE live_sessions
     SET viewer_count = GREATEST(0, ?)
     WHERE id = ? AND status = 'active'`,
    [count, sessionId]
  );
}

// ── Get IDs of all users who follow a given user ─────────
/**
 * Used by liveController to fan out live notifications to followers.
 *
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
async function getFollowerIds(userId) {
  const [rows] = await db.query(
    `SELECT follower_id AS id FROM follows WHERE following_id = ?`,
    [userId]
  );
  return rows.map(r => r.id);
}

module.exports = {
  createSession,
  endSession,
  getSession,
  getActiveSessions,
  getActiveSessionByHost,
  getFollowerIds,
  setViewerCount,
};