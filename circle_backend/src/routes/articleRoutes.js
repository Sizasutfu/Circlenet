// ============================================================
//  routes/articleRoutes.js
//  Defines API endpoints for articles, likes, echoes, comments.
// ============================================================

const router             = require('express').Router();
const articleController  = require('../controllers/articleController');
const { requireAuth }    = require('../middleware/auth');
const upload             = require('../middleware/upload');
const { compressUploads } = require('../middleware/compress');

// ── Read — public ─────────────────────────────────────────────
router.get('/',          articleController.getArticles);
router.get('/tags',      articleController.getAllTags);       // added
router.get('/:id',       articleController.getArticleById);

// ── Write — requires auth ─────────────────────────────────────
router.post(
  '/',
  requireAuth,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  articleController.createArticle
);

router.put(
  '/:id',
  requireAuth,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  articleController.updateArticle
);

router.delete('/:id', requireAuth, articleController.deleteArticle);

// ── Interactions — all require auth ───────────────────────────
router.post('/:id/like',    requireAuth, articleController.toggleLike);
router.post('/:id/echo',    requireAuth, articleController.toggleEcho);
router.post('/:id/comment', requireAuth, articleController.addComment);

module.exports = router;