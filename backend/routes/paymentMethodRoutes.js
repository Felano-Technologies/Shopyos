// routes/paymentMethodRoutes.js
const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', paymentMethodController.getPaymentMethods);
router.post('/', paymentMethodController.addPaymentMethod);
router.delete('/:id', paymentMethodController.deletePaymentMethod);
router.put('/:id/default', paymentMethodController.setDefaultMethod);

module.exports = router;
