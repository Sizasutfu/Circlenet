// ============================================================
//  middleware/auth.js
//  Authentication middleware.
//
//  requireAuth  — reads the "Authorization: Bearer <token>"
//                 header sent by the frontend, verifies the JWT,
//                 and attaches req.actorId. Rejects unauthenticated
//                 or invalid callers with 401.
//
//  optionalAuth — same verification, but never blocks. If a valid
//                 token is present, req.actorId is set. If it's
//                 missing, malformed, or expired, the request
//                 continues as an anonymous caller with no actorId.
//                 Use this on public routes that want to personalise
//                 the response when a viewer happens to be logged in.
// ============================================================

const { sendError } = require('./response');
const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'You must be logged in to do that.');
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = verifyToken(token);
    const userId = parseInt(decoded.id);

    if (!userId) {
      return sendError(res, 401, 'You must be logged in to do that.');
    }

    req.actorId = userId;
    return next();
  } catch (err) {
    // Covers expired tokens (TokenExpiredError), tampered/invalid
    // signatures (JsonWebTokenError), and malformed tokens.
    return sendError(res, 401, 'You must be logged in to do that.');
  }
}

// ── optionalAuth ─────────────────────────────────────────────
// Non-blocking version of requireAuth. Any failure to authenticate
// is silently ignored — the request proceeds as anonymous. This is
// what lets GET /users/:id/profile stay public while still tagging
// the response with isFollowed for logged-in viewers.
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = verifyToken(token);
    const userId = parseInt(decoded.id);

    if (userId) {
      req.actorId = userId;
    }
  } catch {
    // Expired, malformed, or invalid signature → treat as anonymous.
    // Don't log or surface; the request is still valid without auth.
  }

  return next();
}

module.exports = { requireAuth, optionalAuth };