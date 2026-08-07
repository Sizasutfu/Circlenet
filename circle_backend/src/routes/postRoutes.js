// ============================================================
//  routes/postRoutes.js
//  Defines API endpoints for post, like, comment, repost.
//  Route handlers are in controllers/postController.js and commentController.js.
// ============================================================

const router                    = require('express').Router();
const postController            = require('../controllers/postController');
const commentController         = require('../controllers/commentController');
const { requireAuth }           = require('../middleware/auth');
const upload                    = require('../middleware/upload');
const { compressUploads }       = require('../middleware/compress');

// Feed — public (viewerId optional for personalisation)
router.get('/', postController.getPosts);



// Post CRUD
router.post('/', requireAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]), compressUploads, postController.createPost);

router.get('/:id',             postController.getPostById);
router.delete('/:id', requireAuth, postController.deletePost);

// Interactions
router.post('/:id/like',    requireAuth, postController.toggleLike);
router.post('/:id/comment', requireAuth, postController.addComment);
router.post('/:id/repost',   requireAuth, postController.repost);

// Comments
router.get('/:id/comments', commentController.getCommentsByPostId);
router.get('/:id/comments-on-posts', requireAuth, postController.getCommentsOnUserPosts);

// View counts
router.post('/:id/view', postController.recordView);
router.post('/:id/skip', requireAuth, postController.recordSkip);
router.put('/:id', requireAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]), compressUploads, postController.updatePost);
router.post('/:id/video-view', requireAuth, postController.recordVideoView);

module.exports = router;