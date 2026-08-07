// ============================================================
//  routes/dm.js
//  All Direct Message endpoints — all routes require auth
// ============================================================

const express   = require('express');
const router    = express.Router();
const { requireAuth } = require("../middleware/auth");
const dmController  = require('../controllers/dmController');
const upload = require('../middleware/upload');

// Every DM route is protected — user must be logged in
router.use(requireAuth);

// ── Media upload ──────────────────────────────────────────────
// POST /api/dm/upload → upload a file (image, video, audio)
// Uses the existing upload middleware with Cloudinary support
router.post('/upload', upload.single('media'), dmController.uploadMedia);

// ── Presence & heartbeat ──────────────────────────────────────
// POST /api/dm/heartbeat                                      → touch last_seen_at (call every 30 s)
// GET  /api/dm/conversations/:conversationId/presence         → { online, last_seen_at } for the other user
router.post('/heartbeat', dmController.heartbeat);
router.get ('/conversations/:conversationId/presence', dmController.getPresence);

// ── Inbox & badge ─────────────────────────────────────────────
// GET  /api/dm/inbox         → list all conversations for current user
// GET  /api/dm/unread-count  → { count: N } for the nav badge
router.get('/inbox',         dmController.getInbox);
router.get('/unread-count',  dmController.getUnreadCount);

// ── Conversations ─────────────────────────────────────────────
// POST /api/dm/conversations
//   body: { recipientId }
//   → open (or find) a 1-to-1 conversation
router.post('/conversations', dmController.openConversation);

// ── Messages ─────────────────────────────────────────────────
// GET   /api/dm/conversations/:conversationId/messages         → fetch paginated thread
//         query: ?limit=10&before_id=<id>  (before_id omitted on first load)
// GET   /api/dm/conversations/:conversationId/messages/new     → polling: only new messages
//         query: ?after_id=<id>
// POST  /api/dm/conversations/:conversationId/messages         → send a message
// PATCH /api/dm/conversations/:conversationId/read             → mark all read
router.get  ('/conversations/:conversationId/messages/new', dmController.getNewMessages);
router.get  ('/conversations/:conversationId/messages',     dmController.getMessages);
router.post ('/conversations/:conversationId/messages',     dmController.sendMessage);
router.patch('/conversations/:conversationId/read',         dmController.markRead);

// ── Read status ──────────────────────────────────────────────
// POST /api/dm/read-status  body: { ids: [...] }  → { readIds: [...] }
router.post('/read-status', dmController.getReadStatus);

// ── Message management ──────────────────────────────────────
// PATCH /api/dm/conversations/:conversationId/messages/:messageId → edit a message
// DELETE /api/dm/conversations/:conversationId/messages/:messageId → delete a message
router.patch('/conversations/:conversationId/messages/:messageId', dmController.editMessage);
router.delete('/conversations/:conversationId/messages/:messageId', dmController.deleteMessage);

module.exports = router;