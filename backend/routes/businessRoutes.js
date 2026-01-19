// routes/businessRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  createBusiness,
  getMyBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  uploadLogo,
  uploadBanner
} = require('../controllers/businessController');

// Business routes
router.post('/create', protect, createBusiness);
router.get('/my-businesses', protect, getMyBusinesses);
router.get('/:id', protect, getBusinessById);
router.put('/update/:id', protect, updateBusiness);
router.delete('/:id', protect, deleteBusiness);

// Image upload routes
router.post('/:id/upload-logo', protect, upload.single('logo'), uploadLogo);
router.post('/:id/upload-banner', protect, upload.single('banner'), uploadBanner);

module.exports = router;