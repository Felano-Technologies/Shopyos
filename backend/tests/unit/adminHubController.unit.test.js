'use strict';

/**
 * tests/unit/adminHubController.unit.test.js
 * Unit tests for admin hub management functions inside parcelPartnerController.js.
 */

const mockDbQuery = jest.fn();

jest.mock('../../config/postgres', () => ({
  getPool: () => ({
    query: mockDbQuery,
  }),
}));

// Stub repositories — admin hub functions only use raw pool.query
jest.mock('../../db/repositories', () => ({
  orders: { findById: jest.fn() },
  parcelPartner: {
    getHubs: jest.fn(),
    getHubById: jest.fn(),
    getHubByRegionName: jest.fn(),
    getTransitConfig: jest.fn(),
    createStatusLog: jest.fn(),
    getStatusHistory: jest.fn(),
  },
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
}));

const {
  adminGetAllHubs,
  adminCreateHub,
  adminUpdateHub,
  adminToggleHub,
  adminGetTransitRoutes,
  adminUpsertTransitRoute,
} = require('../../controllers/parcelPartnerController');

describe('Admin Hub Management (parcelPartnerController)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'admin-uuid', roles: ['admin'] },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // ─── adminGetAllHubs ───────────────────────────────────────────────────────

  describe('adminGetAllHubs', () => {
    test('test_adminGetAllHubs_happyPath_returnsAllHubs', async () => {
      // Arrange
      const mockHubs = [
        { id: 'hub-1', hub_name: 'Accra Hub', is_active: true, region_name: 'Greater Accra' },
        { id: 'hub-2', hub_name: 'Kumasi Hub', is_active: false, region_name: 'Ashanti' },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows: mockHubs });

      // Act
      await adminGetAllHubs(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockHubs });
    });

    test('test_adminGetAllHubs_dbError_callsNext', async () => {
      // Arrange
      const error = new Error('DB timeout');
      mockDbQuery.mockRejectedValueOnce(error);

      // Act
      await adminGetAllHubs(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── adminCreateHub ────────────────────────────────────────────────────────

  describe('adminCreateHub', () => {
    test('test_adminCreateHub_missingRequiredFields_returns400', async () => {
      // Arrange
      req.body = { regionId: 1, hubName: 'Accra Hub' }; // missing partnerName

      // Act
      await adminCreateHub(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'regionId, hubName and partnerName are required',
      });
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    test('test_adminCreateHub_validInput_insertsHubAndReturns201', async () => {
      // Arrange
      req.body = {
        regionId: 1,
        hubName: 'Accra Central Hub',
        partnerName: 'Express Ghana Ltd',
        address: 'Ring Road, Accra',
        phone: '+233200000000',
      };
      const created = {
        id: 'hub-new',
        region_id: 1,
        hub_name: 'Accra Central Hub',
        partner_name: 'Express Ghana Ltd',
        is_active: true,
      };
      mockDbQuery.mockResolvedValueOnce({ rows: [created] });

      // Act
      await adminCreateHub(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO parcel_partner_hubs'),
        [1, 'Accra Central Hub', 'Express Ghana Ltd', 'Ring Road, Accra', '+233200000000', null, null]
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, hub: created });
    });

    test('test_adminCreateHub_optionalFieldsMissing_insertsWithNulls', async () => {
      // Arrange
      req.body = { regionId: 2, hubName: 'Kumasi Hub', partnerName: 'Hub Co' };
      const created = { id: 'hub-new', hub_name: 'Kumasi Hub', partner_name: 'Hub Co', address: null, phone: null };
      mockDbQuery.mockResolvedValueOnce({ rows: [created] });

      // Act
      await adminCreateHub(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO parcel_partner_hubs'),
        [2, 'Kumasi Hub', 'Hub Co', null, null, null, null]
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ─── adminUpdateHub ────────────────────────────────────────────────────────

  describe('adminUpdateHub', () => {
    test('test_adminUpdateHub_hubNotFound_returns404', async () => {
      // Arrange
      req.params = { hubId: 'hub-missing' };
      req.body = { hubName: 'New Name' };
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // no hub found

      // Act
      await adminUpdateHub(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Hub not found' });
    });

    test('test_adminUpdateHub_happyPath_returnsUpdatedHub', async () => {
      // Arrange
      req.params = { hubId: 'hub-001' };
      req.body = { hubName: 'Updated Hub', partnerName: 'New Partner', address: 'New St', phone: '+233111' };
      const updatedHub = { id: 'hub-001', hub_name: 'Updated Hub', partner_name: 'New Partner' };
      mockDbQuery.mockResolvedValueOnce({ rows: [updatedHub] });

      // Act
      await adminUpdateHub(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE parcel_partner_hubs'),
        ['Updated Hub', 'New Partner', 'New St', '+233111', undefined, undefined, 'hub-001']
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, hub: updatedHub });
    });
  });

  // ─── adminToggleHub ────────────────────────────────────────────────────────

  describe('adminToggleHub', () => {
    test('test_adminToggleHub_hubNotFound_returns404', async () => {
      // Arrange
      req.params = { hubId: 'hub-missing' };
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      // Act
      await adminToggleHub(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Hub not found' });
    });

    test('test_adminToggleHub_happyPath_togglesAndReturnsNewStatus', async () => {
      // Arrange
      req.params = { hubId: 'hub-001' };
      const toggledHub = { id: 'hub-001', hub_name: 'Accra Hub', is_active: false }; // was true, now false
      mockDbQuery.mockResolvedValueOnce({ rows: [toggledHub] });

      // Act
      await adminToggleHub(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = NOT is_active'),
        ['hub-001']
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, hub: toggledHub });
    });
  });

  // ─── adminGetTransitRoutes ────────────────────────────────────────────────

  describe('adminGetTransitRoutes', () => {
    test('test_adminGetTransitRoutes_happyPath_returnsRoutesList', async () => {
      // Arrange
      const mockRoutes = [
        { id: 'r-1', origin_region: 'Greater Accra', dest_region: 'Ashanti', transit_days_min: 2 },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows: mockRoutes });

      // Act
      await adminGetTransitRoutes(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM parcel_transit_config')
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRoutes });
    });
  });

  // ─── adminUpsertTransitRoute ──────────────────────────────────────────────

  describe('adminUpsertTransitRoute', () => {
    test('test_adminUpsertTransitRoute_missingRegions_returns400', async () => {
      // Arrange
      req.body = { transitDaysMin: 3, transitDaysMax: 5, transitFee: 10 }; // no origin/dest

      // Act
      await adminUpsertTransitRoute(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'originRegion and destRegion are required',
      });
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    test('test_adminUpsertTransitRoute_insert_returnsRoute', async () => {
      // Arrange
      req.body = {
        originRegion: 'Greater Accra',
        destRegion: 'Ashanti',
        transitDaysMin: 2,
        transitDaysMax: 4,
        transitFee: 20,
      };
      const route = {
        id: 'route-1',
        origin_region: 'Greater Accra',
        dest_region: 'Ashanti',
        transit_days_min: 2,
        transit_days_max: 4,
        transit_fee: 20,
      };
      mockDbQuery.mockResolvedValueOnce({ rows: [route] });

      // Act
      await adminUpsertTransitRoute(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (origin_region, dest_region)'),
        ['Greater Accra', 'Ashanti', 2, 4, 20]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, route });
    });

    test('test_adminUpsertTransitRoute_defaultValues_usedWhenNotProvided', async () => {
      // Arrange — minimal payload, let defaults apply
      req.body = { originRegion: 'Volta', destRegion: 'Eastern' };
      const route = { id: 'route-2', transit_days_min: 3, transit_days_max: 5, transit_fee: 0 };
      mockDbQuery.mockResolvedValueOnce({ rows: [route] });

      // Act
      await adminUpsertTransitRoute(req, res, next);

      // Assert
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.anything(),
        ['Volta', 'Eastern', 3, 5, 0]
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
