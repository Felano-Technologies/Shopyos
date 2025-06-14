const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', businessController.registerBusiness);
router.post('/login', businessController.loginBusiness);

// Protected routes
router.route('/profile')
  .get(protect, businessController.getBusinessProfile)
  .put(protect, businessController.updateBusinessProfile);

module.exports = router;