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

      // Get image
      const imageUrl = item.images && item.images.length > 0 ? item.images[0].url : null;

      // Save to Notification database for each user
      const notificationsToInsert = userIds.map(userId => ({
        recipient: userId,
        title,
        message,
        type: itemType === 'property' ? 'recommendation' : 'project_recommendation',
        relatedId: item._id,
        data: { itemType, itemId: item._id.toString(), imageUrl }
      }));

      await Notification.insertMany(notificationsToInsert);

      // Push via OneSignal
      await oneSignalService.sendPushNotification(
        userIds,
        title,
        message,
        { type: itemType === 'property' ? 'recommendation' : 'project_recommendation', itemType, itemId: item._id.toString(), imageUrl },
        imageUrl
      );

      logger.info(`Sent ${itemType} alert to ${userIds.length} users in ${city}.`);
    } catch (error) {
      logger.error(`Failed to send listing alert for ${itemType}:`, error);
    }
  }

  /**
   * Generates notifications for properties and projects matching the user's city.
   * Runs whenever the user opens the app (requested in getMyNotifications).
   * Ensures no duplicates are created.
   * @param {String} userId - The user ID
   * @param {String} [queryCity] - Optional city sent by the frontend
   */
  async generateCityNotifications(userId, queryCity) {
    try {
      const Property = require('../properties/property.model');
      const Project = require('../projects/project.model');

      const user = await User.findById(userId);
      if (!user) return;

      // Extract city from address or preferredLocations
      let city = user.address?.city;
      if (!city && user.preferences?.preferredLocations?.length > 0) {
        city = user.preferences.preferredLocations[0].city;
      }

      // If queryCity is passed from frontend, and user city is empty or different, update the user profile in DB!
      if (queryCity && queryCity.trim() !== '') {
        const normalizedQueryCity = queryCity.trim();
        if (!city || city.toLowerCase() !== normalizedQueryCity.toLowerCase()) {
          user.address = user.address || {};
          user.address.city = normalizedQueryCity;
          
          user.preferences = user.preferences || {};
          user.preferences.preferredLocations = [{ city: normalizedQueryCity }];
          
          await user.save();
          city = normalizedQueryCity;
          logger.info(`Automatically updated city for user ${userId} to "${normalizedQueryCity}" in database.`);
        }
      }

      if (!city) {
        logger.info(`User ${userId} has no city stored in address or preferences. Skipping city notifications.`);
        return;
      }

      // Fetch the 5 most recent active properties in this city
      const properties = await Property.find({
        'location.city': { $regex: new RegExp(`^${city}$`, 'i') },
        status: 'active'
      })
      .sort({ createdAt: -1 })
      .limit(5);

      // Fetch the 5 most recent active projects in this city
      const projects = await Project.find({
        city: { $regex: new RegExp(`^${city}$`, 'i') },
        status: { $in: ['upcoming', 'under_construction', 'ready_to_move', 'completed'] }
      })
      .sort({ createdAt: -1 })
      .limit(5);

      // Process Properties
      for (const property of properties) {
        const exists = await Notification.exists({
          recipient: userId,
          relatedId: property._id
        });

        if (!exists) {
          const typeStr = property.propertyType ? property.propertyType.replace('_', ' ') : 'Property';
          const purposeStr = property.purpose === 'rent' ? 'for rent' : 'for sale';
          const title = `New ${typeStr} in ${city}!`;
          const message = `A new ${typeStr} ${purposeStr} was just added: ${property.title}. Tap to check it out.`;

          const imageUrl = property.images && property.images.length > 0 ? property.images[0].url : null;

          await Notification.create({
            recipient: userId,
            title,
            message,
            type: 'recommendation',
            relatedId: property._id,
            data: { itemType: 'property', itemId: property._id.toString(), imageUrl }
          });

          // Send push notification if user has push enabled
          if (user.preferences?.notificationPreferences?.push !== false) {
            await oneSignalService.sendPushNotification(
              [userId.toString()],
              title,
              message,
              { type: 'recommendation', itemType: 'property', itemId: property._id.toString(), imageUrl },
              imageUrl
            ).catch(err => logger.error('Failed to send push notification:', err));
          }
        }
      }

      // Process Projects
      for (const project of projects) {
        const exists = await Notification.exists({
          recipient: userId,
          relatedId: project._id
        });

        if (!exists) {
          const title = `New Project in ${city}!`;
          const message = `${project.name} was just announced. Explore units and pricing now!`;

          const imageUrl = project.images && project.images.length > 0 ? project.images[0].url : null;

          await Notification.create({
            recipient: userId,
            title,
            message,
            type: 'project_recommendation',
            relatedId: project._id,
            data: { itemType: 'project', itemId: project._id.toString(), imageUrl }
          });

          // Send push notification if user has push enabled
          if (user.preferences?.notificationPreferences?.push !== false) {
            await oneSignalService.sendPushNotification(
              [userId.toString()],
              title,
              message,
              { type: 'project_recommendation', itemType: 'project', itemId: project._id.toString(), imageUrl },
              imageUrl
            ).catch(err => logger.error('Failed to send push notification:', err));
          }
        }
      }

    } catch (error) {
      logger.error(`Failed to generate city notifications for user ${userId}:`, error);
    }
  }
}

module.exports = new NotificationService();
