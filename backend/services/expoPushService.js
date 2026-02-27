// services/expoPushService.js
const { Expo } = require('expo-server-sdk');
const { logger } = require('../config/logger');
const repositories = require('../db/repositories');

class ExpoPushService {
    constructor() {
        this.expo = new Expo();
    }

    /**
     * Send push notification to user's registered tokens
     * @param {string} userId
     * @param {Object} payload 
     *    { title, body, data }
     */
    async sendPushNotificationToUser(userId, payload) {
        try {
            // 1. Fetch user's push tokens from the DB
            const tokens = await repositories.notifications.getUserPushTokens(userId);
            if (!tokens || tokens.length === 0) {
                return false;
            }

            const messages = [];
            for (let pushToken of tokens) {
                if (!Expo.isExpoPushToken(pushToken)) {
                    logger.warn(`Push token ${pushToken} is not a valid Expo push token`);
                    // optionally remove invalid token
                    await repositories.notifications.removePushToken(pushToken);
                    continue;
                }

                messages.push({
                    to: pushToken,
                    sound: 'default',
                    title: payload.title,
                    body: payload.body,
                    data: payload.data, // This is where we pass notificationId, messageId, etc.
                });
            }

            if (messages.length === 0) return false;

            // 2. Chunk messages
            const chunks = this.expo.chunkPushNotifications(messages);
            const tickets = [];

            // 3. Send chunks to Expo
            for (let chunk of chunks) {
                try {
                    const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                    tickets.push(...ticketChunk);
                } catch (error) {
                    logger.error('Error sending push notification chunk', error);
                }
            }

            // 4. (Optional) Check receipts later. For simple robust handling, we check tickets here to clean up unregistered tokens.
            for (let i = 0; i < tickets.length; i++) {
                const ticket = tickets[i];
                if (ticket.status === 'error') {
                    logger.error(`Error sending to device: ${ticket.message}`);
                    if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                        // The user uninstalled the app or app data was cleared. 
                        // Cleanup the token from our DB.
                        const tokenToRemove = messages[i].to;
                        await repositories.notifications.removePushToken(tokenToRemove);
                    }
                }
            }

            return true;

        } catch (error) {
            logger.error('ExpoPushService error:', error);
            return false;
        }
    }
}

module.exports = new ExpoPushService();
