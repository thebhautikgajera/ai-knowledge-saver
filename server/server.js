import 'dotenv/config';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { initRedis, getRedisClient } from './src/utils/redis.js';

// List of important environment variables used by the server.
// This does NOT log the actual values, only whether they are present.
const REQUIRED_ENV_VARS = [
  'PORT',
  'MONGODB_URI',
  'REDIS_URL',
  'ACCESS_SECRET',
  'REFRESH_SECRET',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ACCESS_TOKEN_EXPIRY',
  'REFRESH_TOKEN_EXPIRY',
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USERNAME',
  'MAIL_PASSWORD',
  'MAIL_MAILER',
  'MAIL_FROM_ADDRESS',
  'MAIL_FROM_NAME',
  'EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES',
];

const logEnvStatus = () => {
  console.log('🔐 Environment configuration check (server side):');

  const missing = [];

  REQUIRED_ENV_VARS.forEach((key) => {
    if (process.env[key] === undefined || process.env[key] === null || process.env[key] === '') {
      missing.push(key);
      console.warn(`  - ${key}: MISSING`);
    } else {
      console.log(`  - ${key}: OK`);
    }
  });

  if (missing.length === 0) {
    console.log('✅ All required environment variables are set.');
  } else {
    console.warn(`⚠️ Some environment variables are missing: ${missing.join(', ')}`);
  }
};

const PORT = process.env.PORT || 4000;

// Start server
const startServer = async () => {
  try {
    // Log environment variable status once at startup (for debugging / verification)
    logEnvStatus();

    // Connect to MongoDB
    await connectDB();

    // Initialize Redis
    const redisClient = initRedis();
    if (!redisClient) {
      // Caching will be disabled
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      // Server started
    });

    return server;
  } catch (error) {
    // If startup fails, exit with non-zero code
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      // Ignore Redis close errors during shutdown
    }
  }
  await disconnectDB();
};

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

startServer();

export default app;

