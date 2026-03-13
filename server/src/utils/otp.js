import crypto from 'crypto';

/**
 * Generate a secure 6‑digit numeric OTP as a zero‑padded string.
 * Uses Node's crypto.randomInt for cryptographically strong randomness.
 */
export const generateOtp = () => {
  const otpNumber = crypto.randomInt(0, 1_000_000); // 0..999999
  return otpNumber.toString().padStart(6, '0');
};

export default {
  generateOtp,
};

