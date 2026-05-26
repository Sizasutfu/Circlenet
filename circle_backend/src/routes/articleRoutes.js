// ============================================================
//  routes/articleRoutes.js
//  Defines API endpoints for articles, likes, echoes, comments.
//  Route handlers are in controllers/articleController.js.
//
//  Mount in your main app/server file:
//    const articleRoutes = require('./routes/articleRoutes');
//    app.use('/api/articles', articleRoutes);
// ============================================================

const router             = require('express').Router();
const articleController  = require('../controllers/articleController');
const { requireAuth }    = require('../middleware/auth');
const upload             = require('../middleware/upload');
const { compressUploads} = require('../middleware/compress');

// ── Read — public ─────────────────────────────────────────────
// GET /api/articles?page=1&limit=6&tag=tech&q=search+term
router.get('/',    articleController.getArticles);

// GET /api/articles/:id
router.get('/:id', articleController.getArticleById);

// ── Write — requires auth ─────────────────────────────────────
// POST /api/articles  (multipart — cover image optional)
// Body fields: title, excerpt, content, tags (JSON array), published
// File field:  image  (cover image, processed by compressUploads)
router.post(
  '/',
  requireAuth,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  articleController.createArticle
);

// PUT /api/articles/:id  (partial update — any subset of fields)
// Same multipart setup so cover image can be swapped
router.put(
  '/:id',
  requireAuth,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  articleController.updateArticle
);

// DELETE /api/articles/:id
router.delete('/:id', requireAuth, articleController.deleteArticle);

// ── Interactions — all require auth ───────────────────────────
// POST /api/articles/:id/like   (toggles like / unlike)
router.post('/:id/like',    requireAuth, articleController.toggleLike);

// POST /api/articles/:id/echo   (toggles echo / un-echo)
router.post('/:id/echo',    requireAuth, articleController.toggleEcho);

// POST /api/articles/:id/comment
// Body: { text: string, parentId?: number }
router.post('/:id/comment', requireAuth, articleController.addComment);

router.get('/tags', articleController.getAllTags);

module.exports = router;
