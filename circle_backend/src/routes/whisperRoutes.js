const express = require('express');
const multer = require('multer');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const whisperController = require('../controllers/whisperController');
const config = require('../config/whisper');

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_IMAGE_SIZE_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// Rate limiters
const sendLimiter = rateLimit({
  windowMs: config.SEND_RATE_WINDOW_MS,
  max: config.SEND_RATE_LIMIT,
  keyGenerator: (req) => `${ipKeyGenerator(req)}:${req.params.username}`,
  handler: (req, res) => res.status(429).json({
    message: `Too many messages sent. Try again in ${config.SEND_RATE_WINDOW_MS / 3600000} hour(s).`,
  }),
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.AUTH_RATE_LIMIT,
  keyGenerator: (req) => req.actorId || ipKeyGenerator(req),
});

// ── Public routes ──
router.get('/profile/:username', whisperController.getProfile);
router.post('/send/:username', sendLimiter, whisperController.sendMessage);
// Public routes (add after existing ones)
router.get('/profile-by-slug/:slug', whisperController.getProfileBySlug);
router.post('/send-by-slug/:slug', sendLimiter, whisperController.sendMessageBySlug);
// ── Authenticated routes ──
router.use(requireAuth);
router.use(authLimiter);

router.get('/settings', whisperController.getSettings);
router.patch('/settings', whisperController.updateSettings);
router.post('/settings/regenerate-slug', whisperController.regenerateSlug); // ✅ NEW
router.get('/inbox', whisperController.getInbox);
router.delete('/:id', whisperController.deleteMessage);
router.post('/:id/report', whisperController.reportMessage);
router.post('/:id/post', upload.single('image'), whisperController.createPostFromWhisper);


module.exports = router;