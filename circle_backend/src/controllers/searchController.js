// controllers/searchController.js
const { db }                = require('../config/db');
const FollowModel           = require('../models/followModel');
const PostModel             = require('../models/postModel');
const GroupModel            = require('../models/groupModel');
const { sendOk, sendError } = require('../middleware/response');
const esService             = require('../services/elasticsearchService');

function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

// ── Internal helper for people search ──────────────────────
async function _searchPeople(q, limit, offset, viewerId = null) {
  const like = `%${escapeLike(q)}%`;
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.picture, u.created_at AS createdAt,
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

  if (viewerId) {
    const followingSet = await FollowModel.getFollowingSet(viewerId);
    rows.forEach(u => { u.isFollowing = followingSet.has(u.id); });
  } else {
    rows.forEach(u => { u.isFollowing = false; });
  }
  return rows;
}

// GET /api/search?q=<term>&type=all|posts|people|groups&page=1&limit=20
async function search(req, res) {
  const q = (req.query.q || '').trim();

  const VALID_TYPES = new Set(['all', 'posts', 'people', 'groups']);
  const type = req.query.type;
  if (!VALID_TYPES.has(type))
    return sendError(res, 400, 'Invalid type. Must be "all", "posts", "people", or "groups".');

  if (q.length < 2)
    return sendError(res, 400, 'Query must be at least 2 characters.');

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    // ── PEOPLE ──
    if (type === 'people') {
      const viewerId = req.actorId ?? null;
      let users;
      try {
        users = await esService.searchPeople(q, { limit, offset });
      } catch (esErr) {
        console.warn('[ES] People search failed, falling back to MySQL:', esErr.message);
        users = await _searchPeople(q, limit, offset, viewerId);
      }
      return sendOk(res, 200, `${users.length} results.`, users, {
        page, limit, hasMore: users.length === limit,
      });
    }

    // ── GROUPS ──
    if (type === 'groups') {
      const groups = await GroupModel.searchGroups(q, { limit, offset });
      return sendOk(res, 200, `${groups.length} results.`, groups, {
        page, limit, hasMore: groups.length === limit,
      });
    }

    // ── POSTS ──
    if (type === 'posts') {
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

    // ── ALL ──
    if (type === 'all') {
      const viewerId = req.actorId ?? null;

      const [posts, people, groups] = await Promise.all([
        PostModel.searchPosts(q, { limit, offset }),
        _searchPeople(q, limit, offset, viewerId),
        GroupModel.searchGroups(q, { limit, offset }),
      ]);

      const typedPosts = posts.map(p => ({ ...p, _type: 'post' }));
      const typedPeople = people.map(u => ({ ...u, _type: 'user' }));
      const typedGroups = groups.map(g => ({ ...g, _type: 'group' }));

      const combined = [...typedPosts, ...typedPeople, ...typedGroups]
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });

      const results = combined.slice(0, limit);
      const hasMore = combined.length > limit;

      return sendOk(res, 200, `${results.length} combined results.`, results, {
        page, limit, hasMore,
      });
    }

    return sendError(res, 400, 'Invalid type.');
  } catch (err) {
    console.error('search error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/search/autocomplete?q=<term> ──────────────────────
// Returns up to 5 posts, 5 users, 5 groups that match the query.
async function autocomplete(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return sendOk(res, 200, 'Query too short.', []);
  }

  const limit = 5;
  const viewerId = req.actorId ?? null;

  try {
    const [posts, people, groups] = await Promise.all([
      PostModel.searchPosts(q, { limit, offset: 0 }),
      _searchPeople(q, limit, 0, viewerId),
      GroupModel.searchGroups(q, { limit, offset: 0 }),
    ]);

    const typedPosts = posts.map(p => ({
      ...p,
      _type: 'post',
      preview: p.text ? p.text.slice(0, 60) : 'Post',
    }));
    const typedPeople = people.map(u => ({
      ...u,
      _type: 'user',
      preview: u.name,
    }));
    const typedGroups = groups.map(g => ({
      ...g,
      _type: 'group',
      preview: g.displayName || g.topic,
    }));

    const combined = [...typedPosts, ...typedPeople, ...typedGroups];
    const order = { post: 0, user: 1, group: 2 };
    combined.sort((a, b) => (order[a._type] || 0) - (order[b._type] || 0));

    const results = combined.slice(0, 15);

    return sendOk(res, 200, 'Autocomplete results.', results);
  } catch (err) {
    console.error('autocomplete error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── Search History ────────────────────────────────────────────

// GET /api/search/history
async function getHistory(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Unauthorised.');
  try {
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
  const tab   = req.body.tab === 'people' ? 'people' : req.body.tab === 'groups' ? 'groups' : req.body.tab === 'all' ? 'all' : 'posts';

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

module.exports = {
  search,
  autocomplete,
  getHistory,
  saveHistory,
  deleteHistoryEntry,
  clearHistory,
};