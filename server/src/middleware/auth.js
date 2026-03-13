import { verifyAccessToken } from '../utils/jwt.js';
import { isAccessTokenBlacklisted } from '../utils/tokenBlacklist.js';

/**
 * Auth Middleware
 * 
 * Extracts and verifies JWT token from Authorization header
 * Attaches auth info to req.auth for use in route handlers
 * 
 * Usage: app.use('/api/private', requireAuth, privateRouter);
 */

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      ok: false,
      error: 'Missing authorization header',
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'Missing token',
    });
  }

  try {
    // Check Redis-based blacklist before verifying token
    const blacklisted = await isAccessTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({
        ok: false,
        error: 'Token revoked',
      });
    }

    const decoded = await verifyAccessToken(token);
    req.auth = {
      userId: decoded.sub || decoded.id,
      role: decoded.role,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion,
    };
    next();
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid token',
    });
  }
};
