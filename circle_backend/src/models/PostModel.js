// ============================================================
//  models/PostModel.js
//  All database queries related to posts, plus the
//  hydration helper.
//
//  Feed scoring and pagination have moved to feed/feedPipeline.js.
//  computeScore lives in feed/feedScorer.js.
//  getPostsPage lives in feed/feedPipeline.js.
// ============================================================

const { db }          = require('../config/db');
const {
  FEED_PAGE_SIZE,
} = require('../config/constants');
const TopicPreferenceModel = require('./topicPreferenceModel');

// ── Normalise a stored media URL to a relative path ──────────
function toRelativePath(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/uploads/')) return u.pathname;
  } catch {}
  return url;
}

// ── Nest flat comment rows into a parent → replies tree ───
function nestComments(flatComments) {
  const byId  = {};
  const roots = [];

  flatComments.forEach(c => {
    byId[c.id] = { ...c, replies: [] };
  });

  flatComments.forEach(c => {
    if (c.parentId && byId[c.parentId]) {
      byId[c.parentId].replies.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });

  return roots;
}

async function getCommentCount(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM comments WHERE post_id = ?',
    [postId]
  );
  return total;
}

async function getRepostCount(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM reposts WHERE original_post_id = ?',
    [postId]
  );
  return total;
}

// ── Get all users who liked a post ─────────────────────────────
async function getLikers(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [rows] = await db.query(
    'SELECT user_id FROM likes WHERE post_id = ?',
    [postId]
  );
  return rows;
}

// ── Get all users who reposted a post ──────────────────────────
async function getReposters(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [rows] = await db.query(
    'SELECT user_id FROM reposts WHERE original_post_id = ?',
    [postId]
  );
  return rows;
}

// ── Extract @username mentions from text ──────────────────────
function extractMentions(text) {
  if (!text || typeof text !== 'string') return [];
  
  const mentionRegex = /@([a-zA-Z0-9_\-]{3,25})/g;
  const matches = text.matchAll(mentionRegex);
  const usernames = [];
  
  for (const match of matches) {
    const username = match[1].toLowerCase();
    if (!usernames.includes(username)) {
      usernames.push(username);
    }
  }
  
  return usernames;
}

// ── Get user IDs for mentioned usernames ──────────────────────
async function getMentionedUserIds(usernames) {
  if (!usernames || !usernames.length) return new Map();
  
  const result = new Map();
  const placeholders = usernames.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, username FROM users WHERE username IN (${placeholders})`,
    usernames
  );
  
  rows.forEach(row => {
    result.set(row.username.toLowerCase(), row.id);
  });
  
  return result;
}

// ── Create mention records ─────────────────────────────────────
async function createMentions(postId, mentionedByUserId, mentionedUserIds, mentionType = 'post') {
  if (!postId || !mentionedByUserId || !mentionedUserIds || !mentionedUserIds.length) {
    return;
  }

  const values = mentionedUserIds.map(userId => [
    postId,
    userId,
    mentionedByUserId,
    mentionType,
    0,
    new Date()
  ]);

  const query = `
    INSERT INTO mentions (post_id, mentioned_user_id, mentioned_by_user_id, mention_type, is_read, created_at)
    VALUES ?
  `;

  try {
    const [result] = await db.query(query, [values]);
    return result;
  } catch (error) {
    console.error('Error creating mentions:', error);
    throw error;
  }
}

// ── Get mentions for a user ───────────────────────────────────
async function getMentions(userId, { limit = 20, page = 1, status = 'all' } = {}) {
  if (!userId) throw new Error('User ID is required');
  
  limit = Math.min(50, Math.max(1, parseInt(limit) || 20));
  page = Math.max(1, parseInt(page) || 1);
  const offset = (page - 1) * limit;

  let statusCondition = '';
  if (status === 'read') {
    statusCondition = 'AND m.is_read = 1';
  } else if (status === 'unread') {
    statusCondition = 'AND m.is_read = 0';
  }

  const query = `
    SELECT 
      m.id,
      m.post_id,
      m.mentioned_by_user_id,
      m.mention_type,
      m.is_read,
      m.created_at,
      u.id AS actor_id,
      u.name AS actor_name,
      u.username AS actor_username,
      u.picture AS actor_picture,
      u.verified AS actor_verified,
      p.text AS post_text,
      p.image AS post_image,
      p.video AS post_video,
      p.created_at AS post_created_at,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM mentions m
    JOIN users u ON u.id = m.mentioned_by_user_id
    LEFT JOIN posts p ON p.id = m.post_id
    WHERE m.mentioned_user_id = ?
    ${statusCondition}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const [rows] = await db.query(query, [userId, limit, offset]);
    
    let countQuery = 'SELECT COUNT(*) AS total FROM mentions WHERE mentioned_user_id = ?';
    if (status !== 'all') {
      countQuery += status === 'read' ? ' AND is_read = 1' : ' AND is_read = 0';
    }
    const [[{ total }]] = await db.query(countQuery, [userId]);

    return {
      mentions: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting mentions:', error);
    throw error;
  }
}

// ── Mark mentions as read ─────────────────────────────────────
async function markMentionsAsRead(userId, mentionIds = null) {
  if (!userId) throw new Error('User ID is required');

  let query = 'UPDATE mentions SET is_read = 1 WHERE mentioned_user_id = ?';
  const params = [userId];

  if (mentionIds && mentionIds.length) {
    const placeholders = mentionIds.map(() => '?').join(',');
    query += ` AND id IN (${placeholders})`;
    params.push(...mentionIds);
  }

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (error) {
    console.error('Error marking mentions as read:', error);
    throw error;
  }
}

// ── Get unread mention count ──────────────────────────────────
async function getUnreadMentionCount(userId) {
  if (!userId) return 0;

  try {
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM mentions WHERE mentioned_user_id = ? AND is_read = 0',
      [userId]
    );
    return count || 0;
  } catch (error) {
    console.error('Error getting unread mention count:', error);
    return 0;
  }
}

// ── Hydrate raw post rows with engagement data ─────────────
async function hydratePosts(posts, options = {}) {
  const { followingIds = null, includeFullComments = true, viewerUserId = null } = options;
  if (!posts || !posts.length) return posts;

  const ids = posts.map(p => p.id).filter(id => id && !isNaN(id));
  if (!ids.length) return posts;

  const ph  = ids.map(() => '?').join(',');

  const [[allLikes], [allReposts], [allComments], [allViews], [allVideoViews]] = await Promise.all([
    db.query(`SELECT user_id, post_id FROM likes WHERE post_id IN (${ph})`, ids),
    db.query(
      `SELECT r.user_id, r.original_post_id FROM reposts r
       JOIN posts p ON p.id = r.repost_post_id
       WHERE r.original_post_id IN (${ph}) AND (p.text IS NULL OR p.text='')`,
      ids
    ),
    db.query(
      `SELECT c.id, c.post_id, c.user_id AS userId,
              c.parent_id AS parentId,
              u.name AS author, u.picture AS authorPicture,
              c.text, c.created_at AS createdAt
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id IN (${ph})
       ORDER BY c.created_at ASC`,
      ids
    ),
    db.query(
      `SELECT post_id, COUNT(*) AS view_count FROM post_views WHERE post_id IN (${ph}) GROUP BY post_id`,
      ids
    ),
    db.query(
      `SELECT post_id, COUNT(*) AS view_count FROM video_views WHERE post_id IN (${ph}) GROUP BY post_id`,
      ids
    ),
  ]);

  const lMap = {}, rMap = {}, cMap = {}, vMap = {}, vvMap = {};
  ids.forEach(id => { 
    lMap[id] = []; 
    rMap[id] = []; 
    cMap[id] = []; 
    vMap[id] = 0; 
    vvMap[id] = 0; 
  });
  
  allLikes.forEach(l => {
    if (l && l.post_id && lMap[l.post_id] !== undefined) {
      lMap[l.post_id].push(l.user_id);
    }
  });
  
  allReposts.forEach(r => {
    if (r && r.original_post_id && rMap[r.original_post_id] !== undefined) {
      rMap[r.original_post_id].push(r.user_id);
    }
  });
  
  allComments.forEach(c => {
    if (c && c.post_id && cMap[c.post_id] !== undefined) {
      cMap[c.post_id].push(c);
    }
  });
  
  allViews.forEach(v => {
    if (v && v.post_id && vMap[v.post_id] !== undefined) {
      vMap[v.post_id] = Number(v.view_count);
    }
  });
  
  allVideoViews.forEach(v => {
    if (v && v.post_id && vvMap[v.post_id] !== undefined) {
      vvMap[v.post_id] = Number(v.view_count);
    }
  });

  // ── Fetch original posts for reposts ──────────────────────
  const origIds = [
    ...new Set(
      posts.filter(p => p.isRepost && p.originalPostId).map(p => p.originalPostId)
    ),
  ];
  let origMap = {};
  if (origIds.length) {
    const oph = origIds.map(() => '?').join(',');
    const [origRows] = await db.query(
      `SELECT p.id, p.user_id AS userId, u.name AS author, u.picture AS authorPicture,
              p.text, p.image, p.video, p.created_at AS createdAt,
              p.is_live, p.live_session_id, p.youtube_id,
              u.verified AS authorVerified
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id IN (${oph})`,
      origIds
    );
    origRows.forEach(o => { origMap[o.id] = o; });
  }

  // ── Resolve group names ──────────────────────────────────
  const groupIds = [...new Set(posts.map(p => p.groupId).filter(Boolean))];
  let groupMap = {};
  if (groupIds.length) {
    const gph = groupIds.map(() => '?').join(',');
    const [gRows] = await db.query(
      `SELECT id, display_name AS displayName, topic FROM \`groups\` WHERE id IN (${gph})`,
      groupIds
    );
    gRows.forEach(g => { groupMap[g.id] = g; });
  }

  // ── Fetch mention status for viewer ──────────────────────
  let mentionedPostIds = new Set();
  if (viewerUserId && ids.length) {
    const mentionPh = ids.map(() => '?').join(',');
    const [mentionRows] = await db.query(
      `SELECT post_id FROM mentions 
       WHERE mentioned_user_id = ? AND post_id IN (${mentionPh})`,
      [viewerUserId, ...ids]
    );
    mentionedPostIds = new Set(mentionRows.map(r => r.post_id));
  }

  // ── Process each post ────────────────────────────────────
  posts.forEach(p => {
    p.user = {
      id: p.userId,
      name: p.author || 'Unknown',
      username: p.authorUsername || null,
      picture: p.authorPicture || null,
      verified: !!p.authorVerified,
    };

    p.likes    = lMap[p.id] || [];
    p.reposts  = rMap[p.id] || [];
    const commentsList = cMap[p.id] || [];
    p.commentCount = commentsList.length;
    p.isMentioned = mentionedPostIds.has(p.id);

    if (!includeFullComments && followingIds && followingIds.length) {
      const followingSet = new Set(followingIds);
      const followedComments = commentsList.filter(c => followingSet.has(c.userId));
      followedComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      p.recentComments = followedComments.slice(0, 3);
      p.comments = [];
    } else {
      p.comments = nestComments(commentsList);
      p.recentComments = [];
    }

    p.views = vMap[p.id] || 0;
    p.videoViews = vvMap[p.id] || 0;
    p.viewCount = p.views;
    p.videoViewCount = p.videoViews;

    if (p.isRepost && p.originalPostId) {
      const orig = origMap[p.originalPostId];
      if (orig) {
        p.originalPost = {
          id: orig.id,
          userId: orig.userId,
          author: orig.author,
          authorPicture: orig.authorPicture,
          authorVerified: !!orig.authorVerified,
          text: orig.text,
          image: orig.image,
          video: orig.video,
          createdAt: orig.createdAt,
          isLive: orig.is_live,
          liveSessionId: orig.live_session_id,
          youtubeId: orig.youtube_id,
        };
      } else {
        p.originalPost = null;
      }
    }

    if (p.groupId && groupMap[p.groupId]) {
      p.groupName  = groupMap[p.groupId].displayName;
      p.groupTopic = groupMap[p.groupId].topic;
    }

    p.image         = toRelativePath(p.image);
    p.video         = toRelativePath(p.video);
    p.authorPicture = toRelativePath(p.authorPicture);
    if (p.originalPost) {
      p.originalPost.image         = toRelativePath(p.originalPost.image);
      p.originalPost.video         = toRelativePath(p.originalPost.video);
      p.originalPost.authorPicture = toRelativePath(p.originalPost.authorPicture);
    }
  });

  return posts;
}

// ── Fetch IDs the viewer follows ──────────────────────────
async function getFollowingIds(viewerUserId) {
  if (!viewerUserId) return [];
  const [rows] = await db.query(
    'SELECT following_id FROM follows WHERE follower_id=?',
    [viewerUserId]
  );
  return rows.map(r => r.following_id);
}

// ── Fetch viewer's personal engagement with each author ───
async function getEngagementMap(viewerUserId) {
  if (!viewerUserId) return {};
  const [rows] = await db.query(
    `SELECT
       p.user_id                          AS authorId,
       COUNT(DISTINCT l.id)               AS likes,
       COUNT(DISTINCT c.id)               AS comments,
       COUNT(DISTINCT r.id)               AS reposts
     FROM posts p
     LEFT JOIN likes    l ON l.post_id          = p.id AND l.user_id          = ?
     LEFT JOIN comments c ON c.post_id          = p.id AND c.user_id          = ?
     LEFT JOIN reposts  r ON r.original_post_id = p.id AND r.user_id          = ?
     GROUP BY p.user_id
     HAVING likes > 0 OR comments > 0 OR reposts > 0`,
    [viewerUserId, viewerUserId, viewerUserId]
  );
  const map = {};
  rows.forEach(r => {
    map[r.authorId] = {
      likes:    Number(r.likes),
      comments: Number(r.comments),
      reposts:  Number(r.reposts),
    };
  });
  return map;
}

// ── Fetch post IDs the viewer has already seen ────────────
async function getSeenPostIds(viewerKey) {
  if (!viewerKey) return new Set();
  const [rows] = await db.query(
    'SELECT DISTINCT post_id FROM post_views WHERE viewer_key = ?',
    [String(viewerKey)]
  );
  return new Set(rows.map(r => r.post_id));
}

// ── Fetch all posts for a specific user profile ────────────
async function getProfilePosts(profileUserId, page = 1, limit = FEED_PAGE_SIZE) {
  if (!profileUserId || isNaN(profileUserId) || profileUserId <= 0) {
    throw new Error('Invalid user ID');
  }
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || FEED_PAGE_SIZE));

  const LIMIT  = limit;
  const OFFSET = (page - 1) * LIMIT;

  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.group_id         AS groupId,
       p.created_at       AS createdAt,
       p.is_live,
       p.live_session_id,
       p.youtube_id
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [profileUserId, LIMIT + 1, OFFSET]
  );

  const hasMore   = rawPosts.length > LIMIT;
  const pagePosts = rawPosts.slice(0, LIMIT);
  const posts     = await hydratePosts(pagePosts);

  return { posts, hasMore };
}

// ── Create a post ──────────────────────────────────────────
async function createPost(userId, text, image, video, groupId = null, isLive = false, liveSessionId = null, youtubeId = null) {
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('Invalid user ID');
  }
  if (text && typeof text !== 'string') {
    throw new Error('Text must be a string');
  }
  if (groupId && (isNaN(groupId) || groupId <= 0)) {
    throw new Error('Invalid group ID');
  }

  const [result] = await db.query(
    `INSERT INTO posts (user_id, text, image, video, group_id, is_live, live_session_id, youtube_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, text || null, image || null, video || null, groupId || null, isLive ? 1 : 0, liveSessionId || null, youtubeId || null]
  );
  
  const postId = result.insertId;
  if (text) {
    await savePostTopics(postId, text);
    
    // ── Handle mentions ──
    const mentionedUsernames = extractMentions(text);
    if (mentionedUsernames.length) {
      const userIdMap = await getMentionedUserIds(mentionedUsernames);
      const mentionedUserIds = [];
      
      for (const [username, id] of userIdMap) {
        if (id !== userId) {
          mentionedUserIds.push(id);
        }
      }

      if (mentionedUserIds.length) {
        await createMentions(postId, userId, mentionedUserIds, 'post');
      }
    }
  }
  
  return postId;
}

// ── Fetch posts scoped to a group ──────────────────────────
async function getGroupPosts(groupId, page = 1, limit = 20) {
  if (!groupId || isNaN(groupId) || groupId <= 0) {
    throw new Error('Invalid group ID');
  }
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const OFFSET = (page - 1) * limit;
  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.group_id         AS groupId,
       p.created_at       AS createdAt,
       p.is_live,
       p.live_session_id,
       p.youtube_id
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.group_id = ?
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [groupId, limit + 1, OFFSET]
  );
  const hasMore   = rawPosts.length > limit;
  const pagePosts = rawPosts.slice(0, limit);
  const posts     = await hydratePosts(pagePosts);
  return { posts, hasMore };
}

// ── Delete a post ──────────────────────────────────────────
async function deletePost(postId, userId = null) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  
  if (userId) {
    const [post] = await db.query('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (!post.length) {
      throw new Error('Post not found');
    }
    if (post[0].user_id !== userId) {
      throw new Error('Unauthorized: You do not own this post');
    }
  }
  
  await db.query('DELETE FROM posts WHERE id=?', [postId]);
}

// ── Update a post's text ───────────────────────────────────
async function updatePost(postId, text, userId = null, isLive = null, liveSessionId = null, youtubeId = null, image = undefined, video = undefined) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  if (text && typeof text !== 'string') {
    throw new Error('Text must be a string');
  }
  
  if (userId) {
    const [post] = await db.query('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (!post.length) {
      throw new Error('Post not found');
    }
    if (post[0].user_id !== userId) {
      throw new Error('Unauthorized: You do not own this post');
    }
  }

  let query = 'UPDATE posts SET text = ?, edited = 1, updated_at = NOW()';
  const params = [text];
  if (isLive !== null) {
    query += ', is_live = ?';
    params.push(isLive ? 1 : 0);
  }
  if (liveSessionId !== undefined) {
    query += ', live_session_id = ?';
    params.push(liveSessionId);
  }
  if (youtubeId !== undefined) {
    query += ', youtube_id = ?';
    params.push(youtubeId);
  }
  if (image !== undefined) {
    query += ', image = ?';
    params.push(image);
  }
  if (video !== undefined) {
    query += ', video = ?';
    params.push(video);
  }
  query += ' WHERE id = ?';
  params.push(postId);

  const [result] = await db.query(query, params);
  if (!result.affectedRows) throw new Error('Post not found.');

  // Update topics
  await db.query('DELETE FROM post_topics WHERE post_id = ?', [postId]);
  if (text) {
    await savePostTopics(postId, text);
    
    // ── Handle mentions on update ──
    // Clear existing mentions for this post
    await db.query('DELETE FROM mentions WHERE post_id = ?', [postId]);
    
    const mentionedUsernames = extractMentions(text);
    if (mentionedUsernames.length) {
      const userIdMap = await getMentionedUserIds(mentionedUsernames);
      const mentionedUserIds = [];
      
      for (const [username, id] of userIdMap) {
        if (id !== userId) {
          mentionedUserIds.push(id);
        }
      }

      if (mentionedUserIds.length) {
        await createMentions(postId, userId, mentionedUserIds, 'post');
      }
    }
  }

  return result.affectedRows;
}

// ── Find a post by id ──────────────────────────────────────
async function findById(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [rows] = await db.query(
    `SELECT p.*, u.name AS author, u.username AS authorUsername, u.picture AS authorPicture,
            u.verified AS authorVerified,
            p.is_live, p.live_session_id, p.youtube_id
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id=?`,
    [postId]
  );
  return rows[0] || null;
}

// ── GET /api/posts/:id with user data ──────────────────────
async function getPostByIdWithUser(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [rows] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.created_at       AS createdAt,
       p.is_live,
       p.live_session_id,
       p.youtube_id       AS youtubeId
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [postId]
  );
  return rows[0] || null;
}

// ── Like / unlike ──────────────────────────────────────────
async function getLike(userId, postId) {
  if (!userId || isNaN(userId) || userId <= 0 || !postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid user ID or post ID');
  }
  const [rows] = await db.query(
    'SELECT id FROM likes WHERE user_id=? AND post_id=?',
    [userId, postId]
  );
  return rows[0] || null;
}

async function addLike(userId, postId) {
  if (!userId || isNaN(userId) || userId <= 0 || !postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid user ID or post ID');
  }
  await db.query('INSERT INTO likes (user_id, post_id) VALUES (?,?)', [userId, postId]);
}

async function removeLike(userId, postId) {
  if (!userId || isNaN(userId) || userId <= 0 || !postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid user ID or post ID');
  }
  await db.query('DELETE FROM likes WHERE user_id=? AND post_id=?', [userId, postId]);
}

async function getLikeCount(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM likes WHERE post_id=?',
    [postId]
  );
  return total;
}

// ── Add a comment or reply ─────────────────────────────────
async function addComment(postId, userId, text, parentId = null) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('Invalid user ID');
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Comment text is required');
  }
  if (parentId && (isNaN(parentId) || parentId <= 0)) {
    throw new Error('Invalid parent comment ID');
  }

  if (parentId) {
    const [parentRows] = await db.query(
      'SELECT id FROM comments WHERE id=? AND post_id=?',
      [parentId, postId]
    );
    if (!parentRows.length) {
      throw new Error('Parent comment not found on this post.');
    }
  }

  const [result] = await db.query(
    'INSERT INTO comments (post_id, user_id, text, parent_id) VALUES (?,?,?,?)',
    [postId, userId, text, parentId]
  );

  await saveCommentTopics(postId, text);

  // ── Handle mentions in comments ──
  const mentionedUsernames = extractMentions(text);
  if (mentionedUsernames.length) {
    const userIdMap = await getMentionedUserIds(mentionedUsernames);
    const mentionedUserIds = [];
    
    for (const [username, id] of userIdMap) {
      if (id !== userId) {
        mentionedUserIds.push(id);
      }
    }

    if (mentionedUserIds.length) {
      await createMentions(postId, userId, mentionedUserIds, 'reply');
    }
  }

  return result.insertId;
}

async function getCommentsOnUserPosts(userId, limit = 3) {
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('Invalid user ID');
  }
  limit = Math.min(50, Math.max(1, parseInt(limit) || 3));
  
  const [rows] = await db.query(
    `SELECT c.id, c.post_id, c.text, c.created_at,
            u.name AS commenterName,
            u.username AS authorUsername
     FROM comments c
     JOIN posts p ON p.id = c.post_id
     JOIN users u ON u.id = c.user_id
     WHERE p.user_id = ?
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

// ── Repost ─────────────────────────────────────────────────
async function getExistingRepost(userId, originalPostId) {
  if (!userId || isNaN(userId) || userId <= 0 || !originalPostId || isNaN(originalPostId) || originalPostId <= 0) {
    throw new Error('Invalid user ID or post ID');
  }
  const [rows] = await db.query(
    `SELECT r.id FROM reposts r
     JOIN posts p ON p.id = r.repost_post_id
     WHERE r.user_id=? AND r.original_post_id=? AND (p.text IS NULL OR p.text='')`,
    [userId, originalPostId]
  );
  return rows[0] || null;
}

async function createRepost(userId, text, originalPostId) {
  if (!userId || isNaN(userId) || userId <= 0) {
    throw new Error('Invalid user ID');
  }
  if (!originalPostId || isNaN(originalPostId) || originalPostId <= 0) {
    throw new Error('Invalid original post ID');
  }
  
  const [originalPost] = await db.query('SELECT id FROM posts WHERE id = ?', [originalPostId]);
  if (!originalPost.length) {
    throw new Error('Original post not found');
  }

  const [existRows] = await db.query(
    `SELECT r.repost_post_id FROM reposts r
     JOIN posts p ON p.id = r.repost_post_id
     WHERE r.user_id=? AND r.original_post_id=? AND (p.text IS NULL OR p.text='')
     LIMIT 1`,
    [userId, originalPostId]
  );
  
  if (existRows.length) {
    return existRows[0].repost_post_id;
  }

  const [result] = await db.query(
    'INSERT INTO posts (user_id, text, is_repost, original_post_id) VALUES (?,?,1,?)',
    [userId, text || null, originalPostId]
  );
  const repostPostId = result.insertId;
  await db.query(
    'INSERT IGNORE INTO reposts (user_id, original_post_id, repost_post_id) VALUES (?,?,?)',
    [userId, originalPostId, repostPostId]
  );
  if (text) {
    await savePostTopics(repostPostId, text);
    
    // ── Handle mentions in repost text ──
    const mentionedUsernames = extractMentions(text);
    if (mentionedUsernames.length) {
      const userIdMap = await getMentionedUserIds(mentionedUsernames);
      const mentionedUserIds = [];
      
      for (const [username, id] of userIdMap) {
        if (id !== userId) {
          mentionedUserIds.push(id);
        }
      }

      if (mentionedUserIds.length) {
        await createMentions(repostPostId, userId, mentionedUserIds, 'post');
      }
    }
  }
  return repostPostId;
}

async function deleteRepost(userId, originalPostId) {
  if (!userId || isNaN(userId) || userId <= 0 || !originalPostId || isNaN(originalPostId) || originalPostId <= 0) {
    throw new Error('Invalid user ID or post ID');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT r.repost_post_id FROM reposts r
       JOIN posts p ON p.id = r.repost_post_id
       WHERE r.user_id=? AND r.original_post_id=? AND (p.text IS NULL OR p.text='')
       LIMIT 1`,
      [userId, originalPostId]
    );
    
    if (!rows.length) {
      await connection.rollback();
      return;
    }
    
    const repostPostId = rows[0].repost_post_id;
    await connection.query('DELETE FROM reposts WHERE repost_post_id=?', [repostPostId]);
    await connection.query('DELETE FROM posts WHERE id=?', [repostPostId]);
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getOriginalPostEmbed(originalPostId) {
  if (!originalPostId || isNaN(originalPostId) || originalPostId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [rows] = await db.query(
    `SELECT p.id, p.user_id AS userId, u.name AS author, u.username AS authorUsername,
            u.picture AS authorPicture, u.verified AS authorVerified,
            p.text, p.image, p.video, p.created_at AS createdAt,
            p.is_live, p.live_session_id, p.youtube_id
     FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?`,
    [originalPostId]
  );
  return rows[0] || null;
}

// ── Trending posts ─────────────────────────────────────────
async function getTrendingPosts(limit = 20) {
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.created_at       AS createdAt,
       p.is_live,
       p.live_session_id,
       p.youtube_id,
       (
         (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) * 1 +
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 2 +
         (SELECT COUNT(*) FROM reposts  WHERE original_post_id = p.id) * 3
       ) AS engagement_score
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.created_at >= NOW() - INTERVAL 24 HOUR
     ORDER BY engagement_score DESC, p.created_at DESC
     LIMIT ?`,
    [limit]
  );

  if (!rawPosts.length) return [];
  return hydratePosts(rawPosts);
}

// ── Search posts ───────────────────────────────────────────
async function searchPosts(query, { limit = 20, offset = 0 } = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('Search query is required');
  }
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  offset = Math.max(0, parseInt(offset) || 0);
  
  const escaped = query.replace(/[%_\\]/g, '\\$&');
  const like = `%${escaped}%`;
  const [rows] = await db.query(
    `SELECT p.id, p.user_id AS userId, u.name AS author, u.username AS authorUsername,
            u.picture AS authorPicture, u.verified AS authorVerified,
            p.text, p.image, p.video, p.is_repost AS isRepost, 
            p.original_post_id AS originalPostId,
            p.group_id AS groupId,
            p.created_at AS createdAt,
            p.is_live, p.live_session_id, p.youtube_id,
            (SELECT COUNT(*) FROM likes    WHERE post_id=p.id)           AS likeCount,
            (SELECT COUNT(*) FROM comments WHERE post_id=p.id)           AS commentCount,
            (SELECT COUNT(*) FROM reposts  WHERE original_post_id=p.id)  AS repostCount,
            (SELECT COUNT(*) FROM post_views WHERE post_id=p.id)         AS viewCount,
            (SELECT COUNT(*) FROM video_views WHERE post_id=p.id)        AS videoViewCount
     FROM posts p 
     JOIN users u ON u.id = p.user_id
     WHERE p.text LIKE ? OR u.name LIKE ?
     ORDER BY likeCount DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [like, like, limit, offset]
  );
  
  return hydratePosts(rows);
}

// ── Video posts ────────────────────────────────────────────
async function getVideos({ page = 1, limit = 20 } = {}) {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  const offset = (page - 1) * limit;
  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.created_at       AS createdAt,
       p.is_live,
       p.live_session_id,
       p.youtube_id
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.video IS NOT NULL
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit + 1, offset]
  );

  const hasMore = rawPosts.length > limit;
  const pagePosts = rawPosts.slice(0, limit);
  const hydrated = await hydratePosts(pagePosts);
  return { videos: hydrated, hasMore, page, limit };
}

// ── View counts ────────────────────────────────────────────
async function recordView(postId, viewerId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  if (!viewerId) {
    throw new Error('Viewer ID is required');
  }
  await db.query(
    `INSERT INTO post_views (post_id, viewer_key) VALUES (?, ?)`,
    [postId, String(viewerId)]
  );
}

async function getViewCount(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM post_views WHERE post_id = ?',
    [postId]
  );
  return Number(total);
}

// ── Video views ────────────────────────────────────────────
function meetsViewThreshold(watchedSeconds, duration) {
  if (!duration || duration <= 0) return watchedSeconds >= 3;
  const threshold = Math.min(3, duration * 0.5);
  return watchedSeconds >= threshold;
}

async function recordVideoView(postId, viewerId, watchedSeconds, duration) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  if (!viewerId) {
    throw new Error('Viewer ID is required');
  }
  if (watchedSeconds === undefined || watchedSeconds === null || isNaN(watchedSeconds)) {
    throw new Error('Watched seconds is required');
  }

  if (!meetsViewThreshold(watchedSeconds, duration)) {
    const views = await getVideoViewCount(postId);
    return { counted: false, views };
  }

  const date = new Date();
  const dateOnly = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

  const [result] = await db.query(
    `INSERT IGNORE INTO video_views (post_id, viewer_key, date_only)
     VALUES (?, ?, ?)`,
    [postId, String(viewerId), dateOnly]
  );

  const views = await getVideoViewCount(postId);
  return { counted: result && result.affectedRows > 0, views };
}

async function getVideoViewCount(postId) {
  if (!postId || isNaN(postId) || postId <= 0) {
    throw new Error('Invalid post ID');
  }
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM video_views WHERE post_id = ?',
    [postId]
  );
  return Number(total);
}

// ── Topic extraction ──────────────────────────────────────
const TOPIC_STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','her','was','one',
  'our','out','day','get','has','him','his','how','its','let','may','new',
  'now','old','see','two','way','who','boy','did','man','men','put','say',
  'she','too','use','had','have','that','this','with','they','from','been',
  'will','what','were','when','your','said','each','just','into','then',
  'than','some','more','also','over','such','here','know','like','time',
  'very','even','most','make','after','first','well','much','good','want',
  'came','come','back','does','made','many','them','these','other','about',
  'their','there','which','would','could','should','really','think','going',
  'still','being','where','every','those','while','before','again','through',
  'because','always','never','people','thing','things','anyone','someone',
  'something','anything','nothing','everyone','everything','little','great',
  'might','only','both','same','last','long','life','give','work','need',
  'feel','seem','keep','tell','next','best','high','look','place','actually',
  'usually','already','another','between','together','without','year','years',
  'today','right','left','sure','stop','took','take','away','around',
  'different','during','since','until','while','just','here','http','https',
  'with','from','that','this','have','been',
]);

function normalizeText(str) {
  return str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function isStopword(word) {
  return TOPIC_STOPWORDS.has(word);
}

function hasMeaningfulWord(phraseWords) {
  return phraseWords.some(w => !isStopword(w) && w.length >= 3);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTopics(text) {
  if (!text) return [];

  const topics = new Set();

  const hashtags = text.match(/#([a-zA-Z0-9_]+)/g) || [];
  hashtags.forEach(tag => topics.add(tag.slice(1).toLowerCase()));

  const body = text.replace(/#[a-zA-Z0-9_]+/g, '');
  const normalized = normalizeText(body);
  const tokens = normalized.split(/\s+/).filter(t => t.length >= 2 && !/^\d+$/.test(t));

  if (tokens.length === 0) return [...topics];

  const candidates = new Set();

  tokens.forEach(word => {
    if (word.length >= 3 && !isStopword(word)) {
      candidates.add(word);
    }
  });

  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const slice = tokens.slice(i, i + n);
      let start = 0, end = n - 1;
      while (start <= end && isStopword(slice[start])) start++;
      while (end >= start && isStopword(slice[end])) end--;
      const trimmed = slice.slice(start, end + 1);
      if (trimmed.length < 2) continue;
      if (!hasMeaningfulWord(trimmed)) continue;
      const phrase = trimmed.join(' ');
      if (phrase.length >= 5) {
        candidates.add(phrase);
      }
    }
  }

  let topicArray = [...candidates];
  topicArray.sort((a, b) => b.length - a.length);

  const filtered = [];
  for (const topic of topicArray) {
    let isRedundant = false;
    for (const kept of filtered) {
      const regex = new RegExp(`\\b${escapeRegex(topic)}\\b`, 'i');
      if (regex.test(kept)) {
        isRedundant = true;
        break;
      }
    }
    if (!isRedundant) {
      filtered.push(topic);
    }
  }

  filtered.forEach(t => topics.add(t));
  return [...topics];
}

async function savePostTopics(postId, text) {
  const topics = extractTopics(text);
  if (!topics.length) return;
  const values = topics.map(topic => [postId, topic, new Date()]);
  await db.query(
    'INSERT IGNORE INTO post_topics (post_id, topic, created_at) VALUES ?',
    [values]
  );
}

async function saveCommentTopics(postId, text) {
  const topics = extractTopics(text);
  if (!topics.length) return;
  const values = topics.map(topic => [postId, topic, new Date()]);
  await db.query(
    `INSERT INTO post_topics (post_id, topic, created_at) VALUES ?
     ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
    [values]
  );
}

async function getTopics(limit = 20) {
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const [rows] = await db.query(
    `SELECT topic, COUNT(*) AS post_count
     FROM post_topics
     WHERE created_at >= NOW() - INTERVAL 24 HOUR
     GROUP BY topic
     ORDER BY post_count DESC, topic ASC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getPostsByTopic(topic, page = 1, limit = 20) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('Topic is required');
  }
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  const OFFSET = (page - 1) * limit;
  const [rawPosts] = await db.query(
    `SELECT
       p.id,
       p.user_id          AS userId,
       u.name             AS author,
       u.username         AS authorUsername,
       u.picture          AS authorPicture,
       u.verified         AS authorVerified,
       p.text,
       p.image,
       p.video,
       p.is_repost        AS isRepost,
       p.original_post_id AS originalPostId,
       p.created_at       AS createdAt,
       p.is_live,
       p.live_session_id,
       p.youtube_id
     FROM post_topics pt
     JOIN posts p ON p.id = pt.post_id
     JOIN users u ON u.id = p.user_id
     WHERE pt.topic = ?
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [topic.toLowerCase(), limit + 1, OFFSET]
  );
  const hasMore   = rawPosts.length > limit;
  const pagePosts = rawPosts.slice(0, limit);
  const posts     = await hydratePosts(pagePosts);
  return { posts, hasMore };
}

module.exports = {
  hydratePosts,
  nestComments,
  getFollowingIds,
  getEngagementMap,
  getSeenPostIds,
  getProfilePosts,
  getTrendingPosts,
  createPost,
  updatePost,
  deletePost,
  findById,
  getPostByIdWithUser,
  getLike,
  addLike,
  removeLike,
  getLikeCount,
  addComment,
  getCommentsOnUserPosts,
  getExistingRepost,
  createRepost,
  deleteRepost,
  getOriginalPostEmbed,
  searchPosts,
  getVideos,
  savePostTopics,
  saveCommentTopics,
  getTopics,
  getPostsByTopic,
  getGroupPosts,
  recordView,
  getViewCount,
  recordVideoView,
  getVideoViewCount,
  getCommentCount,
  getRepostCount,
  getLikers,
  getReposters,
  // ── Mention exports ──
  extractMentions,
  getMentionedUserIds,
  createMentions,
  getMentions,
  markMentionsAsRead,
  getUnreadMentionCount,
};