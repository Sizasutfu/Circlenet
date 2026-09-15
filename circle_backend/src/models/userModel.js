const { db } = require("../config/db");

const UserModel = {
  // ─── Lookup ────────────────────────────────────────────────────────────────

  async findByEmail(email) {
    const [rows] = await db.query(
      "SELECT id, name, email, password, email_verified, role, deleted_at FROM users WHERE email = ? AND deleted_at IS NULL",
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(
      `SELECT
         id, name, email, username, bio, picture, cover_image AS coverImage,
         phone, location, school, occupation, website,
         date_of_birth  AS dateOfBirth,
         gender,
         verified,
         role,
         created_at     AS createdAt,
         deleted_at     AS deletedAt
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByIdWithPassword(id) {
    const [rows] = await db.query(
      `SELECT id, name, email, password, username, deleted_at
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  // ─── Find deleted user by email (for restoration) ──────────────────────

  async findDeletedByEmail(email) {
    const [rows] = await db.query(
      "SELECT id, name, email, username, deleted_at FROM users WHERE email = ? AND deleted_at IS NOT NULL",
      [email]
    );
    return rows[0] || null;
  },

  async findDeletedById(id) {
    const [rows] = await db.query(
      `SELECT
         id, name, email, username, bio, picture, cover_image AS coverImage,
         phone, location, school, occupation, website,
         date_of_birth  AS dateOfBirth,
         gender,
         verified,
         role,
         created_at     AS createdAt,
         deleted_at     AS deletedAt
       FROM users WHERE id = ? AND deleted_at IS NOT NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async emailExists(email) {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
      [email]
    );
    return rows.length > 0;
  },

  async emailTakenByOther(email, excludeId) {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL",
      [email, excludeId]
    );
    return rows.length > 0;
  },

  // ─── Create ────────────────────────────────────────────────────────────────

  async createUser(name, email, hashedPassword, username = null) {
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, username) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, username]
    );
    return result.insertId;
  },

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateUser(id, name, email, bio = null, extras = {}) {
    const {
      phone       = null,
      location    = null,
      school      = null,
      occupation  = null,
      website     = null,
      dateOfBirth = null,
      gender      = null,
    } = extras;

    await db.query(
      `UPDATE users
       SET name = ?, email = ?, bio = ?,
           phone = ?, location = ?, school = ?,
           occupation = ?, website = ?,
           date_of_birth = ?, gender = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [name, email, bio, phone, location, school, occupation, website, dateOfBirth, gender, id]
    );
  },

  async updateUserWithPassword(id, name, email, hashedPassword, bio = null, extras = {}) {
    const {
      phone       = null,
      location    = null,
      school      = null,
      occupation  = null,
      website     = null,
      dateOfBirth = null,
      gender      = null,
    } = extras;

    await db.query(
      `UPDATE users
       SET name = ?, email = ?, password = ?, bio = ?,
           phone = ?, location = ?, school = ?,
           occupation = ?, website = ?,
           date_of_birth = ?, gender = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [name, email, hashedPassword, bio, phone, location, school, occupation, website, dateOfBirth, gender, id]
    );
  },

  async updatePicture(id, picture) {
    await db.query("UPDATE users SET picture = ? WHERE id = ? AND deleted_at IS NULL", [picture, id]);
  },

  async updateCoverImage(id, coverImage) {
    await db.query("UPDATE users SET cover_image = ? WHERE id = ? AND deleted_at IS NULL", [coverImage, id]);
  },

  async usernameExists(username, excludeId = null) {
    if (excludeId) {
      const [rows] = await db.query(
        "SELECT id FROM users WHERE username = ? AND id != ? AND deleted_at IS NULL",
        [username, excludeId]
      );
      return rows.length > 0;
    }
    const [rows] = await db.query(
      "SELECT id FROM users WHERE username = ? AND deleted_at IS NULL",
      [username]
    );
    return rows.length > 0;
  },

  async updateUsername(id, username) {
    await db.query("UPDATE users SET username = ? WHERE id = ? AND deleted_at IS NULL", [username, id]);
  },

  async updatePassword(userId, hashedPassword) {
    await db.query(
      "UPDATE users SET password = ? WHERE id = ? AND deleted_at IS NULL",
      [hashedPassword, userId]
    );
  },

  // ─── Soft Delete User ──────────────────────────────────────────────────────

  async softDeleteUser(userId) {
    await db.query(
      "UPDATE users SET deleted_at = NOW() WHERE id = ?",
      [userId]
    );
  },

  // ─── Restore User ──────────────────────────────────────────────────────────

  async restoreUser(userId) {
    await db.query(
      "UPDATE users SET deleted_at = NULL WHERE id = ?",
      [userId]
    );
  },

  // ─── Permanently Delete User (hard delete) ──────────────────────────────

  async permanentlyDeleteUser(userId) {
    await db.query(
      "DELETE FROM users WHERE id = ? AND deleted_at IS NOT NULL",
      [userId]
    );
  },

  // ─── Get users marked for deletion older than 30 days ────────────────────

  async getUsersToPermanentlyDelete() {
    const [rows] = await db.query(
      `SELECT id, email, username, deleted_at 
       FROM users 
       WHERE deleted_at IS NOT NULL 
         AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      []
    );
    return rows;
  },

  // ─── Get user's deletion status ──────────────────────────────────────────

  async getDeletionStatus(userId) {
    const [rows] = await db.query(
      `SELECT 
         deleted_at AS deletedAt,
         DATEDIFF(DATE_ADD(deleted_at, INTERVAL 30 DAY), NOW()) AS daysRemaining
       FROM users 
       WHERE id = ? AND deleted_at IS NOT NULL`,
      [userId]
    );
    return rows[0] || null;
  },

  // ─── Verification badge ──────────────────────────────────────────────────

  async updateVerification(id, verified) {
    await db.query("UPDATE users SET verified = ? WHERE id = ? AND deleted_at IS NULL", [verified, id]);
  },

  // ─── E2E encryption public key ───────────────────────────────────────────

  async savePublicKey(id, publicKey) {
    await db.query("UPDATE users SET public_key = ? WHERE id = ? AND deleted_at IS NULL", [publicKey, id]);
  },

  async getPublicKey(id) {
    const [rows] = await db.query("SELECT public_key FROM users WHERE id = ? AND deleted_at IS NULL", [id]);
    return rows[0]?.public_key || null;
  },

  // ─── Profile (public view) ─────────────────────────────────────────────────

  async getProfile(targetId, viewerId = null) {
    const [rows] = await db.query(
      `SELECT
         id, name, username, bio, picture, cover_image AS coverImage,
         location, school, occupation, website, gender,
         verified,
         role
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [targetId]
    );
    if (!rows.length) return null;

    const [[{ postCount }]] = await db.query(
      "SELECT COUNT(*) AS postCount FROM posts WHERE user_id = ? AND is_repost = 0",
      [targetId]
    );
    const [[{ followerCount }]] = await db.query(
      "SELECT COUNT(*) AS followerCount FROM follows WHERE following_id = ?",
      [targetId]
    );
    const [[{ followingCount }]] = await db.query(
      "SELECT COUNT(*) AS followingCount FROM follows WHERE follower_id = ?",
      [targetId]
    );

    let isFollowing = false;
    if (viewerId && viewerId !== targetId) {
      const [f] = await db.query(
        "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
        [viewerId, targetId]
      );
      isFollowing = f.length > 0;
    }

    return { ...rows[0], postCount, followerCount, followingCount, isFollowing };
  },

  // ─── Dashboard aggregates ─────────────────────────────────────────────────

  async getDashboardStats(userId) {
    if (!userId || isNaN(userId) || userId <= 0) {
      throw new Error('Invalid user ID');
    }

    const [[counts]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM posts    WHERE user_id = ? AND is_repost = 0) AS postsCount,
         (SELECT COUNT(*) FROM follows  WHERE following_id = ?)               AS followersCount,
         (SELECT COUNT(*) FROM follows  WHERE follower_id = ?)                AS followingCount,
         (SELECT COUNT(*) FROM likes l
           JOIN posts p ON p.id = l.post_id
           WHERE p.user_id = ?)                                              AS totalLikes,
         (SELECT COUNT(*) FROM comments c
           JOIN posts p ON p.id = c.post_id
           WHERE p.user_id = ?)                                              AS totalComments,
         (SELECT COUNT(*) FROM reposts r
           JOIN posts p ON p.id = r.original_post_id
           WHERE p.user_id = ?)                                              AS totalReposts,
         (SELECT COUNT(*) FROM post_views v
           JOIN posts p ON p.id = v.post_id
           WHERE p.user_id = ?)                                              AS totalViews,
         (SELECT COUNT(*) FROM video_views vv
           JOIN posts p ON p.id = vv.post_id
           WHERE p.user_id = ?)                                              AS totalVideoViews`,
      [userId, userId, userId, userId, userId, userId, userId, userId]
    );

    const [engagementByDay] = await db.query(
      `SELECT
         DATE(d.day) AS date,
         COALESCE(l.cnt, 0) AS likes,
         COALESCE(c.cnt, 0) AS comments,
         COALESCE(r.cnt, 0) AS reposts
       FROM (
         SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) AS day
         FROM (
           SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
           SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
         ) AS nums
       ) AS d
       LEFT JOIN (
         SELECT DATE(l.created_at) AS day, COUNT(*) AS cnt
         FROM likes l
         JOIN posts p ON p.id = l.post_id
         WHERE p.user_id = ? AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(l.created_at)
       ) AS l ON l.day = d.day
       LEFT JOIN (
         SELECT DATE(c.created_at) AS day, COUNT(*) AS cnt
         FROM comments c
         JOIN posts p ON p.id = c.post_id
         WHERE p.user_id = ? AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(c.created_at)
       ) AS c ON c.day = d.day
       LEFT JOIN (
         SELECT DATE(r.created_at) AS day, COUNT(*) AS cnt
         FROM reposts r
         JOIN posts p ON p.id = r.original_post_id
         WHERE p.user_id = ? AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(r.created_at)
       ) AS r ON r.day = d.day
       ORDER BY d.day ASC`,
      [userId, userId, userId]
    );

    const [recentPosts] = await db.query(
      `SELECT
         p.id, p.text, p.created_at AS createdAt,
         (SELECT COUNT(*) FROM likes    WHERE post_id = p.id)          AS likeCount,
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id)          AS commentCount,
         (SELECT COUNT(*) FROM reposts  WHERE original_post_id = p.id) AS repostCount,
         (SELECT COUNT(*) FROM post_views WHERE post_id = p.id)        AS viewCount
       FROM posts p
       WHERE p.user_id = ? AND p.is_repost = 0
       ORDER BY p.created_at DESC
       LIMIT 5`,
      [userId]
    );

    const [[topPost]] = await db.query(
      `SELECT
         p.id, p.text,
         (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS score
       FROM posts p
       WHERE p.user_id = ? AND p.is_repost = 0
       ORDER BY score DESC, p.created_at DESC
       LIMIT 1`,
      [userId]
    );

    return {
      ...counts,
      engagementByDay,
      recentPosts,
      topPost: topPost?.id ? topPost : null,
    };
  },

  // ─── Search ────────────────────────────────────────────────────────────────

  async searchUsers(query, excludeId, limit = 10) {
    const like = `%${query}%`;
    const [rows] = await db.query(
      `SELECT id, name, email, picture, role
       FROM users
       WHERE (name LIKE ? OR email LIKE ?)
         AND id != ?
         AND deleted_at IS NULL
       ORDER BY name ASC
       LIMIT ?`,
      [like, like, excludeId, limit]
    );
    return rows;
  },

  // ─── Password Reset ────────────────────────────────────────────────────────

  async saveResetToken(userId, token, expires) {
    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ? AND deleted_at IS NULL",
      [token, expires, userId]
    );
  },

  async findByValidResetToken(token) {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW() AND deleted_at IS NULL",
      [token]
    );
    return rows[0] || null;
  },

  async updatePasswordAndClearToken(userId, hashedPassword) {
    await db.query(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ? AND deleted_at IS NULL",
      [hashedPassword, userId]
    );
  },

  // ─── Mentions ──────────────────────────────────────────────────────────────

  async extractMentionedUsernames(content) {
    const mentionRegex = /@([a-zA-Z0-9_\.-]+)/g;
    const matches = content.matchAll(mentionRegex);
    const usernames = [];
    for (const match of matches) {
      usernames.push(match[1]);
    }
    return [...new Set(usernames)];
  },

  async getUsersByUsernames(usernames) {
    if (!usernames || usernames.length === 0) return [];
    const placeholders = usernames.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, name, username, picture FROM users WHERE username IN (${placeholders}) AND deleted_at IS NULL`,
      usernames
    );
    return rows;
  },

  async createMentions(postId, mentionedUserIds, mentionedByUserId, mentionType = 'post') {
    if (!mentionedUserIds || mentionedUserIds.length === 0) return;
    
    const values = mentionedUserIds.map(userId => 
      [postId, userId, mentionedByUserId, mentionType]
    );
    
    await db.query(
      `INSERT INTO mentions (post_id, mentioned_user_id, mentioned_by_user_id, mention_type, created_at)
       VALUES ?`,
      [values]
    );
  },

  async getMentionsForUser(userId, limit = 20, offset = 0) {
    const [rows] = await db.query(
      `SELECT 
         m.id,
         m.post_id,
         m.mentioned_by_user_id,
         m.mention_type,
         m.created_at,
         m.is_read,
         p.content as post_content,
         p.created_at as post_created_at,
         u.name as mentioned_by_name,
         u.username as mentioned_by_username,
         u.picture as mentioned_by_picture
       FROM mentions m
       LEFT JOIN posts p ON m.post_id = p.id
       LEFT JOIN users u ON m.mentioned_by_user_id = u.id
       WHERE m.mentioned_user_id = ? AND u.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows;
  },

  async getMentionsForPost(postId) {
    const [rows] = await db.query(
      `SELECT 
         u.id,
         u.name,
         u.username,
         u.picture
       FROM mentions m
       JOIN users u ON m.mentioned_user_id = u.id
       WHERE m.post_id = ? AND u.deleted_at IS NULL`,
      [postId]
    );
    return rows;
  },

  async markMentionsAsRead(userId, mentionIds) {
    if (!mentionIds || mentionIds.length === 0) return;
    const placeholders = mentionIds.map(() => '?').join(',');
    await db.query(
      `UPDATE mentions SET is_read = 1 
       WHERE mentioned_user_id = ? AND id IN (${placeholders})`,
      [userId, ...mentionIds]
    );
  },

  async markAllMentionsAsRead(userId) {
    await db.query(
      `UPDATE mentions SET is_read = 1 
       WHERE mentioned_user_id = ? AND is_read = 0`,
      [userId]
    );
  },

  async getUnreadMentionCount(userId) {
    const [rows] = await db.query(
      `SELECT COUNT(*) as count FROM mentions 
       WHERE mentioned_user_id = ? AND is_read = 0`,
      [userId]
    );
    return rows[0].count;
  },

  async deleteMentionsForPost(postId) {
    await db.query(
      "DELETE FROM mentions WHERE post_id = ?",
      [postId]
    );
  },

  // ─── Mention Suggestions ──────────────────────────────────────────────────

  async getMentionSuggestions(query, excludeId, limit = 10) {
    const like = `%${query}%`;
    const [rows] = await db.query(
      `SELECT id, name, username, picture
       FROM users
       WHERE (username LIKE ? OR name LIKE ?)
         AND id != ?
         AND deleted_at IS NULL
       ORDER BY 
         CASE 
           WHEN username LIKE ? THEN 0
           WHEN name LIKE ? THEN 1
           ELSE 2
         END,
         username ASC
       LIMIT ?`,
      [`${query}%`, `${query}%`, excludeId, `${query}%`, `${query}%`, limit]
    );
    return rows;
  },
};

// ─── New members (joined in last 7 days) ──────────────────────────────────────

async function getNewMembers(viewerId, limit = 10) {
  let query, params;

  if (viewerId) {
    query = `
      SELECT
        u.id,
        u.name,
        u.picture,
        u.created_at AS createdAt,
        u.role
      FROM users u
      WHERE u.created_at >= NOW() - INTERVAL 7 DAY
        AND u.id != ?
        AND u.deleted_at IS NULL
        AND u.id NOT IN (
          SELECT following_id FROM follows WHERE follower_id = ?
        )
      ORDER BY u.created_at DESC
      LIMIT ?
    `;
    params = [viewerId, viewerId, limit];
  } else {
    query = `
      SELECT
        u.id,
        u.name,
        u.picture,
        u.created_at AS createdAt,
        u.role
      FROM users u
      WHERE u.created_at >= NOW() - INTERVAL 7 DAY
        AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT ?
    `;
    params = [limit];
  }

  const [rows] = await db.query(query, params);
  return rows;
}

// ─── Get user by username ──────────────────────────────────────────────────────

async function getByUsername(username) {
  const [rows] = await db.query(
    `SELECT
       id, name, username, email, bio, picture,
       cover_image AS coverImage,
       location, school, occupation, website, gender, phone,
       date_of_birth AS dateOfBirth,
       verified,
       role,
       created_at  AS joined
     FROM users
     WHERE username = ? AND deleted_at IS NULL`,
    [username]
  );
  return rows.length ? rows[0] : null;
}

// ─── Email verification helpers ───────────────────────────────────────────────

async function saveVerificationCode(userId, code, expires) {
  await db.query(
    `UPDATE users
     SET verify_code = ?, verify_code_expires = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [code, expires, userId]
  );
}

async function findByValidVerificationCode(email, code) {
  const [rows] = await db.query(
    `SELECT * FROM users
     WHERE email = ?
       AND verify_code = ?
       AND verify_code_expires > NOW()
       AND deleted_at IS NULL
     LIMIT 1`,
    [email, code]
  );
  return rows[0] || null;
}

async function markEmailVerified(userId) {
  await db.query(
    `UPDATE users
     SET email_verified = 1,
         verify_code = NULL,
         verify_code_expires = NULL
     WHERE id = ? AND deleted_at IS NULL`,
    [userId]
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  ...UserModel,
  getNewMembers,
  getByUsername,
  saveVerificationCode,
  findByValidVerificationCode,
  markEmailVerified,
};