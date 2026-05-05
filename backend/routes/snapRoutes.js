const express = require('express');
const router = express.Router();
const snapController = require('../controllers/snapController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const { requireStore } = require('../middleware/businessMiddleware');

// Public route for viewing snap feed
router.get('/feed', snapController.getSnapFeed);

// Public route to increment view count
router.post('/:id/view', snapController.viewSnap);

// Protected routes for sellers
router.use(protect);
router.use(hasAnyRole(['seller']));
router.use(requireStore);

router.post('/', snapController.createSnap);
router.delete('/:id', snapController.deleteSnap);

module.exports = router;
