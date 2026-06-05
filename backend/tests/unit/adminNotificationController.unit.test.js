'use strict';

/**
 * tests/unit/adminNotificationController.unit.test.js
 *
 * Unit tests for adminNotificationController functions.
 * Mocks all repositories, services (holidayService, aiService, notificationService)
 * and the workers/scheduler module.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/holidayService', () => ({
  checkIfHoliday: jest.fn(),
  getUpcomingHolidays: jest.fn(),
}));

jest.mock('../../services/aiService', () => ({
  generateNotificationText: jest.fn(),
}));

// notificationService is require()-d lazily inside sendTestNotification — must mock the module path.
jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn(),
}));

// scheduler is also lazily required inside triggerMarketingSweep.
jest.mock('../../workers/scheduler', () => ({
  executeDailyMarketingSweep: jest.fn(),
}), { virtual: true });

jest.mock('../../db/repositories', () => ({
  scheduledNotifications: {
    listForAdmin: jest.fn(),
    countForAdmin: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const holidayService = require('../../services/holidayService');
const aiService = require('../../services/aiService');
// notificationService is lazily required inside sendTestNotification; use jest.requireMock so
// both the test file and the lazy require inside the controller share the exact same mock object.
const notificationService = jest.requireMock('../../services/notificationService');

const {
  getScheduledNotifications,
  createScheduledNotification,
  cancelScheduledNotification,
  previewHolidayCampaign,
  triggerMarketingSweep,
  sendTestNotification,
} = require('../../controllers/adminNotificationController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'admin-user-id' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AdminNotificationController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getScheduledNotifications ──────────────────────────────────────
  describe('getScheduledNotifications', () => {
    test('test_getScheduledNotifications_defaultPagination_returnsDataAndTotal', async () => {
      // Arrange
      const mockData = [{ id: 'notif-1', title: 'Welcome' }];
      repositories.scheduledNotifications.listForAdmin.mockResolvedValueOnce(mockData);
      repositories.scheduledNotifications.countForAdmin.mockResolvedValueOnce(1);

      const req = mockReq({ query: {} });
      const res = mockRes();

      // Act
      await getScheduledNotifications(req, res);

      // Assert
      expect(repositories.scheduledNotifications.listForAdmin).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        status: undefined,
        campaign_type: undefined,
      });
      expect(repositories.scheduledNotifications.countForAdmin).toHaveBeenCalledWith({
        status: undefined,
        campaign_type: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData, total: 1 });
    });

    test('test_getScheduledNotifications_withStatusFilter_passesFilterToRepository', async () => {
      // Arrange
      repositories.scheduledNotifications.listForAdmin.mockResolvedValueOnce([]);
      repositories.scheduledNotifications.countForAdmin.mockResolvedValueOnce(0);

      const req = mockReq({ query: { status: 'pending', campaign_type: 'manual', limit: '5', offset: '10' } });
      const res = mockRes();

      // Act
      await getScheduledNotifications(req, res);

      // Assert
      expect(repositories.scheduledNotifications.listForAdmin).toHaveBeenCalledWith({
        limit: 5,
        offset: 10,
        status: 'pending',
        campaign_type: 'manual',
      });
    });

    test('test_getScheduledNotifications_repositoryThrows_returns500InternalServerError', async () => {
      // Arrange
      repositories.scheduledNotifications.listForAdmin.mockRejectedValueOnce(new Error('DB failure'));
      repositories.scheduledNotifications.countForAdmin.mockResolvedValueOnce(0);

      const req = mockReq({ query: {} });
      const res = mockRes();

      // Act
      await getScheduledNotifications(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to fetch notifications' });
    });
  });

  // ── createScheduledNotification ────────────────────────────────────
  describe('createScheduledNotification', () => {
    // Build a valid future date string
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();

    test('test_createScheduledNotification_missingTitle_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { message: 'Hello', scheduled_at: futureDate } });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'title and message are required' });
    });

    test('test_createScheduledNotification_missingMessage_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { title: 'Test', scheduled_at: futureDate } });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'title and message are required' });
    });

    test('test_createScheduledNotification_noChannelSelected_returns400BadRequest', async () => {
      // Arrange — all channel flags explicitly false
      const req = mockReq({
        body: {
          title: 'Flash Sale',
          message: 'Big discounts!',
          send_email: false,
          send_sms: false,
          send_push: false,
          scheduled_at: futureDate,
        },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Select at least one channel (email, sms, push)',
      });
    });

    test('test_createScheduledNotification_missingScheduledAt_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { title: 'Test', message: 'Hello', send_push: true } });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'scheduled_at is required' });
    });

    test('test_createScheduledNotification_pastScheduledAt_returns400BadRequest', async () => {
      // Arrange — date in the past
      const pastDate = new Date(Date.now() - 10_000).toISOString();
      const req = mockReq({
        body: { title: 'Test', message: 'Hello', send_push: true, scheduled_at: pastDate },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'scheduled_at must be a valid future date',
      });
    });

    test('test_createScheduledNotification_specificRecipientTypeWithoutIds_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        body: {
          title: 'Exclusive',
          message: 'For you only',
          send_push: true,
          scheduled_at: futureDate,
          recipient_type: 'specific',
          recipient_ids: [],
        },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'recipient_ids required when targeting specific users',
      });
    });

    test('test_createScheduledNotification_validInput_createsRecordAndReturns201', async () => {
      // Arrange
      const mockRecord = { id: 'sn-1', title: 'Flash Sale', status: 'pending' };
      repositories.scheduledNotifications.create.mockResolvedValueOnce(mockRecord);

      const req = mockReq({
        body: {
          title: 'Flash Sale',
          message: 'Big discounts available!',
          send_push: true,
          scheduled_at: futureDate,
        },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(repositories.scheduledNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Flash Sale',
          message: 'Big discounts available!',
          send_push: true,
          campaign_type: 'manual',
          status: 'pending',
          created_by: 'admin-user-id',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification scheduled',
        data: mockRecord,
      });
    });

    test('test_createScheduledNotification_specificRecipientsWithIds_storesRecipientIds', async () => {
      // Arrange
      repositories.scheduledNotifications.create.mockResolvedValueOnce({ id: 'sn-2' });

      const req = mockReq({
        body: {
          title: 'VIP Offer',
          message: 'Exclusive deal',
          send_push: true,
          scheduled_at: futureDate,
          recipient_type: 'specific',
          recipient_ids: ['user-a', 'user-b'],
        },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(repositories.scheduledNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_type: 'specific',
          recipient_ids: ['user-a', 'user-b'],
        })
      );
    });

    test('test_createScheduledNotification_recipientTypeAll_nullifiesRecipientIds', async () => {
      // Arrange
      repositories.scheduledNotifications.create.mockResolvedValueOnce({ id: 'sn-3' });

      const req = mockReq({
        body: {
          title: 'Broadcast',
          message: 'For everyone',
          send_push: true,
          scheduled_at: futureDate,
          recipient_type: 'all',
        },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(repositories.scheduledNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipient_ids: null })
      );
    });

    test('test_createScheduledNotification_repositoryThrows_returns500InternalServerError', async () => {
      // Arrange
      repositories.scheduledNotifications.create.mockRejectedValueOnce(new Error('Insert failed'));

      const req = mockReq({
        body: { title: 'Test', message: 'Hello', send_push: true, scheduled_at: futureDate },
      });
      const res = mockRes();

      // Act
      await createScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to create notification' });
    });
  });

  // ── cancelScheduledNotification ────────────────────────────────────
  describe('cancelScheduledNotification', () => {
    test('test_cancelScheduledNotification_notFound_returns404NotFound', async () => {
      // Arrange
      repositories.scheduledNotifications.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { id: 'sn-99' } });
      const res = mockRes();

      // Act
      await cancelScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Notification not found' });
    });

    test('test_cancelScheduledNotification_nonPendingStatus_returns400BadRequest', async () => {
      // Arrange
      repositories.scheduledNotifications.findById.mockResolvedValueOnce({ id: 'sn-1', status: 'sent' });

      const req = mockReq({ params: { id: 'sn-1' } });
      const res = mockRes();

      // Act
      await cancelScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot cancel a notification with status: sent',
      });
    });

    test('test_cancelScheduledNotification_pendingRecord_deletesAndReturns200Success', async () => {
      // Arrange
      repositories.scheduledNotifications.findById.mockResolvedValueOnce({ id: 'sn-1', status: 'pending' });
      repositories.scheduledNotifications.delete.mockResolvedValueOnce(true);

      const req = mockReq({ params: { id: 'sn-1' } });
      const res = mockRes();

      // Act
      await cancelScheduledNotification(req, res);

      // Assert
      expect(repositories.scheduledNotifications.delete).toHaveBeenCalledWith('sn-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Scheduled notification cancelled',
      });
    });

    test('test_cancelScheduledNotification_repositoryThrows_returns500InternalServerError', async () => {
      // Arrange
      repositories.scheduledNotifications.findById.mockRejectedValueOnce(new Error('DB failure'));

      const req = mockReq({ params: { id: 'sn-1' } });
      const res = mockRes();

      // Act
      await cancelScheduledNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to cancel notification' });
    });
  });

  // ── previewHolidayCampaign ─────────────────────────────────────────
  describe('previewHolidayCampaign', () => {
    test('test_previewHolidayCampaign_notHoliday_returnsIsHolidayFalseWithUpcoming', async () => {
      // Arrange
      holidayService.checkIfHoliday.mockResolvedValueOnce(null);
      holidayService.getUpcomingHolidays.mockResolvedValueOnce([
        { localName: 'New Year', date: '2025-01-01' },
        { localName: 'Independence Day', date: '2025-03-06' },
      ]);

      const req = mockReq();
      const res = mockRes();

      // Act
      await previewHolidayCampaign(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        isHoliday: false,
        message: 'Today is not a public holiday in Ghana.',
        upcomingHolidays: expect.any(Array),
      });
    });

    test('test_previewHolidayCampaign_isHoliday_returnsAiDraftAndHolidayDetails', async () => {
      // Arrange
      holidayService.checkIfHoliday.mockResolvedValueOnce({ localName: 'Independence Day' });
      aiService.generateNotificationText.mockResolvedValueOnce('Happy Independence Day! Enjoy special offers!');

      const req = mockReq();
      const res = mockRes();

      // Act
      await previewHolidayCampaign(req, res);

      // Assert
      expect(aiService.generateNotificationText).toHaveBeenCalledWith('holiday', {
        holidayName: 'Independence Day',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        isHoliday: true,
        holidayName: 'Independence Day',
        aiRecommendation: 'Happy Independence Day! Enjoy special offers!',
        upcomingHolidays: [],
      });
    });

    test('test_previewHolidayCampaign_holidayServiceThrows_returns500InternalServerError', async () => {
      // Arrange
      holidayService.checkIfHoliday.mockRejectedValueOnce(new Error('Service unavailable'));

      const req = mockReq();
      const res = mockRes();

      // Act
      await previewHolidayCampaign(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to preview holiday campaign' });
    });

    test('test_previewHolidayCampaign_upcomingHolidaysSlicedToFive_returnsMaxFiveUpcoming', async () => {
      // Arrange — service returns 8 upcoming holidays
      holidayService.checkIfHoliday.mockResolvedValueOnce(null);
      const manyHolidays = Array.from({ length: 8 }, (_, i) => ({ localName: `Holiday ${i + 1}` }));
      holidayService.getUpcomingHolidays.mockResolvedValueOnce(manyHolidays);

      const req = mockReq();
      const res = mockRes();

      // Act
      await previewHolidayCampaign(req, res);

      // Assert
      const responseArg = res.json.mock.calls[0][0];
      expect(responseArg.upcomingHolidays).toHaveLength(5);
    });
  });

  // ── triggerMarketingSweep ──────────────────────────────────────────
  describe('triggerMarketingSweep', () => {
    test('test_triggerMarketingSweep_called_triggersWorkerAndReturns200', async () => {
      // Arrange — stub setImmediate to call synchronously in test
      const setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation((fn) => { fn(); return 0; });

      const req = mockReq();
      const res = mockRes();

      // Act
      await triggerMarketingSweep(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Daily marketing sweep triggered. Check logs for progress.',
      });

      setImmediateSpy.mockRestore();
    });

    test('test_triggerMarketingSweep_setImmediateThrows_returns500InternalServerError', async () => {
      // Arrange — make setImmediate throw synchronously to simulate an error in the outer try block
      const setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation(() => {
        throw new Error('setImmediate failed');
      });

      const req = mockReq();
      const res = mockRes();

      // Act
      await triggerMarketingSweep(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to trigger sweep' });

      setImmediateSpy.mockRestore();
    });
  });

  // ── sendTestNotification ───────────────────────────────────────────
  describe('sendTestNotification', () => {
    test('test_sendTestNotification_missingUser_returns401Unauthorized', async () => {
      // Arrange
      const req = mockReq({ user: undefined });
      const res = mockRes();

      // Act
      await sendTestNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
    });

    test('test_sendTestNotification_notificationServiceReturnsFalsy_returns500WithGuidance', async () => {
      // Arrange
      notificationService.sendNotification.mockResolvedValueOnce(false);

      const req = mockReq();
      const res = mockRes();

      // Act
      await sendTestNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('sendNotification returned false') })
      );
    });

    test('test_sendTestNotification_notificationServiceReturnsTrue_returns200Success', async () => {
      // Arrange
      notificationService.sendNotification.mockResolvedValueOnce(true);

      const req = mockReq();
      const res = mockRes();

      // Act
      await sendTestNotification(req, res);

      // Assert
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user-id',
          type: 'admin_broadcast',
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Test notification delivered'),
        })
      );
    });

    test('test_sendTestNotification_serviceThrows_returns500WithErrorMessage', async () => {
      // Arrange — rejection propagates to the outer catch which returns err.message
      notificationService.sendNotification.mockRejectedValueOnce(new Error('Push token expired'));

      const req = mockReq();
      const res = mockRes();

      // Act
      await sendTestNotification(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      // The catch block returns { success: false, message: err.message }
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Push token expired' })
      );
    });
  });
});
