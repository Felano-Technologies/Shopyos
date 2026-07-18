// services/transitEvents.js
// Publishes inter-regional transit milestones to the buyer's socket so the
// shipment tracker updates live instead of relying on polling. Best-effort:
// a failed publish never blocks the underlying status change.

const { publishRealtimeEvent } = require('./realtimePublisher');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

/**
 * Emit an `order:transit_update` to the order's buyer with the current status
 * and full parcel history. Re-reads the order so the emitted status reflects
 * the just-applied update.
 * @param {string} orderId
 */
async function emitTransitUpdate(orderId) {
  try {
    const order = await repositories.orders.findById(orderId);
    if (!order?.buyer_id) return;

    const history = await repositories.parcelPartner
      .getStatusHistory(orderId)
      .catch(() => []);

    await publishRealtimeEvent({
      scope: 'user',
      userId: order.buyer_id,
      event: 'order:transit_update',
      payload: {
        orderId,
        status: order.status,
        trackingNumber: order.parcel_tracking_number || null,
        lastMileRequested: order.last_mile_requested || false,
        history,
      },
    });
  } catch (error) {
    logger.error('Failed to emit transit update', { orderId, error: error.message });
  }
}

module.exports = { emitTransitUpdate };
