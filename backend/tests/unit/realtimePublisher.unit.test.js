'use strict';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRedis = {
  publish: jest.fn(),
};

jest.mock('../../config/redis', () => ({
  getRedis: jest.fn(() => mockRedis),
}));

const { getRedis } = require('../../config/redis');
const { publishRealtimeEvent } = require('../../services/realtimePublisher');

describe('publishRealtimeEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  test('publishes serialised event to the redis channel and returns true', async () => {
    mockRedis.publish.mockResolvedValueOnce(1);

    const event = { scope: 'order', event: 'updated', payload: { id: 'ord-1' } };
    const result = await publishRealtimeEvent(event);

    expect(result).toBe(true);
    expect(mockRedis.publish).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(event)
    );
  });

  test('returns false when redis is not available', async () => {
    getRedis.mockReturnValueOnce(null);

    const result = await publishRealtimeEvent({ scope: 'order', event: 'updated' });
    expect(result).toBe(false);
    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  test('returns false and logs error on publish failure', async () => {
    mockRedis.publish.mockRejectedValueOnce(new Error('Redis connection lost'));

    const result = await publishRealtimeEvent({ scope: 'user', event: 'status' });
    expect(result).toBe(false);
  });
});
