const amqp = require('amqplib');
const { logger } = require('../config/logger');

class RabbitMQService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.exchangeName = 'notifications_exchange';
    }

    async connect() {
        try {
            const url = process.env.RABBITMQ_URL || 'amqp://localhost';
            this.connection = await amqp.connect(url);

            this.connection.on('error', (err) => {
                logger.error('RabbitMQ connection error:', err);
            });

            this.connection.on('close', () => {
                logger.error('RabbitMQ connection closed, attempting reconnect...');
                setTimeout(() => this.connect(), 5000);
            });

            this.channel = await this.connection.createChannel();

            // Use direct exchange for routing to specific queues
            await this.channel.assertExchange(this.exchangeName, 'direct', { durable: true });

            // Assert queues
            await this.channel.assertQueue('email_queue', { durable: true });
            await this.channel.assertQueue('sms_queue', { durable: true });

            // Bind queues to exchange
            await this.channel.bindQueue('email_queue', this.exchangeName, 'email');
            await this.channel.bindQueue('sms_queue', this.exchangeName, 'sms');

            logger.info('Connected to RabbitMQ and setup queues successfully');
        } catch (error) {
            logger.error('Failed to connect to RabbitMQ:', error);
            // Don't throw to prevent app crash on startup if MQ is down
        }
    }

    async publishMessage(routingKey, message) {
        if (!this.channel) {
            logger.warn('RabbitMQ channel not available. Attempting reconnect...');
            await this.connect();
            if (!this.channel) {
                logger.error('Failed to publish message: No RabbitMQ connection');
                return false;
            }
        }

        try {
            const payload = Buffer.from(JSON.stringify(message));
            // Using persistent true means messages survive broker restarts
            const result = this.channel.publish(this.exchangeName, routingKey, payload, { persistent: true });
            if (result) {
                logger.info(`Message published to ${routingKey}:`, message.eventType);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error publishing message to ${routingKey}:`, error);
            return false;
        }
    }

    async close() {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }
}

const rabbitMQService = new RabbitMQService();

// Auto-connect initialized instance
if (process.env.NODE_ENV !== 'test') {
    rabbitMQService.connect();
}

module.exports = rabbitMQService;
