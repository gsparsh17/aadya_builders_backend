const redis = require('redis');
const logger = require('../utils/logger');

let client = null;
let isConnected = false;

/**
 * Create Redis client
 */
const createRedisClient = () => {
  const client = redis.createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 20) {
          logger.error('Redis: Too many connection attempts, giving up');
          return new Error('Too many retries');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  client.on('connect', () => {
    logger.info('Redis: Connecting...');
  });

  client.on('ready', () => {
    isConnected = true;
    logger.info('Redis: Connected and ready');
  });

  client.on('error', (err) => {
    logger.error('Redis error:', err);
  });

  client.on('end', () => {
    isConnected = false;
    logger.warn('Redis: Connection closed');
  });

  return client;
};

/**
 * Get Redis client (singleton)
 */
const getRedisClient = async () => {
  if (!client) {
    client = createRedisClient();
    await client.connect();
  }
  return client;
};

/**
 * Cache middleware for Express
 */
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const redisClient = await getRedisClient();
      const key = `cache:${req.originalUrl}`;
      
      const cachedResponse = await redisClient.get(key);
      
      if (cachedResponse) {
        const data = JSON.parse(cachedResponse);
        return res.json(data);
      }
      
      // Store original send function
      const originalSend = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        if (res.statusCode === 200) {
          redisClient.setEx(key, duration, JSON.stringify(data))
            .catch(err => logger.error('Redis cache set error:', err));
        }
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Redis cache middleware error:', error);
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
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.debug(`Cleared ${keys.length} cache keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error('Redis clear cache error:', error);
  }
};

module.exports = {
  getRedisClient,
  cacheMiddleware,
  clearCache,
};