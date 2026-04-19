const mongoose = require('mongoose');
const logger = require('../utils/logger');

// MongoDB connection options
const options = {
  autoIndex: process.env.NODE_ENV !== 'production', // Don't build indexes in production
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
};

// Connection state tracking
let isConnected = false;

/**
 * Connect to MongoDB
 */
const connectDatabase = async () => {
  if (isConnected) {
    logger.info('Using existing database connection');
    return;
  }

  const uri = process.env.NODE_ENV === 'test' 
    ? process.env.MONGODB_TEST_URI 
    : process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MongoDB URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(uri, options);
    isConnected = true;
    logger.info(`MongoDB connected: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDatabase = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnection error:', error);
    throw error;
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to database');
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from database');
  isConnected = false;
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getConnection: () => mongoose.connection,
};