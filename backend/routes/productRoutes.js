const express = require('express');
const router = express.Router();
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { cacheMiddleware, productCacheKey, hashParams } = require('../middleware/cache');
const {
  createProduct, getStoreProducts, getProductById,
  updateProduct, deleteProduct, uploadProductImages,
  deleteProductImage, searchProducts
} = require('../controllers/productController');
const { validateSearch, validateCreateProduct } = require('../middleware/validators');

router.get('/search', validateSearch, cacheMiddleware(
  (req) => productCacheKey.search(req.query), 300
), searchProducts);

router.get('/store/:storeId', cacheMiddleware(
  (req) => productCacheKey.store(req.params.storeId, req.query.page || 1, req.query.limit || 20), 300
), getStoreProducts);

router.get('/:id', cacheMiddleware(
  (req) => productCacheKey.detail(req.params.id), 600
), getProductById);

router.post('/', protect, hasAnyRole('seller', 'admin'), validateCreateProduct, createProduct);
router.put('/:id', protect, hasAnyRole('seller', 'admin'), updateProduct);
router.delete('/:id', protect, hasAnyRole('seller', 'admin'), deleteProduct);

router.post('/:id/images', protect, hasAnyRole('seller', 'admin'), upload.multiple('images', 5), uploadProductImages);
router.delete('/:id/images/:imageId', protect, hasAnyRole('seller', 'admin'), deleteProductImage);

module.exports = router;
