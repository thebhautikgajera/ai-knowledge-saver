import crypto from 'crypto';
import { getRedisClient, isRedisReady } from './redis.js';

const SESSION_PREFIX = 'session:';
const SESSION_TTL_SECONDS =
  parseInt(process.env.SESSION_TTL_SECONDS, 10) || 60 * 60 * 24 * 30; // 30 days

const getClient = () => {
  const client = getRedisClient();
  if (!client || !isRedisReady()) {
    throw new Error('Redis is not available for session storage');
  }
  return client;
};

export const createSession = async (userId) => {
  const client = getClient();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const key = `${SESSION_PREFIX}${sessionId}`;

  const payload = {
    userId: String(userId),
    createdAt: new Date().toISOString(),
  };

  await client.setex(key, SESSION_TTL_SECONDS, JSON.stringify(payload));
  return sessionId;
};

export const getSession = async (sessionId) => {
  if (!sessionId) return null;
  const client = getClient();
  const key = `${SESSION_PREFIX}${sessionId}`;
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const destroySession = async (sessionId) => {
  if (!sessionId) return;
  const client = getClient();
  const key = `${SESSION_PREFIX}${sessionId}`;
  await client.del(key);
};

