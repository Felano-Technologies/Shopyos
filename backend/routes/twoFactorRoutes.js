const express = require('express');
const { requestVerificationCode, verifyCode } = require('../controllers/twoFactorController');
const auth = require('../middleware/auth'); // Ensure auth middleware is implemented to verify tokens
const router = express.Router();

router.post('/request-verification-code', auth, requestVerificationCode);
router.post('/verify-code', auth, verifyCode);

module.exports = router;
