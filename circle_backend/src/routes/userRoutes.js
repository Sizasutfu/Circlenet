// ============================================================
//  routes/userRoutes.js
//  Defines API endpoints for user operations.
//  Route handlers are in controllers/userController.js.
// ============================================================

const router           = require('express').Router();
const userController   = require('../controllers/userController');
const { requireAuth }  = require('../middleware/auth');
const { requestPasswordReset, confirmResetPassword, sendVerification, verifyEmail } = require("../controllers/authController");
const upload              = require('../middleware/upload');
const { compressUploads } = require('../middleware/compress');
const followController    = require('../controllers/followController');
const UserModel           = require('../models/userModel');

// Public routes — no auth required
router.post('/register',        userController.register);
router.post('/login',           userController.login);
router.get( '/:id/profile',     userController.getProfile);

// Search users — must be before /:id to avoid route conflict
// GET /api/users?search=alice&limit=8
router.get('/', requireAuth, userController.searchUsers);

// New members — joined in last 7 days
// GET /api/users/new-members?limit=10
router.get('/new-members', userController.getNewMembers);

// Follow lists — aliases so frontend can call /:id/following and /:id/followers
// (canonical routes in followRoutes use /following/:userId shape)
router.get('/:id/following', (req, res, next) => {
  req.params.userId = req.params.id;
  followController.getFollowing(req, res, next);
});
router.get('/:id/followers', (req, res, next) => {
  req.params.userId = req.params.id;
  followController.getFollowers(req, res, next);
});

// E2E encryption public key — used for encrypted DMs
// GET /api/users/:id/publickey  → { publicKey: "<b64 spki>" }
router.get('/:id/publickey', async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    const publicKey = await UserModel.getPublicKey(userId);
    return res.json({ publicKey: publicKey || null });
  } catch (err) {
    console.error('get publickey error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/users/:id/publickey  { publicKey: "<b64 spki>" }
router.put('/:id/publickey', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (req.actorId !== userId)
    return res.status(403).json({ error: 'Forbidden.' });

  const { publicKey } = req.body;
  if (!publicKey)
    return res.status(400).json({ error: 'publicKey is required.' });

  try {
    await UserModel.savePublicKey(userId, publicKey);
    return res.json({ message: 'Public key saved.' });
  } catch (err) {
    console.error('put publickey error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// Protected routes — must send X-User-Id header
router.put('/:id/picture', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }]), compressUploads, userController.updatePicture);
router.put('/:id/cover', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }]), compressUploads, userController.updateCoverImage);
router.put('/:id',         requireAuth, userController.updateProfile);
router.put('/:id/username', requireAuth, userController.updateUsername);
// ── Get user by username (public) ──
// GET /api/users/by-username/:username
router.get('/by-username/:username', userController.getUserByUsername);
router.post("/reset-password",         requestPasswordReset);
router.post("/reset-password/confirm", confirmResetPassword);

router.post("/email/send-verification", sendVerification);
router.post("/email/verify",            verifyEmail);

module.exports = router;