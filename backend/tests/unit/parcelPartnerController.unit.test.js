'use strict';

/**
 * tests/unit/parcelPartnerController.unit.test.js
 * Unit tests for parcelPartnerController.
 */

// Define mock query function first to reference it
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
  parcelPartner: {
    getHubs: jest.fn(),
    getHubById: jest.fn(),
    getHubByRegionName: jest.fn(),
    getTransitConfig: jest.fn(),
    createStatusLog: jest.fn(),
    getStatusHistory: jest.fn()
  }
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({})
}));

const repositories = require('../../db/repositories');
const notificationService = require('../../services/notificationService');
const {
  getHubs,
  getDashboardStats,
  getHubParcels,
  checkInParcel,
  dispatchParcel,
  arriveParcel
} = require('../../controllers/parcelPartnerController');

describe('parcelPartnerController Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'staff-uuid', roles: ['parcel_partner'] }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  // ─── getHubs ─────────────────────────────────────────────────────────────
  describe('getHubs', () => {
    test('test_getHubs_happyPath_returnsHubListSuccessfully', async () => {
      // Arrange
      const mockHubs = [
        { id: 'hub-01', hub_name: 'Accra Hub' },
        { id: 'hub-02', hub_name: 'Kumasi Hub' }
      ];
      repositories.parcelPartner.getHubs.mockResolvedValueOnce(mockHubs);

      // Act
      await getHubs(req, res, next);

      // Assert
      expect(repositories.parcelPartner.getHubs).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockHubs });
    });
  });

  // ─── getDashboardStats ───────────────────────────────────────────────────
  describe('getDashboardStats', () => {
    test('test_getDashboardStats_missingHubId_returns400BadRequest', async () => {
      // Arrange
      req.query = {};

      // Act
      await getDashboardStats(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'hubId is required' });
    });

    test('test_getDashboardStats_happyPath_returnsCorrectCounts', async () => {
      // Arrange
      req.query = { hubId: 'hub-001' };
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // awaiting check in
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })  // checked in
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })   // in transit
        .mockResolvedValueOnce({ rows: [{ count: '12' }] });  // arrived

      // Act
      await getDashboardStats(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledTimes(4);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          awaitingCheckIn: 5,
          checkedIn: 10,
          inTransit: 3,
          arrived: 12
        }
      });
    });
  });

  // ─── getHubParcels ────────────────────────────────────────────────────────
  describe('getHubParcels', () => {
    test('test_getHubParcels_missingHubId_returns400BadRequest', async () => {
      // Arrange
      req.query = {};

      // Act
      await getHubParcels(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'hubId is required' });
    });

    test('test_getHubParcels_happyPath_returnsParcelList', async () => {
      // Arrange
      req.query = { hubId: 'hub-001', status: 'at_origin_hub' };
      const mockParcels = [{ id: 'order-001', parcel_tracking_number: 'SPY-01' }];
      mockDbQuery.mockResolvedValueOnce({ rows: mockParcels });

      // Act
      await getHubParcels(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockParcels });
    });
  });

  // ─── checkInParcel ────────────────────────────────────────────────────────
  describe('checkInParcel', () => {
    test('test_checkInParcel_orderNotFound_returns404NotFound', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      req.body = { hubId: 'hub-001' };
      repositories.orders.findById.mockResolvedValueOnce(null);

      // Act
      await checkInParcel(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    test('test_checkInParcel_hubNotFound_returns404NotFound', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      req.body = { hubId: 'hub-001' };
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-001' });
      repositories.parcelPartner.getHubById.mockResolvedValueOnce(null);

      // Act
      await checkInParcel(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Hub not found' });
    });

    test('test_checkInParcel_happyPath_checksInAndNotifies', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      req.body = { hubId: 'hub-001', notes: 'Checked in fine' };
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-001', buyer_id: 'buyer-001', order_number: 'ORD123' });
      repositories.parcelPartner.getHubById.mockResolvedValueOnce({ id: 'hub-001', hub_name: 'Accra Hub' });
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // For UPDATE orders query

      // Act
      await checkInParcel(req, res, next);

      // Assert
      expect(repositories.parcelPartner.createStatusLog).toHaveBeenCalledWith(
        'order-001', 'at_origin_hub', 'hub-001', 'staff-uuid', 'Checked in fine', undefined
      );
      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Parcel checked in successfully',
        trackingNumber: 'SPY-PRC-ORDER-00'
      });
    });
  });

  // ─── dispatchParcel ───────────────────────────────────────────────────────
  describe('dispatchParcel', () => {
    test('test_dispatchParcel_happyPath_dispatchesSuccessfully', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      req.body = { hubId: 'hub-001' };
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'order-001',
        buyer_id: 'buyer-001',
        order_number: 'ORD123',
        destination_hub_id: 'hub-002'
      });
      repositories.parcelPartner.getHubById.mockResolvedValueOnce({ id: 'hub-001', hub_name: 'Accra Hub', region_name: 'Greater Accra' });
      repositories.parcelPartner.getHubById.mockResolvedValueOnce({ id: 'hub-002', hub_name: 'Kumasi Hub', region_name: 'Ashanti' });
      repositories.parcelPartner.getTransitConfig.mockResolvedValueOnce({ transit_days_min: 2 });
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

      // Act
      await dispatchParcel(req, res, next);

      // Assert
      expect(repositories.parcelPartner.createStatusLog).toHaveBeenCalledWith(
        'order-001', 'in_transit_regional', 'hub-001', 'staff-uuid', undefined, undefined
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── arriveParcel ─────────────────────────────────────────────────────────
  describe('arriveParcel', () => {
    test('test_arriveParcel_happyPath_arrivesSuccessfully', async () => {
      // Arrange
      req.params = { orderId: 'order-001' };
      req.body = { hubId: 'hub-002' };
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'order-001',
        buyer_id: 'buyer-001',
        order_number: 'ORD123'
      });
      repositories.parcelPartner.getHubById.mockResolvedValueOnce({ id: 'hub-002', hub_name: 'Kumasi Hub' });
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

      // Act
      await arriveParcel(req, res, next);

      // Assert
      expect(repositories.parcelPartner.createStatusLog).toHaveBeenCalledWith(
        'order-001', 'at_destination_hub', 'hub-002', 'staff-uuid', undefined, undefined
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
