const Chat = require('./chat.model');
const Property = require('../properties/property.model');
const User = require('../users/user.model');
const { AppError } = require('../../middlewares/errorHandler');
const { successResponse } = require('../../utils/responseHandler');
const oneSignalService = require('../../utils/onesignal.service');

/**
 * Initiate or fetch a chat for a property
 */
exports.initiateChat = async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    const buyerId = req.user._id;

    if (!propertyId) {
      return next(new AppError('Property ID is required', 400));
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return next(new AppError('Property not found', 404));
    }

    let ownerId = property.owner;

    if (!ownerId) {
      return next(new AppError('This property does not have an owner assigned', 400));
    }
    
    if (ownerId._id) {
      ownerId = ownerId._id;
    }

    if (buyerId.toString() === ownerId.toString()) {
      return next(new AppError('You cannot chat with yourself about your own property', 400));
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      property: propertyId,
      buyer: buyerId,
      owner: ownerId
    }).populate('property', 'title images price location.city location.locality')
      .populate('buyer', 'name profilePicture')
      .populate('owner', 'name profilePicture');

    if (!chat) {
      chat = await Chat.create({
        property: propertyId,
        buyer: buyerId,
        owner: ownerId,
        messages: []
      });
      chat = await chat.populate([
        { path: 'property', select: 'title images price location.city location.locality' },
        { path: 'buyer', select: 'name profilePicture' },
        { path: 'owner', select: 'name profilePicture' }
      ]);
    }

    return successResponse(res, { chat }, 'Chat initiated successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all chats for the current user
 */
exports.getChats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      $or: [{ buyer: userId }, { owner: userId }]
    })
    .populate('property', 'title images price location.city location.locality')
    .populate('buyer', 'name profilePicture')
    .populate('owner', 'name profilePicture')
    .sort('-lastMessageAt');

    return successResponse(res, { chats }, 'Chats retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message in a chat
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const senderId = req.user._id;

    if (!content) {
      return next(new AppError('Message content is required', 400));
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(new AppError('Chat not found', 404));
    }

    // Verify user is part of the chat
    const isBuyer = chat.buyer.toString() === senderId.toString();
    const isOwner = chat.owner.toString() === senderId.toString();

    if (!isBuyer && !isOwner) {
      return next(new AppError('You are not authorized to send messages in this chat', 403));
    }

    const newMessage = {
      sender: senderId,
      content,
      isRead: false
    };

    chat.messages.push(newMessage);
    chat.lastMessageAt = Date.now();
    await chat.save();

    // Receiver ID for notifications
    const receiverId = isBuyer ? chat.owner.toString() : chat.buyer.toString();

    // Trigger Push Notification
    const pushMessage = `New message from ${req.user.name.split(' ')[0]}`;
    oneSignalService.sendPushNotification(
      [receiverId.toString()],
      "Aadya Acres Chat",
      pushMessage,
      { type: 'chat', chatId: chat._id.toString() }
    ).catch(err => console.error('Push notification failed:', err));

    // Save to Notification DB
    const Notification = require('../notifications/notification.model');
    Notification.create({
      recipient: receiverId,
      title: "New Message",
      message: pushMessage,
      type: 'chat',
      relatedId: chat._id
    }).catch(err => console.error('Notification DB save failed:', err));

    return successResponse(res, { 
      message: chat.messages[chat.messages.length - 1] 
    }, 'Message sent successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages for a chat
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId)
      .populate('messages.sender', 'name profilePicture');
      
    if (!chat) {
      return next(new AppError('Chat not found', 404));
    }

    // Verify user is part of the chat
    if (chat.buyer.toString() !== userId.toString() && chat.owner.toString() !== userId.toString()) {
      return next(new AppError('You are not authorized to view messages in this chat', 403));
    }

    // Mark messages as read
    let hasUnread = false;
    chat.messages.forEach(msg => {
      if (msg.sender._id.toString() !== userId.toString() && !msg.isRead) {
        msg.isRead = true;
        hasUnread = true;
      }
    });

    if (hasUnread) {
      // Avoid triggering full validation, just save the modified fields
      await chat.save();
    }

    return successResponse(res, { 
      messages: chat.messages 
    }, 'Messages retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};
