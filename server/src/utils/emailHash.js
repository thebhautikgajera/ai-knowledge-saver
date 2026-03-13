import crypto from 'crypto';

/**
 * Hash email for privacy-preserving rate limiting
 * Uses SHA-256 with a salt from environment variables
 * 
 * @param {string} email - Email address to hash
 * @returns {string} Hashed email (hex string)
 */
export const hashEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const salt = process.env.RATE_SALT;
  
  const hash = crypto.createHash('sha256');
  hash.update(normalizedEmail + salt);
  return hash.digest('hex');
};

/**
 * Extract email from request body (supports multiple field names)
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Email address or null if not found
 */
export const extractEmailFromRequest = (req) => {
  const body = req.body || {};
  const query = req.query || {};
  
  return body.email || body.oldEmail || body.newEmail || 
         (typeof query.email === 'string' ? query.email : null);
};

