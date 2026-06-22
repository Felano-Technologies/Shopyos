'use strict';

/**
 * tests/unit/flashSaleController.unit.test.js
 * Unit tests for flashSaleController.
 */

const mockDbQuery = jest.fn();

jest.mock('../../config/postgres', () => ({
  getPool: () => ({
    query: mockDbQuery
  })
}));

jest.mock('../../db/repositories', () => ({
  products: {
    findById: jest.fn()
  },
  flashSales: {
    getActiveSale: jest.fn(),
    createSale: jest.fn(),
    addProducts: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    createSlot: jest.fn(),
    getSlots: jest.fn(),
    getSellerSales: jest.fn(),
    getAdminSales: jest.fn(),
    checkProductAvailability: jest.fn()
  }
}));

jest.mock('../../services/feeConfigService', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'flash_sale_min_discount_pct') return Promise.resolve(10);
    return Promise.resolve(null);
  })
}));

const repositories = require('../../db/repositories');
const feeConfigService = require('../../services/feeConfigService');
const {
  getActiveSale,
  getSlotsList,
  submitFlashSale,
  getSellerSales,
  cancelFlashSale,
  createSlot,
  getAdminSales,
  reviewFlashSale
} = require('../../controllers/flashSaleController');

describe('flashSaleController Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'seller-uuid', storeId: 'store-001', roles: ['seller'] }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  // ─── getActiveSale ────────────────────────────────────────────────────────
  describe('getActiveSale', () => {
    test('test_getActiveSale_happyPath_returnsActiveSaleProducts', async () => {
      // Arrange
      const mockResult = {
        sale: { id: 'sale-01', title: 'Summer Deals', starts_at: '2026-06-22', ends_at: '2026-06-23' },
        items: [
          {
            flash_price: 90,
            stock_limit: 5,
            sold_count: 1,
            product: { id: 'p-1', title: 'Product One', price: 100, images: [], category: 'A', average_rating: 4.5, store_id: 'store-001' }
          }
        ]
      };
      repositories.flashSales.getActiveSale.mockResolvedValueOnce(mockResult);

      // Act
      await getActiveSale(req, res, next);

      // Assert
      expect(repositories.flashSales.getActiveSale).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        active: true,
        sale: expect.any(Object),
        products: expect.arrayContaining([
          expect.objectContaining({ price: 90, compare_at_price: 100 })
        ])
      });
    });
  });

  // ─── submitFlashSale ──────────────────────────────────────────────────────
  describe('submitFlashSale', () => {
    test('test_submitFlashSale_missingStoreProfile_returns403Forbidden', async () => {
      // Arrange
      req.user.storeId = null;

      // Act
      await submitFlashSale(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Seller store profile required' });
    });

    test('test_submitFlashSale_insufficientDiscountPercent_throwsError', async () => {
      // Arrange
      req.body = {
        slotId: 'slot-001',
        title: 'Weekly Sale',
        products: [{ productId: 'p-1', flashPrice: 95, stockLimit: 5 }] // listed price = 100, discount = 5% (min is 10)
      };
      repositories.products.findById.mockResolvedValueOnce({ id: 'p-1', store_id: 'store-001', price: 100, title: 'Prod' });
      repositories.flashSales.checkProductAvailability.mockResolvedValueOnce(true);

      // Act
      await submitFlashSale(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('discount must be at least 10%');
    });

    test('test_submitFlashSale_happyPath_submitsSuccessfully', async () => {
      // Arrange
      req.body = {
        slotId: 'slot-001',
        title: 'Weekly Sale',
        products: [{ productId: 'p-1', flashPrice: 80, stockLimit: 5 }] // 20% discount
      };
      repositories.products.findById.mockResolvedValueOnce({ id: 'p-1', store_id: 'store-001', price: 100, title: 'Prod' });
      repositories.flashSales.checkProductAvailability.mockResolvedValueOnce(true);
      repositories.flashSales.findById.mockResolvedValueOnce({ id: 'slot-001', start_time: '2026-06-22', end_time: '2026-06-23' });
      repositories.flashSales.createSale.mockResolvedValueOnce({ id: 'sale-100' });

      // Act
      await submitFlashSale(req, res, next);

      // Assert
      expect(repositories.flashSales.createSale).toHaveBeenCalled();
      expect(repositories.flashSales.addProducts).toHaveBeenCalledWith('sale-100', req.body.products, 'store-001');
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ─── cancelFlashSale ──────────────────────────────────────────────────────
  describe('cancelFlashSale', () => {
    test('test_cancelFlashSale_happyPath_cancelsAndReleasesStock', async () => {
      // Arrange
      req.params = { id: 'sale-001' };
      repositories.flashSales.findById.mockResolvedValueOnce({ id: 'sale-001', store_id: 'store-001', status: 'approved' });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ product_id: 'p-1', reserved_quantity: 5, sold_count: 0 }] }) // products list
        .mockResolvedValueOnce({ rows: [] }); // UPDATE inventory

      // Act
      await cancelFlashSale(req, res, next);

      // Assert
      expect(repositories.flashSales.update).toHaveBeenCalledWith('sale-001', { status: 'cancelled', is_active: false });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── reviewFlashSale ───────────────────────────────────────────────────────
  describe('reviewFlashSale', () => {
    test('test_reviewFlashSale_approved_reservesInventorySuccessfully', async () => {
      // Arrange
      req.params = { id: 'sale-001' };
      req.body = { status: 'approved', adminNotes: 'Looking good' };
      req.user = { id: 'admin-uuid', roles: ['admin'] };
      repositories.flashSales.findById.mockResolvedValueOnce({ id: 'sale-001', status: 'pending_approval' });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ product_id: 'p-1', stock_limit: 5 }] }) // products
        .mockResolvedValueOnce({ rows: [{ quantity: 15 }] }) // select for update inventory (quantity 15 >= 5)
        .mockResolvedValueOnce({ rows: [] }); // update inventory

      // Act
      await reviewFlashSale(req, res, next);

      // Assert
      expect(repositories.flashSales.update).toHaveBeenCalledWith('sale-001', expect.objectContaining({
        status: 'approved',
        admin_notes: 'Looking good',
        reviewed_by: 'admin-uuid'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
