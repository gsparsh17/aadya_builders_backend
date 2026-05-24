const oneSignalService = require('../../utils/onesignal.service');
const { successResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const Notification = require('./notification.model');

class NotificationController {
  /**
   * Broadcast a notification to all app users (Admin only)
   * @route POST /api/v1/notifications/broadcast
   */
  async broadcastNotification(req, res, next) {
    try {
      const { title, message, data } = req.body;

      if (!title || !message) {
        return next(new AppError('Title and message are required', 400));
      }

      const response = await oneSignalService.sendBroadcastNotification(title, message, data || {});

      if (!response) {
        return next(new AppError('Failed to send broadcast notification', 500));
      }

      return successResponse(res, response, 'Broadcast notification sent successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a personalized welcome push notification to the current user
   * @route POST /api/v1/notifications/welcome
   */
  async sendWelcomePush(req, res, next) {
    try {
      const userId = req.user._id;
      const User = require('../users/user.model');
      const user = await User.findById(userId);

      if (user) {
        const title = `Welcome to Aadya Acres, ${user.name.split(' ')[0]}! 👋`;
        const message = "Explore the best real estate properties tailored just for you.";
        
        // Save to DB
        await Notification.create({
          recipient: userId,
          title,
          message,
          type: 'welcome'
        });

        // Send push
        await oneSignalService.sendPushNotification(
          [userId.toString()],
          title,
          message
        );
      }

      return successResponse(res, null, 'Welcome push triggered');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch all notifications for the logged-in user
   * @route GET /api/v1/notifications
   */
  async getMyNotifications(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments({ recipient: req.user._id });
      const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });

      return successResponse(res, {
        notifications,
        unreadCount,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }, 'Notifications fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a notification as read
   * @route PATCH /api/v1/notifications/:id/read
   */
  async markAsRead(req, res, next) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user._id },
        { read: true },
        { new: true }
      );

      if (!notification) {
        return next(new AppError('Notification not found', 404));
      }

      return successResponse(res, notification, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Send a property recommendation to a user or all users
   * @route POST /api/v1/notifications/recommendation
   */
  async sendPropertyRecommendation(req, res, next) {
    try {
      const { title, message, propertyId, userIds } = req.body; // userIds is array. If empty, send to all (broadcast)

      if (!title || !message || !propertyId) {
        return next(new AppError('Title, message, and propertyId are required', 400));
      }

      const payload = { type: 'recommendation', relatedId: propertyId };

      if (userIds && userIds.length > 0) {
        // Targeted
        const notifications = userIds.map(id => ({
          recipient: id,
          title,
          message,
          type: 'recommendation',
          relatedId: propertyId
        }));
        await Notification.insertMany(notifications);
        await oneSignalService.sendPushNotification(userIds, title, message, payload);
      } else {
        // Broadcast to all users in DB
        const User = require('../users/user.model');
        const allUsers = await User.find({ isActive: true }).select('_id');
        const notifications = allUsers.map(u => ({
          recipient: u._id,
          title,
          message,
          type: 'recommendation',
          relatedId: propertyId
        }));
        await Notification.insertMany(notifications);
        await oneSignalService.sendBroadcastNotification(title, message, payload);
      }

      return successResponse(res, null, 'Property recommendation sent');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
