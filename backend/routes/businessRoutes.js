// routes/businessRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createBusiness,
  getMyBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness
} = require('../controllers/businessController');

// Business routes
router.post('/create', protect, createBusiness);
router.get('/my-businesses', protect, getMyBusinesses);
router.get('/:id', protect, getBusinessById);
router.put('/update/:id', protect, updateBusiness);
router.delete('/:id', protect, deleteBusiness);

module.exports = router;