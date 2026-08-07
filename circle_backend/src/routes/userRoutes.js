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

// ─── Get User Profile ────────────────────────────────────────────
router.get('/:id/profile', userController.getProfile);

// ─── New Members ──────────────────────────────────────────────────
router.get('/new-members', userController.getNewMembers);

// ════════════════════════════════════════════════════════════════
//  PROTECTED ROUTES — Authentication required
// ════════════════════════════════════════════════════════════════

// ─── Search Users ─────────────────────────────────────────────────
router.get('/', requireAuth, userController.searchUsers);

// ─── Account Deletion Status ─────────────────────────────────────
router.get('/:id/deletion-status', requireAuth, userController.getDeletionStatus);

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

// ─── Profile Updates ──────────────────────────────────────────────
router.put('/:id/picture', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }]), compressUploads, userController.updatePicture);
router.put('/:id/cover', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }]), compressUploads, userController.updateCoverImage);
router.put('/:id', requireAuth, userController.updateProfile);
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

// ─── REMOVED the interfering middleware ──────────────────────────
// The problematic middleware was:
// router.use('/:id', (req, res, next) => { ... });

module.exports = router;