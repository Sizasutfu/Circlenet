const VerificationModel = require('../models/verificationModel');
const NotificationModel = require('../models/notificationModel');
const { sendOk, sendError } = require('../middleware/response');

const VALID_CATEGORIES = [
  'creator', 'journalist', 'business',
  'sports', 'music', 'actor', 'government', 'other',
];

// GET /api/verification/status
async function getStatus(req, res) {
  const userId = req.actorId;
  try {
    const request = await VerificationModel.getLatestRequest(userId);
    return sendOk(res, 200, 'Status fetched.', { request });
  } catch (err) {
    console.error('verification getStatus error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/verification/request
async function submitRequest(req, res) {
  const userId = req.actorId;
  const { fullName, category, reason, links, email } = req.body || {};

  if (!fullName || !String(fullName).trim()) {
    return sendError(res, 400, 'Full name is required.');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return sendError(res, 400, 'Please choose a valid category.');
  }
  const trimmedReason = String(reason || '').trim();
  if (trimmedReason.length < 50) {
    return sendError(res, 400, 'Please give a reason (at least 50 characters).');
  }
  if (trimmedReason.length > 1000) {
    return sendError(res, 400, 'Reason is too long (max 1000 characters).');
  }

  try {
    const pending = await VerificationModel.getPendingRequest(userId);
    if (pending) {
      return sendError(res, 409, 'You already have a pending verification request.');
    }

    const id = await VerificationModel.createRequest(userId, {
      fullName: String(fullName).trim().slice(0, 120),
      category,
      reason: trimmedReason,
      links: links ? String(links).trim().slice(0, 1000) : null,
      email: email ? String(email).trim().slice(0, 120) : null,
    });

    return sendOk(res, 201, 'Request submitted.', { id, status: 'pending' });
  } catch (err) {
    console.error('verification submit error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── Admin handlers ─────────────────────────────────────────────

// GET /api/admin/verification-requests?status=pending&page=1
async function listRequests(req, res) {
  const status = req.query.status || 'pending';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  try {
    const result = await VerificationModel.listRequests(status, page);
    return sendOk(res, 200, 'Requests fetched.', result);
  } catch (err) {
    console.error('verification list error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// PUT /api/admin/verification-requests/:id/approve
async function approve(req, res) {
  const id = parseInt(req.params.id);
  const adminId = req.adminId;
  const note = (req.body?.note || '').trim() || null;

  try {
    const request = await VerificationModel.getRequestById(id);
    if (!request) return sendError(res, 404, 'Request not found.');
    if (request.status !== 'pending') {
      return sendError(res, 409, 'Request has already been reviewed.');
    }

    await VerificationModel.reviewRequest(id, 'approved', adminId, note);
    await NotificationModel.createVerificationNotification(request.user_id, true);

    return sendOk(res, 200, 'Request approved.');
  } catch (err) {
    console.error('verification approve error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// PUT /api/admin/verification-requests/:id/reject
async function reject(req, res) {
  const id = parseInt(req.params.id);
  const adminId = req.adminId;
  const note = (req.body?.note || '').trim() || null;

  try {
    const request = await VerificationModel.getRequestById(id);
    if (!request) return sendError(res, 404, 'Request not found.');
    if (request.status !== 'pending') {
      return sendError(res, 409, 'Request has already been reviewed.');
    }

    await VerificationModel.reviewRequest(id, 'rejected', adminId, note);
    await NotificationModel.createSystemNotification(
      request.user_id,
      'unverified',
      note
        ? `Your verification request was not approved: ${note}`
        : 'Your verification request was not approved at this time. You can submit a new one after 30 days.'
    );

    return sendOk(res, 200, 'Request rejected.');
  } catch (err) {
    console.error('verification reject error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = {
  getStatus,
  submitRequest,
  listRequests,
  approve,
  reject,
  VALID_CATEGORIES,
};