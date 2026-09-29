// ============================================================
//  routes/followRoutes.js
//  Defines API endpoints for the follow system.
//  Route handlers are in controllers/followController.js.
// ============================================================

const router            = require('express').Router();
const followController  = require('../controllers/followController');
const { requireAuth }   = require('../middleware/auth');

// ── Follow / unfollow — require auth ──────────────────────────
// Both paths are accepted for unfollow. The canonical URL is
// /unfollow/:targetId, but we also alias DELETE /follow/:targetId so
// clients that treat follow and unfollow as the same resource don't
// 404.
router.post(  '/follow/:targetId',   requireAuth, followController.follow);
router.delete('/unfollow/:targetId', requireAuth, followController.unfollow);
router.delete('/follow/:targetId',   requireAuth, followController.unfollow);

// ── Follower / following lists — require auth so we can tag each
//    user with isFollowing relative to the requesting viewer ──
router.get('/followers/:userId', requireAuth, followController.getFollowers);
router.get('/following/:userId', requireAuth, followController.getFollowing);

module.exports = router;