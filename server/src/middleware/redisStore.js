import { getRedisClient, isRedisReady } from '../utils/redis.js';

/**
 * Redis store adapter for express-rate-limit
 * Provides atomic counters and persistence for multi-instance deployments
 */
export class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rate-limit:';
    this.client = null;
  }

  /**
   * Get Redis client (lazy initialization)
   */
  getClient() {
    if (!this.client && isRedisReady()) {
      this.client = getRedisClient();
    }
    return this.client;
  }

  /**
   * Increment counter and return current count
   * @param {string} key - Rate limit key
   * @param {number} windowMs - Window size in milliseconds
   * @returns {Promise<{totalHits: number, resetTime: Date}>}
   */
  async increment(key) {
    const client = this.getClient();
    if (!client) {
      // Fallback to in-memory if Redis unavailable
      throw new Error('Redis not available');
    }

    const fullKey = `${this.prefix}${key}`;
    const windowSeconds = Math.ceil(parseInt(process.env.RATE_WINDOW_SECONDS, 10));

    try {
      // Use Redis INCR with EXPIRE for atomic operations
      const multi = client.multi();
      multi.incr(fullKey);
      multi.expire(fullKey, windowSeconds);
      const results = await multi.exec();

      if (!results || results.length === 0) {
        throw new Error('Redis increment failed');
      }

      const totalHits = results[0][1] || 1;
      const resetTime = new Date(Date.now() + windowSeconds * 1000);

      return {
        totalHits,
        resetTime,
      };
    } catch (error) {
      console.error('[RATE_LIMIT] Redis increment error:', error.message);
      throw error;
    }
  }

  /**
   * Decrement counter (for skipSuccessfulRequests)
   * @param {string} key - Rate limit key
   */
  async decrement(key) {
    const client = this.getClient();
    if (!client) return;

    const fullKey = `${this.prefix}${key}`;
    try {
      await client.decr(fullKey);
    } catch (error) {
      console.error('[RATE_LIMIT] Redis decrement error:', error.message);
    }
  }

  /**
   * Reset counter for a key
   * @param {string} key - Rate limit key
   */
  async resetKey(key) {
    const client = this.getClient();
    if (!client) return;

    const fullKey = `${this.prefix}${key}`;
    try {
      await client.del(fullKey);
    } catch (error) {
      console.error('[RATE_LIMIT] Redis reset error:', error.message);
    }
  }

  /**
   * Shutdown store (cleanup)
   */
  shutdown() {
    // Redis client is managed globally, no cleanup needed here
  }
}

