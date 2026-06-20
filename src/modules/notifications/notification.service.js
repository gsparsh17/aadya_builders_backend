const Notification = require('./notification.model');
const User = require('../users/user.model');
const oneSignalService = require('../../utils/onesignal.service');
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Send alerts to users whose preferences match the newly active property or project.
   * @param {Object} item - The Property or Project document
   * @param {String} itemType - 'property' or 'project'
   */
  async sendListingAlert(item, itemType) {
    try {
      const city = itemType === 'property' ? item.location?.city : item.city;
      if (!city) return;

      // Find users matching this city who have property alerts enabled
      const users = await User.find({
        'preferences.preferredLocations.city': { $regex: new RegExp(`^${city}$`, 'i') },
        'preferences.notificationPreferences.propertyAlerts': true,
        isActive: true,
        isBlocked: false,
        _id: { $ne: itemType === 'property' ? item.owner : item.builder } // Don't notify the creator
      }).select('_id');

      if (!users || users.length === 0) {
        logger.info(`No matching users found for new ${itemType} in ${city}.`);
        return;
      }

      const userIds = users.map(user => user._id.toString());

      // Construct notification details
      let title, message;
      if (itemType === 'property') {
        const typeStr = item.propertyType ? item.propertyType.replace('_', ' ') : 'Property';
        const purposeStr = item.purpose === 'rent' ? 'for rent' : 'for sale';
        title = `New ${typeStr} in ${city}!`;
        message = `A new ${typeStr} ${purposeStr} was just added near you. Tap to check it out.`;
      } else {
        title = `New Project in ${city}!`;
        message = `${item.name} was just announced. Explore units and pricing now!`;
      }

      // Save to Notification database for each user
      const notificationsToInsert = userIds.map(userId => ({
        recipient: userId,
        title,
        message,
        type: 'recommendation',
        relatedId: item._id,
        data: { itemType, itemId: item._id.toString() }
      }));

      await Notification.insertMany(notificationsToInsert);

      // Push via OneSignal
      await oneSignalService.sendPushNotification(
        userIds,
        title,
        message,
        { type: 'recommendation', itemType, itemId: item._id.toString() }
      );

      logger.info(`Sent ${itemType} alert to ${userIds.length} users in ${city}.`);
    } catch (error) {
      logger.error(`Failed to send listing alert for ${itemType}:`, error);
    }
  }
}

module.exports = new NotificationService();
