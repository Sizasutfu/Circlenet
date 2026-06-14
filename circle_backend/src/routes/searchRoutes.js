// ============================================================
//  routes/searchRoutes.js
//  Defines API endpoints for search.
//  Route handlers are in controllers/searchController.js.
// ============================================================

const router            = require('express').Router();
const { requireAuth }   = require('../middleware/auth');
const searchController  = require('../controllers/searchController');

// GET  /api/search?q=<term>&type=posts|people
router.get('/', searchController.search);

// History (all require auth)
router.get   ('/history',     requireAuth, searchController.getHistory);
router.post  ('/history',     requireAuth, searchController.saveHistory);
router.delete('/history/:id', requireAuth, searchController.deleteHistoryEntry);
router.delete('/history',     requireAuth, searchController.clearHistory);

module.exports = router;