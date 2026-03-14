import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import itemsRoutes from './routes/items.js';
import saveRoutes from './routes/save.js';
import { createApiLimiter } from './middleware/rateLimiter.js';

const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const EXTENSION_ORIGIN = process.env.EXTENSION_ORIGIN;

// CORS configuration (allow dashboard + extension origins)
const allowedOrigins = [FRONTEND_ORIGIN, EXTENSION_ORIGIN].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware
app.use(compression()); // Enable gzip compression
app.use(express.json());
app.use(cookieParser());

// Initialize rate limiter (synchronous, in-memory)
const apiLimiter = createApiLimiter();

// Apply rate limiter to all routes
app.use(apiLimiter);

// Login-specific rate limiter (stricter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    ok: false,
    error: 'Too many login attempts from this IP, please try again later',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Routes
// Apply login limiter specifically to login endpoint
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/items', itemsRoutes);
// Dedicated extension endpoint: POST /save (session cookie auth)
app.use('/save', saveRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal server error',
  });
});

export default app;

