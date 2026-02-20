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
  uploadBanner,
  getBusinessDashboard,
  getBusinessAnalytics,
  getAllBusinesses,
  followBusiness,
  unfollowBusiness
} = require('../controllers/businessController');

// Business routes
router.post('/create', protect, createBusiness);
router.get('/my-businesses', protect, getMyBusinesses);
router.get('/all', protect, getAllBusinesses);
router.get('/:id', protect, getBusinessById);
router.put('/update/:id', protect, updateBusiness);
router.delete('/:id', protect, deleteBusiness);

// Image upload routes
router.post('/:id/upload-logo', protect, upload.single('logo'), uploadLogo);
router.post('/:id/upload-banner', protect, upload.single('banner'), uploadBanner);

// Dashboard
router.get('/dashboard/:id', protect, getBusinessDashboard);
router.get('/analytics/:id', protect, getBusinessAnalytics);

// Follow routes
router.post('/:id/follow', protect, followBusiness);
router.delete('/:id/follow', protect, unfollowBusiness);

module.exports = router;