// routes/searchRoutes.js
const router            = require('express').Router();
const { requireAuth }   = require('../middleware/auth');
const searchController  = require('../controllers/searchController');

// GET  /api/search?q=<term>&type=all|posts|people|groups
router.get('/', searchController.search);

// GET  /api/search/autocomplete?q=<term>  (public)
router.get('/autocomplete', searchController.autocomplete);

// History (all require auth)
router.get   ('/history',     requireAuth, searchController.getHistory);
router.post  ('/history',     requireAuth, searchController.saveHistory);
router.delete('/history/:id', requireAuth, searchController.deleteHistoryEntry);
router.delete('/history',     requireAuth, searchController.clearHistory);

module.exports = router;