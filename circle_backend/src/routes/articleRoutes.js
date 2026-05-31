// ============================================================
//  routes/articleRoutes.js
//  Defines API endpoints for articles, likes, echoes, comments.
// ============================================================

const router             = require('express').Router();
const articleController  = require('../controllers/articleController');
const { requireAuth }    = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const upload             = require('../middleware/upload');
const { compressUploads } = require('../middleware/compress');

// ── Read — public ─────────────────────────────────────────────
router.get('/',          articleController.getArticles);
router.get('/tags',           articleController.getAllTags);
router.get('/by-slug/:slug',  articleController.getArticleBySlug);  // must be before /:id
router.get('/:id',       articleController.getArticleById);

// ── Write — requires auth ─────────────────────────────────────
router.post(
  '/',
  requireAdmin,   // <-- only admins can create articles
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  articleController.createArticle
);

router.put(
  '/:id',
  requireAdmin,   // <-- only admins can update articles
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  articleController.updateArticle
);

router.delete('/:id', requireAdmin, articleController.deleteArticle);  // <-- only admins can delete articles

// ── Interactions — all require auth ───────────────────────────
router.post('/:id/like',    requireAuth, articleController.toggleLike);
router.post('/:id/echo',    requireAuth, articleController.toggleEcho);
router.post('/:id/comment', requireAuth, articleController.addComment);

router.get('/:id/analytics', requireAdmin, articleController.getArticleAnalytics);

module.exports = router;