// routes/adRoutes.js
const router = require('express').Router();
const adController = require('../controllers/adController');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireAuth } = require('../middleware/auth');

// Public: fetch an ad (used by frontend AdSlot component)
router.get('/', adController.getAd);

// Admin-only routes
router.post('/', requireAdmin, adController.createAd);
router.put('/:id', requireAdmin, adController.updateAd);
router.delete('/:id', requireAdmin, adController.deleteAd);
router.get('/list', requireAdmin, adController.listAds);
router.get('/:id', requireAdmin, adController.getAdById);

// Tracking (optional – can be called by frontend)
router.post('/:id/impression', requireAuth, adController.trackImpression); // or use requireAuth optionally
router.post('/:id/click', requireAuth, adController.trackClick);

module.exports = router;