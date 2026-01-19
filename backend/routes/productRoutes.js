// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const { protect, seller, hasAnyRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  createProduct,
  getStoreProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  searchProducts
} = require('../controllers/productController');

// Public routes
router.get('/search', searchProducts);
router.get('/store/:storeId', getStoreProducts);
router.get('/:id', getProductById);

// Protected routes (Seller only)
router.post('/', protect, hasAnyRole('seller', 'admin'), createProduct);
router.put('/:id', protect, hasAnyRole('seller', 'admin'), updateProduct);
router.delete('/:id', protect, hasAnyRole('seller', 'admin'), deleteProduct);

// Image upload routes
router.post('/:id/images', protect, hasAnyRole('seller', 'admin'), upload.multiple('images', 5), uploadProductImages);
router.delete('/:id/images/:imageId', protect, hasAnyRole('seller', 'admin'), deleteProductImage);

module.exports = router;
