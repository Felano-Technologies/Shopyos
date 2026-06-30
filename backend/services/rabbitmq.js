const amqp = require('amqplib');
const { logger } = require('../config/logger');
const amqpPublisher = require('./amqpPublisher');

class RabbitMQService {
    connection = null;
    channel = null;
    exchangeName = 'notifications_exchange';

    async connect() {
        try {
            const url = process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL;
            if (!url) {
                logger.error('RabbitMQ URL missing. Set RABBITMQ_URL or CLOUDAMQP_URL');
                return;
            }

            // Use amqpPublisher for the actual connection — it handles
            // deduplication, reconnection, and proper channel management
            logger.info('RabbitMQService delegating to AmqpPublisher');
        } catch (error) {
            logger.error('Failed to connect to RabbitMQ:', error);
        }
    }

    async publishMessage(routingKey, message) {
        try {
            await amqpPublisher.publish(routingKey, message);
            logger.info(`Message published to ${routingKey}:`, message.eventType);
            return true;
        } catch (error) {
            logger.error(`Error publishing message to ${routingKey}:`, error);
            return false;
        }
    }

    async close() {
        return amqpPublisher.close();
    }
}

const rabbitMQService = new RabbitMQService();

// Auto-connect initialized instance
if (process.env.NODE_ENV !== 'test') {
    rabbitMQService.connect();
}

module.exports = rabbitMQService;
