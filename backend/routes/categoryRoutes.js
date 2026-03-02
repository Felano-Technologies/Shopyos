const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const { cacheMiddleware, categoryCacheKey } = require('../middleware/cache');

router.get('/', cacheMiddleware(() => categoryCacheKey.all(), 1800), categoryController.getAll);

router.post('/', protect, hasAnyRole('admin'), categoryController.create);
router.put('/:id', protect, hasAnyRole('admin'), categoryController.update);
router.delete('/:id', protect, hasAnyRole('admin'), categoryController.delete);

module.exports = router;
