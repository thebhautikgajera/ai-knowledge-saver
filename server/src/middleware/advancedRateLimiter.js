import rateLimit from 'express-rate-limit';
import { getRedisClient, isRedisReady } from '../utils/redis.js';

/**
 * Lightweight, auth-focused advanced rate limiter helpers.
 *
 * These are used only for OTP / email verification / password-reset flows.
 * They intentionally do NOT depend on Prometheus or any external metrics
 * so they remain stable in a minimal auth starter template.
 */

const buildRedisStore = (prefix, windowSeconds) => {
  if (!isRedisReady()) return undefined;

  const client = getRedisClient();
  if (!client) return undefined;

  return {
    async increment(key) {
      const fullKey = `${prefix}${key}`;

      const multi = client.multi();
      multi.incr(fullKey);
      multi.expire(fullKey, windowSeconds);
      const results = await multi.exec();

      if (!results || results.length === 0) {
        throw new Error('Redis increment failed');
      }

      const totalHits = results[0][1] || 1;
      const resetTime = new Date(Date.now() + windowSeconds * 1000);

      return { totalHits, resetTime };
    },
    async decrement(key) {
      const fullKey = `${prefix}${key}`;
      try {
        await client.decr(fullKey);
      } catch {
        // ignore
      }
    },
    async resetKey(key) {
      const fullKey = `${prefix}${key}`;
      try {
        await client.del(fullKey);
      } catch {
        // ignore
      }
    },
    shutdown() {
      // global client lifecycle handled elsewhere
    },
  };
};

const buildBaseOptions = ({ windowMinutes, maxRequests, prefix }) => {
  const windowMs = windowMinutes * 60 * 1000;
  const windowSeconds = windowMinutes * 60;
  const store = buildRedisStore(`rate-limit:${prefix}:`, windowSeconds);

  return {
    store,
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
  };
};

// Extract email-ish identifier from request for per-email limiting
const getEmailKey = (req) => {
  const email =
    req.body?.email ||
    req.body?.oldEmail ||
    req.body?.newEmail ||
    req.query?.email ||
    '';

  if (!email || typeof email !== 'string') return 'unknown';
  return email.toLowerCase().trim();
};

/**
 * createAdvancedOtpLimiter
 *
 * Returns an array of two middlewares: [ipLimiter, emailLimiter].
 * Both are express-rate-limit instances; the first limits per-IP,
 * the second per-email, sharing the same window/max configuration.
 */
export const createAdvancedOtpLimiter = ({
  windowMinutes,
  maxRequests,
  endpoint,
}) => {
  const base = buildBaseOptions({ windowMinutes, maxRequests, prefix: endpoint });

  const ipLimiter = rateLimit({
    ...base,
    keyGenerator: (req) => `ip:${req.ip}`,
    message: {
      success: false,
      message: 'Too many attempts from this IP, please try again later.',
    },
  });

  const emailLimiter = rateLimit({
    ...base,
    keyGenerator: (req) => `email:${getEmailKey(req)}`,
    message: {
      success: false,
      message: 'Too many attempts for this email, please try again later.',
    },
  });

  return [ipLimiter, emailLimiter];
};

/**
 * createOtpResendLimiter
 *
 * Similar to createAdvancedOtpLimiter but tuned for resend endpoints,
 * which typically need slightly stricter behavior per email.
 * Returns [ipLimiter, emailLimiter] so it can be spread in route defs.
 */
export const createOtpResendLimiter = ({
  windowMinutes,
  maxRequests,
  endpoint,
}) => {
  const base = buildBaseOptions({ windowMinutes, maxRequests, prefix: endpoint });

  const ipLimiter = rateLimit({
    ...base,
    keyGenerator: (req) => `ip:${req.ip}`,
    message: {
      success: false,
      message: 'Too many resend attempts from this IP, please wait before trying again.',
    },
  });

  const emailLimiter = rateLimit({
    ...base,
    keyGenerator: (req) => `email:${getEmailKey(req)}`,
    message: {
      success: false,
      message: 'You are requesting verification codes too frequently. Please wait a moment.',
    },
  });

  return [ipLimiter, emailLimiter];
};

/**
 * getRateLimitMetrics
 *
 * In the original full app this exposed Prometheus metrics. For the
 * minimal auth starter we provide a harmless stub so callers can safely
 * await it if needed without additional setup.
 */
export const getRateLimitMetrics = async () => {
  return null;
};

