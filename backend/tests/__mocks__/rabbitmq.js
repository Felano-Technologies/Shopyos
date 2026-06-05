/**
 * tests/__mocks__/rabbitmq.js
 * Jest manual mock for services/rabbitmq.js
 * Prevents real AMQP connections during unit tests.
 */
const rabbitMQService = {
  connect: jest.fn().mockResolvedValue(undefined),
  publishMessage: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(false),
};

module.exports = rabbitMQService;
