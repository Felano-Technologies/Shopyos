'use strict';

jest.mock('nodemailer');
jest.mock('../../services/rabbitmq');
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../services/amqpPublisher', () => ({ publish: jest.fn() }));
jest.mock('axios');
jest.mock('../../db/repositories', () => ({
  notifications: {
    createNotification: jest.fn(),
    getUserPreferences: jest.fn(),
    getUserPushTokens: jest.fn(),
    removePushToken: jest.fn(),
    db: { from: jest.fn(() => ({ update: jest.fn(() => ({ eq: jest.fn() })) })) },
  },
  users: {
    findById: jest.fn(),
    getAdmins: jest.fn(),
  },
}));

const nodemailer = require('nodemailer');
const axios = require('axios');
const amqpPublisher = require('../../services/amqpPublisher');
const repositories = require('../../db/repositories');

const mockSendMail = jest.fn();
nodemailer.createTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

const service = require('../../services/notificationService');

describe('NotificationService', () => {
  beforeEach(() => jest.clearAllMocks());

  const dbNotif = { id: 'notif-1', title: 'Test' };
  const user = { id: 'user-1', email: 'test@example.com', phone: '+233200000000' };
  const prefs = { email_enabled: false, sms_enabled: false, push_enabled: false };

  describe('sendEmail', () => {
    test('sends email and returns true', async () => {
      mockSendMail.mockResolvedValueOnce({});
      const result = await service.sendEmail({
        to: 'a@b.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });
      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('throws on sendMail failure', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
      await expect(service.sendEmail({ to: 'a@b.com', subject: 'Test', html: '', text: '' })).rejects.toThrow('SMTP error');
    });
  });

  describe('sendSMS', () => {
    test('sends SMS via Arkesel and returns response data', async () => {
      axios.post.mockResolvedValueOnce({ data: { status: 'success' } });
      const result = await service.sendSMS({ to: '+233200000000', message: 'OTP: 1234' });
      expect(result).toEqual({ status: 'success' });
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sms/send'),
        expect.objectContaining({ recipients: ['+233200000000'] }),
        expect.any(Object)
      );
    });

    test('throws on Arkesel API error', async () => {
      axios.post.mockRejectedValueOnce(new Error('API error'));
      await expect(service.sendSMS({ to: '+233', message: 'test' })).rejects.toThrow('API error');
    });
  });

  describe('sendOTP', () => {
    test('delegates to sendSMS with formatted message', async () => {
      axios.post.mockResolvedValueOnce({ data: {} });
      await service.sendOTP('+233200000000', '654321');
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ message: expect.stringContaining('654321') }),
        expect.any(Object)
      );
    });
  });

  describe('sendNotification', () => {
    test('returns false without throwing when user not found', async () => {
      repositories.notifications.createNotification.mockResolvedValueOnce(dbNotif);
      repositories.notifications.getUserPreferences.mockResolvedValueOnce(prefs);
      repositories.users.findById.mockResolvedValueOnce(null);

      const result = await service.sendNotification({
        userId: 'user-1', type: 'order_placed', title: 'Order', message: 'Placed',
      });
      expect(result).toBeUndefined();
    });

    test('returns true when notification is created and no channels enabled', async () => {
      repositories.notifications.createNotification.mockResolvedValueOnce(dbNotif);
      repositories.notifications.getUserPreferences.mockResolvedValueOnce(prefs);
      repositories.users.findById.mockResolvedValueOnce(user);

      const result = await service.sendNotification({
        userId: 'user-1', type: 'order_placed', title: 'Order', message: 'Placed',
      });
      expect(result).toBe(true);
    });

    test('sends email when email channel is enabled', async () => {
      repositories.notifications.createNotification.mockResolvedValueOnce(dbNotif);
      repositories.notifications.getUserPreferences.mockResolvedValueOnce({ ...prefs, email_enabled: true });
      repositories.users.findById.mockResolvedValueOnce(user);
      mockSendMail.mockResolvedValueOnce({});

      await service.sendNotification({
        userId: 'user-1', type: 'new_message', title: 'Msg', message: 'Hi',
        email: { html: '<p>Hi</p>', text: 'Hi' },
      });
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('queues push via AMQP when push channel is enabled', async () => {
      repositories.notifications.createNotification.mockResolvedValueOnce(dbNotif);
      repositories.notifications.getUserPreferences.mockResolvedValueOnce({ ...prefs, push_enabled: true });
      repositories.users.findById.mockResolvedValueOnce(user);
      amqpPublisher.publish.mockResolvedValueOnce(undefined);

      await service.sendNotification({
        userId: 'user-1', type: 'order_placed', title: 'Order', message: 'Placed',
        push: { data: { screen: 'order' } },
      });
      expect(amqpPublisher.publish).toHaveBeenCalledWith('push', expect.any(Object));
    });

    test('returns false without throwing on unexpected error', async () => {
      repositories.notifications.createNotification.mockRejectedValueOnce(new Error('DB down'));
      const result = await service.sendNotification({
        userId: 'user-1', type: 'order_placed', title: 'Order', message: 'Placed',
      });
      expect(result).toBe(false);
    });
  });

  describe('sendOrderNotification', () => {
    test('calls sendNotification with order data', async () => {
      repositories.notifications.createNotification.mockResolvedValue(dbNotif);
      repositories.notifications.getUserPreferences.mockResolvedValue(prefs);
      repositories.users.findById.mockResolvedValue(user);

      const order = { id: 'ord-1', order_number: '001', total_amount: '50.00' };
      await service.sendOrderNotification('user-1', order, 'confirmed');
      expect(repositories.notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order_confirmed' })
      );
    });
  });

  describe('notifyAdminsVerificationRequest', () => {
    test('notifies each admin', async () => {
      const admins = [{ id: 'admin-1' }, { id: 'admin-2' }];
      repositories.users.getAdmins.mockResolvedValueOnce(admins);
      repositories.notifications.createNotification.mockResolvedValue(dbNotif);
      repositories.notifications.getUserPreferences.mockResolvedValue(prefs);
      repositories.users.findById.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' });

      await service.notifyAdminsVerificationRequest('store-1', 'store', 'Kojo Fashion');
      expect(repositories.notifications.createNotification).toHaveBeenCalledTimes(admins.length);
    });

    test('does nothing when no admins exist', async () => {
      repositories.users.getAdmins.mockResolvedValueOnce([]);
      await service.notifyAdminsVerificationRequest('store-1', 'store', 'Kojo Fashion');
      expect(repositories.notifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
