// controllers/searchController.js
const { db } = require('../config/db');
const FollowModel = require('../models/followModel');
const PostModel = require('../models/postModel');
const GroupModel = require('../models/groupModel');
const { sendOk, sendError } = require('../middleware/response');
const esService = require('../services/elasticsearchService');

function escapeLike(str) {
  if (!str) return '';
  return str.replace(/[%_\\]/g, '\\$&');
}

// ── Internal helper for people search ──────────────────────
async function _searchPeople(q, limit, offset, viewerId = null) {
  const like = `%${escapeLike(q)}%`;
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.username, u.picture, u.verified, u.created_at AS createdAt,
            COUNT(DISTINCT p.id)          AS postCount,
            COUNT(DISTINCT f.follower_id) AS followerCount
     FROM users u
     LEFT JOIN posts p   ON p.user_id = u.id AND p.is_repost = 0
     LEFT JOIN follows f ON f.following_id = u.id
     WHERE u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ?
     GROUP BY u.id
     ORDER BY postCount DESC, u.name ASC
     LIMIT ? OFFSET ?`,
    [like, like, like, parseInt(limit), parseInt(offset)]
  );

  if (viewerId) {
    const followingSet = await FollowModel.getFollowingSet(viewerId);
    rows.forEach(u => { u.isFollowing = followingSet.has(u.id); });
  } else {
    rows.forEach(u => { u.isFollowing = false; });
  }
  return rows;
}

// ── GET /api/search?q=<term>&type=all|posts|people|groups&page=1&limit=20 ──
async function search(req, res) {
  const q = (req.query.q || '').trim();

  const VALID_TYPES = new Set(['all', 'posts', 'people', 'groups']);
  const type = req.query.type || 'all';
  
  if (!VALID_TYPES.has(type)) {
    return sendError(res, 400, 'Invalid type. Must be "all", "posts", "people", or "groups".');
  }

  if (q.length < 2) {
    return sendError(res, 400, 'Query must be at least 2 characters.');
  }

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    // ── PEOPLE ──
    if (type === 'people') {
      const viewerId = req.actorId || null;
      let users;
      try {
        users = await esService.searchPeople(q, { limit, offset });
        if (viewerId && users && users.length) {
          const followingSet = await FollowModel.getFollowingSet(viewerId);
          users.forEach(u => { u.isFollowing = followingSet.has(u.id); });
        }
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
      const groups = await _searchGroups(q, { limit, offset });
      return sendOk(res, 200, `${groups.length} results.`, groups, {
        page, limit, hasMore: groups.length === limit,
      });
    }

    // ── POSTS ──
    if (type === 'posts') {
      let posts;
      try {
        posts = await esService.searchPosts(q, { limit, offset });
        if (posts && posts.length) {
          posts = await PostModel.hydratePosts(posts);
        }
      } catch (esErr) {
        console.warn('[ES] Posts search failed, falling back to MySQL:', esErr.message);
        posts = await _searchPosts(q, { limit, offset });
      }
      return sendOk(res, 200, `${posts.length} results.`, posts, {
        page, limit, hasMore: posts.length === limit,
      });
    }

    // ── ALL ──
    if (type === 'all') {
      const viewerId = req.actorId || null;

      const [posts, people, groups] = await Promise.all([
        _searchPosts(q, { limit: 10, offset: 0 }),
        _searchPeople(q, 10, 0, viewerId),
        _searchGroups(q, { limit: 10, offset: 0 }),
      ]);

      const typedPosts = (posts || []).map(p => ({ 
        ...p, 
        _type: 'post', 
        createdAt: p.createdAt || p.created_at || new Date().toISOString() 
      }));
      const typedPeople = (people || []).map(u => ({ 
        ...u, 
        _type: 'user', 
        createdAt: u.createdAt || u.created_at || new Date().toISOString() 
      }));
      const typedGroups = (groups || []).map(g => ({ 
        ...g, 
        _type: 'group', 
        createdAt: g.createdAt || g.created_at || new Date().toISOString() 
      }));

      const combined = [...typedPosts, ...typedPeople, ...typedGroups]
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });

      const start = offset;
      const end = Math.min(start + limit, combined.length);
      const results = combined.slice(start, end);
      const hasMore = end < combined.length;

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

// ── Helper function for posts search ──────────────────────
async function _searchPosts(q, { limit, offset }) {
  const like = `%${escapeLike(q)}%`;
  const [rows] = await db.query(
    `SELECT p.*, u.name as authorName, u.username as authorUsername, u.picture as authorPicture,
            u.verified as authorVerified,
            (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) as viewCount,
            (SELECT COUNT(*) FROM video_views WHERE post_id = p.id) as videoViewCount
     FROM posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.text LIKE ?
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [like, parseInt(limit), parseInt(offset)]
  );
  return rows;
}

// ── Helper function for groups search ──────────────────────
async function _searchGroups(q, { limit, offset }) {
  const like = `%${escapeLike(q)}%`;
  const [rows] = await db.query(
    `SELECT g.*, 
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as memberCount,
            g.post_count as postCount
     FROM \`groups\` g
     WHERE g.display_name LIKE ? 
        OR g.topic LIKE ? 
        OR g.description LIKE ?
     ORDER BY g.member_count DESC, g.created_at DESC
     LIMIT ? OFFSET ?`,
    [like, like, like, parseInt(limit), parseInt(offset)]
  );
  return rows;
}

// ── GET /api/search/autocomplete?q=<term> ──────────────────────
async function autocomplete(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return sendOk(res, 200, 'Query too short.', []);
  }

  const limit = 5;
  const viewerId = req.actorId || null;

  try {
    const [posts, people, groups] = await Promise.all([
      _searchPosts(q, { limit, offset: 0 }),
      _searchPeople(q, limit, 0, viewerId),
      _searchGroups(q, { limit, offset: 0 }),
    ]);

    const typedPosts = (posts || []).map(p => ({
      ...p,
      _type: 'post',
      preview: p.text ? p.text.slice(0, 60) : 'Post',
      viewCount: p.viewCount || 0,
      videoViewCount: p.videoViewCount || 0,
      createdAt: p.createdAt || p.created_at || new Date().toISOString(),
    }));
    const typedPeople = (people || []).map(u => ({
      ...u,
      _type: 'user',
      preview: u.name || u.username,
      createdAt: u.createdAt || u.created_at || new Date().toISOString(),
    }));
    const typedGroups = (groups || []).map(g => ({
      ...g,
      _type: 'group',
      preview: g.display_name || g.topic || 'Group',
      createdAt: g.createdAt || g.created_at || new Date().toISOString(),
    }));

    const combined = [...typedPosts, ...typedPeople, ...typedGroups];
    const order = { post: 0, user: 1, group: 2 };
    combined.sort((a, b) => {
      const orderA = order[a._type] !== undefined ? order[a._type] : 3;
      const orderB = order[b._type] !== undefined ? order[b._type] : 3;
      return orderA - orderB;
    });

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
  if (!userId) {
    return sendError(res, 401, 'Unauthorized.');
  }
  
  try {
    // Clean old entries (older than 30 days - matching vanilla code)
    await db.query(
      `DELETE FROM search_history
       WHERE user_id = ? AND searched_at < NOW() - INTERVAL 30 DAY`,
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
    console.error('[Search] getHistory error:', err);
    return sendError(res, 500, 'Failed to get history.');
  }
}

// POST /api/search/history - Simplified like vanilla code
async function saveHistory(req, res) {
  const userId = req.actorId;
  if (!userId) {
    return sendError(res, 401, 'Unauthorized.');
  }

  const query = (req.body.query || '').trim();
  const tab = req.body.tab || 'all';
  
  // Validate tab - match vanilla code pattern
  const validTabs = ['all', 'posts', 'people', 'groups'];
  if (!validTabs.includes(tab)) {
    return sendError(res, 400, 'Invalid tab.');
  }

  if (query.length < 2) {
    return sendError(res, 400, 'Query too short.');
  }

  try {
    // Check if entry exists (like vanilla code)
    const [existing] = await db.query(
      `SELECT id FROM search_history 
       WHERE user_id = ? AND query = ? AND tab = ?`,
      [userId, query, tab]
    );
    
    if (existing.length) {
      // Update existing entry
      await db.query(
        `UPDATE search_history SET searched_at = NOW() WHERE id = ?`,
        [existing[0].id]
      );
    } else {
      // Insert new entry
      await db.query(
        `INSERT INTO search_history (user_id, query, tab, searched_at)
         VALUES (?, ?, ?, NOW())`,
        [userId, query, tab]
      );
    }
    
    // Return the updated history list (matching vanilla code)
    const [rows] = await db.query(
      `SELECT id, query, tab, searched_at
       FROM search_history
       WHERE user_id = ?
       ORDER BY searched_at DESC
       LIMIT 20`,
      [userId]
    );
    
    return sendOk(res, 200, 'History saved.', rows);
  } catch (err) {
    console.error('[Search] saveHistory error:', err);
    return sendError(res, 500, 'Failed to save history.');
  }
}

// DELETE /api/search/history/:id
async function deleteHistoryEntry(req, res) {
  const userId = req.actorId;
  if (!userId) {
    return sendError(res, 401, 'Unauthorized.');
  }
  
  const entryId = parseInt(req.params.id);
  if (!entryId || isNaN(entryId) || entryId <= 0) {
    return sendError(res, 400, 'Invalid entry ID.');
  }
  
  try {
    const [result] = await db.query(
      `DELETE FROM search_history WHERE id = ? AND user_id = ?`,
      [entryId, userId]
    );
    
    if (result.affectedRows === 0) {
      return sendError(res, 404, 'Entry not found.');
    }
    
    // Return updated history list
    const [rows] = await db.query(
      `SELECT id, query, tab, searched_at
       FROM search_history
       WHERE user_id = ?
       ORDER BY searched_at DESC
       LIMIT 20`,
      [userId]
    );
    
    return sendOk(res, 200, 'Deleted.', rows);
  } catch (err) {
    console.error('[Search] deleteHistoryEntry error:', err);
    return sendError(res, 500, 'Failed to delete.');
  }
}

// DELETE /api/search/history
async function clearHistory(req, res) {
  const userId = req.actorId;
  if (!userId) {
    return sendError(res, 401, 'Unauthorized.');
  }
  
  try {
    await db.query(
      `DELETE FROM search_history WHERE user_id = ?`,
      [userId]
    );
    
    return sendOk(res, 200, 'History cleared.', []);
  } catch (err) {
    console.error('[Search] clearHistory error:', err);
    return sendError(res, 500, 'Failed to clear history.');
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