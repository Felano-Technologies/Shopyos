// controllers/bargainController.js
const ApiResponse = require('../utils/apiResponse');
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
      return ApiResponse.error(res, sellerId === buyerId ? 'Sellers cannot bargain on their own products' : 'Could not determine seller', 400);
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

    ApiResponse.withEntity(res, 'bargain', bargain, 'Offer submitted', null, isRejected ? 200 : 201);
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('must be') || error.message.includes('not enabled') || error.message.includes('less than') || error.message.includes('already have')) {
      return ApiResponse.error(res, error.message, 400);
    }
    if (error.message === 'Product not found') {
      return ApiResponse.error(res, error.message, 404);
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

    ApiResponse.paginated(res, data, {
      totalItems: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: Math.floor(offset / limitNum) + 1,
      itemsPerPage: limitNum,
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

    ApiResponse.paginated(res, data, {
      totalItems: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: Math.floor(offset / limitNum) + 1,
      itemsPerPage: limitNum,
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

  ApiResponse.withEntity(res, 'bargain', updated);
};

const handleSellerCounter = async (bargain, sellerId, counterPrice, sellerMessage, res) => {
  if (bargain.round_number >= bargain.max_rounds) {
    return ApiResponse.error(res, 'Maximum bargaining rounds reached. Cannot counter again.', 400);
  }
  const price = Number.parseFloat(counterPrice);
  if (Number.isNaN(price) || price <= 0 || price >= Number.parseFloat(bargain.original_price)) {
    return ApiResponse.error(res, 'Counter price must be positive and less than original price.', 400);
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

  ApiResponse.withEntity(res, 'bargain', updated);
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

  ApiResponse.withEntity(res, 'bargain', updated);
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
      return ApiResponse.error(res, 'Invalid action. Must be accept, counter, or reject.', 400);
    }

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || bargain.seller_id !== sellerId) {
      return ApiResponse.error(res, 'Bargain offer not found', 404);
    }
    if (!['pending', 'countered'].includes(bargain.status)) {
      return ApiResponse.error(res, 'Bargain is no longer active for responses.', 400);
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

  ApiResponse.withEntity(res, 'bargain', updated);
};

const handleBuyerCounter = async (bargain, buyerId, offeredPrice, buyerMessage, res) => {
  if (bargain.round_number >= bargain.max_rounds) {
    return ApiResponse.error(res, 'Maximum bargaining rounds reached. Cannot counter again.', 400);
  }
  const price = Number.parseFloat(offeredPrice);
  if (Number.isNaN(price) || price <= 0 || price >= Number.parseFloat(bargain.counter_price || bargain.original_price)) {
    return ApiResponse.error(res, 'Counter-offer price must be positive and less than the previous counter price.', 400);
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

  ApiResponse.withEntity(res, 'bargain', updated);
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
      return ApiResponse.error(res, 'Invalid action. Must be accept, counter, or reject.', 400);
    }

    const bargain = await repositories.bargains.findById(bargainId);
    if (!bargain || bargain.buyer_id !== buyerId) {
      return ApiResponse.error(res, 'Bargain offer not found', 404);
    }
    if (bargain.status !== 'countered') {
      return ApiResponse.error(res, 'No active seller counter-offer to respond to.', 400);
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
      ApiResponse.withEntity(res, 'bargain', updated);
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
      return ApiResponse.error(res, 'Bargain offer not found', 404);
    }
    if (!['pending', 'countered'].includes(bargain.status)) {
      return ApiResponse.error(res, 'Only pending or countered offers can be withdrawn.', 400);
    }

    const updated = await repositories.bargains.update(bargainId, { status: 'withdrawn' });
    await repositories.bargains.createHistoryEntry(bargainId, buyerId, 'buyer', 'withdraw_offer');

    ApiResponse.withEntity(res, 'bargain', updated, 'Offer withdrawn successfully');
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
      return ApiResponse.error(res, 'Bargain offer not found', 404);
    }

    const history = await repositories.bargains.getBargainHistory(bargainId);
    ApiResponse.withEntity(res, 'history', history);
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
      return ApiResponse.error(res, 'Bargain offer not found', 404);
    }
    if (bargain.status !== 'accepted') {
      return ApiResponse.error(res, 'Only accepted bargain offers can be added to cart', 400);
    }
    if (new Date(bargain.checkout_window_end).getTime() < Date.now()) {
      return ApiResponse.error(res, 'Bargain checkout window has expired', 400);
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

    ApiResponse.success(res, { cartItem, cart }, 'Bargained item added to cart');
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
