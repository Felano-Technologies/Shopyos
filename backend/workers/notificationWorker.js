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
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Arkesel configuration
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || 'Shopyos';

// Guard so SIGTERM / SIGINT don't trigger the reconnection loop
let isShuttingDown = false;
process.on('SIGTERM', () => { isShuttingDown = true; });
process.on('SIGINT',  () => { isShuttingDown = true; });

function extractErrorDetails(error) {
    return {
        message: error?.message || 'Unknown error',
        code: error?.code || null,
        status: error?.response?.status || null,
        responseData: error?.response?.data || null,
        command: error?.command || null,
        response: error?.response || null
    };
}

function markNonRetryable(error, reason) {
    const err = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
    err.retryable = false;
    err.reason = reason;
    return err;
}

/**
 * Ensures the notification log is stored and idempotent.
 * @param {string} eventType 
 * @param {string} target 
 * @param {string} referenceId 
 * @returns {boolean} True if processed (or log exists). False if inserted successfully and needs processing.
 */
async function checkOrLogIdempotency(eventType, target, referenceId) {
    try {
        const { data: existing, error: selectError } = await repositories.users.db
            .from('notification_logs')
            .select('id, status')
            .eq('event_type', eventType)
            .eq('target', target)
            .eq('reference_id', referenceId)
            .maybeSingle(); // Returns null data (not an error) when no row exists

        if (selectError) {
            logger.error('Error querying notification_logs:', selectError.message || selectError);
            return false; // Fallback: proceed
        }

        if (existing) {
            if (existing.status === 'SENT') {
                logger.info(`Message already sent to ${target} for ${eventType}`, { referenceId });
                return true; // Stop processing, already done
            } else {
                return false; // Failed/processing before, try again
            }
        }

        // Attempt to insert processing state; ignore if another worker beat us to it.
        // Known trade-off: if the worker crashes after this insert but before the send
        // completes, the row stays as 'PROCESSING' and checkOrLogIdempotency returns false
        // on the next attempt (correctly allowing a retry). This means a crash mid-send
        // could result in a duplicate delivery on restart. Avoiding this entirely would
        // require distributed locks, which is out of scope here.
        const { error: insertError, conflictIgnored } = await repositories.users.db
            .from('notification_logs')
            .insert({
                event_type: eventType,
                target,
                reference_id: referenceId,
                status: 'PROCESSING'
            })
            .onConflict(['event_type', 'target', 'reference_id'])
            .ignore();

        if (insertError) {
            logger.error('Error recording idempotency log:', insertError.message || insertError);
            return false; // Fallback: proceed
        }

        if (conflictIgnored) {
            logger.warn('Idempotency insert conflict — another worker processed this message first.');
            return true; // Another worker got there first
        }

        return false; // Proceed with sending
    } catch (error) {
        logger.error('Error checking idempotency:', error?.message || error);
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

    if (!target) {
        logger.warn('Email target missing; skipping message', { eventType, referenceId: refId });
        await updateLogStatus(eventType, 'unknown', refId, 'FAILED', 'Missing email target');
        return true;
    }

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
            from: `${process.env.EMAIL_FROM_NAME || 'Shopyos'} <${process.env.EMAIL_USER}>`,
            to: target,
            subject: template.subject,
            html: template.html
        });

        logger.info(`Email sent: ${info.messageId}`);
        await updateLogStatus(eventType, target, refId, 'SENT');
        return true; // Success

    } catch (error) {
        const details = extractErrorDetails(error);
        logger.error(`Failed to send email to ${target}`, details);
        await updateLogStatus(eventType, target, refId, 'FAILED', JSON.stringify(details));

        const nonRetryableCodes = new Set(['EAUTH', 'EENVELOPE', 'EMESSAGE']);
        if (nonRetryableCodes.has(details.code)) {
            throw markNonRetryable(error, `non-retryable email error: ${details.code}`);
        }

        throw error; // Retry only for transient errors
    }
}

async function handleSMS(msg) {
    const payload = JSON.parse(msg.content.toString());
    const { eventType, userId, role, phone, orderId, referenceId, templateData } = payload;
    const target = phone;
    const refId = referenceId || orderId || userId;

    if (!target) {
        logger.warn('SMS target missing; skipping message', { eventType, referenceId: refId });
        await updateLogStatus(eventType, 'unknown', refId, 'FAILED', 'Missing phone target');
        return true;
    }

    if (!ARKESEL_API_KEY) {
        const err = markNonRetryable(new Error('ARKESEL_API_KEY is missing'), 'Missing SMS provider key');
        await updateLogStatus(eventType, target, refId, 'FAILED', err.message);
        throw err;
    }

    if (await checkOrLogIdempotency(eventType, target, refId)) {
        return true; // Already processed
    }

    let textMsg;
    try {
        textMsg = getSmsTemplateByEvent(eventType, role, templateData);

        if (!textMsg || typeof textMsg !== 'string' || textMsg.trim() === '') {
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

        // Arkesel always returns { status: 'success' } on success regardless of HTTP 200
        if (res.data?.status === 'success') {
            logger.info(`SMS sent successfully to ${target}`);
            await updateLogStatus(eventType, target, refId, 'SENT');
            return true;
        } else {
            throw new Error(`Arkesel response failed: ${JSON.stringify(res.data)}`);
        }

    } catch (error) {
        const details = extractErrorDetails(error);
        logger.error(`Failed to send SMS to ${target}`, details);
        await updateLogStatus(eventType, target, refId, 'FAILED', JSON.stringify(details));

        // 4xx from provider are usually invalid request/auth and won't succeed on retry.
        if (details.status && details.status >= 400 && details.status < 500) {
            throw markNonRetryable(error, `non-retryable SMS provider status: ${details.status}`);
        }

        throw error; // Retry only for transient errors
    }
}

async function startWorker() {
    try {
        const url = process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL;
        if (!url) {
            throw new Error('RABBITMQ_URL (or CLOUDAMQP_URL) is required for notification worker');
        }
        const conn = await amqp.connect(url, { heartbeat: 30 });

        // Reconnect on unexpected connection errors or closure.
        // isShuttingDown prevents an infinite reconnect loop on SIGTERM/SIGINT.
        conn.on('error', (err) => {
            if (isShuttingDown) return;
            logger.error('RabbitMQ connection error:', err.message);
            setTimeout(startWorker, 5000);
        });
        conn.on('close', () => {
            if (isShuttingDown) return;
            logger.warn('RabbitMQ connection closed. Reconnecting in 5s...');
            setTimeout(startWorker, 5000);
        });

        // Assert the exchange once on a short-lived setup channel, then close it.
        // This ensures both emailChannel and smsChannel share the same exchange
        // without either channel needing to redundantly assert it.
        const setupChannel = await conn.createChannel();
        await setupChannel.assertExchange('notifications_exchange', 'direct', { durable: true });
        await setupChannel.close();

        // Use separate channels so prefetch limits are independent per queue
        const emailChannel = await conn.createChannel();
        const smsChannel = await conn.createChannel();

        // Email Setup — allow up to 10 unacked messages at a time
        await emailChannel.assertQueue('email_queue', { durable: true });
        await emailChannel.bindQueue('email_queue', 'notifications_exchange', 'email');
        emailChannel.prefetch(10);

        // SMS Setup — allow up to 5 unacked messages at a time
        await smsChannel.assertQueue('sms_queue', { durable: true });
        await smsChannel.bindQueue('sms_queue', 'notifications_exchange', 'sms');
        smsChannel.prefetch(5);

        logger.info('Notification Workers started. Waiting for messages...');

        // Consume Emails
        emailChannel.consume('email_queue', async (msg) => {
            if (msg !== null) {
                try {
                    await handleEmail(msg);
                    emailChannel.ack(msg);
                } catch (error) {
                    if (error?.retryable === false) {
                        logger.error('Email job failed with non-retryable error. Discarding.', {
                            reason: error?.reason || error?.message,
                            eventType: JSON.parse(msg.content.toString())?.eventType ?? null
                        });
                        emailChannel.reject(msg, false);
                        return;
                    }
                    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
                    if (retryCount >= 3) {
                        logger.error('Max retries reached for email job. Discarding.');
                        emailChannel.reject(msg, false); // Dead letter if DLQ configured
                    } else {
                        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                        logger.info(`Requeueing email job. Attempt ${retryCount + 1} (after ${delay}ms)`);
                        await new Promise(res => setTimeout(res, delay));
                        emailChannel.ack(msg);
                        emailChannel.publish('notifications_exchange', 'email', msg.content, {
                            persistent: true,
                            headers: { 'x-retry-count': retryCount + 1 }
                        });
                    }
                }
            }
        });

        // Consume SMS
        smsChannel.consume('sms_queue', async (msg) => {
            if (msg !== null) {
                try {
                    await handleSMS(msg);
                    smsChannel.ack(msg);
                } catch (error) {
                    if (error?.retryable === false) {
                        logger.error('SMS job failed with non-retryable error. Discarding.', {
                            reason: error?.reason || error?.message,
                            eventType: JSON.parse(msg.content.toString())?.eventType ?? null
                        });
                        smsChannel.reject(msg, false);
                        return;
                    }
                    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
                    if (retryCount >= 3) {
                        logger.error('Max retries reached for SMS job. Discarding.');
                        smsChannel.reject(msg, false);
                    } else {
                        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                        logger.info(`Requeueing SMS job. Attempt ${retryCount + 1} (after ${delay}ms)`);
                        await new Promise(res => setTimeout(res, delay));
                        smsChannel.ack(msg);
                        smsChannel.publish('notifications_exchange', 'sms', msg.content, {
                            persistent: true,
                            headers: { 'x-retry-count': retryCount + 1 }
                        });
                    }
                }
            }
        });

    } catch (error) {
        logger.error('Worker failed to start:', error.message);
        setTimeout(startWorker, 5000); // Retry startup instead of hard-exiting
    }
}

if (require.main === module) {
    startWorker();
}

module.exports = { startWorker, handleEmail, handleSMS };
