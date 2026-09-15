// ============================================================
//  routes/userRoutes.js
//  Defines API endpoints for user operations.
//  Route handlers are in controllers/userController.js.
// ============================================================

const router           = require('express').Router();
const userController   = require('../controllers/userController');
const { requireAuth }  = require('../middleware/auth');
const { requestPasswordReset, confirmResetPassword, sendVerification, verifyEmail } = require("../controllers/authController");
const { requireAdmin } = require('../middleware/adminAuth');

const upload              = require('../middleware/upload');
const { compressUploads } = require('../middleware/compress');
const followController    = require('../controllers/followController');
const UserModel           = require('../models/userModel');
const { toggleVerification } = require('../controllers/userController');
const postController      = require('../controllers/postController');

// ════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES — No authentication required
// ════════════════════════════════════════════════════════════════

// ─── Authentication ──────────────────────────────────────────────
router.post('/register',        userController.register);
router.post('/login',           userController.login);

router.get('/:id/dashboard', requireAuth, userController.getDashboard);

// ─── Password Reset ──────────────────────────────────────────────
router.post("/reset-password",         requestPasswordReset);
router.post("/reset-password/confirm", confirmResetPassword);

// ─── Email Verification ──────────────────────────────────────────
router.post("/email/send-verification", sendVerification);
router.post("/email/verify",            verifyEmail);

// ─── Restore Deleted Account ─────────────────────────────────────
router.post('/restore', userController.restoreAccount);

// ─── Get User by Username ────────────────────────────────────────
router.get('/by-username/:username', userController.getUserByUsername);

// ─── New Members ─────────────────────────────────────────────────
// Must come BEFORE the generic /:id routes so it isn't swallowed
router.get('/new-members', userController.getNewMembers);

// ─── Get User Profile ────────────────────────────────────────────
router.get('/:id/profile', userController.getProfile);

// ════════════════════════════════════════════════════════════════
//  PROTECTED ROUTES — Authentication required
// ════════════════════════════════════════════════════════════════

// ─── Search Users ─────────────────────────────────────────────────
router.get('/', requireAuth, userController.searchUsers);

// ─── Account Deletion Status ─────────────────────────────────────
router.get('/:id/deletion-status', requireAuth, userController.getDeletionStatus);

// ─── Change Password (logged-in user) ────────────────────────────
router.put('/:id/password', requireAuth, userController.changePassword);

// ─── Delete Account ──────────────────────────────────────────────
// DELETE /api/users/:id — Soft delete user account (30-day grace period)
router.delete('/:id', requireAuth, userController.deleteAccount);

// ─── Follow Lists ─────────────────────────────────────────────────
router.get('/:id/following', (req, res, next) => {
  req.params.userId = req.params.id;
  followController.getFollowing(req, res, next);
});
router.get('/:id/followers', (req, res, next) => {
  req.params.userId = req.params.id;
  followController.getFollowers(req, res, next);
});

// ─── E2E Encryption Public Key ───────────────────────────────────
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

router.put('/:id/publickey', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (req.actorId !== userId)
    return res.status(403).json({ error: 'Forbidden.' });

  const { publicKey } = req.body || {};
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

// ─── Dedicated picture / cover routes (single-purpose) ───────────
router.put(
  '/:id/picture',
  requireAuth,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  userController.updatePicture
);
router.put(
  '/:id/cover',
  requireAuth,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  compressUploads,
  userController.updateCoverImage
);

// ─── Combined profile update (text + optional avatar / cover) ─────
// ⚠️  This route accepts multipart/form-data with:
//     - text fields: name, username, email, bio, phone, location, website, ...
//     - file fields: avatar (image), coverImage (image)
//     Multer must run first to populate req.body and req.files.
router.put(
  '/:id',
  requireAuth,
  upload.fields([
    { name: 'avatar',     maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  compressUploads,
  userController.updateProfile
);

router.put('/:id/username', requireAuth, userController.updateUsername);

// ─── Admin Routes ──────────────────────────────────────────────────
router.put('/users/:id/verify', requireAuth, requireAdmin, toggleVerification);

// ════════════════════════════════════════════════════════════════
//  MENTION ROUTES
// ════════════════════════════════════════════════════════════════

router.get('/mentions', requireAuth, postController.getMentions);
router.get('/mentions/unread/count', requireAuth, postController.getUnreadMentionCount);
router.put('/mentions/read', requireAuth, postController.markMentionsAsRead);

// ════════════════════════════════════════════════════════════════
//  NOTIFICATION ROUTES
// ════════════════════════════════════════════════════════════════

const notificationRoutes = require('./notificationRoutes');
router.use('/notifications', notificationRoutes);

module.exports = router;