// ============================================================
//  routes/trackRoutes.js
//  Mounted at /api/tracks
// ============================================================

const router          = require('express').Router();
const trackController = require('../controllers/trackController');
const { requireAuth } = require('../middleware/auth');
const uploadAudio     = require('../middleware/uploadAudio');

// Browse + stream (public, like the feed)
router.get('/',            trackController.getTracks);
router.get('/:id',         trackController.getTrackById);
router.get('/:id/stream',  trackController.streamTrack);

// Plays
router.post('/:id/play',   trackController.recordPlay);

// Upload + delete (logged in)
router.post('/',           requireAuth, uploadAudio, trackController.createTrack);
router.delete('/:id',      requireAuth, trackController.deleteTrack);

module.exports = router;