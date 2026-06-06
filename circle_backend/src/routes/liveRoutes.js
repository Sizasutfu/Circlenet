// ============================================================
//  routes/live.js
//
//  Mount in app.js / server.js:
//    const liveRoutes = require('./routes/live');
//    app.use('/api/live', liveRoutes);
//
//  authenticate middleware (already on your app) sets
//  req.actorId for logged-in requests.
//  requireAuth blocks unauthenticated requests with 401.
// ============================================================

const express          = require('express');
const router           = express.Router();
const liveCtrl         = require('../controllers/liveController');
const { requireAuth }  = require('../middleware/auth');

// Start a new live session (host only)
router.post('/start',         requireAuth, liveCtrl.startSession);       // POST  /api/live/start

// End your live session (host only)
router.post('/end',           requireAuth, liveCtrl.endSession);         // POST  /api/live/end

// All currently active streams (guests can see)
router.get('/active',                      liveCtrl.getActiveSessions);  // GET   /api/live/active

// Single session details — must come last to avoid shadowing /active
router.get('/:sessionId',                  liveCtrl.getSession);         // GET   /api/live/:sessionId

module.exports = router;

// ── app.js additions ─────────────────────────────────────
//
//   const liveRoutes = require('./routes/live');
//   app.use('/api/live', liveRoutes);
