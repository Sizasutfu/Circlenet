const router = require('express').Router();
const controller = require('../controllers/verificationController');
const { requireAuth } = require('../middleware/auth');

router.get('/status',  requireAuth, controller.getStatus);
router.post('/request', requireAuth, controller.submitRequest);

module.exports = router;