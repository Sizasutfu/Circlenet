// ============================================================
//  controllers/recommendationController.js
// ============================================================

const RecommendationModel    = require('../models/recommendationModel');
const DismissedRecommendationModel = require('../models/dismissedRecommendationModel');
const { sendOk, sendError }  = require('../middleware/response');

// GET /api/recommendations?userId=ID&limit=10
async function getRecommendations(req, res) {
  const userId = parseInt(req.query.userId);
  const limit  = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 20);

  if (!userId || isNaN(userId))
    return sendError(res, 400, 'userId is required.');

  try {
    const dismissed = await DismissedRecommendationModel.getDismissedUserIds(userId);
    const users = await RecommendationModel.getRecommendations(userId, limit, dismissed);
    return sendOk(res, 200, 'Recommendations fetched.', users);
  } catch (err) {
    console.error('getRecommendations error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// POST /api/recommendations/dismiss
// Body: { dismissedUserId: number }
async function dismissRecommendation(req, res) {
  const userId = req.actorId;
  const { dismissedUserId } = req.body;

  if (!userId || !dismissedUserId)
    return sendError(res, 400, 'Missing userId or dismissedUserId.');

  try {
    await DismissedRecommendationModel.dismissRecommendation(userId, dismissedUserId);
    return sendOk(res, 200, 'Dismissed.');
  } catch (err) {
    console.error('dismissRecommendation error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = { getRecommendations, dismissRecommendation };