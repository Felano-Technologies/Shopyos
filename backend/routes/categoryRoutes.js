const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');

router.get('/', categoryController.getAll);

// Seller or Admin can manage
router.post('/', protect, hasAnyRole('seller', 'admin'), categoryController.create);
router.put('/:id', protect, hasAnyRole('seller', 'admin'), categoryController.update);
router.delete('/:id', protect, hasAnyRole('seller', 'admin'), categoryController.delete);

module.exports = router;
