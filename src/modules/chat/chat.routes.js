const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { body, param } = require('express-validator');

// All chat routes require authentication
router.use(authMiddleware);

// Get all chats for the user
router.get('/', chatController.getChats);

// Initiate a chat
router.post('/initiate',
  [
    body('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  chatController.initiateChat
);

// Get messages for a specific chat
router.get('/:chatId/messages',
  [
    param('chatId').isMongoId().withMessage('Invalid chat ID'),
    validate
  ],
  chatController.getMessages
);

// Send a message in a specific chat
router.post('/:chatId/messages',
  [
    param('chatId').isMongoId().withMessage('Invalid chat ID'),
    body('content').notEmpty().withMessage('Message content is required'),
    validate
  ],
  chatController.sendMessage
);

module.exports = router;
