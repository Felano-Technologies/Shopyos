// Persistent singleton AMQP publisher
// Replaces per-message connection pattern — one connection reused across all publishes

const amqp = require('amqplib');
const { logger } = require('../config/logger');

const EXCHANGE = 'notifications_exchange';

class AmqpPublisher {
  _conn           = null;
  _channel        = null;
  _connectPromise = null;

  async _doConnect() {
    const url = process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL;
    if (!url) throw new Error('RABBITMQ_URL not configured');

    this._conn = await amqp.connect(url, { heartbeat: 60 });
    this._conn.on('error', (err) => { logger.error('[AmqpPublisher] Error:', err.message); this._reset(); });
    this._conn.on('close', ()    => { logger.warn('[AmqpPublisher] Connection closed');    this._reset(); });

    this._channel = await this._conn.createChannel();
    await this._channel.assertExchange(EXCHANGE, 'direct', { durable: true });
    logger.info('[AmqpPublisher] Connected to RabbitMQ');
  }

  // Deduplicates concurrent connect calls into one shared promise
  async _connect() {
    if (this._channel) return;
    if (!this._connectPromise) {
      this._connectPromise = this._doConnect().finally(() => { this._connectPromise = null; });
    }
    if (this._connectPromise) { await this._connectPromise; }
  }

  _reset() {
    this._conn    = null;
    this._channel = null;
  }

  async publish(routingKey, payload) {
    await this._connect();
    if (!this._channel) throw new Error('AMQP channel unavailable after connect');
    this._channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
  }

  async close() {
    if (this._conn) await this._conn.close().catch(() => {});
    this._reset();
  }
}

module.exports = new AmqpPublisher();
