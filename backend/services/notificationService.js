// services/notificationService.js
// Service for sending notifications via different channels (email, SMS, push)

const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const amqpPublisher = require('./amqpPublisher');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { publishRealtimeEvent } = require('./realtimePublisher');
const { renderGenericEmail } = require('../templates');

// Route realtime emits through Redis pub/sub so they reach the socket service
// whether it runs in-process (monolith) or as a separate container.
const emitToUser = (userId, event, payload) =>
  publishRealtimeEvent({ scope: 'user', userId, event, payload });

const BRAND_LOGO_CID = 'shopyos-logo';
const BRAND_LOGO_PATH = path.join(__dirname, '../templates/assets/logo.png');

class NotificationService {
  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: false,
      family: 4,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Arkesel SMS configuration
    this.arkeselApiKey = process.env.ARKESEL_API_KEY;
    this.arkeselSenderId = process.env.ARKESEL_SENDER_ID || 'Shopyos';
    this.arkeselBaseUrl = 'https://sms.arkesel.com/api/v2/sms';
  }

  /**
   * Send notification through all enabled channels
   * @param {Object} params - { userId, type, title, message, data, email, sms, push }
   */
  async sendNotification(params) {
    const { userId, type, title, message, data, relatedId, relatedType } = params;

    try {
      // Create in-app notification
      const dbNotification = await repositories.notifications.createNotification({
        userId,
        type,
        title,
        message,
        data,
        relatedId,
        relatedType
      });

      // Emit real-time in-app notification to the user via socket
      try {
        emitToUser(userId, 'notification:new', {
          notification: dbNotification,
          type,
          title,
          message
        });
      } catch (socketErr) {
        logger.warn('Failed to emit real-time notification:', socketErr.message);
      }

      // Get user preferences
      const preferences = await repositories.notifications.getUserPreferences(userId);

      // Get user details for contact info
      const user = await repositories.users.findById(userId);
      if (!user) return;

      // Send email if enabled
      if (preferences.email_enabled && params.email && user.email) {
        await this.sendEmail({
          to: user.email,
          subject: title,
          html: params.email.html || renderGenericEmail(title, `<p>${message}</p>`),
          text: params.email.text || message
        });
      }

      // Send SMS if enabled — phone lives on user_profiles, not users
      if (preferences.sms_enabled && params.sms) {
        let phone = params.sms.to || user.phone;
        if (!phone) {
          try {
            const profile = await repositories.userProfiles.findByUserId(userId);
            phone = profile?.phone;
          } catch (profileErr) {
            logger.warn(`Could not resolve phone for SMS to user ${userId}:`, profileErr.message);
          }
        }
        if (phone) {
          await this.sendSMS({
            to: phone,
            message: params.sms.text || message
          });
        }
      }

      // Send push notification if enabled — queued through RabbitMQ for observability
      if (preferences.push_enabled && params.push) {
        const queued = await this._publishPushJob({
          eventType: type,
          userId,
          notificationId: dbNotification.id,
          title,
          body: message,
          relatedId,
          relatedType,
          data: {
            ...(params.push.data || data),
            notificationId: dbNotification.id,
            relatedType,
            relatedId
          }
        });

        // Fallback: call expoPushService directly if RabbitMQ is unavailable
        if (!queued) {
          logger.warn('[NotificationService] Push published via direct fallback (no RabbitMQ)');
          const pushResult = await this.sendPushNotification({
            userId,
            title,
            body: message,
            eventType: type,
            data: {
              ...(params.push.data || data),
              notificationId: dbNotification.id,
              relatedType,
              relatedId
            }
          });
          if (pushResult) {
            await repositories.notifications.db
              .from('notifications')
              .update({ sent_via_push: true })
              .eq('id', dbNotification.id);
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Notification service error:', error);
      // Don't throw - notification failures shouldn't break the main flow
      return false;
    }
  }

  /**
   * Send email notification
   * @param {Object} emailData - { to, subject, html, text }
   */
  async sendEmail(emailData) {
    try {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      };

      if (emailData.html && emailData.html.includes(`cid:${BRAND_LOGO_CID}`)) {
        mailOptions.attachments = [{
          filename: 'shopyos-logo.png',
          path: BRAND_LOGO_PATH,
          cid: BRAND_LOGO_CID
        }];
      }

      await this.emailTransporter.sendMail(mailOptions);
      logger.debug(`Email sent to ${emailData.to}`);
      return true;
    } catch (error) {
      logger.error('Email send error:', error);
      throw error;
    }
  }

  /**
   * Send SMS via Arkesel
   * @param {Object} smsData - { to, message }
   */
  async sendSMS(smsData) {
    try {
      logger.info(`Sending SMS to ${smsData.to}`);
      const response = await axios.post(
        `${this.arkeselBaseUrl}/send`,
        {
          sender: this.arkeselSenderId,
          recipients: [smsData.to],
          message: smsData.message
        },
        {
          headers: {
            'api-key': this.arkeselApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      // Arkesel returns HTTP 200 even on failure — only status:'success' counts
      if (response.data?.status !== 'success') {
        logger.error(`SMS rejected by Arkesel for ${smsData.to}:`, JSON.stringify(response.data));
        throw new Error(response.data?.message || 'Arkesel rejected the SMS');
      }

      logger.info(`SMS sent successfully to ${smsData.to}`, JSON.stringify(response.data?.data || ''));
      return response.data;
    } catch (error) {
      logger.error('SMS send error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otp - OTP code
   */
  async sendOTP(phoneNumber, otp) {
    const message = `Your Shopyos verification code is: ${otp}. Valid for 10 minutes.`;
    return this.sendSMS({ to: phoneNumber, message });
  }

  /**
   * Publish a push notification job to the RabbitMQ push_queue.
   * Returns true if successfully queued, false if RabbitMQ is unavailable (caller falls back to direct send).
   * @param {Object} payload - { eventType, userId, notificationId, title, body, relatedId, relatedType, data }
   */
  async _publishPushJob(payload) {
    try {
      await amqpPublisher.publish('push', payload);
      logger.debug(`[NotificationService] Push job queued for user ${payload.userId} (${payload.eventType})`);
      return true;
    } catch (err) {
      logger.error('[NotificationService] Failed to publish push job:', err.message);
      return false;
    }
  }

  /**
   * Send push notification directly via Expo (used as fallback when RabbitMQ is unavailable)
   * @param {Object} pushData - { userId, title, body, data }
   */
  async sendPushNotification(pushData) {
    try {
      const expoPushService = require('./expoPushService');
      return await expoPushService.sendPushNotificationToUser(pushData.userId, pushData);
    } catch (error) {
      logger.error('Failed to trigger Expo push service:', error);
      return false;
    }
  }

  /**
   * Send order notification
   * @param {string} userId - User ID
   * @param {Object} order - Order object
   * @param {string} status - Order status
   */
  async sendOrderNotification(userId, order, status) {
    const statusMessages = {
      pending:          'Your order has been placed successfully',
      payment_processing: 'Your payment is being processed',
      paid:             'Payment confirmed! The store will start preparing your order soon.',
      confirmed:        'Your order has been confirmed and is being prepared.',
      ready_for_pickup: 'Your order is ready! A driver will pick it up soon.',
      assigned:         'A driver has been assigned to your order.',
      picked_up:        'Your order has been picked up and is on the way!',
      in_transit:       'Your driver is heading to your location.',
      delivered:        'Your order has been delivered! Enjoy your purchase.',
      completed:        'Order completed. Thank you for shopping!',
      cancelled:        'Your order has been cancelled.',
      refunded:         'A refund has been issued for your order.'
    };

    const title = status === 'pending' ? 'Order Placed' : 'Order Update';
    const message = `${statusMessages[status] || 'Status updated'} - Order #${order.order_number}`;

    await this.sendNotification({
      userId,
      type: `order_${status}`,
      title,
      message,
      data: { orderId: order.id, orderNumber: order.order_number, status },
      relatedId: order.id,
      relatedType: 'order',
      email: {
        html: renderGenericEmail(
          title,
          `<p>${message}</p><p><strong>Total:</strong> ₵${order.total_amount}</p>`,
          `${process.env.FRONTEND_URL}/order/${order.id}`,
          'View Order Details'
        )
      },
      sms: {
        text: `${message}. Details: ORD-#${order.order_number}`
      },
      push: {
        data: {
          screen: 'order',
          orderId: order.id
        }
      }
    });
  }

  /**
   * Send delivery notification
   * @param {string} userId - User ID
   * @param {Object} delivery - Delivery object
   * @param {string} status - Delivery status
   */
  async sendDeliveryNotification(userId, delivery, status) {
    const statusMessages = {
      assigned: 'A driver has been assigned to your delivery',
      picked_up: 'Your order has been picked up',
      in_transit: 'Your order is on the way',
      arrived: 'Your driver has arrived',
      delivered: 'Your order has been delivered'
    };

    const title = 'Delivery Update';
    const message = statusMessages[status];

    await this.sendNotification({
      userId,
      type: 'delivery_update',
      title,
      message,
      data: { deliveryId: delivery.id, status },
      relatedId: delivery.id,
      relatedType: 'delivery',
      sms: {
        text: message
      },
      push: {
        data: {
          screen: 'order',
          deliveryId: delivery.id
        }
      }
    });
  }

  /**
   * Send new message notification
   * @param {string} userId - Recipient user ID
   * @param {Object} sender - Sender user object
   * @param {string} messageText - Message preview
   */
  async sendMessageNotification(userId, sender, messageText) {
    const title = `New message from ${sender.full_name || 'User'}`;
    const preview = messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText;

    await this.sendNotification({
      userId,
      type: 'new_message',
      title,
      message: preview,
      data: { senderId: sender.id, senderName: sender.full_name },
      relatedId: sender.id,
      relatedType: 'user',
      push: {
        data: {
          screen: 'messages',
          senderId: sender.id
        }
      }
    });
  }

  /**
   * Send review notification to store owner
   * @param {string} storeOwnerId - Store owner user ID
   * @param {Object} review - Review object
   * @param {string} reviewerName - Reviewer name
   */
  async sendReviewNotification(storeOwnerId, review, reviewerName) {
    const title = 'New Review Received';
    const message = `${reviewerName} left a ${review.rating}-star review`;

    await this.sendNotification({
      userId: storeOwnerId,
      type: 'new_review',
      title,
      message,
      data: { reviewId: review.id, rating: review.rating },
      relatedId: review.id,
      relatedType: 'review',
      push: {
        data: {
          screen: 'reviews',
          reviewId: review.id
        }
      }
    });
  }
  /**
   * Notify admins when a business or driver submits verification documents
   * @param {string} sourceId - The ID of the store or driver profile
   * @param {string} sourceType - 'store' or 'driver'
   * @param {string} name - The name of the business or driver
   */
  async notifyAdminsVerificationRequest(sourceId, sourceType, name) {
    try {
      const admins = await repositories.users.getAdmins();
      if (!admins || admins.length === 0) return;

      const title = `New Verification Request: ${sourceType === 'store' ? 'Business' : 'Driver'}`;
      const message = `${name} has submitted documents for verification. Please review them.`;
      const type = sourceType === 'store' ? 'business_verification' : 'driver_verification';

      for (const admin of admins) {
        await this.sendNotification({
          userId: admin.id,
          type,
          title,
          message,
          data: { sourceId, sourceType, name },
          relatedId: sourceId,
          relatedType: sourceType,
          push: {
            data: {
              screen: sourceType === 'store' ? 'AdminStoreDetails' : 'AdminDriverDetails',
              id: sourceId
            }
          }
        });
      }
    } catch (error) {
      logger.error('Failed to notify admins of verification request:', error);
    }
  }
}


module.exports = new NotificationService();
