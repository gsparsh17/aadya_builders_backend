const redis = require('redis');
const logger = require('../utils/logger');

let client = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 3;

/**
 * Create Redis client
 */
const createRedisClient = () => {
  const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
      reconnectStrategy: (retries) => {
        connectionAttempts = retries;
        if (retries > MAX_ATTEMPTS) {
          logger.warn('Redis: Not available, continuing without cache');
          return false; // Stop reconnecting
        }
        return Math.min(retries * 100, 1000);
      },
      connectTimeout: 5000, // 5 seconds timeout
    },
  });

  client.on('connect', () => {
    logger.info('Redis: Connecting...');
  });

  client.on('ready', () => {
    isConnected = true;
    connectionAttempts = 0;
    logger.info('Redis: Connected and ready');
  });

  client.on('error', (err) => {
    if (connectionAttempts <= MAX_ATTEMPTS) {
      logger.warn('Redis connection error (continuing without cache):', err.message);
    }
  });

  client.on('end', () => {
    isConnected = false;
    logger.info('Redis: Connection closed');
  });

  return client;
};

/**
 * Get Redis client (singleton) - Returns null if not available
 */
const getRedisClient = async () => {
  // Skip Redis in development if not configured
  if (process.env.SKIP_REDIS === 'true') {
    return null;
  }
  
  if (!client) {
    client = createRedisClient();
    try {
      await client.connect();
    } catch (error) {
      logger.warn('Redis not available, continuing without cache');
      client = null;
      return null;
    }
  }
  return client;
};

/**
 * Cache middleware for Express
 */
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const redisClient = await getRedisClient();
      if (!redisClient) {
        return next(); // Skip cache if Redis not available
      }
      
      const key = `cache:${req.originalUrl}`;
      const cachedResponse = await redisClient.get(key);
      
      if (cachedResponse) {
        const data = JSON.parse(cachedResponse);
        return res.json(data);
      }
      
      const originalSend = res.json;
      
      res.json = function(data) {
        if (res.statusCode === 200) {
          redisClient.setEx(key, duration, JSON.stringify(data))
            .catch(err => logger.error('Redis cache set error:', err));
        }
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      next();
    }
  };
};

/**
 * Clear cache by pattern
 */
const clearCache = async (pattern) => {
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) {
      return; // Skip if Redis not available
    }
    
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.debug(`Cleared ${keys.length} cache keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    // Silently fail - cache clearing is not critical
  }
};

module.exports = {
  getRedisClient,
  cacheMiddleware,
  clearCache,
};