'use strict';

/**
 * tests/unit/driverController.unit.test.js
 *
 * Unit tests for DriverController — no real DB, no HTTP server.
 * Mocks all repositories, cloudinary upload helpers, and rabbitmq messaging.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../db/repositories', () => ({
  drivers: {
    upsertProfile: jest.fn(),
    findByUserId: jest.fn(),
    updateAvailability: jest.fn(),
  },
  userProfiles: {
    updateByUserId: jest.fn(),
    findByUserId: jest.fn(),
  },
  users: {
    findById: jest.fn(),
    getAdmins: jest.fn(),
  },
}));

jest.mock('../../utils/uploadHelpers', () => ({
  uploadFileToCloudinary: jest.fn(),
}));

jest.mock('../../services/notificationService', () => ({
  notifyAdminsVerificationRequest: jest.fn(),
}));

jest.mock('../../services/rabbitmq', () => ({
  publishMessage: jest.fn(),
}));

const driverController = require('../../controllers/driverController');
const repositories = require('../../db/repositories');
const uploadHelpers = require('../../utils/uploadHelpers');
const notificationService = require('../../services/notificationService');
const rabbitMQService = require('../../services/rabbitmq');

function mockReq(overrides = {}) {
  return {
    user: { id: 'user-123', email: 'driver@test.local' },
    body: {},
    files: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('DriverController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── submitVerification ──────────────────────────────────────────────
  describe('submitVerification', () => {
    test('test_submitVerification_validInputWithFiles_uploadsFilesAndSavesProfile', async () => {
      // Arrange
      uploadHelpers.uploadFileToCloudinary
        .mockResolvedValueOnce({ url: 'http://cloudinary.mock/id.jpg' }) // idCard
        .mockResolvedValueOnce({ url: 'http://cloudinary.mock/licenseFront.jpg' }) // licenseFront
        .mockResolvedValueOnce({ url: 'http://cloudinary.mock/licenseBack.jpg' }) // licenseBack
        .mockResolvedValueOnce({ url: 'http://cloudinary.mock/insurance.jpg' }) // insurance
        .mockResolvedValueOnce({ url: 'http://cloudinary.mock/profile.jpg' }); // profilePhoto

      const mockProfile = { id: 'profile-99', user_id: 'user-123', vehicleType: 'Motorcycle' };
      repositories.drivers.upsertProfile.mockResolvedValueOnce(mockProfile);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({ full_name: 'Driver Dan' });
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce(undefined);
      repositories.users.findById.mockResolvedValueOnce({ email: 'driver@test.local' });
      repositories.users.getAdmins.mockResolvedValueOnce([{ id: 'admin-1', email: 'admin@test.local' }]);

      const req = mockReq({
        body: { vehicleType: 'Motorcycle', plateNumber: 'M-123', licenseNumber: 'DL-999' },
        files: {
          idCard: [{ filename: 'id.jpg' }],
          licenseFront: [{ filename: 'licFront.jpg' }],
          licenseBack: [{ filename: 'licBack.jpg' }],
          insurance: [{ filename: 'ins.jpg' }],
          profilePhoto: [{ filename: 'profile.jpg' }],
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.submitVerification(req, res, next);

      // Assert
      expect(uploadHelpers.uploadFileToCloudinary).toHaveBeenCalledTimes(5);
      expect(repositories.drivers.upsertProfile).toHaveBeenCalledWith('user-123', {
        vehicleType: 'Motorcycle',
        plateNumber: 'M-123',
        licenseNumber: 'DL-999',
        national_id_url: 'http://cloudinary.mock/id.jpg',
        license_image_url: 'http://cloudinary.mock/licenseFront.jpg',
        insurance_doc_url: 'http://cloudinary.mock/insurance.jpg',
      });
      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {
        avatar_url: 'http://cloudinary.mock/profile.jpg',
      });
      expect(notificationService.notifyAdminsVerificationRequest).toHaveBeenCalledWith('profile-99', 'driver', 'Driver Dan');
      expect(rabbitMQService.publishMessage).toHaveBeenCalledTimes(2); // driver email + admin email
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Verification documents submitted successfully',
        profile: mockProfile,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_submitVerification_noFiles_registersVerificationSuccessfully', async () => {
      // Arrange
      const mockProfile = { id: 'profile-99', user_id: 'user-123', vehicleType: 'Car' };
      repositories.drivers.upsertProfile.mockResolvedValueOnce(mockProfile);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(null); // defaults to user email
      repositories.users.findById.mockResolvedValueOnce(null);
      repositories.users.getAdmins.mockResolvedValueOnce([]);

      const req = mockReq({
        body: { vehicleType: 'Car', plateNumber: 'C-777', licenseNumber: 'DL-777' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.submitVerification(req, res, next);

      // Assert
      expect(uploadHelpers.uploadFileToCloudinary).not.toHaveBeenCalled();
      expect(repositories.drivers.upsertProfile).toHaveBeenCalledWith('user-123', {
        vehicleType: 'Car',
        plateNumber: 'C-777',
        licenseNumber: 'DL-777',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_submitVerification_dbUpsertFails_callsNextWithError', async () => {
      // Arrange
      repositories.drivers.upsertProfile.mockRejectedValueOnce(new Error('Database error'));

      const req = mockReq({
        body: { vehicleType: 'Car' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.submitVerification(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── getDriverProfile ────────────────────────────────────────────────
  describe('getDriverProfile', () => {
    test('test_getDriverProfile_validDriver_returnsProfileAnd200', async () => {
      // Arrange
      const mockProfile = { id: 'profile-99', user_id: 'user-123', vehicleType: 'Car' };
      repositories.drivers.findByUserId.mockResolvedValueOnce(mockProfile);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.getDriverProfile(req, res, next);

      // Assert
      expect(repositories.drivers.findByUserId).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, profile: mockProfile });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getDriverProfile_databaseFails_callsNextWithError', async () => {
      // Arrange
      repositories.drivers.findByUserId.mockRejectedValueOnce(new Error('DB Query Failed'));

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.getDriverProfile(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateAvailability ──────────────────────────────────────────────
  describe('updateAvailability', () => {
    test('test_updateAvailability_online_updatesAndReturns200', async () => {
      // Arrange
      const mockProfile = { id: 'profile-99', user_id: 'user-123', is_available: true };
      repositories.drivers.updateAvailability.mockResolvedValueOnce(mockProfile);

      const req = mockReq({ body: { isAvailable: true } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.updateAvailability(req, res, next);

      // Assert
      expect(repositories.drivers.updateAvailability).toHaveBeenCalledWith('user-123', true);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Driver is now online',
        profile: mockProfile,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_updateAvailability_offline_updatesAndReturns200', async () => {
      // Arrange
      const mockProfile = { id: 'profile-99', user_id: 'user-123', is_available: false };
      repositories.drivers.updateAvailability.mockResolvedValueOnce(mockProfile);

      const req = mockReq({ body: { isAvailable: false } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.updateAvailability(req, res, next);

      // Assert
      expect(repositories.drivers.updateAvailability).toHaveBeenCalledWith('user-123', false);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Driver is now offline',
        profile: mockProfile,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_updateAvailability_databaseFails_callsNextWithError', async () => {
      // Arrange
      repositories.drivers.updateAvailability.mockRejectedValueOnce(new Error('DB Update Failed'));

      const req = mockReq({ body: { isAvailable: true } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await driverController.updateAvailability(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
