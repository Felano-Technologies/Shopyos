'use strict';

/**
 * tests/unit/interRegionalController.unit.test.js
 * Unit tests for interRegionalController.
 */

const mockDbQuery = jest.fn();

jest.mock('../../config/postgres', () => ({
  getPool: () => ({
    query: mockDbQuery
  })
}));

jest.mock('../../db/repositories', () => ({
  orders: {
    findById: jest.fn()
  },
  deliveries: {
    create: jest.fn()
  },
  parcelPartner: {
    getHubById: jest.fn(),
    getStatusHistory: jest.fn()
  }
}));

jest.mock('../../services/feeConfigService', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'last_mile_default_fee') return Promise.resolve(15.00);
    return Promise.resolve(null);
  })
}));

const repositories = require('../../db/repositories');
const feeConfigService = require('../../services/feeConfigService');
const {
  requestLastMile,
  getTransitInfo
} = require('../../controllers/interRegionalController');

describe('interRegionalController Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      user: { id: 'buyer-uuid', roles: ['buyer'] }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  // ─── requestLastMile ──────────────────────────────────────────────────────
  describe('requestLastMile', () => {
    test('test_requestLastMile_orderNotFound_returns404NotFound', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      repositories.orders.findById.mockResolvedValueOnce(null);

      // Act
      await requestLastMile(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    test('test_requestLastMile_unauthorizedBuyer_returns403Forbidden', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-001', buyer_id: 'other-buyer-uuid' });

      // Act
      await requestLastMile(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    });

    test('test_requestLastMile_invalidOrderStatus_returns400BadRequest', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-001', buyer_id: 'buyer-uuid', status: 'pending' });

      // Act
      await requestLastMile(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order must be at destination hub' });
    });

    test('test_requestLastMile_happyPath_requestsLastMileSuccessfully', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      const mockOrder = {
        id: 'order-001',
        buyer_id: 'buyer-uuid',
        status: 'at_destination_hub',
        delivery_address_line1: '123 Buyer St Accra'
      };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.deliveries.create.mockResolvedValueOnce({ id: 'delivery-100' });
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

      // Act
      await requestLastMile(req, res, next);

      // Assert
      expect(feeConfigService.get).toHaveBeenCalledWith('last_mile_default_fee');
      expect(repositories.deliveries.create).toHaveBeenCalledWith(expect.objectContaining({
        order_id: 'order-001',
        delivery_fee: 15.00
      }));
      expect(mockDbQuery).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Last-mile delivery requested successfully',
        fee: 15.00,
        deliveryId: 'delivery-100'
      });
    });
  });

  // ─── getTransitInfo ───────────────────────────────────────────────────────
  describe('getTransitInfo', () => {
    test('test_getTransitInfo_happyPath_returnsFullTransitDetails', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      const mockOrder = {
        id: 'order-001',
        buyer_id: 'buyer-uuid',
        status: 'in_transit_regional',
        parcel_tracking_number: 'SPY-007',
        origin_hub_id: 'hub-01',
        destination_hub_id: 'hub-02',
        estimated_hub_arrival: '2026-06-25',
        last_mile_requested: false,
        last_mile_fee: 0
      };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.parcelPartner.getHubById.mockResolvedValueOnce({ id: 'hub-01', hub_name: 'Accra Hub' });
      repositories.parcelPartner.getHubById.mockResolvedValueOnce({ id: 'hub-02', hub_name: 'Kumasi Hub' });

      const mockHistory = [{ status: 'in_transit_regional', notes: 'Departed' }];
      repositories.parcelPartner.getStatusHistory.mockResolvedValueOnce(mockHistory);

      // Act
      await getTransitInfo(req, res, next);

      // Assert
      expect(repositories.parcelPartner.getStatusHistory).toHaveBeenCalledWith('order-001');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          trackingNumber: 'SPY-007',
          orderStatus: 'in_transit_regional',
          history: mockHistory
        })
      });
    });
  });
});
