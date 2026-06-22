'use strict';

/**
 * tests/unit/bargainController.unit.test.js
 * Unit tests for bargainController endpoints.
 */

jest.mock('../../db/repositories', () => ({
  products: {
    findById: jest.fn(),
  },
  stores: {
    findById: jest.fn(),
  },
  bargains: {
    findActiveBargain: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getBuyerOffers: jest.fn(),
    getSellerOffers: jest.fn(),
    createHistoryEntry: jest.fn(),
    getBargainHistory: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../services/feeConfigService', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'bargain_max_rounds') return Promise.resolve(3);
    if (key === 'bargain_offer_ttl_hours') return Promise.resolve(24);
    if (key === 'bargain_checkout_window_hours') return Promise.resolve(1);
    return Promise.resolve(null);
  }),
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const notificationService = require('../../services/notificationService');
const {
  createBargainOffer,
  getBuyerOffers,
  getSellerOffers,
  respondToBargain,
  buyerRespondToBargain,
  withdrawBargainOffer,
  getBargainHistory,
} = require('../../controllers/bargainController');

describe('bargainController Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'buyer-uuid' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // ─── createBargainOffer ────────────────────────────────────────────────────
  describe('createBargainOffer', () => {
    test('test_createBargainOffer_happyPath_submitsSuccessfully', async () => {
      // Arrange
      req.body = { productId: 'prod-001', offeredPrice: 80, buyerMessage: 'Please accept' };
      const product = { id: 'prod-001', name: 'Sample Product', price: '100.00', store_id: 'store-001', bargaining_enabled: true, min_bargain_price: '50.00' };
      const store = { id: 'store-001', owner_id: 'seller-uuid' };
      const mockBargain = { id: 'bargain-001', product_id: 'prod-001', buyer_id: 'buyer-uuid', seller_id: 'seller-uuid', offered_price: 80, status: 'pending' };

      repositories.products.findById.mockResolvedValueOnce(product);
      repositories.bargains.findActiveBargain.mockResolvedValueOnce(null);
      repositories.stores.findById.mockResolvedValueOnce(store);
      repositories.bargains.create.mockResolvedValueOnce(mockBargain);

      // Act
      await createBargainOffer(req, res, next);

      // Assert
      expect(repositories.bargains.create).toHaveBeenCalled();
      expect(repositories.bargains.createHistoryEntry).toHaveBeenCalledWith('bargain-001', 'buyer-uuid', 'buyer', 'submit_offer', 80, 'Please accept');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'seller-uuid', type: 'bargain_offer_received' }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Offer submitted', bargain: mockBargain });
    });

    test('test_createBargainOffer_missingFields_returns400', async () => {
      // Arrange
      req.body = { productId: 'prod-001' }; // missing offeredPrice

      // Act
      await createBargainOffer(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.any(String) }));
    });

    test('test_createBargainOffer_productNotFound_returns404', async () => {
      // Arrange
      req.body = { productId: 'prod-none', offeredPrice: 80 };
      repositories.products.findById.mockResolvedValueOnce(null);

      // Act
      await createBargainOffer(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_createBargainOffer_bargainingDisabled_returns400', async () => {
      // Arrange
      req.body = { productId: 'prod-001', offeredPrice: 80 };
      const product = { id: 'prod-001', price: '100.00', bargaining_enabled: false };
      repositories.products.findById.mockResolvedValueOnce(product);

      // Act
      await createBargainOffer(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bargaining is not enabled for this product' }));
    });

    test('test_createBargainOffer_offerTooHigh_returns400', async () => {
      // Arrange
      req.body = { productId: 'prod-001', offeredPrice: 120 }; // price is 100
      const product = { id: 'prod-001', price: '100.00', bargaining_enabled: true };
      repositories.products.findById.mockResolvedValueOnce(product);

      // Act
      await createBargainOffer(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_createBargainOffer_belowFloorSecretPrice_rejectsImmediately', async () => {
      // Arrange
      req.body = { productId: 'prod-001', offeredPrice: 40 }; // floor is 50
      const product = { id: 'prod-001', name: 'Sample Product', price: '100.00', store_id: 'store-001', bargaining_enabled: true, min_bargain_price: '50.00' };
      const store = { id: 'store-001', owner_id: 'seller-uuid' };
      const mockBargain = { id: 'bargain-001', product_id: 'prod-001', buyer_id: 'buyer-uuid', offered_price: 40, status: 'rejected' };

      repositories.products.findById.mockResolvedValueOnce(product);
      repositories.bargains.findActiveBargain.mockResolvedValueOnce(null);
      repositories.stores.findById.mockResolvedValueOnce(store);
      repositories.bargains.create.mockResolvedValueOnce(mockBargain);

      // Act
      await createBargainOffer(req, res, next);

      // Assert
      expect(repositories.bargains.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
      expect(notificationService.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'buyer-uuid', type: 'bargain_rejected' }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── respondToBargain ──────────────────────────────────────────────────────
  describe('respondToBargain', () => {
    test('test_respondToBargain_sellerAccepts_updatesStatusToAccepted', async () => {
      // Arrange
      req.params.bargainId = 'bargain-001';
      req.body = { action: 'accept' };
      req.user.id = 'seller-uuid';
      const mockBargain = { id: 'bargain-001', seller_id: 'seller-uuid', buyer_id: 'buyer-uuid', original_price: '100.00', offered_price: '80.00', status: 'pending' };
      const updatedBargain = { ...mockBargain, status: 'accepted', final_agreed_price: 80, bargain_discount: 20 };

      repositories.bargains.findById.mockResolvedValueOnce(mockBargain);
      repositories.bargains.update.mockResolvedValueOnce(updatedBargain);

      // Act
      await respondToBargain(req, res, next);

      // Assert
      expect(repositories.bargains.update).toHaveBeenCalledWith('bargain-001', expect.objectContaining({ status: 'accepted' }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_respondToBargain_sellerCounters_updatesStatusToCountered', async () => {
      // Arrange
      req.params.bargainId = 'bargain-001';
      req.body = { action: 'counter', counterPrice: 90, sellerMessage: 'Best price' };
      req.user.id = 'seller-uuid';
      const mockBargain = { id: 'bargain-001', seller_id: 'seller-uuid', buyer_id: 'buyer-uuid', original_price: '100.00', offered_price: '80.00', status: 'pending', round_number: 1, max_rounds: 3 };
      const updatedBargain = { ...mockBargain, status: 'countered', counter_price: 90, round_number: 2 };

      repositories.bargains.findById.mockResolvedValueOnce(mockBargain);
      repositories.bargains.update.mockResolvedValueOnce(updatedBargain);

      // Act
      await respondToBargain(req, res, next);

      // Assert
      expect(repositories.bargains.update).toHaveBeenCalledWith('bargain-001', expect.objectContaining({ status: 'countered', counter_price: 90 }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_respondToBargain_maxRoundsReached_returns400', async () => {
      // Arrange
      req.params.bargainId = 'bargain-001';
      req.body = { action: 'counter', counterPrice: 90 };
      req.user.id = 'seller-uuid';
      const mockBargain = { id: 'bargain-001', seller_id: 'seller-uuid', status: 'pending', round_number: 3, max_rounds: 3 };

      repositories.bargains.findById.mockResolvedValueOnce(mockBargain);

      // Act
      await respondToBargain(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Maximum bargaining rounds reached. Cannot counter again.' }));
    });
  });

  // ─── buyerRespondToBargain ─────────────────────────────────────────────────
  describe('buyerRespondToBargain', () => {
    test('test_buyerRespondToBargain_buyerAccepts_updatesStatusToAccepted', async () => {
      // Arrange
      req.params.bargainId = 'bargain-001';
      req.body = { action: 'accept' };
      const mockBargain = { id: 'bargain-001', buyer_id: 'buyer-uuid', seller_id: 'seller-uuid', original_price: '100.00', counter_price: '90.00', status: 'countered' };
      const updated = { ...mockBargain, status: 'accepted', final_agreed_price: 90 };

      repositories.bargains.findById.mockResolvedValueOnce(mockBargain);
      repositories.bargains.update.mockResolvedValueOnce(updated);

      // Act
      await buyerRespondToBargain(req, res, next);

      // Assert
      expect(repositories.bargains.update).toHaveBeenCalledWith('bargain-001', expect.objectContaining({ status: 'accepted', final_agreed_price: 90 }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
