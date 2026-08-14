// routes/dmRoutes.js
// All Direct Message endpoints with E2E encryption support

const express   = require('express');
const router    = express.Router();
const { requireAuth } = require("../middleware/auth");
const dmController  = require('../controllers/dmController');
const upload = require('../middleware/upload');

// Every DM route is protected — user must be logged in
router.use(requireAuth);

// ── Media upload ──────────────────────────────────────────────
router.post('/upload', upload.single('media'), dmController.uploadMedia);

// ── Presence & heartbeat ──────────────────────────────────────
router.post('/heartbeat', dmController.heartbeat);
router.get('/conversations/:conversationId/presence', dmController.getPresence);

// ── Inbox & badge ─────────────────────────────────────────────
router.get('/inbox', dmController.getInbox);
router.get('/unread-count', dmController.getUnreadCount);

// ── Conversations ─────────────────────────────────────────────
router.post('/conversations', dmController.openConversation);

// ── Messages ─────────────────────────────────────────────────
router.get('/conversations/:conversationId/messages/new', dmController.getNewMessages);
router.get('/conversations/:conversationId/messages', dmController.getMessages);
router.post('/conversations/:conversationId/messages', dmController.sendMessage);
router.patch('/conversations/:conversationId/read', dmController.markRead);

// ── Read status ──────────────────────────────────────────────
router.post('/read-status', dmController.getReadStatus);

// ── Message management ──────────────────────────────────────
router.patch('/conversations/:conversationId/messages/:messageId', dmController.editMessage);
router.delete('/conversations/:conversationId/messages/:messageId', dmController.deleteMessage);

// ── E2E Encryption Routes ────────────────────────────────────
router.get('/e2e/public-key', dmController.getPublicKey);
router.put('/e2e/public-key', dmController.updatePublicKey);
router.get('/e2e/key-versions', dmController.getKeyVersions);
router.get('/e2e/public-key/:userId', dmController.getPeerPublicKey);
router.post('/e2e/encrypt', dmController.encryptMessage);
router.post('/e2e/decrypt', dmController.decryptMessage);
router.get('/e2e/status/:userId', dmController.getE2EStatus);
router.post('/e2e/rotate-keys', dmController.rotateKeys);

module.exports = router;