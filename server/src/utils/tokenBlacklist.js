import { setCache, existsCache, isRedisReady } from './redis.js';

const ACCESS_BLACKLIST_PREFIX = 'blacklist:access:';

/**
 * Add an access token to the Redis blacklist.
 *
 * The key is stored with a TTL so it expires when the token would naturally
 * become invalid.
 *
 * @param {string} token - Raw JWT access token string
 * @param {number} ttlSeconds - Time-to-live in seconds
 */
export const blacklistAccessToken = async (token, ttlSeconds) => {
  if (!token) return;

  // If Redis isn't available, silently skip blacklisting (fail-open)
  if (!isRedisReady()) {
    return;
  }

  const safeTtl =
    typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.floor(ttlSeconds)
      : 3600; // default 1 hour

  const key = `${ACCESS_BLACKLIST_PREFIX}${token}`;

  try {
    // Value itself is irrelevant; we just need the key to exist
    await setCache(key, true, safeTtl);
  } catch (error) {
    // Don't break auth flow if Redis write fails
    console.warn(`[TOKEN_BLACKLIST] Failed to blacklist token: ${error.message}`);
  }
};

/**
 * Check if an access token is blacklisted in Redis.
 *
 * @param {string} token - Raw JWT access token string
 * @returns {Promise<boolean>} True if token is blacklisted, false otherwise
 */
export const isAccessTokenBlacklisted = async (token) => {
  if (!token) return false;

  if (!isRedisReady()) {
    // If Redis is down, we treat token as not blacklisted to avoid hard failures
    return false;
  }

  const key = `${ACCESS_BLACKLIST_PREFIX}${token}`;

  try {
    return await existsCache(key);
  } catch (error) {
    console.warn(`[TOKEN_BLACKLIST] Failed to check token blacklist: ${error.message}`);
    return false;
  }
};

