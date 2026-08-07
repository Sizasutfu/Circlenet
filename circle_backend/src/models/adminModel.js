// ============================================================
//  models/AdminModel.js
//  All database queries used exclusively by admin routes.
// ============================================================

const { db } = require('../config/db');
const crypto = require('crypto');
const { createSystemNotification } = require('./notificationModel');

// ── Auth ───────────────────────────────────────────────────

async function findAdminByEmail(email) {
  const [rows] = await db.query(
    "SELECT * FROM users WHERE email=? AND role='admin'", [email]
  );
  return rows[0] || null;
}

async function createSession(adminId) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
  await db.query(
    'INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES (?,?,?)',
    [adminId, token, expiresAt]
  );
  return token;
}

async function deleteSession(token) {
  await db.query('DELETE FROM admin_sessions WHERE token=?', [token]);
}

async function verifySession(token) {
  const [rows] = await db.query(
    `SELECT admin_id FROM admin_sessions 
     WHERE token = ? AND expires_at > NOW()`,
    [token]
  );
  return rows[0] || null;
}

// ── Dashboard stats ────────────────────────────────────────

async function getStats() {
  const [[{ totalUsers }]]    = await db.query('SELECT COUNT(*) AS totalUsers    FROM users   WHERE role="user"');
  const [[{ totalPosts }]]    = await db.query('SELECT COUNT(*) AS totalPosts    FROM posts   WHERE is_repost=0');
  const [[{ totalReposts }]]  = await db.query('SELECT COUNT(*) AS totalReposts  FROM posts   WHERE is_repost=1');
  const [[{ totalComments }]] = await db.query('SELECT COUNT(*) AS totalComments FROM comments');
  const [[{ newUsersToday }]] = await db.query(
    "SELECT COUNT(*) AS newUsersToday FROM users WHERE DATE(created_at)=CURDATE() AND role='user'"
  );
  const [[{ pendingReports }]] = await db.query(
    "SELECT COUNT(*) AS pendingReports FROM reports WHERE status='pending'"
  );
  
  // Get mention stats
  const [[{ totalMentions }]] = await db.query('SELECT COUNT(*) AS totalMentions FROM mentions');
  const [[{ unreadMentions }]] = await db.query('SELECT COUNT(*) AS unreadMentions FROM mentions WHERE is_read=0');
  
  return { 
    totalUsers, totalPosts, totalReposts, totalComments, 
    newUsersToday, pendingReports,
    totalMentions, unreadMentions 
  };
}

// ── Chart data ─────────────────────────────────────────────

async function getUserGrowth() {
  const [rows] = await db.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM users
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND role='user'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);
  return rows;
}

async function getPostsPerDay() {
  const [rows] = await db.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM posts
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND is_repost=0
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);
  return rows;
}

async function getMentionsPerDay() {
  const [rows] = await db.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM mentions
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);
  return rows;
}

async function getMentionStats() {
  const [[{ totalMentions }]] = await db.query('SELECT COUNT(*) AS totalMentions FROM mentions');
  const [[{ mentionsToday }]] = await db.query(
    "SELECT COUNT(*) AS mentionsToday FROM mentions WHERE DATE(created_at)=CURDATE()"
  );
  const [[{ mentionsThisWeek }]] = await db.query(
    "SELECT COUNT(*) AS mentionsThisWeek FROM mentions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
  );
  const [[{ unreadMentions }]] = await db.query(
    "SELECT COUNT(*) AS unreadMentions FROM mentions WHERE is_read=0"
  );
  const [[{ postMentions }]] = await db.query(
    "SELECT COUNT(*) AS postMentions FROM mentions WHERE mention_type='post'"
  );
  const [[{ replyMentions }]] = await db.query(
    "SELECT COUNT(*) AS replyMentions FROM mentions WHERE mention_type='reply'"
  );
  
  // Most mentioned user
  const [mostMentioned] = await db.query(`
    SELECT u.id, u.username, u.name, COUNT(*) AS mentionCount
    FROM mentions m
    JOIN users u ON u.id = m.mentioned_user_id
    GROUP BY u.id, u.username, u.name
    ORDER BY mentionCount DESC
    LIMIT 1
  `);
  
  // Recent mentions with user details
  const [recentMentions] = await db.query(`
    SELECT 
      m.*,
      u1.name AS mentioned_by_name,
      u1.username AS mentioned_by_username,
      u2.name AS mentioned_name,
      u2.username AS mentioned_username,
      p.text AS post_text
    FROM mentions m
    JOIN users u1 ON u1.id = m.mentioned_by_user_id
    JOIN users u2 ON u2.id = m.mentioned_user_id
    LEFT JOIN posts p ON p.id = m.post_id
    ORDER BY m.created_at DESC
    LIMIT 10
  `);
  
  return {
    totalMentions,
    mentionsToday,
    mentionsThisWeek,
    unreadMentions,
    postMentions,
    replyMentions,
    mostMentionedUser: mostMentioned[0] || null,
    recentMentions
  };
}

// ── Users ─────────────────────────────────────────────────

async function getAllUsers(search = '', page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const like   = `%${search}%`;
  const [rows] = await db.query(`
    SELECT 
      id, 
      name, 
      username, 
      email, 
      picture, 
      role, 
      suspended, 
      verified,
      email_verified,
      created_at AS joinDate,
      (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND is_repost=0) AS postCount,
      (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followerCount,
      (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS followingCount
    FROM users
    WHERE (name LIKE ? OR email LIKE ? OR username LIKE ?) AND role='user'
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [like, like, like, limit, offset]);

  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM users WHERE (name LIKE ? OR email LIKE ? OR username LIKE ?) AND role='user'",
    [like, like, like]
  );
  return { users: rows, total };
}

async function getUserById(userId) {
  const [rows] = await db.query(`
    SELECT 
      id, name, username, email, picture, bio, location, school,
      role, suspended, verified, email_verified, created_at,
      (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND is_repost=0) AS postCount,
      (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followerCount,
      (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS followingCount
    FROM users
    WHERE id = ?
  `, [userId]);
  return rows[0] || null;
}

async function suspendUser(userId) {
  await db.query('UPDATE users SET suspended=1 WHERE id=?', [userId]);
}

async function unsuspendUser(userId) {
  await db.query('UPDATE users SET suspended=0 WHERE id=?', [userId]);
}

async function updateUserRole(userId, role) {
  await db.query('UPDATE users SET role=? WHERE id=?', [role, userId]);
}

async function deleteUser(userId) {
  await db.query('DELETE FROM users WHERE id=? AND role="user"', [userId]);
}

async function toggleVerification(userId, verified) {
  await db.query('UPDATE users SET verified = ? WHERE id = ?', [verified, userId]);
}

// ── Posts ─────────────────────────────────────────────────

async function getAllPosts(search = '', page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const like   = `%${search}%`;
  const [rows] = await db.query(`
    SELECT 
      p.id, 
      p.text, 
      p.image, 
      p.video,
      p.is_repost AS isRepost, 
      p.created_at AS createdAt,
      p.is_live,
      p.youtube_id,
      u.id AS userId, 
      u.name AS author, 
      u.username AS authorUsername,
      u.email AS authorEmail,
      (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likeCount,
      (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS commentCount,
      (SELECT COUNT(*) FROM reposts WHERE original_post_id=p.id) AS repostCount,
      (SELECT COUNT(*) FROM post_views WHERE post_id=p.id) AS viewCount
    FROM posts p
    JOIN users u ON u.id=p.user_id
    WHERE (p.text LIKE ? OR u.name LIKE ? OR u.username LIKE ?) AND p.is_repost=0
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `, [like, like, like, limit, offset]);

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total 
     FROM posts p 
     JOIN users u ON u.id=p.user_id 
     WHERE (p.text LIKE ? OR u.name LIKE ? OR u.username LIKE ?) AND p.is_repost=0`,
    [like, like, like]
  );
  return { posts: rows, total };
}

async function adminDeletePost(postId) {
  await db.query('DELETE FROM posts WHERE id=?', [postId]);
}

// ── Reports ───────────────────────────────────────────────

async function getReports(status = 'pending', page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(`
    SELECT 
      r.id, 
      r.reason, 
      r.status, 
      r.created_at AS reportedAt,
      p.id AS postId, 
      p.text AS postText, 
      p.image AS postImage,
      author.id AS authorId, 
      author.name AS authorName,
      author.username AS authorUsername,
      reporter.id AS reporterId, 
      reporter.name AS reporterName,
      reporter.username AS reporterUsername
    FROM reports r
    JOIN posts p ON p.id = r.post_id
    JOIN users author ON author.id = p.user_id
    JOIN users reporter ON reporter.id = r.reporter_id
    WHERE r.status = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `, [status, limit, offset]);

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM reports WHERE status=?', [status]
  );
  return { reports: rows, total };
}

async function createReport(postId, reporterId, reason) {
  const [r] = await db.query(
    'INSERT INTO reports (post_id, reporter_id, reason) VALUES (?,?,?)',
    [postId, reporterId, reason]
  );
  return r.insertId;
}

async function resolveReport(reportId) {
  const [[report]] = await db.query(
    'SELECT reporter_id FROM reports WHERE id=?', [reportId]
  );
  await db.query("UPDATE reports SET status='resolved' WHERE id=?", [reportId]);
  if (report) {
    await createSystemNotification(
      report.reporter_id,
      'report_resolved',
      'Your report has been reviewed and the post was removed. Thanks for keeping Circle safe.'
    );
  }
}

async function ignoreReport(reportId) {
  const [[report]] = await db.query(
    'SELECT reporter_id FROM reports WHERE id=?', [reportId]
  );
  await db.query("UPDATE reports SET status='ignored' WHERE id=?", [reportId]);
  if (report) {
    await createSystemNotification(
      report.reporter_id,
      'report_ignored',
      'Your report has been reviewed. Our team decided no action was needed at this time.'
    );
  }
}

// ── Settings ──────────────────────────────────────────────

async function updateAdminPassword(adminId, hashedPassword) {
  await db.query('UPDATE users SET password=? WHERE id=?', [hashedPassword, adminId]);
}

// ── Notifications (Admin) ─────────────────────────────────

async function createAdminNotification(recipientId, type, message) {
  await createSystemNotification(recipientId, type, message);
}

// ── Groups (Admin) ─────────────────────────────────────────

async function getAllGroups(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(`
    SELECT 
      g.id,
      g.topic,
      g.display_name AS displayName,
      g.description,
      g.cover_image AS coverImage,
      g.member_count AS memberCount,
      g.post_count AS postCount,
      g.created_at AS createdAt,
      g.updated_at AS updatedAt
    FROM groups g
    ORDER BY g.member_count DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM groups');
  return { groups: rows, total };
}

async function deleteGroup(groupId) {
  await db.query('DELETE FROM groups WHERE id=?', [groupId]);
}

// ── Ads (Admin) ────────────────────────────────────────────

async function getAllAds(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(`
    SELECT 
      id, title, image_url AS imageUrl, link_url AS linkUrl,
      placement, page_target AS pageTarget,
      start_date AS startDate, end_date AS endDate,
      is_active AS isActive, impressions, clicks,
      created_at AS createdAt, updated_at AS updatedAt
    FROM ads
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM ads');
  return { ads: rows, total };
}

async function createAd(data) {
  const {
    title, imageUrl, linkUrl, placement, pageTarget,
    startDate, endDate, isActive = true
  } = data;
  
  const [result] = await db.query(`
    INSERT INTO ads 
    (title, image_url, link_url, placement, page_target, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [title, imageUrl, linkUrl, placement, pageTarget, startDate, endDate, isActive]);
  
  return result.insertId;
}

async function updateAd(id, data) {
  const {
    title, imageUrl, linkUrl, placement, pageTarget,
    startDate, endDate, isActive
  } = data;
  
  await db.query(`
    UPDATE ads 
    SET 
      title = COALESCE(?, title),
      image_url = COALESCE(?, image_url),
      link_url = COALESCE(?, link_url),
      placement = COALESCE(?, placement),
      page_target = COALESCE(?, page_target),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `, [title, imageUrl, linkUrl, placement, pageTarget, startDate, endDate, isActive, id]);
}

async function deleteAd(id) {
  await db.query('DELETE FROM ads WHERE id=?', [id]);
}

// ── User Activity Log ──────────────────────────────────────

async function getUserActivity(userId, limit = 10) {
  const [rows] = await db.query(`
    (SELECT 
      'post' AS type,
      id AS itemId,
      text AS content,
      created_at AS createdAt
    FROM posts
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?)
    UNION ALL
    (SELECT 
      'comment' AS type,
      id AS itemId,
      text AS content,
      created_at AS createdAt
    FROM comments
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?)
    UNION ALL
    (SELECT 
      'like' AS type,
      post_id AS itemId,
      NULL AS content,
      created_at AS createdAt
    FROM likes
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?)
    ORDER BY createdAt DESC
    LIMIT ?
  `, [userId, limit, userId, limit, userId, limit, limit]);
  
  return rows;
}

// ── Exports ─────────────────────────────────────────────────

module.exports = {
  // Auth
  findAdminByEmail,
  createSession,
  deleteSession,
  verifySession,
  
  // Dashboard
  getStats,
  getUserGrowth,
  getPostsPerDay,
  getMentionsPerDay,
  getMentionStats,
  
  // Users
  getAllUsers,
  getUserById,
  suspendUser,
  unsuspendUser,
  updateUserRole,
  deleteUser,
  toggleVerification,
  getUserActivity,
  
  // Posts
  getAllPosts,
  adminDeletePost,
  
  // Reports
  getReports,
  createReport,
  resolveReport,
  ignoreReport,
  
  // Settings
  updateAdminPassword,
  
  // Notifications
  createAdminNotification,
  
  // Groups
  getAllGroups,
  deleteGroup,
  
  // Ads
  getAllAds,
  createAd,
  updateAd,
  deleteAd,
};