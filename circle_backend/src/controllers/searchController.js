// controllers/searchController.js
const { db }                = require('../config/db');
const FollowModel           = require('../models/followModel');
const PostModel             = require('../models/postModel');
const { sendOk, sendError } = require('../middleware/response');
const esService             = require('../services/elasticsearchService');

function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

// GET /api/search?q=<term>&type=posts|people&page=1&limit=20
async function search(req, res) {
  const q = (req.query.q || '').trim();

  const VALID_TYPES = new Set(['posts', 'people']);
  const type = req.query.type;
  if (!VALID_TYPES.has(type))
    return sendError(res, 400, 'Invalid type. Must be "posts" or "people".');

  if (q.length < 2)
    return sendError(res, 400, 'Query must be at least 2 characters.');

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    if (type === 'people') {
      const viewerId = req.actorId ?? null;

      // ── Try Elasticsearch first ──────────────────────────────────────────
      let users;
      try {
        users = await esService.searchPeople(q, { limit, offset });
      } catch (esErr) {
        console.warn('[ES] People search failed, falling back to MySQL:', esErr.message);

        // ── MySQL fallback (your original query) ─────────────────────────
        const like = `%${escapeLike(q)}%`;
        const [rows] = await db.query(
          `SELECT u.id, u.name, u.email, u.picture,
                  COUNT(DISTINCT p.id)          AS postCount,
                  COUNT(DISTINCT f.follower_id) AS followerCount
           FROM users u
           LEFT JOIN posts p   ON p.user_id = u.id AND p.is_repost = 0
           LEFT JOIN follows f ON f.following_id = u.id
           WHERE u.name LIKE ? OR u.email LIKE ?
           GROUP BY u.id
           ORDER BY postCount DESC, u.name ASC
           LIMIT ? OFFSET ?`,
          [like, like, limit, offset]
        );
        users = rows;
      }

      const followingSet = await FollowModel.getFollowingSet(viewerId);
      users.forEach(u => { u.isFollowing = followingSet.has(u.id); });

      return sendOk(res, 200, `${users.length} results.`, users, {
        page, limit, hasMore: users.length === limit,
      });

    } else {
      // ── Try Elasticsearch first ──────────────────────────────────────────
      let posts;
      try {
        posts = await esService.searchPosts(q, { limit, offset });
      } catch (esErr) {
        console.warn('[ES] Posts search failed, falling back to MySQL:', esErr.message);
        posts = await PostModel.searchPosts(q, { limit, offset });
      }

      return sendOk(res, 200, `${posts.length} results.`, posts, {
        page, limit, hasMore: posts.length === limit,
      });
    }

  } catch (err) {
    console.error('search error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── Search History ────────────────────────────────────────────

// GET /api/search/history
async function getHistory(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Unauthorised.');
  try {
    // Delete expired entries for this user first
    await db.query(
      `DELETE FROM search_history
       WHERE user_id = ? AND searched_at < NOW() - INTERVAL 7 DAY`,
      [userId]
    );
    const [rows] = await db.query(
      `SELECT id, query, tab, searched_at
       FROM search_history
       WHERE user_id = ?
       ORDER BY searched_at DESC
       LIMIT 20`,
      [userId]
    );
    return sendOk(res, 200, 'History fetched.', rows);
  } catch (err) {
    console.error('getHistory error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/search/history
async function saveHistory(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Unauthorised.');

  const query = (req.body.query || '').trim();
  const tab   = req.body.tab === 'people' ? 'people' : 'posts';

  if (query.length < 2)
    return sendError(res, 400, 'Query must be at least 2 characters.');

  try {
    await db.query(
      `INSERT INTO search_history (user_id, query, tab, searched_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE searched_at = NOW()`,
      [userId, query, tab]
    );
    return sendOk(res, 200, 'Saved.');
  } catch (err) {
    console.error('saveHistory error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// DELETE /api/search/history/:id  — remove one entry
async function deleteHistoryEntry(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Unauthorised.');
  try {
    await db.query(
      `DELETE FROM search_history WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    return sendOk(res, 200, 'Deleted.');
  } catch (err) {
    console.error('deleteHistoryEntry error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// DELETE /api/search/history  — clear all for user
async function clearHistory(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Unauthorised.');
  try {
    await db.query(
      `DELETE FROM search_history WHERE user_id = ?`,
      [userId]
    );
    return sendOk(res, 200, 'History cleared.');
  } catch (err) {
    console.error('clearHistory error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = { search, getHistory, saveHistory, deleteHistoryEntry, clearHistory };