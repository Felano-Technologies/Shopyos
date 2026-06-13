'use strict';

jest.mock('amqplib');
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const amqp = require('amqplib');

const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue(undefined),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockConn = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

let service;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RABBITMQ_URL = 'amqp://localhost';
  amqp.connect = jest.fn().mockResolvedValue(mockConn);
  service = require('../../services/rabbitmq');
  // Reset singleton state
  service.connection = null;
  service.channel = null;
});

describe('RabbitMQService', () => {
  test('connect() establishes connection and asserts exchange + queues', async () => {
    await service.connect();

    expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost', expect.any(Object));
    expect(mockChannel.assertExchange).toHaveBeenCalledWith('notifications_exchange', 'direct', { durable: true });
    expect(mockChannel.assertQueue).toHaveBeenCalledWith('email_queue', { durable: true });
    expect(mockChannel.assertQueue).toHaveBeenCalledWith('sms_queue', { durable: true });
  });

  test('connect() does nothing when RABBITMQ_URL is missing', async () => {
    delete process.env.RABBITMQ_URL;
    delete process.env.CLOUDAMQP_URL;
    await service.connect();
    expect(amqp.connect).not.toHaveBeenCalled();
  });

  test('publishMessage() returns true on successful publish', async () => {
    await service.connect();
    mockChannel.publish.mockReturnValueOnce(true);

    const result = await service.publishMessage('email', { eventType: 'welcome' });
    expect(result).toBe(true);
    expect(mockChannel.publish).toHaveBeenCalledWith(
      'notifications_exchange',
      'email',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  test('publishMessage() returns false when channel.publish returns false', async () => {
    await service.connect();
    mockChannel.publish.mockReturnValueOnce(false);

    const result = await service.publishMessage('sms', { eventType: 'otp' });
    expect(result).toBe(false);
  });

  test('publishMessage() attempts to reconnect when channel is null', async () => {
    service.channel = null;
    await service.publishMessage('email', { eventType: 'test' });
    expect(amqp.connect).toHaveBeenCalled();
  });

  test('close() closes channel and connection', async () => {
    await service.connect();
    await service.close();

    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConn.close).toHaveBeenCalled();
  });
});
