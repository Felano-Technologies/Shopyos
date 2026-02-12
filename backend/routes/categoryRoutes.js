const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', categoryController.getAll);

// Seller or Admin can manage
router.post('/', protect, authorize('seller', 'admin'), categoryController.create);
router.put('/:id', protect, authorize('seller', 'admin'), categoryController.update);
router.delete('/:id', protect, authorize('seller', 'admin'), categoryController.delete);

module.exports = router;
