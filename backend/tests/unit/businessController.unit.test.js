'use strict';

/**
 * tests/unit/businessController.unit.test.js
 *
 * Unit tests for businessController functions.
 * Mocks all repositories, services, config helpers, and upload utilities.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
  cacheDelPattern: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../config/cacheInvalidation', () => ({
  invalidateStore: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => url || ''),
  resolveImageUrl: jest.fn(async (url) => url || null),
}));

jest.mock('../../utils/uploadHelpers', () => ({
  uploadFileToCloudinary: jest.fn(),
  deleteImage: jest.fn().mockResolvedValue(undefined),
  extractPublicId: jest.fn().mockReturnValue('cloudinary-public-id'),
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
  sendPushNotification: jest.fn().mockResolvedValue({}),
  sendOrderNotification: jest.fn().mockResolvedValue({}),
  notifyAdminsVerificationRequest: jest.fn().mockResolvedValue({}),
}));

const mockDbStoreChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockResolvedValue({ data: [], error: null }),
  then: jest.fn(),
};

const mockDbReviewChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockResolvedValue({ data: [], error: null }),
};

jest.mock('../../db/repositories', () => ({
  users: {
    findById: jest.fn(),
    getAdmins: jest.fn(),
    hasRole: jest.fn(),
  },
  stores: {
    findById: jest.fn(),
    findByOwner: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    getStoreDetails: jest.fn(),
    isFollowing: jest.fn(),
    followStore: jest.fn(),
    unfollowStore: jest.fn(),
    db: mockDbStoreChain,
  },
  products: {
    count: jest.fn(),
  },
  orders: {
    count: jest.fn(),
    getStoreOrders: jest.fn(),
    findAll: jest.fn(),
    getStoreRevenueStats: jest.fn(),
  },
  roles: {
    userHasRole: jest.fn(),
    findByName: jest.fn(),
    assignRoleToUser: jest.fn(),
  },
  userProfiles: {
    findByUserId: jest.fn(),
  },
  reviews: {
    db: mockDbReviewChain,
  },
  adminSettings: {
    getSettings: jest.fn().mockResolvedValue({ auto_approve_sellers: false }),
  },
}));

const repositories = require('../../db/repositories');
const notificationService = require('../../services/notificationService');
const rabbitMQService = require('../../services/rabbitmq');
const { invalidateStore } = require('../../config/cacheInvalidation');

const {
  createBusiness,
  getMyBusinesses,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  uploadLogo,
  uploadBanner,
  getBusinessDashboard,
  getBusinessAnalytics,
  followBusiness,
  unfollowBusiness,
  getBusinessReviews,
} = require('../../controllers/businessController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    files: null,
    file: null,
    user: { id: 'seller-user-id', roles: ['seller'] },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeValidBusinessBody(overrides = {}) {
  return {
    businessName: 'Test Shop',
    description: 'A great shop',
    category: 'Fashion',
    address: '1 Main Street',
    city: 'Accra',
    country: 'Ghana',
    phone: '+233201234567',
    ...overrides,
  };
}

describe('BusinessController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createBusiness ─────────────────────────────────────────────────
  describe('createBusiness', () => {
    test('test_createBusiness_missingBusinessName_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        body: makeValidBusinessBody({ businessName: undefined }),
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Please fill all required fields',
      });
    });

    test('test_createBusiness_missingCity_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        body: makeValidBusinessBody({ city: undefined }),
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_createBusiness_userNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.users.findById.mockResolvedValueOnce(null);
      const req = mockReq({ body: makeValidBusinessBody() });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
    });

    test('test_createBusiness_maxStoresReached_returns400BadRequest', async () => {
      // Arrange
      repositories.users.findById.mockResolvedValueOnce({ id: 'seller-user-id', email: 'seller@test.com' });
      repositories.stores.findByOwner.mockResolvedValueOnce([
        { store_name: 'Shop A' },
        { store_name: 'Shop B' },
        { store_name: 'Shop C' },
      ]);
      const req = mockReq({ body: makeValidBusinessBody() });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You have reached the maximum limit of 3 business profiles',
      });
    });

    test('test_createBusiness_duplicateBusinessName_returns400BadRequest', async () => {
      // Arrange
      repositories.users.findById.mockResolvedValueOnce({ id: 'seller-user-id', email: 'seller@test.com' });
      repositories.stores.findByOwner.mockResolvedValueOnce([{ store_name: 'Test Shop' }]);
      const req = mockReq({ body: makeValidBusinessBody({ businessName: 'Test Shop' }) });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You already have a business with this name',
      });
    });

    test('test_createBusiness_validInput_creates201AndReturnsFormattedBusiness', async () => {
      // Arrange
      const mockUser = { id: 'seller-user-id', email: 'seller@test.com' };
      const mockStore = {
        id: 'store-1',
        store_name: 'Test Shop',
        description: 'A great shop',
        category: 'Fashion',
        phone: '+233201234567',
        email: null,
        address_line1: '1 Main Street',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'pending',
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      repositories.users.findById.mockResolvedValueOnce(mockUser);
      repositories.stores.findByOwner.mockResolvedValueOnce([]);
      repositories.stores.create.mockResolvedValueOnce(mockStore);
      repositories.stores.getStoreDetails.mockResolvedValueOnce({ ...mockStore, owner: mockUser });
      repositories.roles.userHasRole.mockResolvedValueOnce(true);
      const req = mockReq({ body: makeValidBusinessBody() });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(repositories.stores.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Business created successfully',
          business: expect.objectContaining({ businessName: 'Test Shop' }),
        }),
      );
    });

    test('test_createBusiness_noSellerRole_assignsSellerRoleToUser', async () => {
      // Arrange
      const mockUser = { id: 'seller-user-id', email: 'seller@test.com' };
      const mockStore = {
        id: 'store-1',
        store_name: 'New Shop',
        description: 'Desc',
        category: 'Food',
        phone: '+233',
        email: null,
        address_line1: 'Addr',
        city: 'Kumasi',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'pending',
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      repositories.users.findById.mockResolvedValueOnce(mockUser);
      repositories.stores.findByOwner.mockResolvedValueOnce([]);
      repositories.stores.create.mockResolvedValueOnce(mockStore);
      repositories.stores.getStoreDetails.mockResolvedValueOnce({ ...mockStore, owner: mockUser });
      repositories.roles.userHasRole.mockResolvedValueOnce(false);
      repositories.roles.findByName.mockResolvedValueOnce({ id: 'role-seller', name: 'seller' });
      repositories.roles.assignRoleToUser.mockResolvedValueOnce(undefined);
      const req = mockReq({
        body: makeValidBusinessBody({ businessName: 'New Shop', city: 'Kumasi', category: 'Food' }),
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(repositories.roles.assignRoleToUser).toHaveBeenCalledWith(
        'seller-user-id',
        'role-seller',
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('test_createBusiness_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.users.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ body: makeValidBusinessBody() });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getMyBusinesses ────────────────────────────────────────────────
  describe('getMyBusinesses', () => {
    test('test_getMyBusinesses_defaultPagination_returns200AndBusinessList', async () => {
      // Arrange
      const mockStore = {
        id: 'store-1',
        store_name: 'Test Shop',
        description: 'Desc',
        category: 'Fashion',
        phone: '+233',
        email: null,
        address_line1: 'Addr',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'pending',
        rejection_reason: null,
        is_active: true,
        is_trusted: false,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      repositories.stores.findAll.mockResolvedValueOnce({ data: [mockStore], count: 1 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyBusinesses(req, res, next);

      // Assert
      expect(repositories.stores.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { owner_id: 'seller-user-id' } }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.objectContaining({ totalItems: 1 }),
        }),
      );
    });

    test('test_getMyBusinesses_customPagination_passesCorrectParams', async () => {
      // Arrange
      repositories.stores.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      const req = mockReq({ query: { limit: '5', offset: '10' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyBusinesses(req, res, next);

      // Assert
      expect(repositories.stores.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, offset: 10 }),
      );
    });

    test('test_getMyBusinesses_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findAll.mockRejectedValueOnce(dbError);
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyBusinesses(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getBusinessById ────────────────────────────────────────────────
  describe('getBusinessById', () => {
    test('test_getBusinessById_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessById(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Business not found' });
    });

    test('test_getBusinessById_existingBusiness_returns200AndFormattedBusiness', async () => {
      // Arrange
      const mockStore = {
        id: 'store-1',
        owner_id: 'seller-user-id',
        store_name: 'Test Shop',
        description: 'A great shop',
        category: 'Fashion',
        phone: '+233',
        email: null,
        address_line1: '1 Main St',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'verified',
        rejection_reason: null,
        is_active: true,
        is_trusted: true,
        average_rating: 4.5,
        total_reviews: 12,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const mockStoreDetails = { ...mockStore, owner: { email: 'seller@test.com' } };
      repositories.stores.findById.mockResolvedValueOnce(mockStore);
      repositories.stores.getStoreDetails.mockResolvedValueOnce(mockStoreDetails);
      repositories.stores.isFollowing.mockResolvedValueOnce(false);
      mockDbStoreChain.from.mockReturnThis();
      mockDbStoreChain.select.mockReturnThis();
      mockDbStoreChain.eq.mockResolvedValueOnce({ count: 3 });
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessById(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          business: expect.objectContaining({ businessName: 'Test Shop' }),
        }),
      );
    });

    test('test_getBusinessById_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessById(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── updateBusiness ─────────────────────────────────────────────────
  describe('updateBusiness', () => {
    test('test_updateBusiness_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' }, body: { businessName: 'New Name' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Business not found' });
    });

    test('test_updateBusiness_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
      });
      const req = mockReq({
        params: { id: 'store-1' },
        body: { businessName: 'New Name' },
        user: { id: 'intruder-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to update this business',
      });
    });

    test('test_updateBusiness_authorizedOwner_updates200AndReturnsUpdatedBusiness', async () => {
      // Arrange
      const mockStore = { id: 'store-1', owner_id: 'seller-user-id' };
      const mockUpdatedStore = {
        id: 'store-1',
        store_name: 'Renamed Shop',
        description: 'Updated desc',
        category: 'Fashion',
        phone: '+233',
        email: null,
        address_line1: '1 Main St',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'pending',
        rejection_reason: null,
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        updated_at: new Date().toISOString(),
      };
      repositories.stores.findById.mockResolvedValueOnce(mockStore);
      repositories.stores.update.mockResolvedValueOnce(mockUpdatedStore);
      const req = mockReq({
        params: { id: 'store-1' },
        body: { businessName: 'Renamed Shop' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(repositories.stores.update).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({ store_name: 'Renamed Shop' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Business updated successfully',
        }),
      );
    });

    test('test_updateBusiness_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── deleteBusiness ─────────────────────────────────────────────────
  describe('deleteBusiness', () => {
    test('test_deleteBusiness_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Business not found' });
    });

    test('test_deleteBusiness_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
        logo_url: null,
        banner_url: null,
      });
      const req = mockReq({ params: { id: 'store-1' }, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to delete this business',
      });
    });

    test('test_deleteBusiness_authorizedOwner_softDeletesAndReturns200', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        logo_url: null,
        banner_url: null,
      });
      repositories.stores.softDelete.mockResolvedValueOnce(undefined);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteBusiness(req, res, next);

      // Assert
      expect(repositories.stores.softDelete).toHaveBeenCalledWith('store-1');
      expect(invalidateStore).toHaveBeenCalledWith('store-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Business deleted successfully',
      });
    });

    test('test_deleteBusiness_storeHasImages_deletesImagesFromCloudinary', async () => {
      // Arrange
      const { deleteImage, extractPublicId } = require('../../utils/uploadHelpers');
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        logo_url: 'https://res.cloudinary.com/test/image/upload/store-logo.jpg',
        banner_url: 'https://res.cloudinary.com/test/image/upload/store-banner.jpg',
      });
      repositories.stores.softDelete.mockResolvedValueOnce(undefined);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteBusiness(req, res, next);

      // Assert
      expect(extractPublicId).toHaveBeenCalledTimes(2);
      expect(deleteImage).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_deleteBusiness_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteBusiness(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── uploadLogo ─────────────────────────────────────────────────────
  describe('uploadLogo', () => {
    test('test_uploadLogo_noFileUploaded_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { id: 'store-1' }, file: null });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No logo file uploaded',
      });
    });

    test('test_uploadLogo_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' }, file: { buffer: Buffer.from('img') } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Business not found' });
    });

    test('test_uploadLogo_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
        logo_url: null,
      });
      const req = mockReq({
        params: { id: 'store-1' },
        file: { buffer: Buffer.from('img') },
        user: { id: 'intruder' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
    });

    test('test_uploadLogo_authorizedOwner_uploadsAndReturns200WithLogoUrl', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValueOnce({
        url: 'https://cloudinary.com/store-logo.jpg',
        public_id: 'store-logo-id',
      });
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        logo_url: null,
      });
      repositories.stores.update.mockResolvedValueOnce(undefined);
      const req = mockReq({
        params: { id: 'store-1' },
        file: { buffer: Buffer.from('img') },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(uploadFileToCloudinary).toHaveBeenCalled();
      expect(repositories.stores.update).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({ logo_url: 'https://cloudinary.com/store-logo.jpg' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Logo uploaded successfully' }),
      );
    });

    test('test_uploadLogo_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' }, file: { buffer: Buffer.from('img') } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── uploadBanner ───────────────────────────────────────────────────
  describe('uploadBanner', () => {
    test('test_uploadBanner_noFileUploaded_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { id: 'store-1' }, file: null });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadBanner(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No banner file uploaded' });
    });

    test('test_uploadBanner_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' }, file: { buffer: Buffer.from('img') } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadBanner(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_uploadBanner_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
        banner_url: null,
      });
      const req = mockReq({
        params: { id: 'store-1' },
        file: { buffer: Buffer.from('img') },
        user: { id: 'intruder' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadBanner(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_uploadBanner_authorizedOwner_uploadsAndReturns200WithBannerUrl', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValueOnce({
        url: 'https://cloudinary.com/store-banner.jpg',
        public_id: 'store-banner-id',
      });
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        banner_url: null,
      });
      repositories.stores.update.mockResolvedValueOnce(undefined);
      const req = mockReq({
        params: { id: 'store-1' },
        file: { buffer: Buffer.from('img') },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadBanner(req, res, next);

      // Assert
      expect(repositories.stores.update).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({ banner_url: 'https://cloudinary.com/store-banner.jpg' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Banner uploaded successfully' }),
      );
    });

    test('test_uploadBanner_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' }, file: { buffer: Buffer.from('img') } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadBanner(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getBusinessDashboard ───────────────────────────────────────────
  describe('getBusinessDashboard', () => {
    test('test_getBusinessDashboard_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessDashboard(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Business not found' });
    });

    test('test_getBusinessDashboard_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
        current_balance: 0,
      });
      const req = mockReq({ params: { id: 'store-1' }, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessDashboard(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
    });

    test('test_getBusinessDashboard_authorizedOwner_returns200WithDashboardData', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        current_balance: 100,
      });
      repositories.products.count.mockResolvedValueOnce(5);
      repositories.orders.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(6);
      repositories.orders.getStoreOrders.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([]);
      mockDbStoreChain.from.mockReturnThis();
      mockDbStoreChain.select.mockReturnThis();
      mockDbStoreChain.eq.mockResolvedValueOnce({ count: 7 });
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessDashboard(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ stats: expect.any(Object) }),
        }),
      );
    });

    test('test_getBusinessDashboard_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessDashboard(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getBusinessAnalytics ───────────────────────────────────────────
  describe('getBusinessAnalytics', () => {
    test('test_getBusinessAnalytics_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_getBusinessAnalytics_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
      });
      const req = mockReq({ params: { id: 'store-1' }, query: {}, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_getBusinessAnalytics_weekTimeframe_returns200AndAnalyticsData', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([]);
      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'week' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            stats: expect.any(Object),
            chart: expect.any(Object),
            topProducts: expect.any(Array),
          }),
        }),
      );
    });

    test('test_getBusinessAnalytics_monthTimeframe_returns200', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([]);
      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'month' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getBusinessAnalytics_yearTimeframe_returns200', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([]);
      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'year' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getBusinessAnalytics_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAllBusinesses ────────────────────────────────────────────────
  describe('getAllBusinesses', () => {
    test('test_getAllBusinesses_noFilters_returns200AndPaginatedBusinesses', async () => {
      // Arrange
      mockDbStoreChain.from.mockReturnThis();
      mockDbStoreChain.select.mockReturnThis();
      mockDbStoreChain.eq.mockReturnThis();
      mockDbStoreChain.order.mockReturnThis();
      mockDbStoreChain.range.mockResolvedValue({ data: [], error: null });
      mockDbStoreChain.is.mockResolvedValue({ data: [], error: null });

      mockDbStoreChain.from.mockImplementation((table) => {
        if (table === 'products') {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), is: jest.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return mockDbStoreChain;
      });
      mockDbStoreChain.range.mockResolvedValue({ data: [], error: null });

      repositories.stores.db = {
        from: jest.fn().mockImplementation((table) => {
          const chain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({ data: [], error: null }),
            in: jest.fn().mockReturnThis(),
            is: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
          if (table === 'stores') {
            chain.eq = jest.fn().mockReturnThis();
            chain.range = jest.fn().mockResolvedValue({ data: [], error: null });
          }
          return chain;
        }),
      };

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllBusinesses(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) }),
      );
    });

    test('test_getAllBusinesses_repositoryThrows_callsNext', async () => {
      // Arrange
      repositories.stores.db = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('DB failure');
        }),
      };
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllBusinesses(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── followBusiness ─────────────────────────────────────────────────
  describe('followBusiness', () => {
    test('test_followBusiness_validRequest_followsStoreAndReturns200', async () => {
      // Arrange
      repositories.stores.followStore.mockResolvedValueOnce(undefined);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await followBusiness(req, res, next);

      // Assert
      expect(repositories.stores.followStore).toHaveBeenCalledWith('seller-user-id', 'store-1');
      expect(invalidateStore).toHaveBeenCalledWith('store-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Store followed successfully',
      });
    });

    test('test_followBusiness_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.followStore.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await followBusiness(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── unfollowBusiness ───────────────────────────────────────────────
  describe('unfollowBusiness', () => {
    test('test_unfollowBusiness_validRequest_unfollowsStoreAndReturns200', async () => {
      // Arrange
      repositories.stores.unfollowStore.mockResolvedValueOnce(undefined);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await unfollowBusiness(req, res, next);

      // Assert
      expect(repositories.stores.unfollowStore).toHaveBeenCalledWith('seller-user-id', 'store-1');
      expect(invalidateStore).toHaveBeenCalledWith('store-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Store unfollowed successfully',
      });
    });

    test('test_unfollowBusiness_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.unfollowStore.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await unfollowBusiness(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getBusinessReviews ─────────────────────────────────────────────
  describe('getBusinessReviews', () => {
    test('test_getBusinessReviews_businessNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost-store' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_getBusinessReviews_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'another-seller',
      });
      const req = mockReq({ params: { id: 'store-1' }, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_getBusinessReviews_authorizedOwner_returns200AndCombinedReviews', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });
      repositories.reviews = {
        db: {
          from: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ data: [], error: null }),
        },
      };
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, reviews: expect.any(Array) }),
      );
    });

    test('test_getBusinessReviews_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessReviews(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});

// ── Additional coverage: uncovered branches ────────────────────────────────────
describe('BusinessController Additional Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-attach the shared chain objects in case a prior test replaced repositories.stores.db
    repositories.stores.db = mockDbStoreChain;
    repositories.reviews.db = mockDbReviewChain;
    // Restore the db-chain stubs that clearAllMocks() wipes
    mockDbStoreChain.from.mockReturnThis();
    mockDbStoreChain.select.mockReturnThis();
    mockDbStoreChain.eq.mockReturnThis();
    mockDbStoreChain.ilike.mockReturnThis();
    mockDbStoreChain.in.mockReturnThis();
    mockDbStoreChain.is.mockReturnThis();
    mockDbStoreChain.order.mockReturnThis();
    mockDbStoreChain.range.mockResolvedValue({ data: [], error: null });
    mockDbReviewChain.from.mockReturnThis();
    mockDbReviewChain.select.mockReturnThis();
    mockDbReviewChain.eq.mockReturnThis();
    mockDbReviewChain.in.mockReturnThis();
    mockDbReviewChain.is.mockResolvedValue({ data: [], error: null });
  });

  function mockReq(overrides = {}) {
    return {
      params: {},
      query: {},
      body: {},
      files: null,
      file: null,
      user: { id: 'seller-user-id', roles: ['seller'] },
      ...overrides,
    };
  }

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  function makeValidBusinessBody(overrides = {}) {
    return {
      businessName: 'Test Shop',
      description: 'A great shop',
      category: 'Fashion',
      address: '1 Main Street',
      city: 'Accra',
      country: 'Ghana',
      phone: '+233201234567',
      ...overrides,
    };
  }

  // ── createBusiness — file upload branch ───────────────────────────
  describe('createBusiness file upload paths', () => {
    test('test_createBusiness_withLogoFile_uploadsLogoViaCloudinary', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValue({ url: 'https://cloudinary.com/logo.jpg', public_id: 'logo-id' });

      const mockUser = { id: 'seller-user-id', email: 'seller@test.com' };
      const mockStore = {
        id: 'store-new',
        store_name: 'Test Shop',
        description: 'A great shop',
        category: 'Fashion',
        phone: '+233201234567',
        email: null,
        address_line1: '1 Main Street',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: 'https://cloudinary.com/logo.jpg',
        banner_url: null,
        verification_status: 'pending',
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      repositories.users.findById.mockResolvedValueOnce(mockUser);
      repositories.stores.findByOwner.mockResolvedValueOnce([]);
      repositories.stores.create.mockResolvedValueOnce(mockStore);
      repositories.stores.getStoreDetails.mockResolvedValueOnce({ ...mockStore, owner: mockUser });
      repositories.roles.userHasRole.mockResolvedValueOnce(true);

      const req = mockReq({
        body: makeValidBusinessBody(),
        files: {
          logo: [{ buffer: Buffer.from('img'), originalname: 'logo.jpg', mimetype: 'image/jpeg' }],
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(uploadFileToCloudinary).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('test_createBusiness_fileUploadThrows_returns500Error', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockRejectedValueOnce(new Error('Cloudinary failure'));

      repositories.users.findById.mockResolvedValueOnce({ id: 'seller-user-id', email: 'seller@test.com' });
      repositories.stores.findByOwner.mockResolvedValueOnce([]);

      const req = mockReq({
        body: makeValidBusinessBody(),
        files: {
          logo: [{ buffer: Buffer.from('img'), originalname: 'logo.jpg', mimetype: 'image/jpeg' }],
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Failed to upload documents' });
    });

    test('test_createBusiness_withVerificationDocs_notifiesAdminsAndPublishesEmails', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValue({ url: 'https://cloudinary.com/doc.pdf', public_id: 'doc-id' });

      const mockUser = { id: 'seller-user-id', email: 'seller@test.com' };
      const mockAdmin = { id: 'admin-1', email: 'admin@test.com' };
      const mockStore = {
        id: 'store-verify',
        store_name: 'Verified Shop',
        description: 'A great shop',
        category: 'Fashion',
        phone: '+233201234567',
        email: null,
        address_line1: '1 Main Street',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'pending',
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      repositories.users.findById.mockResolvedValueOnce(mockUser);
      repositories.stores.findByOwner.mockResolvedValueOnce([]);
      repositories.stores.create.mockResolvedValueOnce(mockStore);
      repositories.stores.getStoreDetails.mockResolvedValueOnce({ ...mockStore, owner: mockUser });
      repositories.roles.userHasRole.mockResolvedValueOnce(true);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({ full_name: 'Test Seller' });
      repositories.users.getAdmins.mockResolvedValueOnce([mockAdmin]);

      const req = mockReq({
        body: makeValidBusinessBody({ businessName: 'Verified Shop' }),
        files: {
          businessCert: [{ buffer: Buffer.from('cert'), originalname: 'cert.pdf', mimetype: 'application/pdf' }],
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createBusiness(req, res, next);

      // Assert
      expect(notificationService.notifyAdminsVerificationRequest).toHaveBeenCalledWith(
        mockStore.id,
        'store',
        mockStore.store_name
      );
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({ eventType: 'BUSINESS_VERIFICATION_SUBMITTED', role: 'seller' })
      );
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({ eventType: 'BUSINESS_VERIFICATION_SUBMITTED', role: 'admin' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── updateBusiness — file upload branch ───────────────────────────
  describe('updateBusiness file upload paths', () => {
    test('test_updateBusiness_withLogoFile_uploadsLogoViaCloudinary', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValue({ url: 'https://cloudinary.com/newlogo.jpg', public_id: 'new-logo-id' });

      const mockStore = { id: 'store-1', owner_id: 'seller-user-id' };
      const mockUpdatedStore = {
        id: 'store-1',
        store_name: 'Test Shop',
        description: 'Desc',
        category: 'Fashion',
        phone: '+233',
        email: null,
        address_line1: '1 Main St',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: 'https://cloudinary.com/newlogo.jpg',
        banner_url: null,
        verification_status: 'pending',
        rejection_reason: null,
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        updated_at: new Date().toISOString(),
      };
      repositories.stores.findById.mockResolvedValueOnce(mockStore);
      repositories.stores.update.mockResolvedValueOnce(mockUpdatedStore);

      const req = mockReq({
        params: { id: 'store-1' },
        body: {},
        files: {
          logo: [{ buffer: Buffer.from('img'), originalname: 'logo.jpg', mimetype: 'image/jpeg' }],
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(uploadFileToCloudinary).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateBusiness_fileUploadThrows_returns500Error', async () => {
      // Arrange
      const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockRejectedValueOnce(new Error('Cloudinary failure'));

      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });

      const req = mockReq({
        params: { id: 'store-1' },
        body: {},
        files: {
          logo: [{ buffer: Buffer.from('img'), originalname: 'logo.jpg', mimetype: 'image/jpeg' }],
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Failed to upload documents' });
    });

    test('test_updateBusiness_withNewDocs_notifiesAdminsAndPublishesEmails', async () => {
      // Arrange
      const mockStore = { id: 'store-1', owner_id: 'seller-user-id' };
      const mockOwner = { id: 'seller-user-id', email: 'seller@test.com' };
      const mockAdmin = { id: 'admin-1', email: 'admin@test.com' };
      const mockUpdatedStore = {
        id: 'store-1',
        store_name: 'Test Shop',
        description: 'Desc',
        category: 'Fashion',
        phone: '+233',
        email: null,
        address_line1: '1 Main St',
        city: 'Accra',
        country: 'Ghana',
        website_url: null,
        social_instagram: null,
        social_facebook: null,
        logo_url: null,
        banner_url: null,
        verification_status: 'pending',
        rejection_reason: null,
        is_active: true,
        average_rating: 0,
        total_reviews: 0,
        updated_at: new Date().toISOString(),
        business_cert_url: 'https://cloudinary.com/cert.pdf',
        business_license_url: null,
        proof_of_bank_url: null,
      };

      repositories.stores.findById.mockResolvedValueOnce(mockStore);
      repositories.stores.update.mockResolvedValueOnce(mockUpdatedStore);
      repositories.users.findById.mockResolvedValueOnce(mockOwner);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({ full_name: 'Test Seller' });
      repositories.users.getAdmins.mockResolvedValueOnce([mockAdmin]);

      const req = mockReq({
        params: { id: 'store-1' },
        body: { businessCert: 'https://cloudinary.com/cert.pdf' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateBusiness(req, res, next);

      // Assert
      expect(notificationService.notifyAdminsVerificationRequest).toHaveBeenCalledWith(
        mockUpdatedStore.id,
        'store',
        mockUpdatedStore.store_name
      );
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({ role: 'seller' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── uploadLogo — existing logo deletion ───────────────────────────
  describe('uploadLogo existing logo deletion path', () => {
    test('test_uploadLogo_existingLogo_deletesOldLogoBeforeUploading', async () => {
      // Arrange
      const { uploadFileToCloudinary, deleteImage, extractPublicId } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValueOnce({
        url: 'https://cloudinary.com/new-logo.jpg',
        public_id: 'new-logo-id',
      });
      extractPublicId.mockReturnValueOnce('old-logo-public-id');
      deleteImage.mockResolvedValueOnce(undefined);

      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        logo_url: 'https://cloudinary.com/old-logo.jpg',
      });
      repositories.stores.update.mockResolvedValueOnce(undefined);

      const req = mockReq({
        params: { id: 'store-1' },
        file: { buffer: Buffer.from('img') },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadLogo(req, res, next);

      // Assert
      expect(extractPublicId).toHaveBeenCalledWith('https://cloudinary.com/old-logo.jpg');
      expect(deleteImage).toHaveBeenCalledWith('old-logo-public-id');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── uploadBanner — existing banner deletion ────────────────────────
  describe('uploadBanner existing banner deletion path', () => {
    test('test_uploadBanner_existingBanner_deletesOldBannerBeforeUploading', async () => {
      // Arrange
      const { uploadFileToCloudinary, deleteImage, extractPublicId } = require('../../utils/uploadHelpers');
      uploadFileToCloudinary.mockResolvedValueOnce({
        url: 'https://cloudinary.com/new-banner.jpg',
        public_id: 'new-banner-id',
      });
      extractPublicId.mockReturnValueOnce('old-banner-public-id');
      deleteImage.mockResolvedValueOnce(undefined);

      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        banner_url: 'https://cloudinary.com/old-banner.jpg',
      });
      repositories.stores.update.mockResolvedValueOnce(undefined);

      const req = mockReq({
        params: { id: 'store-1' },
        file: { buffer: Buffer.from('img') },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadBanner(req, res, next);

      // Assert
      expect(extractPublicId).toHaveBeenCalledWith('https://cloudinary.com/old-banner.jpg');
      expect(deleteImage).toHaveBeenCalledWith('old-banner-public-id');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getBusinessDashboard — revenue stat branches ───────────────────
  describe('getBusinessDashboard revenue stat branches', () => {
    test('test_getBusinessDashboard_paidAndCompletedOrders_calculatesRevenueCorrectly', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        current_balance: 500,
      });
      repositories.products.count.mockResolvedValueOnce(10);
      repositories.orders.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(12);
      repositories.orders.getStoreOrders.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.findAll.mockResolvedValueOnce({
        data: [
          { id: 'o1', created_at: new Date().toISOString(), status: 'delivered', total_amount: '100' },
          { id: 'o2', created_at: new Date().toISOString(), status: 'completed', total_amount: '200' },
          { id: 'o3', created_at: new Date().toISOString(), status: 'paid', total_amount: '50' },
          { id: 'o4', created_at: new Date().toISOString(), status: 'refunded', total_amount: '30' },
        ],
        count: 4,
      });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([
        { status: 'delivered', total: '300' },
        { status: 'completed', total: '100' },
        { status: 'paid', total: '80' },
        { status: 'refunded', total: '20' },
      ]);
      mockDbStoreChain.from.mockReturnThis();
      mockDbStoreChain.select.mockReturnThis();
      mockDbStoreChain.eq.mockResolvedValueOnce({ count: 3 });

      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessDashboard(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data.stats.totalRevenue).toBe(380); // 300 + 100 - 20
      expect(body.data.stats.pendingRevenue).toBe(80);
    });

    test('test_getBusinessDashboard_revenueStatsWithRefunded_subtractsFromTotalRevenue', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        current_balance: 0,
      });
      repositories.products.count.mockResolvedValueOnce(0);
      repositories.orders.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      repositories.orders.getStoreOrders.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([
        { status: 'refunded', total: '50' },
      ]);
      mockDbStoreChain.from.mockReturnThis();
      mockDbStoreChain.select.mockReturnThis();
      mockDbStoreChain.eq.mockResolvedValueOnce({ count: 0 });

      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessDashboard(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data.stats.totalRevenue).toBe(-50);
    });
  });

  // ── getBusinessAnalytics — chart data for all timeframes ──────────
  describe('getBusinessAnalytics chart data paths', () => {
    function setupAnalyticsBase() {
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });
    }

    test('test_getBusinessAnalytics_weekTimeframe_buildsDailyChartLabels', async () => {
      // Arrange
      setupAnalyticsBase();
      repositories.orders.findAll.mockResolvedValueOnce({
        data: [
          {
            id: 'o1',
            created_at: new Date().toISOString(),
            status: 'paid',
            total_amount: '75',
            order_items: [{ product_title: 'Widget', quantity: 2, price: 37.5 }],
          },
        ],
        count: 1,
      });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([
        { status: 'delivered', total: '75' },
      ]);

      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'week' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data.chart.labels).toHaveLength(7);
      expect(body.data.topProducts).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Widget' })])
      );
    });

    test('test_getBusinessAnalytics_monthTimeframe_buildsWeeklyChartLabels', async () => {
      // Arrange
      setupAnalyticsBase();
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([]);

      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'month' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data.chart.labels).toHaveLength(4);
      expect(body.data.chart.labels[0]).toBe('Wk 1');
    });

    test('test_getBusinessAnalytics_yearTimeframe_buildsMonthlyChartLabels', async () => {
      // Arrange
      setupAnalyticsBase();
      repositories.orders.findAll.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([]);

      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'year' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.data.chart.labels).toHaveLength(12);
    });

    test('test_getBusinessAnalytics_ordersWithMultipleItems_computesTopProducts', async () => {
      // Arrange
      setupAnalyticsBase();
      repositories.orders.findAll.mockResolvedValueOnce({
        data: [
          {
            id: 'o1',
            created_at: new Date().toISOString(),
            status: 'completed',
            total_amount: '200',
            order_items: [
              { product_title: 'Shoes', quantity: 3, price: 50 },
              { product_title: 'Hat', quantity: 1, price: 50 },
            ],
          },
          {
            id: 'o2',
            created_at: new Date().toISOString(),
            status: 'completed',
            total_amount: '100',
            order_items: [{ product_title: 'Shoes', quantity: 2, price: 50 }],
          },
        ],
        count: 2,
      });
      repositories.orders.getStoreRevenueStats.mockResolvedValueOnce([
        { status: 'completed', total: '300' },
      ]);

      const req = mockReq({ params: { id: 'store-1' }, query: { timeframe: 'week' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessAnalytics(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      // 'Shoes' has 5 total sales, 'Hat' has 1 — Shoes should be first
      expect(body.data.topProducts[0].name).toBe('Shoes');
      expect(body.data.topProducts[0].sales).toBe(5);
    });
  });

  // ── getBusinessReviews — replies and product review filter ─────────
  describe('getBusinessReviews reply and product review paths', () => {
    test('test_getBusinessReviews_withReviewReplies_attachesRepliesToReviews', async () => {
      // Arrange
      const storeReview = {
        id: 'rev-1',
        rating: 5,
        review_text: 'Great!',
        created_at: '2024-01-10T10:00:00Z',
        user: { user_profiles: { full_name: 'Alice', avatar_url: null } },
      };

      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });

      // Build a per-test db chain that correctly routes each query:
      // Query 1: from('store_reviews')...is()   -> storeReviews
      // Query 2: from('product_reviews')...is() -> no product reviews
      // Query 3: from('review_comments')...in().eq() -> comments
      let isCallCount = 0;
      const commentsEqChain = jest.fn().mockResolvedValue({
        data: [{ review_id: 'rev-1', comment: 'Thank you!' }],
        error: null,
      });
      const inChain = { eq: commentsEqChain };

      const reviewsDb = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnValue(inChain),
        is: jest.fn().mockImplementation(() => {
          isCallCount += 1;
          if (isCallCount === 1) return Promise.resolve({ data: [storeReview], error: null });
          return Promise.resolve({ data: [], error: null });
        }),
      };

      repositories.reviews.db = reviewsDb;

      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.reviews[0].reply).toBe('Thank you!');
    });

    test('test_getBusinessReviews_productReviewsFilteredByStoreId_onlyIncludesMatchingStore', async () => {
      // Arrange
      const productReviewForStore = {
        id: 'prev-1',
        rating: 4,
        review_text: 'Good product',
        created_at: '2024-01-11T10:00:00Z',
        products: { store_id: 'store-1', title: 'Widget' },
        user: { user_profiles: { full_name: 'Bob', avatar_url: null } },
      };
      const productReviewOtherStore = {
        id: 'prev-2',
        rating: 3,
        review_text: 'Other store product',
        created_at: '2024-01-12T10:00:00Z',
        products: { store_id: 'other-store', title: 'Gadget' },
        user: { user_profiles: { full_name: 'Carol', avatar_url: null } },
      };

      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
      });

      const reviewsDb = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn(),
      };

      // Store reviews — none
      reviewsDb.is
        .mockResolvedValueOnce({ data: [], error: null })
        // Product reviews — two, only one for this store
        .mockResolvedValueOnce({ data: [productReviewForStore, productReviewOtherStore], error: null });

      repositories.reviews.db = reviewsDb;

      const req = mockReq({ params: { id: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getBusinessReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      // Only the review belonging to store-1 should appear
      expect(body.reviews).toHaveLength(1);
      expect(body.reviews[0].productName).toBe('Widget');
    });
  });
});

