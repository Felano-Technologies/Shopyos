// routes/bargainRoutes.js
const express = require('express');
const router = express.Router();
const {
  createBargainOffer,
  getBuyerOffers,
  getSellerOffers,
  respondToBargain,
  buyerRespondToBargain,
  withdrawBargainOffer,
  getBargainHistory,
  addBargainToCart
} = require('../controllers/bargainController');
const { protect } = require('../middleware/authMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');

// All bargaining routes require authentication
router.use(protect);

// Create bargain is gated behind legal agreement to bargain terms
router.post('/', requireDisclaimer('bargain_terms'), createBargainOffer);

router.get('/my-offers', getBuyerOffers);
router.get('/seller', getSellerOffers);
router.patch('/:bargainId/respond', respondToBargain);
router.patch('/:bargainId/buyer-respond', buyerRespondToBargain);
router.delete('/:bargainId/withdraw', withdrawBargainOffer);
router.get('/:bargainId/history', getBargainHistory);
router.post('/:bargainId/add-to-cart', addBargainToCart);

module.exports = router;
