'use strict';

jest.mock('amqplib');
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const amqp = require('amqplib');

const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
};

const mockConn = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

// Reset singleton state between tests without resetModules
let publisher;
beforeEach(() => {
  jest.clearAllMocks();
  amqp.connect = jest.fn().mockResolvedValue(mockConn);
  publisher = require('../../services/amqpPublisher');
  // Reset internal state of the singleton
  publisher._conn = null;
  publisher._channel = null;
  publisher._connectPromise = null;
});

describe('amqpPublisher', () => {
  test('connects and publishes a message', async () => {
    process.env.RABBITMQ_URL = 'amqp://localhost';
    await publisher.publish('push', { userId: 'u1', title: 'Test' });

    expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost', expect.any(Object));
    expect(mockChannel.assertExchange).toHaveBeenCalledWith('notifications_exchange', 'direct', expect.any(Object));
    expect(mockChannel.publish).toHaveBeenCalledWith(
      'notifications_exchange',
      'push',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  test('reuses existing channel on second publish (no reconnect)', async () => {
    process.env.RABBITMQ_URL = 'amqp://localhost';
    await publisher.publish('email', { foo: 'bar' });
    await publisher.publish('email', { foo: 'baz' });

    expect(amqp.connect).toHaveBeenCalledTimes(1);
    expect(mockChannel.publish).toHaveBeenCalledTimes(2);
  });

  test('throws when RABBITMQ_URL is not set', async () => {
    delete process.env.RABBITMQ_URL;
    delete process.env.CLOUDAMQP_URL;

    await expect(publisher.publish('push', {})).rejects.toThrow('RABBITMQ_URL not configured');
  });

  test('close() cleans up connection', async () => {
    process.env.RABBITMQ_URL = 'amqp://localhost';
    await publisher.publish('push', {});
    await publisher.close();

    expect(mockConn.close).toHaveBeenCalled();
  });
});
