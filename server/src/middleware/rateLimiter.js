import rateLimit from 'express-rate-limit';
import { getRedisClient, isRedisReady } from '../utils/redis.js';
import { createAdvancedOtpLimiter, createOtpResendLimiter } from './advancedRateLimiter.js';

/**
 * Get Redis store for express-rate-limit
 * Falls back to in-memory if Redis unavailable
 */
const getStore = (prefix = 'rate-limit:') => {
  if (!isRedisReady()) {
    return undefined; // Use default in-memory store
  }

  const client = getRedisClient();
  if (!client) {
    return undefined;
  }

  // Custom Redis store adapter
  return {
    async increment(key) {
      const fullKey = `${prefix}${key}`;
      // Use environment variable or calculate from windowMs if provided
      const windowSeconds = parseInt(process.env.RATE_WINDOW_SECONDS, 10);

      try {
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
    },
    async decrement(key) {
      const fullKey = `${prefix}${key}`;
      try {
        await client.decr(fullKey);
      } catch (error) {
        console.error('[RATE_LIMIT] Redis decrement error:', error.message);
      }
    },
    async resetKey(key) {
      const fullKey = `${prefix}${key}`;
      try {
        await client.del(fullKey);
      } catch (error) {
        console.error('[RATE_LIMIT] Redis reset error:', error.message);
      }
    },
    shutdown() {
      // Redis client managed globally
    },
  };
};

// General API rate limiter (Redis store if available, fallback to in-memory)
export const createApiLimiter = () => {
  const windowMinutes = parseInt(process.env.API_RATE_WINDOW_MINUTES, 10);
  const maxRequests = parseInt(process.env.API_RATE_MAX_REQUESTS, 10);
  const store = getStore('rate-limit:api:');

  return rateLimit({
    store,
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      ok: false,
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Auth endpoints rate limiter (stricter, Redis store if available)
export const createAuthLimiter = () => {
  const windowMinutes = parseInt(process.env.AUTH_RATE_WINDOW_MINUTES, 10);
  const maxRequests = parseInt(process.env.AUTH_RATE_MAX_REQUESTS, 10);
  const store = getStore('rate-limit:auth:');

  return rateLimit({
    store,
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      ok: false,
      error: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
};

// OTP-related endpoints limiter (advanced: Redis + dual-layer + exponential backoff)
// Protects email verification, password reset & OTP resend from abuse / brute-force
  export const createOtpLimiter = () => {
    const windowMinutes = parseInt(process.env.OTP_RATE_WINDOW_MINUTES, 10);
  const maxRequests = parseInt(process.env.OTP_RATE_MAX_REQUESTS, 10);

  return createAdvancedOtpLimiter({
    windowMinutes,
    maxRequests,
    endpoint: 'otp',
    enableResendLimit: false, // Only enable for resend endpoints
  });
};

// OTP resend limiter (with resend frequency limits)
export const createOtpResendLimiterWrapper = () => {
  const windowMinutes = parseInt(process.env.OTP_RATE_WINDOW_MINUTES, 10);
  const maxRequests = parseInt(process.env.OTP_RATE_MAX_REQUESTS, 10);

  return createOtpResendLimiter({
    windowMinutes,
    maxRequests,
    endpoint: 'otp-resend',
    enableResendLimit: true, // Always enable for resend endpoints
  });
};

// Password reset limiter (more lenient - allows first-time requests)
// Only applies strict limits after multiple attempts to prevent abuse
export const createPasswordResetLimiter = () => {
  const windowMinutes = parseInt(process.env.PASSWORD_RESET_RATE_WINDOW_MINUTES, 10);
  const maxRequests = parseInt(process.env.PASSWORD_RESET_RATE_MAX_REQUESTS, 10);
  const store = getStore('rate-limit:password-reset:');

  return rateLimit({
    store,
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests, // More lenient: 10 requests per 15 minutes
    message: {
      success: false,
      message: 'Too many password reset requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    // Use IP-based limiting only (no email-based backoff for first requests)
    keyGenerator: (req) => `ip:${req.ip}`,
  });
};