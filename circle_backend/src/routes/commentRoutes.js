// routes/commentRoutes.js
const express = require('express');
const router = express.Router();
const commentCtrl = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');

// ── Thread endpoint (must come before /:id) ──
router.get('/:id/thread', commentCtrl.getCommentThread);

// ── Single comment ──
router.get('/:id', commentCtrl.getComment);

// ── Reply ──
router.post('/:id/reply', requireAuth, commentCtrl.replyToComment);

// ── Comments for a post ──
// NOTE: this route is also defined in postRoutes.js as `/:id/comments`.
// If both routers are mounted at `/api/posts`, whichever registers first
// in server.js wins. The controller accepts either param name (`id` or
// `postId`), so both patterns work — but prefer removing one of the two
// to avoid confusion.
router.get('/:id/comments', commentCtrl.getCommentsByPostId);

module.exports = router;