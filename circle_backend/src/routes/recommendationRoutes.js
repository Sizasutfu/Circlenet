// ============================================================
//  routes/recommendationRoutes.js
// ============================================================

const router = require('express').Router();
const recommendationController = require('../controllers/recommendationController');
const { requireAuth }           = require('../middleware/auth');

// GET /api/recommendations?userId=ID
router.get('/',requireAuth, recommendationController.getRecommendations);

// POST /api/recommendations/dismiss
router.post('/dismiss',requireAuth, recommendationController.dismissRecommendation);

module.exports = router;
