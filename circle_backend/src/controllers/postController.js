// ============================================================
//  controllers/postController.js
//  Handles all request/response logic for post routes.
//  Compression is handled by middleware/compress.js which
//  runs before this controller — files are already saved to
//  disk and their filenames are in req.compressedFiles.
// ============================================================

const PostModel             = require('../models/postModel');
const UserModel             = require('../models/userModel');
const NotificationModel     = require('../models/notificationModel');
const FollowModel           = require('../models/followModel');
const PushModel             = require('../models/pushModel');
const TopicPreferenceModel  = require('../models/topicPreferenceModel');
const NegativeSignalModel   = require('../models/negativeSignalModel');
const GroupModel            = require('../models/groupModel');
const ContentTypePreference = require('../models/contentTypePreferenceModel');

const { getPostsPage }      = require('../feed/feedPipeline');
const { db }                = require('../config/db');
const { sendOk, sendError } = require('../middleware/response');
const { notifyUser, isOnline, broadcastToAll } = require('../../wsServer');

const IS_PROD = process.env.NODE_ENV === 'production';

function resolveFileUrl(compressed, req) {
  if (!compressed) return { path: null, url: null };

  if (IS_PROD) {
    const url = compressed.secure_url;
    return { path: url, url };
  }

  const relativePath = `/uploads/${compressed.filename}`;
  const baseUrl      = `${req.protocol}://${req.get('host')}`;
  return { path: relativePath, url: `${baseUrl}${relativePath}` };
}

function extractYouTubeId(text) {
  if (!text) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(?:[&?]|$)/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// GET /api/posts?userId=<id>&feed=global|following&page=<n>&limit=<n>&media=video
async function getPosts(req, res) {
  const profileUserId = req.query.userId ? parseInt(req.query.userId) : null;
  const feedMode      = req.query.feed === 'following' ? 'following' : 'global';
  const page          = Math.max(1, parseInt(req.query.page)  || 1);
  const limit         = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  try {
    if (profileUserId) {
      const result  = await PostModel.getProfilePosts(profileUserId, page, limit);
      const posts   = result.posts   ?? result ?? [];
      const hasMore = result.hasMore ?? (posts.length === limit);
      return sendOk(res, 200, 'Posts fetched.', { posts, hasMore, page, limit });
    }

    const viewerUserId = req.actorId || (req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null);
    const mediaFilter  = req.query.media === 'video' ? 'video' : null;

    const result = await getPostsPage(viewerUserId, feedMode, page, limit, mediaFilter);
    return sendOk(res, 200, 'Posts fetched.', result);
  } catch (err) {
    console.error('getPosts error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// GET /api/posts/:id
async function getPostById(req, res) {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return sendError(res, 400, 'Invalid post ID.');

  try {
    const [rows] = await db.query(
      `SELECT
         p.id,
         p.user_id          AS userId,
         u.name             AS author,
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

    if (!rows.length) return sendError(res, 404, 'Post not found.');

    const [post] = await PostModel.hydratePosts(rows);
    return sendOk(res, 200, 'Post fetched.', post);
  } catch (err) {
    console.error('getPostById error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts
async function createPost(req, res) {
  const userId = req.actorId;
  const text   = req.body.text || '';

  const { path: imagePath, url: imageUrl } = resolveFileUrl(req.compressedFiles?.image, req);
  const { path: videoPath, url: videoUrl } = resolveFileUrl(req.compressedFiles?.video, req);

  if (!text && !imagePath && !videoPath)
    return sendError(res, 400, 'A post must have text, an image, or a video.');

  const groupId = req.body.groupId ? parseInt(req.body.groupId) : null;
  let group = null;
  if (groupId) {
    if (isNaN(groupId) || groupId < 1)
      return sendError(res, 400, 'Invalid groupId.');

    group = await GroupModel.getGroupById(groupId, userId);
    if (!group)
      return sendError(res, 404, 'Group not found.');
    if (!group.isMember)
      return sendError(res, 403, 'You must be a member of this group to post in it.');
  }

  const isLive = req.body.isLive === true || req.body.isLive === 'true';
  const liveSessionId = req.body.liveSessionId || null;
  const youtubeId = extractYouTubeId(text);

  try {
    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    const postId = await PostModel.createPost(
      userId,
      text,
      imagePath,
      videoPath,
      groupId,
      isLive,
      liveSessionId,
      youtubeId
    );

    await PostModel.savePostTopics(postId, text);

    const followerIds = await FollowModel.getFollowerIds(userId);
    const sampled = [...followerIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.ceil(followerIds.length * 0.2));

    await Promise.all(
      sampled.map(async fId => {
        const notif = await NotificationModel.createNotification(fId, userId, 'new_post', postId);
        notifyUser(fId, 'new_post', {
          actorId:   userId,
          actorName: user.name,
          postId,
          notifId:   notif?.insertId ?? null,
        });
        if (!isOnline(fId)) {
          await PushModel.sendPushToUser(
            fId,
            'new_post',
            user.name,
            text ? text.slice(0, 100) : '📷 New post',
            './',
            { postId, actorId: userId, notifId: notif?.insertId ?? null }
          );
        }
      })
    );

    await broadcastPostCounts(postId);

    return sendOk(res, 201, 'Posted.', {
      id:            postId,
      userId,
      author:        user.name,
      authorPicture: user.picture || null,
      authorVerified: user.verified || null,
      text,
      image:         imageUrl,
      video:         videoUrl,
      groupId:       groupId || null,
      groupName:     groupId ? group.displayName : null,
      groupTopic:    groupId ? group.topic       : null,
      isLive,
      liveSessionId,
      youtubeId,
      likes: [],
      reposts: [],
      comments: [],
      isRepost:      false,
      createdAt:     new Date(),
    });
  } catch (err) {
    console.error('createPost error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// DELETE /api/posts/:id
async function deletePost(req, res) {
  const postId = parseInt(req.params.id);

  try {
    const post = await PostModel.findById(postId);
    if (!post)                        return sendError(res, 404, 'Post not found.');
    if (post.user_id !== req.actorId) return sendError(res, 403, 'Not your post.');

    await PostModel.deletePost(postId);
    return sendOk(res, 200, 'Post deleted.');
  } catch (err) {
    console.error('deletePost error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts/:id/like
async function toggleLike(req, res) {
  const postId = parseInt(req.params.id);
  const userId = req.actorId;

  try {
    const existing = await PostModel.getLike(userId, postId);

    if (existing) {
      await PostModel.removeLike(userId, postId);
      const total = await PostModel.getLikeCount(postId);
      await broadcastPostCounts(postId);
      return sendOk(res, 200, 'Unliked.', { likes: total, liked: false });
    } else {
      await PostModel.addLike(userId, postId);
      const total = await PostModel.getLikeCount(postId);

      await ContentTypePreference.incrementEngagement(userId, postId);

      const post = await PostModel.findById(postId);
      if (post && post.user_id !== userId) {
        const notif = await NotificationModel.createNotification(post.user_id, userId, 'like', postId);
        const topics = await TopicPreferenceModel.getPostTopics(postId);
        await TopicPreferenceModel.recordEngagement(userId, topics, 'like');
        const actor = await UserModel.findById(userId);
        notifyUser(post.user_id, 'like', {
          actorId:   userId,
          actorName: actor?.name ?? 'Someone',
          postId,
          notifId:   notif?.insertId ?? null,
        });
      }

      await broadcastPostCounts(postId);
      return sendOk(res, 200, 'Liked.', { likes: total, liked: true });
    }
  } catch (err) {
    console.error('toggleLike error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts/:id/comment
async function addComment(req, res) {
  const postId             = parseInt(req.params.id);
  const userId             = req.actorId;
  const { text, parentId } = req.body;

  if (!text) return sendError(res, 400, 'Comment text is required.');

  const parentIdInt = parentId ? parseInt(parentId) : null;
  if (parentId && (isNaN(parentIdInt) || parentIdInt < 1)) {
    return sendError(res, 400, 'Invalid parentId.');
  }

  try {
    const post = await PostModel.findById(postId);
    if (!post) return sendError(res, 404, 'Post not found.');

    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    const commentId = await PostModel.addComment(postId, userId, text, parentIdInt);

    await ContentTypePreference.incrementEngagement(userId, postId);

    const commentData = {
      id:            commentId,
      userId,
      parentId:      parentIdInt,
      author:        user.name,
      authorPicture: user.picture || null,
      text,
      createdAt:     new Date().toISOString(),
      replies:       parentIdInt ? undefined : [],
    };

    if (post.user_id !== userId) {
      await NotificationModel.createNotification(post.user_id, userId, 'comment', postId);
      notifyUser(post.user_id, 'comment', {
        actorId:   userId,
        actorName: user.name,
        postId,
        comment:   commentData,
      });
    }

    const topics = await TopicPreferenceModel.getPostTopics(postId);
    await TopicPreferenceModel.recordEngagement(userId, topics, 'comment');

    broadcastToAll({
      type:    'new_comment',
      postId:  post.id,
      comment: commentData,
    });

    await broadcastPostCounts(postId);

    return sendOk(res, 201, 'Comment added.', commentData);
  } catch (err) {
    console.error('addComment error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts/:id/repost
async function repost(req, res) {
  const origId  = parseInt(req.params.id);
  const userId  = req.actorId;
  const { text } = req.body;
  const isQuote = text && text.trim().length > 0;

  try {
    const original = await PostModel.findById(origId);
    if (!original) return sendError(res, 404, 'Original post not found.');

    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    if (!isQuote) {
      const dup = await PostModel.getExistingRepost(userId, origId);
      if (dup) return sendError(res, 409, 'Already reposted.');
    }

    const repostId  = await PostModel.createRepost(userId, text, origId);
    const origEmbed = await PostModel.getOriginalPostEmbed(origId);

    await ContentTypePreference.incrementEngagement(userId, origId);

    if (original.user_id !== userId) {
      await NotificationModel.createNotification(original.user_id, userId, 'repost', origId);
      notifyUser(original.user_id, 'repost', {
        actorId:   userId,
        actorName: user.name,
        postId:    origId,
      });
    }

    const topics = await TopicPreferenceModel.getPostTopics(origId);
    await TopicPreferenceModel.recordEngagement(userId, topics, 'repost');

    await broadcastPostCounts(origId);

    return sendOk(res, 201, 'Reposted.', {
      id:             repostId,
      userId,
      author:         user.name,
      authorPicture:  user.picture || null,
      text:           text || '',
      image:          null,
      video:          null,
      isRepost:       true,
      originalPostId: origId,
      originalPost:   origEmbed,
      likes: [],
      reposts: [],
      comments: [],
      createdAt:      new Date(),
    });
  } catch (err) {
    console.error('repost error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── Helper to broadcast counts ──
async function broadcastPostCounts(postId) {
  const [likes, comments, reposts] = await Promise.all([
    PostModel.getLikeCount(postId),
    PostModel.getCommentCount(postId),
    PostModel.getRepostCount(postId),
  ]);
  broadcastToAll({
    type: 'post_counts',
    postId,
    likes,
    comments,
    reposts,
  });
}

async function getCommentsOnUserPosts(req, res) {
  const userId = parseInt(req.params.id);
  const limit = Math.min(50, parseInt(req.query.limit) || 3);
  if (!userId) return sendError(res, 400, 'Invalid user ID.');
  try {
    const comments = await PostModel.getCommentsOnUserPosts(userId, limit);
    return sendOk(res, 200, 'Comments fetched.', comments);
  } catch (err) {
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts/:id/view
async function recordView(req, res) {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return sendError(res, 400, 'Invalid post ID.');

  const userId   = req.actorId;
  const viewerId = userId || req.body.fingerprint || req.ip;
  const dwellMs  = req.body.dwellMs != null ? Number(req.body.dwellMs) : null;

  try {
    await PostModel.recordView(postId, viewerId);

    if (userId && dwellMs !== null) {
      await NegativeSignalModel.recordDwellView(userId, postId, dwellMs);
    }

    const total = await PostModel.getViewCount(postId);
    return sendOk(res, 200, 'View recorded.', { views: total });
  } catch (err) {
    console.error('recordView error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts/:id/skip
async function recordSkip(req, res) {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return sendError(res, 400, 'Invalid post ID.');

  const userId = req.actorId;
  if (!userId) return sendOk(res, 200, 'Skip ignored (guest).');

  try {
    await NegativeSignalModel.recordSkip(userId, postId);
    return sendOk(res, 200, 'Skip recorded.');
  } catch (err) {
    console.error('recordSkip error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/posts/:id/video-view
async function recordVideoView(req, res) {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return sendError(res, 400, 'Invalid post ID.');

  const watchedSeconds = Number(req.body.watchedSeconds);
  const duration       = Number(req.body.duration);
  if (isNaN(watchedSeconds) || watchedSeconds < 0) {
    return sendError(res, 400, 'watchedSeconds is required.');
  }

  const userId   = req.actorId;
  const viewerId = userId || req.body.fingerprint || req.ip;

  try {
    const post = await PostModel.findById(postId);
    if (!post) return sendError(res, 404, 'Post not found.');
    if (!post.video && !post.youtube_id) {
      return sendError(res, 400, 'This post has no video.');
    }

    const { counted, views } = await PostModel.recordVideoView(
      postId, viewerId, watchedSeconds, duration
    );

    if (counted && userId) {
      await ContentTypePreference.incrementEngagement(userId, postId);
    }

    return sendOk(res, 200, 'Video view recorded.', { counted, views });
  } catch (err) {
    console.error('recordVideoView error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// GET /api/topics?limit=<n>
async function getTopics(req, res) {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  try {
    const topics = await PostModel.getTopics(limit);
    return sendOk(res, 200, 'Topics fetched.', topics);
  } catch (err) {
    console.error('getTopics error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// GET /api/topics/:topic/posts?page=<n>&limit=<n>
async function getPostsByTopic(req, res) {
  const topic = req.params.topic?.toLowerCase();
  if (!topic) return sendError(res, 400, 'Topic is required.');
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  try {
    const result = await PostModel.getPostsByTopic(topic, page, limit);
    return sendOk(res, 200, 'Posts fetched.', result);
  } catch (err) {
    console.error('getPostsByTopic error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// GET /api/groups/:groupId/posts?page=<n>&limit=<n>
async function getGroupPosts(req, res) {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId) || groupId < 1)
    return sendError(res, 400, 'Invalid group ID.');

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  try {
    const result = await PostModel.getGroupPosts(groupId, page, limit);
    return sendOk(res, 200, 'Group posts fetched.', result);
  } catch (err) {
    console.error('getGroupPosts error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// PUT /api/posts/:id
async function updatePost(req, res) {
  const postId = Number(req.params.id);
  const { text, isLive, liveSessionId, youtubeId } = req.body;

  if (text === undefined && isLive === undefined && liveSessionId === undefined && youtubeId === undefined) {
    return sendError(res, 400, 'No fields to update.');
  }

  try {
    const post = await PostModel.findById(postId);
    if (!post) return sendError(res, 404, 'Post not found.');
    if (post.user_id !== req.actorId) {
      return sendError(res, 403, 'You can only edit your own posts.');
    }

    let updatedText = post.text;
    let updatedIsLive = post.is_live;
    let updatedLiveSessionId = post.live_session_id;
    let updatedYoutubeId = post.youtube_id;

    if (text !== undefined) {
      if (!text.trim()) return sendError(res, 400, 'Post text cannot be empty.');
      if (text.trim().length > 500) return sendError(res, 400, 'Post text exceeds 500 characters.');
      updatedText = text.trim();
      if (youtubeId === undefined) {
        updatedYoutubeId = extractYouTubeId(updatedText);
      }
    }

    if (isLive !== undefined) {
      updatedIsLive = isLive === true || isLive === 'true';
    }

    if (liveSessionId !== undefined) {
      updatedLiveSessionId = liveSessionId || null;
    }

    if (youtubeId !== undefined) {
      updatedYoutubeId = youtubeId;
    }

    await PostModel.updatePost(postId, updatedText, updatedIsLive, updatedLiveSessionId, updatedYoutubeId);
    return sendOk(res, 200, 'Post updated.');
  } catch (e) {
    console.error('Edit post error:', e);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/videos?page=1&limit=50 ─────────────────────────
async function getVideos(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  try {
    const result = await PostModel.getVideos({ page, limit });
    return sendOk(res, 200, 'Videos fetched.', result.videos, {
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    });
  } catch (err) {
    console.error('getVideos error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = {
  getPosts,
  getPostById,
  createPost,
  deletePost,
  toggleLike,
  addComment,
  repost,
  recordView,
  recordVideoView,
  recordSkip,
  getTopics,
  getPostsByTopic,
  getGroupPosts,
  updatePost,
  getCommentsOnUserPosts,
  getVideos,           // ✅ added
};