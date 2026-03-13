import express from 'express';
import { User } from '../models/User.js';
import { sendMail } from '../utils/mailer.js';
import {
  generateEmailVerificationOTPTemplate,
  generatePasswordResetOTPTemplate,
} from '../utils/otpTemplates.js';
import {
  createOtpLimiter,
  createOtpResendLimiterWrapper,
  createPasswordResetLimiter,
} from '../middleware/rateLimiter.js';
import { deleteCache, isRedisReady } from '../utils/redis.js';
import { generateOtp } from '../utils/otp.js';

const router = express.Router();

// Align with email copy: 10 minutes
const CODE_EXPIRY_MINUTES = 10;

// Advanced OTP limiters (returns array of middleware: [ipLimiter, emailLimiter])
const otpLimiters = createOtpLimiter();
const otpResendLimiters = createOtpResendLimiterWrapper();
// Password reset limiter (more lenient - allows first-time requests)
const passwordResetLimiter = createPasswordResetLimiter();

// Send OTP email using Nodemailer + MJML templates
const sendCodeToEmail = async (email, code, purpose) => {
  let subject;
  let html;

  if (purpose === 'password-reset') {
    subject = 'CineScope — Password reset code';
    html = generatePasswordResetOTPTemplate(code);
  } else {
    // Default to email verification template
    subject = 'CineScope — Email verification code';
    html = generateEmailVerificationOTPTemplate(code);
  }

  await sendMail({
    to: email,
    subject,
    html,
  });
};

// Forgot password: send reset code
// Uses lenient rate limiter that allows first-time requests
router.post('/forgot-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Do not leak whether the email exists; pretend success
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists for this email, a reset code has been sent.',
      });
    }

    const code = generateOtp();
    const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    user.passwordResetCode = code;
    user.passwordResetExpires = expires;
    await user.save();

    await sendCodeToEmail(user.email, code, 'password-reset');

    return res.json({
      success: true,
      message: 'Password reset OTP has been sent to your email.',
    });
  } catch (error) {
    next(error);
  }
});

// Reset password with code
// Uses lenient rate limiter that allows first-time requests
router.post('/reset-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (
      !user ||
      !user.passwordResetCode ||
      user.passwordResetCode !== otp ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    user.password = newPassword;
    user.passwordResetCode = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
});

// Resend email verification code (with resend frequency limits)
router.post('/resend-otp', ...otpResendLimiters, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User with this email was not found',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    const code = generateOtp();
    const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    user.emailVerificationCode = code;
    user.emailVerificationExpires = expires;
    await user.save();

    await sendCodeToEmail(user.email, code, 'email-verification');

    return res.json({
      success: true,
      message: 'Verification code has been sent to your email.',
    });
  } catch (error) {
    next(error);
  }
});

// Verify email with OTP
router.post('/verify-otp', ...otpLimiters, async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (
      !user ||
      !user.emailVerificationCode ||
      user.emailVerificationCode !== otp ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    await user.save();

    // CRITICAL: Invalidate user cache so login reads fresh verification status
    if (isRedisReady()) {
      try {
        const cacheKey = `user:lookup:${normalizedEmail}`;
        await deleteCache(cacheKey);
        console.log(`[CACHE] Invalidated user cache after email verification: ${normalizedEmail}`);
      } catch (error) {
        console.warn(`[CACHE] Error invalidating user cache after verification: ${error.message}`);
        // Continue even if cache invalidation fails - DB is source of truth
      }
    }

    return res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Change verification email and send new code
router.post('/change-verification-email', ...otpLimiters, async (req, res, next) => {
  try {
    const { oldEmail, newEmail } = req.body;

    if (!oldEmail || !newEmail) {
      return res.status(400).json({
        success: false,
        message: 'Old email and new email are required',
      });
    }

    const normalizedOld = oldEmail.toLowerCase().trim();
    const normalizedNew = newEmail.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedOld });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User with this email was not found',
      });
    }

    // Check if new email already used by some user
    const existingNew = await User.findOne({ email: normalizedNew });
    if (existingNew) {
      return res.status(400).json({
        success: false,
        message: 'The new email is already associated with another account',
      });
    }

    user.email = normalizedNew;
    user.isEmailVerified = false;

    const code = generateOtp();
    const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    user.emailVerificationCode = code;
    user.emailVerificationExpires = expires;
    await user.save();

    await sendCodeToEmail(user.email, code, 'email-verification');

    return res.json({
      success: true,
      message: 'Email updated and verification code sent',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

export default router;


