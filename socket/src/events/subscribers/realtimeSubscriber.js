const logger = require('../../config/logger');
const { getSubClient } = require('../../config/redis');
const { publishRealtimeEvent } = require('../publishers/realtimePublisher');

const startRealtimeSubscriber = async () => {
  const channel = process.env.REALTIME_EVENTS_CHANNEL || 'shopyos:realtime:events';
  const sub = getSubClient();

  if (!sub) {
    logger.warn('Redis not configured. External realtime subscription disabled.');
    return;
  }

  await sub.subscribe(channel);
  logger.info('Realtime subscriber started', { channel });

  sub.on('message', (receivedChannel, message) => {
    if (receivedChannel !== channel) return;
    try {
      const event = JSON.parse(message);
      publishRealtimeEvent(event);
    } catch (error) {
      logger.error('Failed to process realtime event', { error: error.message, message });
    }
  });
};

module.exports = { startRealtimeSubscriber };
