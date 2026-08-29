// ============================================================
//  middleware/auth.js
//  Authentication middleware.
//
//  requireAuth — reads the "Authorization: Bearer <token>"
//  header sent by the frontend, verifies the JWT, and attaches
//  req.actorId. Rejects unauthenticated or invalid callers
//  with 401.
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

module.exports = { requireAuth };