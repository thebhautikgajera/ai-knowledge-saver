import Redis from 'ioredis';

/**
 * Shared Redis Client Utility
 * 
 * Provides a singleton Redis client instance for use across the application.
 * This replaces in-memory caching with Redis for better scalability and persistence.
 */

let redisClient = null;

/**
 * Initialize Redis client
 * @returns {Redis|null} Redis client instance or null if initialization fails
 */
export const initRedis = () => {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  try {
    const REDIS_URL = process.env.REDIS_URL;
    
    if (!REDIS_URL) {
      console.error('[REDIS] REDIS_URL environment variable is not set');
      return null;
    }

    redisClient = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready');
    });

    redisClient.on('close', () => {
      console.warn('[REDIS] Connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('[REDIS] Failed to initialize:', error.message);
    redisClient = null;
    return null;
  }
};

/**
 * Get Redis client instance
 * @returns {Redis|null} Redis client instance or null if not initialized
 */
export const getRedisClient = () => {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
};

/**
 * Check if Redis is available and ready
 * @returns {boolean} True if Redis is ready, false otherwise
 */
export const isRedisReady = () => {
  return redisClient && redisClient.status === 'ready';
};

/**
 * Cache helper: Get value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if not found
 */
export const getCache = async (key) => {
  const client = getRedisClient();
  if (!client || !isRedisReady()) {
    throw new Error('Redis is not available');
  }

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`[REDIS] Get error for key ${key}:`, error.message);
    throw error;
  }
};

/**
 * Cache helper: Set value in Redis with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (default: 300)
 * @returns {Promise<void>}
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
  const client = getRedisClient();
  if (!client || !isRedisReady()) {
    throw new Error('Redis is not available');
  }

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`[REDIS] Set error for key ${key}:`, error.message);
    throw error;
  }
};

/**
 * Cache helper: Delete value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
export const deleteCache = async (key) => {
  const client = getRedisClient();
  if (!client || !isRedisReady()) {
    throw new Error('Redis is not available');
  }

  try {
    await client.del(key);
  } catch (error) {
    console.error(`[REDIS] Delete error for key ${key}:`, error.message);
    throw error;
  }
};

/**
 * Cache helper: Check if key exists in Redis
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if key exists, false otherwise
 */
export const existsCache = async (key) => {
  const client = getRedisClient();
  if (!client || !isRedisReady()) {
    throw new Error('Redis is not available');
  }

  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`[REDIS] Exists error for key ${key}:`, error.message);
    throw error;
  }
};

// Initialize Redis on module load
initRedis();

