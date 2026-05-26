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
const { db }              = require('../config/db');   // <-- IMPORTANT: added for getAllTags

const IS_PROD = process.env.NODE_ENV === 'production';

// Same helper as postController — dev local path vs prod Cloudinary URL
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

// ── GET /api/articles ────────────────────────────────────────
async function getArticles(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 6));
  const tag   = req.query.tag  || null;
  const q     = req.query.q    || null;

  try {
    // ✅ Pass the authenticated user ID so the model can set userLiked / userEchoed
    const result = await ArticleModel.getArticles({
      page,
      limit,
      tag,
      q,
      userId: req.actorId   // <-- CRITICAL FIX
    });
    return sendOk(res, 200, 'Articles fetched.', result);
  } catch (err) {
    console.error('getArticles error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/articles/:id ────────────────────────────────────
async function getArticleById(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid article ID.');

  try {
    // ✅ Also pass userId for like/echo status
    const article = await ArticleModel.findById(id, req.actorId);
    if (!article) return sendError(res, 404, 'Article not found.');
    return sendOk(res, 200, 'Article fetched.', article);
  } catch (err) {
    console.error('getArticleById error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/articles ───────────────────────────────────────
async function createArticle(req, res) {
  // ... (unchanged, keep as is) ...
}

// ── PUT /api/articles/:id ────────────────────────────────────
async function updateArticle(req, res) {
  // ... (unchanged, keep as is) ...
}

// ── DELETE /api/articles/:id ─────────────────────────────────
async function deleteArticle(req, res) {
  // ... (unchanged, keep as is) ...
}

// ── POST /api/articles/:id/like  (toggle) ────────────────────
async function toggleLike(req, res) {
  // ... (unchanged, keep as is) ...
}

// ── POST /api/articles/:id/echo  (toggle) ────────────────────
async function toggleEcho(req, res) {
  // ... (unchanged, keep as is) ...
}

// ── GET /api/articles/tags ───────────────────────────────────
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

// ── POST /api/articles/:id/comment ───────────────────────────
async function addComment(req, res) {
  // ... (unchanged, keep as is) ...
}

// ✅ Export all functions including getAllTags
module.exports = {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  toggleLike,
  toggleEcho,
  getAllTags,     // <-- ADDED
  addComment,
};