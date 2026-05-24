const axios = require('axios');
const logger = require('./logger');

class OneSignalService {
  constructor() {
    this.appId = process.env.ONE_SIGNAL_APP_ID;
    this.apiKey = process.env.ONE_SIGNAL_REST_API_KEY;
    this.baseUrl = 'https://onesignal.com/api/v1/notifications';
  }

  /**
   * Send a push notification to specific users by their backend user IDs (external IDs)
   * @param {Array<String>} userIds - Array of MongoDB ObjectIds as strings
   * @param {String} title - Notification title
   * @param {String} message - Notification body
   * @param {Object} additionalData - Custom JSON data to send with notification
   */
  async sendPushNotification(userIds, title, message, additionalData = {}) {
    if (!this.appId || !this.apiKey) {
      logger.warn('OneSignal credentials not configured. Skipping push notification.');
      return;
    }

    if (!userIds || userIds.length === 0) return;

    try {
      const payload = {
        app_id: this.appId,
        include_aliases: {
          external_id: userIds
        },
        target_channel: "push",
        headings: { en: title },
        contents: { en: message },
        data: additionalData,
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${this.apiKey}`
        }
      });

      logger.info(`OneSignal push sent to ${userIds.length} users. Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to send OneSignal push notification:', error.response ? error.response.data : error.message);
    }
  }

  /**
   * Send a push notification to ALL subscribed users (Admin Broadcast)
   */
  async sendBroadcastNotification(title, message, additionalData = {}) {
    if (!this.appId || !this.apiKey) {
      logger.warn('OneSignal credentials not configured. Skipping broadcast.');
      return;
    }

    try {
      const payload = {
        app_id: this.appId,
        included_segments: ["Total Subscriptions"],
        headings: { en: title },
        contents: { en: message },
        data: additionalData,
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${this.apiKey}`
        }
      });

      logger.info(`OneSignal broadcast sent. Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to send OneSignal broadcast notification:', error.response ? error.response.data : error.message);
    }
  }
}

module.exports = new OneSignalService();
