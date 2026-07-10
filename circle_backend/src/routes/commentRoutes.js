// routes/comments.js
const express = require('express');
const router = express.Router();
const commentCtrl = require('../controllers/commentController');
const { requireAuth } = require('../middleware/auth');

router.get('/:id', commentCtrl.getComment);
router.post('/:id/reply', requireAuth, commentCtrl.replyToComment);
router.get('/:postId/comments', commentCtrl.getCommentsByPostId);

module.exports = router;