// routes/videoRoutes.js
const router = require('express').Router();
const videoController = require('../controllers/videoController');

// GET /api/posts/videos?page=1&limit=20
router.get('/', videoController.getVideos);

module.exports = router;