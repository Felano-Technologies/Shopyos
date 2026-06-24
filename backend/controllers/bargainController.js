// controllers/bargainController.js
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getBargainConfig = async () => {
  const feeConfig = require('../services/feeConfigService');
  const maxRounds = await feeConfig.get('bargain_max_rounds') || 3;
  const ttlHours = await feeConfig.get('bargain_offer_ttl_hours') || 24;
  const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
  return { maxRounds, expiresAt };
};

const handleBargainNotifications = async (bargain, productName, isRejected) => {
  const notificationService = require('../services/notificationService');
  if (isRejected) {
    await notificationService.sendNotification({
      userId: bargain.buyer_id,
      type: 'bargain_rejected',
      title: 'Bargain offer rejected',
      message: `Your bargain offer of GHS ${Number(bargain.offered_price).toFixed(2)} for ${productName} was rejected.`,
      relatedId: bargain.id,
      relatedType: 'bargain_offer',
    }).catch((e) => logger.warn('[Bargain] silent reject notify failed:', e.message));
  } else {
    await notificationService.sendNotification({
      userId: bargain.seller_id,
      type: 'bargain_offer_received',
      title: 'New bargain offer received',
      message: `A buyer offered GHS ${Number(bargain.offered_price).toFixed(2)} for ${productName}.`,
      relatedId: bargain.id,
      relatedType: 'bargain_offer',
    }).catch((e) => logger.warn('[Bargain] seller notify failed:', e.message));
  }
};

const validateBargainInput = (req) => {
  const { productId, offeredPrice } = req.body;
  if (!productId || !offeredPrice) {
    throw new Error('productId and offeredPrice are required');
  }
  const price = Number.parseFloat(offeredPrice);
  if (Number.isNaN(price) || price <= 0) {
    throw new Error('offeredPrice must be a positive number');
  }
  return { productId, price };
};

const validateProductEligibility = async (productId, price, buyerId) => {
  const product = await repositories.products.findById(productId);
  if (!product) throw new Error('Product not found');
  if (!product.bargaining_enabled) throw new Error('Bargaining is not enabled for this product');
  if (price >= Number.parseFloat(product.price)) {
    throw new Error('Offered price must be less than the current listed price');
  }
  const activeBargain = await repositories.bargains.findActiveBargain(productId, buyerId);
  if (activeBargain) throw new Error('You already have an active bargaining offer for this product');
  return product;
};

// ─── Controller Endpoints ────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/bargains
 * @desc    Buyer submits a new bargain offer
 * @access  Private (Buyer)
 */
const createBargainOffer = async (req, res, next) => {
  try {
    const { productId, price } = validateBargainInput(req);
    const buyerId = req.user.id;
    const product = await validateProductEligibility(productId, price, buyerId);

    const store = await repositories.stores.findById(product.store_id);
    const sellerId = store?.owner_id;
    if (!sellerId || sellerId === buyerId) {
      return res.status(400).json({
        success: false,
        error: sellerId === buyerId ? 'Sellers cannot bargain on their own products' : 'Could not determine seller',
      });
    }

    const { maxRounds, expiresAt } = await getBargainConfig();
    const isRejected = price < Number.parseFloat(product.min_bargain_price || 0);

    const bargain = await repositories.bargains.create({
      product_id: productId,
      buyer_id: buyerId,
      seller_id: sellerId,
      store_id: product.store_id,
      original_price: product.price,
      offered_price: price,
      status: isRejected ? 'rejected' : 'pending',
      round_number: 1,
      max_rounds: maxRounds,
      buyer_message: req.body.buyerMessage || null,
      expires_at: expiresAt,
    });

    await repositories.bargains.createHistoryEntry(bargain.id, buyerId, 'buyer', 'submit_offer', price, req.body.buyerMessage || null);
    await repositories.auditLogs.createLog({
      userId: buyerId,
      action: 'bargain_offer_submitted',
      entityType: 'bargain_offer',
      entityId: bargain.id,
      changes: { product_id: productId, offered_price: price, status: bargain.status },
    }).catch(() => {});
    await handleBargainNotifications(bargain, product.title, isRejected);

    res.status(isRejected ? 200 : 201).json({ success: true, message: 'Offer submitted', bargain });
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('must be') || error.message.includes('not enabled') || error.message.includes('less than') || error.message.includes('already have')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * @route   GET /api/v1/bargains/my-offers
 * @desc    Buyer retrieves their own bargain offers
 * @access  Private (Buyer)
 */
const getBuyerOffers = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { status, productId, page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(Number.parseInt(limit) || 20, 100);
    const offset = (Math.max(Number.parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.bargains.getBuyerOffers(buyerId, {
      status,
      productId,
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: Math.floor(offset / limitNum) + 1,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/bargains/seller
 * @desc    Seller retrieves incoming bargain offers for their stores
 * @access  Private (Seller)
 */
const getSellerOffers = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(Number.parseInt(limit) || 20, 100);
    const offset = (Math.max(Number.parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.bargains.getSellerOffers(sellerId, {
      status,
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: Math.floor(offset / limitNum) + 1,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

const handleSellerAccept = async (bargain, sellerId, res) => {
  const feeConfig = require('../services/feeConfigService');
  const windowHours = await feeConfig.get('bargain_checkout_window_hours') || 1;
  const checkoutWindowEnd = new Date(Date.now() + windowHours * 3600000).toISOString();
  const finalPrice = Number(bargain.offered_price);

  const updated = await repositories.bargains.update(bargain.id, {
    status: 'accepted',
    final_agreed_price: finalPrice,
    bargain_discount: Number(bargain.original_price) - finalPrice,
    accepted_at: new Date().toISOString(),
    checkout_window_end: checkoutWindowEnd,
  });

  await repositories.bargains.createHistoryEntry(bargain.id, sellerId, 'seller', 'accept_offer', finalPrice);
  await repositories.auditLogs.createLog({
    userId: sellerId,
    action: 'bargain_offer_accepted',
    entityType: 'bargain_offer',
    entityId: bargain.id,
    changes: { final_agreed_price: finalPrice, buyer_id: bargain.buyer_id },
  }).catch(() => {});

  const notificationService = require('../services/notificationService');
  await notificationService.sendNotification({
    userId: bargain.buyer_id,
    type: 'bargain_accepted',
    title: 'Bargain offer accepted!',
    message: `Your bargain offer for GHS ${finalPrice.toFixed(2)} was accepted. Proceed to checkout now!`,
    relatedId: bargain.id,
    relatedType: 'bargain_offer',
  }).catch((e) => logger.warn('[Bargain] accept notify failed:', e.message));

  res.status(200).json({ success: true, bargain: updated });
};

const handleSellerCounter = async (bargain, sellerId, counterPrice, sellerMessage, res) => {
  if (bargain.round_number >= bargain.max_rounds) {
    return res.status(400).json({ success: false, error: 'Maximum bargaining rounds reached. Cannot counter again.' });
  }
  const price = Number.parseFloat(counterPrice);
  if (Number.isNaN(price) || price <= 0 || price >= Number.parseFloat(bargain.original_price)) {
    return res.status(400).json({ success: false, error: 'Counter price must be positive and less than original price.' });
  }

  const { expiresAt } = await getBargainConfig();
  const updated = await repositories.bargains.update(bargain.id, {
    status: 'countered',
    counter_price: price,
    round_number: bargain.round_number + 1,
    expires_at: expiresAt,
    seller_message: sellerMessage?.trim() || null,
  });

  await repositories.bargains.createHistoryEntry(bargain.id, sellerId, 'seller', 'counter_offer', price, sellerMessage?.trim() || null);
  await repositories.auditLogs.createLog({
    userId: sellerId,
    action: 'bargain_offer_countered',
    entityType: 'bargain_offer',
    entityId: bargain.id,
    changes: { counter_price: price, round_number: bargain.round_number + 1 },
  }).catch(() => {});

  const notificationService = require('../services/notificationService');
  await notificationService.sendNotification({
    userId: bargain.buyer_id,
    type: 'bargain_countered',
    title: 'New counter-offer received',
    message: `The seller has countered with GHS ${price.toFixed(2)}.`,
    relatedId: bargain.id,
    relatedType: 'bargain_offer',
  }).catch((e) => logger.warn('[Bargain] counter notify failed:', e.message));

  res.status(200).json({ success: true, bargain: updated });
};

const handleSellerReject = async (bargain, sellerId, res) => {
  const updated = await repositories.bargains.update(bargain.id, { status: 'rejected' });
  await repositories.bargains.createHistoryEntry(bargain.id, sellerId, 'seller', 'reject_offer');
  await repositories.auditLogs.createLog({
    userId: sellerId,
    action: 'bargain_offer_rejected',
    entityType: 'bargain_offer',
    entityId: bargain.id,
    changes: { buyer_id: bargain.buyer_id },
  }).catch(() => {});

  const notificationService = require('../services/notificationService');
  await notificationService.sendNotification({
    userId: bargain.buyer_id,
    type: 'bargain_rejected',
    title: 'Bargain offer rejected',
    message: 'Your bargain offer has been rejected by the seller.',
    relatedId: bargain.id,
    relatedType: 'bargain_offer',
  }).catch((e) => logger.warn('[Bargain] reject notify failed:', e.message));

  res.status(200).json({ success: true, bargain: updated });
};

/**
 * @route   PATCH /api/v1/bargains/:bargainId/respond
 * @desc    Seller responds to a bargain offer (accept, reject, or counter)
 * @access  Private (Seller)
 */
const respondToBargain = async (req, res, next) => {
  try {
    const { bargainId } = req.params;
    const { action, counterPrice, sellerMessage } = req.body;
    const sellerId = req.user.id;

    if (!['accept', 'counter', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be accept, counter, or reject.' });
    }

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || bargain.seller_id !== sellerId) {
      return res.status(404).json({ success: false, error: 'Bargain offer not found' });
    }
    if (!['pending', 'countered'].includes(bargain.status)) {
      return res.status(400).json({ success: false, error: 'Bargain is no longer active for responses.' });
    }

    if (action === 'accept') {
      await handleSellerAccept(bargain, sellerId, res);
    } else if (action === 'counter') {
      await handleSellerCounter(bargain, sellerId, counterPrice, sellerMessage, res);
    } else if (action === 'reject') {
      await handleSellerReject(bargain, sellerId, res);
    }
  } catch (error) {
    next(error);
  }
};

const handleBuyerAccept = async (bargain, buyerId, res) => {
  const feeConfig = require('../services/feeConfigService');
  const windowHours = await feeConfig.get('bargain_checkout_window_hours') || 1;
  const checkoutWindowEnd = new Date(Date.now() + windowHours * 3600000).toISOString();
  const finalPrice = Number(bargain.counter_price);

  const updated = await repositories.bargains.update(bargain.id, {
    status: 'accepted',
    final_agreed_price: finalPrice,
    bargain_discount: Number(bargain.original_price) - finalPrice,
    accepted_at: new Date().toISOString(),
    checkout_window_end: checkoutWindowEnd,
  });

  await repositories.bargains.createHistoryEntry(bargain.id, buyerId, 'buyer', 'accept_counter', finalPrice);
  await repositories.auditLogs.createLog({
    userId: buyerId,
    action: 'bargain_counter_accepted',
    entityType: 'bargain_offer',
    entityId: bargain.id,
    changes: { final_agreed_price: finalPrice, seller_id: bargain.seller_id },
  }).catch(() => {});

  const notificationService = require('../services/notificationService');
  await notificationService.sendNotification({
    userId: bargain.seller_id,
    type: 'bargain_accepted',
    title: 'Counter-offer accepted!',
    message: `Buyer accepted your counter-offer of GHS ${finalPrice.toFixed(2)}.`,
    relatedId: bargain.id,
    relatedType: 'bargain_offer',
  }).catch((e) => logger.warn('[Bargain] buyer accept notify failed:', e.message));

  res.status(200).json({ success: true, bargain: updated });
};

const handleBuyerCounter = async (bargain, buyerId, offeredPrice, buyerMessage, res) => {
  if (bargain.round_number >= bargain.max_rounds) {
    return res.status(400).json({ success: false, error: 'Maximum bargaining rounds reached. Cannot counter again.' });
  }
  const price = Number.parseFloat(offeredPrice);
  if (Number.isNaN(price) || price <= 0 || price >= Number.parseFloat(bargain.counter_price || bargain.original_price)) {
    return res.status(400).json({ success: false, error: 'Counter-offer price must be positive and less than the previous counter price.' });
  }

  const { expiresAt } = await getBargainConfig();
  const updated = await repositories.bargains.update(bargain.id, {
    status: 'pending', // reverts back to pending for seller
    offered_price: price,
    round_number: bargain.round_number + 1,
    expires_at: expiresAt,
    buyer_message: buyerMessage?.trim() || null,
  });

  await repositories.bargains.createHistoryEntry(bargain.id, buyerId, 'buyer', 'buyer_counter_offer', price, buyerMessage?.trim() || null);
  await repositories.auditLogs.createLog({
    userId: buyerId,
    action: 'bargain_buyer_countered',
    entityType: 'bargain_offer',
    entityId: bargain.id,
    changes: { offered_price: price, round_number: bargain.round_number + 1 },
  }).catch(() => {});

  const notificationService = require('../services/notificationService');
  await notificationService.sendNotification({
    userId: bargain.seller_id,
    type: 'bargain_offer_received',
    title: 'New bargain counter-offer received',
    message: `Buyer has countered with GHS ${price.toFixed(2)}.`,
    relatedId: bargain.id,
    relatedType: 'bargain_offer',
  }).catch((e) => logger.warn('[Bargain] buyer counter notify failed:', e.message));

  res.status(200).json({ success: true, bargain: updated });
};

/**
 * @route   PATCH /api/v1/bargains/:bargainId/buyer-respond
 * @desc    Buyer responds to a seller's counter-offer (accept, reject, or counter again)
 * @access  Private (Buyer)
 */
const buyerRespondToBargain = async (req, res, next) => {
  try {
    const { bargainId } = req.params;
    const { action, offeredPrice, buyerMessage } = req.body;
    const buyerId = req.user.id;

    if (!['accept', 'counter', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be accept, counter, or reject.' });
    }

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || bargain.buyer_id !== buyerId) {
      return res.status(404).json({ success: false, error: 'Bargain offer not found' });
    }
    if (bargain.status !== 'countered') {
      return res.status(400).json({ success: false, error: 'No active seller counter-offer to respond to.' });
    }

    if (action === 'accept') {
      await handleBuyerAccept(bargain, buyerId, res);
    } else if (action === 'counter') {
      await handleBuyerCounter(bargain, buyerId, offeredPrice, buyerMessage, res);
    } else if (action === 'reject') {
      const updated = await repositories.bargains.update(bargainId, { status: 'rejected' });
      await repositories.bargains.createHistoryEntry(bargainId, buyerId, 'buyer', 'reject_counter');
      await repositories.auditLogs.createLog({
        userId: buyerId,
        action: 'bargain_counter_rejected',
        entityType: 'bargain_offer',
        entityId: bargainId,
        changes: { seller_id: bargain.seller_id },
      }).catch(() => {});
      const notificationService = require('../services/notificationService');
      await notificationService.sendNotification({
        userId: bargain.seller_id,
        type: 'bargain_rejected',
        title: 'Counter-offer rejected',
        message: 'The buyer has rejected your counter-offer.',
        relatedId: bargainId,
        relatedType: 'bargain_offer',
      }).catch((e) => logger.warn('[Bargain] buyer-reject-counter notify failed:', e.message));
      res.status(200).json({ success: true, bargain: updated });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/bargains/:bargainId/withdraw
 * @desc    Buyer withdraws their active bargain offer
 * @access  Private (Buyer)
 */
const withdrawBargainOffer = async (req, res, next) => {
  try {
    const { bargainId } = req.params;
    const buyerId = req.user.id;

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || bargain.buyer_id !== buyerId) {
      return res.status(404).json({ success: false, error: 'Bargain offer not found' });
    }
    if (!['pending', 'countered'].includes(bargain.status)) {
      return res.status(400).json({ success: false, error: 'Only pending or countered offers can be withdrawn.' });
    }

    const updated = await repositories.bargains.update(bargainId, { status: 'withdrawn' });
    await repositories.bargains.createHistoryEntry(bargainId, buyerId, 'buyer', 'withdraw_offer');

    res.status(200).json({ success: true, message: 'Offer withdrawn successfully', bargain: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/bargains/:bargainId/history
 * @desc    Get detailed history trail of a bargain session
 * @access  Private (Buyer or Seller)
 */
const getBargainHistory = async (req, res, next) => {
  try {
    const { bargainId } = req.params;
    const userId = req.user.id;

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || (bargain.buyer_id !== userId && bargain.seller_id !== userId)) {
      return res.status(404).json({ success: false, error: 'Bargain offer not found' });
    }

    const history = await repositories.bargains.getBargainHistory(bargainId);
    res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/bargains/:bargainId/add-to-cart
 * @desc    Buyer adds accepted bargain item to cart
 * @access  Private (Buyer)
 */
const addBargainToCart = async (req, res, next) => {
  try {
    const { bargainId } = req.params;
    const buyerId = req.user.id;

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || bargain.buyer_id !== buyerId) {
      return res.status(404).json({ success: false, error: 'Bargain offer not found' });
    }
    if (bargain.status !== 'accepted') {
      return res.status(400).json({ success: false, error: 'Only accepted bargain offers can be added to cart' });
    }
    if (new Date(bargain.checkout_window_end).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Bargain checkout window has expired' });
    }

    const price = Number.parseFloat(bargain.original_price);
    const discount = Number.parseFloat(bargain.bargain_discount);

    const cartItem = await repositories.carts.addBargainItem(
      buyerId,
      bargain.product_id,
      price,
      discount,
      bargain.id
    );

    const cart = await repositories.carts.getCartWithItems(buyerId);

    res.status(200).json({
      success: true,
      message: 'Bargained item added to cart',
      cartItem,
      cart
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBargainOffer,
  getBuyerOffers,
  getSellerOffers,
  respondToBargain,
  buyerRespondToBargain,
  withdrawBargainOffer,
  getBargainHistory,
  addBargainToCart,
};
