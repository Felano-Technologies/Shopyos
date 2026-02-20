const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', protect, authController.getUserData);
router.post('/add-role', protect, authController.addRole);
router.get('/roles', protect, authController.getUserRoles);
router.put('/profile', protect, authController.updateProfile);
router.put('/role', protect, authController.updateUserRole); // Deprecated - use add-role

module.exports = router;