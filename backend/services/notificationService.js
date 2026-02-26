// services/notificationService.js
// Service for sending notifications via different channels (email, SMS, push)

const nodemailer = require('nodemailer');
const axios = require('axios');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

class NotificationService {
  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Arkesel SMS configuration
    this.arkeselApiKey = process.env.ARKESEL_API_KEY;
    this.arkeselSenderId = process.env.ARKESEL_SENDER_ID;
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
      await repositories.notifications.createNotification({
        userId,
        type,
        title,
        message,
        data,
        relatedId,
        relatedType
      });

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
          html: params.email.html || message,
          text: params.email.text || message
        });
      }

      // Send SMS if enabled
      if (preferences.sms_enabled && params.sms && user.phone) {
        await this.sendSMS({
          to: user.phone,
          message: params.sms.text || message
        });
      }

      // Send push notification if enabled
      if (preferences.push_enabled && params.push) {
        await this.sendPushNotification({
          userId,
          title,
          body: message,
          data: params.push.data || data
        });
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

      logger.debug(`SMS sent to ${smsData.to}:`, response.data);
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
   * Send push notification (placeholder for FCM/OneSignal integration)
   * @param {Object} pushData - { userId, title, body, data }
   */
  async sendPushNotification(pushData) {
    // TODO: Integrate with Firebase Cloud Messaging (FCM) or OneSignal
    // For now, just log the notification
    logger.debug('Push notification (not implemented):', pushData);
    
    // Example FCM implementation:
    // const message = {
    //   notification: {
    //     title: pushData.title,
    //     body: pushData.body
    //   },
    //   data: pushData.data,
    //   token: userDeviceToken
    // };
    // await admin.messaging().send(message);
    
    return true;
  }

  /**
   * Send order notification
   * @param {string} userId - User ID
   * @param {Object} order - Order object
   * @param {string} status - Order status
   */
  async sendOrderNotification(userId, order, status) {
    const statusMessages = {
      pending: 'Your order has been placed successfully',
      confirmed: 'Your order has been confirmed',
      processing: 'Your order is being processed',
      shipped: 'Your order has been shipped',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled'
    };

    const title = 'Order Update';
    const message = `${statusMessages[status]} - Order #${order.order_number}`;

    await this.sendNotification({
      userId,
      type: 'order_update',
      title,
      message,
      data: { orderId: order.id, orderNumber: order.order_number, status },
      relatedId: order.id,
      relatedType: 'order',
      email: {
        html: `
          <h2>${title}</h2>
          <p>${message}</p>
          <p><strong>Order Total:</strong> GHS ${order.total_amount}</p>
          <p>Track your order at: ${process.env.FRONTEND_URL}/orders/${order.id}</p>
        `
      },
      sms: {
        text: `${message}. Track at: ${process.env.FRONTEND_URL}/orders/${order.id}`
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
      relatedType: 'user'
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
      relatedType: 'review'
    });
  }
}

module.exports = new NotificationService();
