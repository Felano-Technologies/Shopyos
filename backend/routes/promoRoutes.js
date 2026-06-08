const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { validatePromoCode } = require('../controllers/promoController');

router.post('/validate', protect, validatePromoCode);

module.exports = router;
