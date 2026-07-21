// ============================================================
//  controllers/liveController.js
//
//  POST   /api/live/start          → start a live session
//  POST   /api/live/end            → end your live session
//  GET    /api/live/active         → all currently active streams
//  GET    /api/live/:sessionId     → single session details
// ============================================================

const LiveModel                  = require('../models/liveModel');
const NotificationModel          = require('../models/notificationModel');
const { sendOk, sendError }      = require('../middleware/response');

// Lazy-require to avoid circular dependency.
// wsServer requires LiveModel; we require wsServer here only when
// a request actually arrives — by then both modules are fully loaded.
function ws() {
  return require('../../wsServer');
}

// ── POST /api/live/start ─────────────────────────────────
async function startSession(req, res) {
  const hostId = req.actorId;
  const title  = (req.body.title || '').trim();

  if (!title)            return sendError(res, 400, 'A stream title is required.');
  if (title.length > 80) return sendError(res, 400, 'Title must be 80 characters or fewer.');

  try {
    // Prevent a host from opening multiple concurrent streams (bug #10)
   const existing = await LiveModel.getActiveSessionByHost(hostId);
  if (existing) return sendError(res, 409, 'You already have an active stream.');

    const session = await LiveModel.createSession(hostId, title);

    // Notify every connected user so feed cards appear in real time
    ws().broadcastLiveStarted(session);

    // Fan out persistent + real-time notifications to all followers
    // Non-blocking — a notification failure must never fail the stream start
    LiveModel.getFollowerIds(hostId)
      .then(followerIds => Promise.all(
        followerIds.map(followerId => {
          // 1. Persist to DB (deduplicates, triggers push)
          NotificationModel.createNotification(
            followerId, hostId, 'live', null, session.sessionId
          ).catch(err => console.error('[liveController] notif persist error:', err));

          // 2. Real-time WS push so badge bumps instantly
          ws().notifyUser(followerId, 'live', {
            actorId:   hostId,
            actorName: session.broadcasterName,
            sessionId: session.sessionId,
          });
        })
      ))
      .catch(err => console.error('[liveController] follower fanout error:', err));

    return sendOk(res, 201, 'Stream started.', session);
  } catch (err) {
    console.error('[liveController] startSession error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/live/end ───────────────────────────────────
async function endSession(req, res) {
  const hostId    = req.actorId;
  const sessionId = (req.body.sessionId || '').trim();

  if (!sessionId) return sendError(res, 400, 'sessionId is required.');

  try {
    const session = await LiveModel.getSession(sessionId);
    if (!session)               return sendError(res, 404, 'Session not found.');
    if (session.hostId !== hostId) return sendError(res, 403, 'You are not the host of this session.');
    if (session.status === 'ended') return sendOk(res, 200, 'Session already ended.', { sessionId });

    await LiveModel.endSession(sessionId);
    ws().broadcastLiveEnded(sessionId);
    return sendOk(res, 200, 'Stream ended.', { sessionId });
  } catch (err) {
    console.error('[liveController] endSession error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/live/active ─────────────────────────────────
async function getActiveSessions(req, res) {
  try {
    const sessions = await LiveModel.getActiveSessions();
    return sendOk(res, 200, 'Active sessions fetched.', sessions);
  } catch (err) {
    console.error('[liveController] getActiveSessions error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/live/:sessionId ─────────────────────────────
async function getSession(req, res) {
  const { sessionId } = req.params;
  if (!sessionId) return sendError(res, 400, 'sessionId is required.');

  try {
    const session = await LiveModel.getSession(sessionId);
    if (!session) return sendError(res, 404, 'Session not found.');
    return sendOk(res, 200, 'Session fetched.', session);
  } catch (err) {
    console.error('[liveController] getSession error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = {
  startSession,
  endSession,
  getActiveSessions,
  getSession,
};