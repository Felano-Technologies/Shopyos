const { emitToUser, emitToConversation } = require('../../config/socketServer');
const logger = require('../../config/logger');

const publishRealtimeEvent = (event) => {
  if (!event?.scope || !event?.event) {
    logger.warn('Invalid realtime event payload', { event });
    return;
  }

  if (event.scope === 'user' && event.userId) {
    emitToUser(event.userId, event.event, event.payload || {});
    return;
  }

  if (event.scope === 'conversation' && event.conversationId) {
    emitToConversation(event.conversationId, event.event, event.payload || {});
    return;
  }

  logger.warn('Realtime event missing target', { event });
};

module.exports = { publishRealtimeEvent };
