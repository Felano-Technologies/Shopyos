require('dotenv').config();
const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const axios = require('axios');
const winston = require('winston');
const { getEmailTemplateByEvent, getSmsTemplateByEvent } = require('../templates');
const repositories = require('../db/repositories');

// Basic worker logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

// Configure Nodemailer
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
    port: process.env.EMAIL_PORT || 2525,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Arkesel configuration
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || 'Shopyos';

/**
 * Ensures the notification log is stored and idempotent.
 * @param {string} eventType 
 * @param {string} target 
 * @param {string} referenceId 
 * @returns {boolean} True if processed (or log exists). False if inserted successfully and needs processing.
 */
async function checkOrLogIdempotency(eventType, target, referenceId) {
    try {
        const { data: existing } = await repositories.users.db
            .from('notification_logs')
            .select('id, status')
            .eq('event_type', eventType)
            .eq('target', target)
            .eq('reference_id', referenceId)
            .single();

        if (existing) {
            if (existing.status === 'SENT') {
                logger.info(`Message already sent to ${target} for ${eventType}`, { referenceId });
                return true; // Stop processing, already done
            } else {
                return false; // Failed before, try again
            }
        }

        // Attempt to insert processing state
        await repositories.users.db.from('notification_logs').insert({
            event_type: eventType,
            target,
            reference_id: referenceId,
            status: 'PROCESSING'
        });

        return false; // Proceed with sending
    } catch (error) {
        logger.error('Error checking idempotency:', error.message);
        return false; // Fallback: proceed
    }
}

async function updateLogStatus(eventType, target, referenceId, status, errorMsg = null) {
    try {
        await repositories.users.db.from('notification_logs')
            .update({ status, error: errorMsg, updated_at: new Date() })
            .eq('event_type', eventType)
            .eq('target', target)
            .eq('reference_id', referenceId);
    } catch (error) {
        logger.error('Error updating log status:', error.message);
    }
}

async function handleEmail(msg) {
    const payload = JSON.parse(msg.content.toString());
    const { eventType, userId, role, email, orderId, referenceId, templateData } = payload;
    const target = email;
    const refId = referenceId || orderId || userId;

    if (await checkOrLogIdempotency(eventType, target, refId)) {
        return true; // Already processed
    }

    let template;
    try {
        template = getEmailTemplateByEvent(eventType, role, templateData);

        if (!template) {
            logger.warn(`No email template found for event ${eventType} and role ${role}`);
            await updateLogStatus(eventType, target, refId, 'FAILED', 'No Template');
            return true; // We ack because retrying won't fix missing template
        }

        logger.info(`Sending email to ${target} for ${eventType}`);
        const info = await emailTransporter.sendMail({
            from: `Shopyos Notifications <${process.env.EMAIL_USER}>`,
            to: target,
            subject: template.subject,
            html: template.html
        });

        logger.info(`Email sent: ${info.messageId}`);
        await updateLogStatus(eventType, target, refId, 'SENT');
        return true; // Success

    } catch (error) {
        logger.error(`Failed to send email to ${target}:`, error.message);
        await updateLogStatus(eventType, target, refId, 'FAILED', error.message);
        throw error; // Will retry via NACK
    }
}

async function handleSMS(msg) {
    const payload = JSON.parse(msg.content.toString());
    const { eventType, userId, role, phone, orderId, referenceId, templateData } = payload;
    const target = phone;
    const refId = referenceId || orderId || userId;

    if (await checkOrLogIdempotency(eventType, target, refId)) {
        return true; // Already processed
    }

    let textMsg;
    try {
        textMsg = getSmsTemplateByEvent(eventType, role, templateData);

        if (!textMsg) {
            logger.warn(`No SMS template found for event ${eventType} and role ${role}`);
            await updateLogStatus(eventType, target, refId, 'FAILED', 'No Template');
            return true; // Ack, missing template won't fix itself
        }

        logger.info(`Sending SMS to ${target} for ${eventType}`);
        const res = await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
            sender: ARKESEL_SENDER_ID,
            message: textMsg,
            recipients: [target]
        }, {
            headers: { 'api-key': ARKESEL_API_KEY }
        });

        if (res.data?.status === 'success' || res.status === 200) {
            logger.info(`SMS sent successfully to ${target}`);
            await updateLogStatus(eventType, target, refId, 'SENT');
            return true;
        } else {
            throw new Error(`Arkesel response failed: ${JSON.stringify(res.data)}`);
        }

    } catch (error) {
        logger.error(`Failed to send SMS to ${target}:`, error.message);
        await updateLogStatus(eventType, target, refId, 'FAILED', error.message);
        throw error; // Will be NACKed and retried
    }
}

async function startWorker() {
    try {
        const url = process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL;
        if (!url) {
            throw new Error('RABBITMQ_URL (or CLOUDAMQP_URL) is required for notification worker');
        }
        const conn = await amqp.connect(url);
        const channel = await conn.createChannel();

        await channel.assertExchange('notifications_exchange', 'direct', { durable: true });

        // Email Setup
        await channel.assertQueue('email_queue', { durable: true });
        await channel.bindQueue('email_queue', 'notifications_exchange', 'email');
        channel.prefetch(10); // Process 10 concurrent emails

        // SMS Setup
        await channel.assertQueue('sms_queue', { durable: true });
        await channel.bindQueue('sms_queue', 'notifications_exchange', 'sms');
        channel.prefetch(5); // Process 5 concurrent SMS

        logger.info('Notification Workers started. Waiting for messages...');

        // Consume Emails
        channel.consume('email_queue', async (msg) => {
            if (msg !== null) {
                try {
                    // Process job
                    await handleEmail(msg);
                    // Explicit acknowledgment
                    channel.ack(msg);
                } catch (error) {
                    // Reject and requeue (simulating retry logic)
                    // In production, we should handle retry max count via headers
                    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
                    if (retryCount >= 3) {
                        logger.error(`Max retries reached for email job. Discarding.`);
                        channel.reject(msg, false); // Dead letter if DLQ configured
                    } else {
                        logger.info(`Requeueing email job. Attempt ${retryCount + 1}`);
                        // Resend to back of queue with incremented retry count
                        channel.ack(msg); // Ack the original
                        channel.publish('notifications_exchange', 'email', msg.content, {
                            persistent: true,
                            headers: { 'x-retry-count': retryCount + 1 }
                        });
                    }
                }
            }
        });

        // Consume SMS
        channel.consume('sms_queue', async (msg) => {
            if (msg !== null) {
                try {
                    await handleSMS(msg);
                    channel.ack(msg);
                } catch (error) {
                    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
                    if (retryCount >= 3) {
                        logger.error(`Max retries reached for SMS job. Discarding.`);
                        channel.reject(msg, false);
                    } else {
                        logger.info(`Requeueing SMS job. Attempt ${retryCount + 1}`);
                        channel.ack(msg);
                        channel.publish('notifications_exchange', 'sms', msg.content, {
                            persistent: true,
                            headers: { 'x-retry-count': retryCount + 1 }
                        });
                    }
                }
            }
        });

    } catch (error) {
        logger.error('Worker failed to start:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startWorker();
}

module.exports = { startWorker, handleEmail, handleSMS };
