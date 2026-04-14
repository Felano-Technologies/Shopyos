const { getRedis } = require('../config/redis');
const { logger } = require('../config/logger');

const CHANNEL = process.env.REALTIME_EVENTS_CHANNEL || 'shopyos:realtime:events';

const publishRealtimeEvent = async (event) => {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.publish(CHANNEL, JSON.stringify(event));
    return true;
  } catch (error) {
    logger.error('Failed to publish realtime event', {
      error: error.message,
      channel: CHANNEL,
      scope: event?.scope,
      event: event?.event,
    });
    return false;
  }
};

module.exports = {
  publishRealtimeEvent,
};
