const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const { validateRegister, validateLogin } = require('../middleware/validators');

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh', authController.refreshAccessToken); // NEW: Token refresh
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', protect, authController.getUserData);
router.post('/add-role', protect, authController.addRole);
router.get('/roles', protect, authController.getUserRoles);
router.put('/profile', protect, authController.updateProfile);
router.put('/role', protect, authController.updateUserRole); // Deprecated - use add-role

// Session management (NEW)
router.post('/logout-all', protect, authController.logoutAll);
router.get('/sessions', protect, authController.getSessions);
router.delete('/sessions/:sessionId', protect, authController.revokeSession);

module.exports = router;