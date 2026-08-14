// ============================================================
//  models/GroupModel.js
//  Database logic for Circle's auto-created topic groups.
// ============================================================

const { db } = require('../config/db');
const cron   = require('node-cron');

// ── Thresholds (tune here) ─────────────────────────────────
const MIN_POSTS_TO_CREATE = 30;
const CRON_SCHEDULE       = '0 * * * *';

// ── Pause control for production ──────────────────────────
const isGroupCreationPaused = () => {
  return process.env.NODE_ENV === 'production';
};

// ── Auto-creation cron ────────────────────────────────────
async function runGroupCreationCron() {
  if (isGroupCreationPaused()) {
    return [];
  }

  try {
    const [rows] = await db.query(
      `SELECT v.topic, v.post_count_7d
       FROM v_topic_post_counts_7d v
       LEFT JOIN \`groups\` g ON g.topic = v.topic
       WHERE v.post_count_7d >= ?
         AND g.id IS NULL`,
      [MIN_POSTS_TO_CREATE]
    );

    if (!rows.length) return [];

    const created = [];

    for (const row of rows) {
      const topic       = row.topic.toLowerCase().trim();
      const displayName = `#${topic}`;
      const description = `Conversations about #${topic} — join to see posts from members on this topic.`;

      const [result] = await db.query(
        `INSERT IGNORE INTO \`groups\` (topic, display_name, description, post_count)
         VALUES (?, ?, ?, ?)`,
        [topic, displayName, description, row.post_count_7d]
      );

      if (result.affectedRows > 0) {
        created.push(topic);
      }
    }

    await db.query(
      `UPDATE \`groups\` g
       JOIN v_topic_post_counts_7d v ON v.topic = g.topic
       SET g.post_count = v.post_count_7d`
    );

    return created;
  } catch (err) {
    console.error('[GroupModel] runGroupCreationCron error:', err);
    return [];
  }
}

function startGroupCron() {
  if (isGroupCreationPaused()) {
    return;
  }

  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runGroupCreationCron();
    } catch (err) {
      console.error('[GroupCron] Error during group creation check:', err);
    }
  });

  runGroupCreationCron().catch(err => {
    console.error('[GroupCron] Startup run failed:', err);
  });
}

// ── Fetch a paginated list of groups (Explore) ────────────
async function getTrendingGroups({ limit = 20, offset = 0, userId = null } = {}) {
  limit  = Math.min(50, Math.max(1, limit));
  offset = Math.max(0, offset);

  try {
    if (userId) {
      const [rows] = await db.query(
        `SELECT
           g.id,
           g.topic,
           g.display_name  AS displayName,
           g.description,
           g.cover_image   AS coverImage,
           g.member_count  AS memberCount,
           g.post_count    AS postCount,
           g.created_at    AS createdAt,
           IF(gm.user_id IS NOT NULL, 1, 0) AS isMember
         FROM \`groups\` g
         LEFT JOIN group_members gm
           ON gm.group_id = g.id AND gm.user_id = ?
         ORDER BY g.member_count DESC, g.post_count DESC
         LIMIT ? OFFSET ?`,
        [userId, limit + 1, offset]
      );
      const hasMore = rows.length > limit;
      return { groups: rows.slice(0, limit).map(normalise), hasMore };
    }

    const [rows] = await db.query(
      `SELECT
         id,
         topic,
         display_name  AS displayName,
         description,
         cover_image   AS coverImage,
         member_count  AS memberCount,
         post_count    AS postCount,
         created_at    AS createdAt,
         0             AS isMember
       FROM \`groups\`
       ORDER BY member_count DESC, post_count DESC
       LIMIT ? OFFSET ?`,
      [limit + 1, offset]
    );
    const hasMore = rows.length > limit;
    return { groups: rows.slice(0, limit).map(normalise), hasMore };
  } catch (err) {
    console.error('getTrendingGroups error:', err);
    throw err;
  }
}

// ── Get a single group by topic slug ─────────────────────
async function getGroupByTopic(topic, userId = null) {
  topic = topic.toLowerCase().trim();

  try {
    if (userId) {
      const [[row]] = await db.query(
        `SELECT
           g.id,
           g.topic,
           g.display_name  AS displayName,
           g.description,
           g.cover_image   AS coverImage,
           g.member_count  AS memberCount,
           g.post_count    AS postCount,
           g.created_at    AS createdAt,
           IF(gm.user_id IS NOT NULL, 1, 0) AS isMember
         FROM \`groups\` g
         LEFT JOIN group_members gm
           ON gm.group_id = g.id AND gm.user_id = ?
         WHERE g.topic = ?`,
        [userId, topic]
      );
      return row ? normalise(row) : null;
    }

    const [[row]] = await db.query(
      `SELECT
         id, topic,
         display_name AS displayName, description,
         cover_image  AS coverImage,
         member_count AS memberCount,
         post_count   AS postCount,
         created_at   AS createdAt,
         0            AS isMember
       FROM \`groups\` WHERE topic = ?`,
      [topic]
    );
    return row ? normalise(row) : null;
  } catch (err) {
    console.error('getGroupByTopic error:', err);
    throw err;
  }
}

// ── Get a single group by id ──────────────────────────────
async function getGroupById(groupId, userId = null) {
  try {
    if (userId) {
      const [[row]] = await db.query(
        `SELECT 
           g.id, 
           g.topic, 
           g.display_name AS displayName, 
           g.description,
           g.cover_image AS coverImage, 
           g.member_count AS memberCount,
           g.post_count AS postCount, 
           g.created_at AS createdAt,
           IF(gm.user_id IS NOT NULL, 1, 0) AS isMember
         FROM \`groups\` g
         LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
         WHERE g.id = ?`,
        [userId, groupId]
      );
      return row ? normalise(row) : null;
    }

    const [[row]] = await db.query(
      `SELECT 
         id, 
         topic, 
         display_name AS displayName, 
         description,
         cover_image AS coverImage, 
         member_count AS memberCount,
         post_count AS postCount, 
         created_at AS createdAt,
         0 AS isMember
       FROM \`groups\` WHERE id = ?`,
      [groupId]
    );
    return row ? normalise(row) : null;
  } catch (err) {
    console.error('getGroupById error:', err);
    throw err;
  }
}

// ── Join a group (explicit opt-in only) ──────────────────
async function joinGroup(userId, groupId) {
  let connection;
  
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
      [groupId, userId]
    );

    if (existing.length > 0) {
      await connection.commit();
      connection.release();
      return false;
    }

    const [result] = await connection.query(
      `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`,
      [groupId, userId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return false;
    }

    const [updateResult] = await connection.query(
      `UPDATE \`groups\` SET member_count = member_count + 1 WHERE id = ?`,
      [groupId]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return false;
    }

    await connection.commit();
    connection.release();
    return true;
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('joinGroup error:', err);
    throw err;
  }
}

// ── Leave a group ─────────────────────────────────────────
async function leaveGroup(userId, groupId) {
  let connection;
  
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
      [groupId, userId]
    );

    if (existing.length === 0) {
      await connection.commit();
      connection.release();
      return false;
    }

    const [result] = await connection.query(
      `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return false;
    }

    const [updateResult] = await connection.query(
      `UPDATE \`groups\` SET member_count = GREATEST(0, member_count - 1) WHERE id = ?`,
      [groupId]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return false;
    }

    await connection.commit();
    connection.release();
    return true;
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('leaveGroup error:', err);
    throw err;
  }
}

// ── Check membership ──────────────────────────────────────
async function isMember(userId, groupId) {
  try {
    const [[row]] = await db.query(
      `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
      [groupId, userId]
    );
    return !!row;
  } catch (err) {
    console.error('isMember error:', err);
    return false;
  }
}

// ── Groups a user has joined ──────────────────────────────
async function getUserGroups(userId) {
  try {
    const [rows] = await db.query(
      `SELECT
         g.id, 
         g.topic,
         g.display_name AS displayName,
         g.description,
         g.cover_image  AS coverImage,
         g.member_count AS memberCount,
         g.post_count   AS postCount,
         g.created_at   AS createdAt,
         1              AS isMember,
         gm.joined_at   AS joinedAt
       FROM group_members gm
       JOIN \`groups\` g ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY gm.joined_at DESC`,
      [userId]
    );
    return rows.map(normalise);
  } catch (err) {
    console.error('getUserGroups error:', err);
    throw err;
  }
}

// ── Search groups by topic or display name ──────────────────
async function searchGroups(query, { limit = 20, offset = 0 } = {}) {
  try {
    const like = `%${query.replace(/[%_\\]/g, '\\$&')}%`;
    const [rows] = await db.query(
      `SELECT
         id,
         topic,
         display_name  AS displayName,
         description,
         cover_image   AS coverImage,
         member_count  AS memberCount,
         post_count    AS postCount,
         created_at    AS createdAt,
         0             AS isMember
       FROM \`groups\`
       WHERE topic LIKE ? OR display_name LIKE ?
       ORDER BY member_count DESC, post_count DESC
       LIMIT ? OFFSET ?`,
      [like, like, limit, offset]
    );
    return rows.map(normalise);
  } catch (err) {
    console.error('searchGroups error:', err);
    throw err;
  }
}

// ── Group feed ────────────────────────────────────────────
async function getGroupFeed(groupId, { page = 1, limit = 20, userId = null } = {}) {
  limit        = Math.min(50, Math.max(1, limit));
  const offset = (Math.max(1, page) - 1) * limit;

  try {
    const [rawPosts] = await db.query(
      `SELECT
         p.id,
         p.user_id          AS userId,
         u.name             AS author,
         u.picture          AS authorPicture,
         p.text,
         p.image,
         p.video,
         p.is_repost        AS isRepost,
         p.original_post_id AS originalPostId,
         p.group_id         AS groupId,
         p.created_at       AS createdAt
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.group_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [groupId, limit + 1, offset]
    );

    const hasMore   = rawPosts.length > limit;
    const pagePosts = rawPosts.slice(0, limit);

    const PostModel = require('./postModel');
    const hydrated  = await PostModel.hydratePosts(pagePosts);

    return { posts: hydrated, hasMore, page, limit };
  } catch (err) {
    console.error('getGroupFeed error:', err);
    throw err;
  }
}

// ── Internal helpers ──────────────────────────────────────
function normalise(row) {
  return {
    ...row,
    isMember: !!row.isMember,
  };
}

module.exports = {
  startGroupCron,
  runGroupCreationCron,
  getTrendingGroups,
  getGroupByTopic,
  getGroupById,
  getUserGroups,
  getGroupFeed,
  searchGroups,
  joinGroup,
  leaveGroup,
  isMember,
};