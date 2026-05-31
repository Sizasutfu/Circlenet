// ============================================================
//  controllers/articleController.js
//  Handles all request/response logic for article routes.
// ============================================================

const ArticleModel        = require('../models/ArticleModel');
const UserModel           = require('../models/userModel');
const NotificationModel   = require('../models/notificationModel');
const FollowModel         = require('../models/followModel');
const PushModel           = require('../models/pushModel');
const { sendOk, sendError } = require('../middleware/response');
const { db }              = require('../config/db');

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

// ── GET /api/articles ─────────────────────────────────────────
async function getArticles(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 6));
  const tag   = req.query.tag  || null;
  const q     = req.query.q    || null;

  try {
    const result = await ArticleModel.getArticles({
      page,
      limit,
      tag,
      q,
      userId: req.actorId || null,
    });
    return sendOk(res, 200, 'Articles fetched.', result);
  } catch (err) {
    console.error('getArticles error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/articles/:id ─────────────────────────────────────
async function getArticleById(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid article ID.');

  try {
    const article = await ArticleModel.findById(id, req.actorId || null);
    if (!article) return sendError(res, 404, 'Article not found.');
    return sendOk(res, 200, 'Article fetched.', article);
  } catch (err) {
    console.error('getArticleById error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/articles/slug/:slug ──────────────────────────────
// Primary public-facing read — this is where views are recorded.
async function getArticleBySlug(req, res) {
  const { slug } = req.params;
  if (!slug) return sendError(res, 400, 'Slug is required.');

  try {
    const article = await ArticleModel.findBySlug(slug, req.actorId || null);
    if (!article) return sendError(res, 404, 'Article not found.');

    // ── Record view (fire-and-forget, never block the response) ──
    // We don't await so a slow DB write never slows down page load.
    // Errors are logged but swallowed — a failed view record is not
    // worth returning a 500 to the reader.
    ArticleModel.recordView(
      article.id,
      req.actorId || null,
      req.ip
    ).then(({ recorded, viewCount }) => {
      if (recorded) {
        // Optionally update the value already in `article` for the
        // response — but since we fire-and-forget this runs AFTER the
        // response is sent, so it only matters for logging here.
        console.debug(`[views] article=${article.id} total=${viewCount}`);
      }
    }).catch(err => {
      console.error('[views] recordView failed (non-fatal):', err);
    });

    // Attach the current view count before sending
    // (view_count is already on the article object from findBySlug)
    return sendOk(res, 200, 'Article fetched.', article);
  } catch (err) {
    console.error('getArticleBySlug error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/articles/:id/analytics  (admin only) ─────────────
async function getArticleAnalytics(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid article ID.');

  try {
    const article = await ArticleModel.findById(id);
    if (!article) return sendError(res, 404, 'Article not found.');

    const viewAnalytics = await ArticleModel.getViewAnalytics(id);

    return sendOk(res, 200, 'Analytics fetched.', {
      articleId:  id,
      title:      article.title,
      views:      viewAnalytics,
      likes:      article.likes?.length  ?? 0,
      echoes:     article.echoes?.length ?? 0,
      comments:   article.comments?.length ?? 0,
    });
  } catch (err) {
    console.error('getArticleAnalytics error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/articles ────────────────────────────────────────
async function createArticle(req, res) {
  const userId   = req.adminId;
  const userName = req.adminName;

  const { title, excerpt, content, published } = req.body;

  if (!title || !title.trim())
    return sendError(res, 400, 'Title is required.');
  if (!content || !content.trim())
    return sendError(res, 400, 'Content is required.');

  let tags = [];
  try {
    tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    if (!Array.isArray(tags)) tags = [];
  } catch (err) {
    console.error('Tag parse error:', err);
    tags = [];
  }

  const { path: coverPath, url: coverUrl } = resolveFileUrl(req.compressedFiles?.image, req);

  try {
    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'Admin user record not found.');

    const articleId = await ArticleModel.createArticle(userId, {
      title:      title.trim(),
      excerpt:    excerpt?.trim() || null,
      content:    content.trim(),
      coverImage: coverPath,
      tags,
      published:  published === 'true',
    });

    if (published === 'true') {
      const followerIds = await FollowModel.getFollowerIds(userId);
      const sampled = [...followerIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.ceil(followerIds.length * 0.2));

      await Promise.all(
        sampled.map(async fId => {
          const notif = await NotificationModel.createNotification(
            fId, userId, 'new_article', articleId
          );
          await PushModel.sendPushToUser(
            fId,
            'new_article',
            user.name,
            title.trim().slice(0, 100),
            './index.html',
            { articleId, actorId: userId, notifId: notif?.insertId ?? null }
          );
        })
      );
    }

    return sendOk(res, 201, 'Article created.', {
      id:            articleId,
      userId,
      author:        user.name,
      authorPicture: user.picture || null,
      title:         title.trim(),
      excerpt:       excerpt?.trim() || null,
      coverImage:    coverUrl,
      tags,
      published:     published === 'true',
      like_count:    0,
      echo_count:    0,
      comment_count: 0,
      viewCount:     0,
      created_at:    new Date(),
    });
  } catch (err) {
    console.error('createArticle error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── PUT /api/articles/:id ─────────────────────────────────────
async function updateArticle(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid article ID.');

  try {
    const article = await ArticleModel.findById(id);
    if (!article) return sendError(res, 404, 'Article not found.');

    const { title, excerpt, content, published } = req.body;
    if (title !== undefined && !title.trim())     return sendError(res, 400, 'Title cannot be empty.');
    if (content !== undefined && !content.trim()) return sendError(res, 400, 'Content cannot be empty.');

    let tags;
    if (req.body.tags !== undefined) {
      try { tags = JSON.parse(req.body.tags); if (!Array.isArray(tags)) tags = []; }
      catch { tags = []; }
    }

    const { path: coverPath } = resolveFileUrl(req.compressedFiles?.image, req);

    await ArticleModel.updateArticle(id, {
      title:      title?.trim(),
      excerpt:    excerpt?.trim(),
      content:    content?.trim(),
      coverImage: coverPath || undefined,
      tags,
      published:  published !== undefined ? published === 'true' : undefined,
    });

    return sendOk(res, 200, 'Article updated.');
  } catch (err) {
    console.error('updateArticle error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── DELETE /api/articles/:id ──────────────────────────────────
async function deleteArticle(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid article ID.');

  try {
    const article = await ArticleModel.findById(id);
    if (!article) return sendError(res, 404, 'Article not found.');

    await ArticleModel.deleteArticle(id);
    return sendOk(res, 200, 'Article deleted.');
  } catch (err) {
    console.error('deleteArticle error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/articles/:id/like ───────────────────────────────
async function toggleLike(req, res) {
  const articleId = parseInt(req.params.id);
  const userId    = req.actorId;
  if (isNaN(articleId)) return sendError(res, 400, 'Invalid article ID.');

  try {
    const article  = await ArticleModel.findById(articleId);
    if (!article) return sendError(res, 404, 'Article not found.');

    const existing = await ArticleModel.getLike(userId, articleId);

    if (existing) {
      await ArticleModel.removeLike(userId, articleId);
      const total = await ArticleModel.getLikeCount(articleId);
      return sendOk(res, 200, 'Unliked.', { likes: total, liked: false });
    } else {
      await ArticleModel.addLike(userId, articleId);
      const total = await ArticleModel.getLikeCount(articleId);

      if (article.userId !== userId) {
        await NotificationModel.createNotification(
          article.userId, userId, 'article_like', articleId
        );
      }
      return sendOk(res, 200, 'Liked.', { likes: total, liked: true });
    }
  } catch (err) {
    console.error('toggleLike error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/articles/:id/echo ───────────────────────────────
async function toggleEcho(req, res) {
  const articleId = parseInt(req.params.id);
  const userId    = req.actorId;
  if (isNaN(articleId)) return sendError(res, 400, 'Invalid article ID.');

  try {
    const article  = await ArticleModel.findById(articleId);
    if (!article) return sendError(res, 404, 'Article not found.');

    const existing = await ArticleModel.getEcho(userId, articleId);

    if (existing) {
      await ArticleModel.removeEcho(userId, articleId);
      const total = await ArticleModel.getEchoCount(articleId);
      return sendOk(res, 200, 'Echo removed.', { echoes: total, echoed: false });
    } else {
      await ArticleModel.addEcho(userId, articleId);
      const total = await ArticleModel.getEchoCount(articleId);

      if (article.userId !== userId) {
        await NotificationModel.createNotification(
          article.userId, userId, 'article_echo', articleId
        );
      }
      return sendOk(res, 200, 'Echoed.', { echoes: total, echoed: true });
    }
  } catch (err) {
    console.error('toggleEcho error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/articles/tags ────────────────────────────────────
async function getAllTags(req, res) {
  try {
    const [rows] = await db.query(`SELECT DISTINCT tag FROM article_tags ORDER BY tag`);
    const tags = rows.map(r => r.tag);
    return sendOk(res, 200, 'Tags fetched', tags);
  } catch (err) {
    console.error('getAllTags error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// ── POST /api/articles/:id/comment ────────────────────────────
async function addComment(req, res) {
  const articleId = parseInt(req.params.id);
  const userId    = req.actorId;
  const { text, parentId } = req.body;

  if (isNaN(articleId))            return sendError(res, 400, 'Invalid article ID.');
  if (!text || !text.trim())       return sendError(res, 400, 'Comment text is required.');
  if (text.trim().length > 1000)   return sendError(res, 400, 'Comment too long (max 1000 chars).');

  const parentIdInt = parentId ? parseInt(parentId) : null;
  if (parentId && isNaN(parentIdInt)) return sendError(res, 400, 'Invalid parentId.');

  try {
    const article = await ArticleModel.findById(articleId);
    if (!article) return sendError(res, 404, 'Article not found.');

    const user = await UserModel.findById(userId);
    if (!user)  return sendError(res, 404, 'User not found.');

    const commentId = await ArticleModel.addComment(articleId, userId, text.trim(), parentIdInt);

    if (article.userId !== userId) {
      await NotificationModel.createNotification(
        article.userId, userId, 'article_comment', articleId
      );
    }

    return sendOk(res, 201, 'Comment added.', {
      id:            commentId,
      userId,
      parentId:      parentIdInt,
      author:        user.name,
      authorPicture: user.picture || null,
      text:          text.trim(),
      createdAt:     new Date(),
      replies:       parentIdInt ? undefined : [],
    });
  } catch (err) {
    console.error('addComment error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = {
  getArticles,
  getArticleById,
  getArticleBySlug,
  getArticleAnalytics,   // ← new
  createArticle,
  updateArticle,
  deleteArticle,
  toggleLike,
  toggleEcho,
  getAllTags,
  addComment,
};