import express from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} from '../utils/jwt.js';
import { createAuthLimiter } from '../middleware/rateLimiter.js';
import {
    getCache,
    setCache,
    deleteCache,
    isRedisReady,
} from '../utils/redis.js';
import { blacklistAccessToken } from '../utils/tokenBlacklist.js';
import { sendMail } from '../utils/mailer.js';
import { generateEmailVerificationOTPTemplate } from '../utils/otpTemplates.js';
import { generateOtp } from '../utils/otp.js';
import { createSession, destroySession } from '../utils/sessionStore.js';

const router = express.Router();

const CACHE_TTL = 3600; // 1 hour in seconds
const EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES = parseInt(
    process.env.EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES,
    10
);

// Helper: Get user from cache or DB (by email only)
const getUserWithCache = async (email) => {
    const startTime = Date.now();
    const cacheKey = `user:lookup:${email}`;

    // Try cache first (only if Redis is available)
    if (isRedisReady()) {
        try {
            const cached = await getCache(cacheKey);
            if (cached) {
                console.log(`[PERF] User lookup (cache): ${Date.now() - startTime}ms`);
                return cached;
            }
        } catch (error) {
            console.warn(`[CACHE] Error reading user cache: ${error.message}`);
            // Continue to database query if cache read fails
        }
    }

    // DB lookup with projection for performance
    const dbStartTime = Date.now();
    const user = await User.findOne({
            email
        },
        'password role lastLogin _id email tokenVersion failedLoginAttempts lockUntil isActive isEmailVerified'
    ).lean();

    const dbTime = Date.now() - dbStartTime;
    const totalTime = Date.now() - startTime;
    console.log(`[PERF] User lookup (DB): ${dbTime}ms, Total: ${totalTime}ms`);

    // Cache user if found (only if Redis is available)
    if (user && isRedisReady()) {
        try {
            await setCache(cacheKey, user, CACHE_TTL);
        } catch (error) {
            console.warn(`[CACHE] Error writing user cache: ${error.message}`);
            // Continue even if cache write fails
        }
    }

    return user;
};

// Initialize rate limiter
const authLimiter = createAuthLimiter();

// Register endpoint
router.post('/register', async (req, res, next) => {
    try {
        await authLimiter(req, res, async () => {
            const {
                email,
                password,
                role
            } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    ok: false,
                    error: 'Missing required fields: email, password',
                });
            }

            // Enforce server-side role rules: self-registration can only create "user" accounts
            if (role && role !== 'user') {
                return res.status(400).json({
                    ok: false,
                    error: 'Invalid role. New accounts are created with the "user" role.',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();

            // Check if user exists by email
            const existingUser = await User.findOne({
                email: normalizedEmail
            }).lean();
            if (existingUser) {
                return res.status(400).json({
                    ok: false,
                    error: 'User with this email already exists',
                });
            }

            // Generate verification code & expiry BEFORE sending email
            const emailVerificationCode = generateOtp();
            const emailVerificationExpires = new Date(
                Date.now() + EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000
            );

            // Create user with default role "user" and pending email verification
            const user = await User.create({
                email: normalizedEmail,
                password,
                role: 'user',
                isEmailVerified: false,
                emailVerificationCode,
                emailVerificationExpires,
            });

            // Send verification email (fails the request if email cannot be sent)
            const html = generateEmailVerificationOTPTemplate(emailVerificationCode);
            await sendMail({
                to: user.email,
                subject: 'CineScope - Verify your email address',
                html,
            });

            // Invalidate cache (defensive - user shouldn't be cached yet)
            if (isRedisReady()) {
                try {
                    const cacheKey = `user:lookup:${user.email}`;
                    await deleteCache(cacheKey);
                } catch (error) {
                    console.warn(`[CACHE] Error invalidating user cache: ${error.message}`);
                }
            }

            // Do NOT log the user in here; they must verify email and then log in explicitly
            res.status(201).json({
                ok: true,
                data: {
                    email: user.email,
                },
            });
        });
    } catch (error) {
        next(error);
    }
});

/*
  POST /auth/login
  - Accepts { email, password }
  - Finds user by email (select password explicitly)
  - Implements account lockout & failed attempts handling
*/
router.post('/login', async (req, res, next) => {
    try {
        await authLimiter(req, res, async () => {
            const start = Date.now();
            const {
                email,
                password
            } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    ok: false,
                    error: 'Missing required fields: email, password',
                });
            }

            const normalizedEmail = email.toLowerCase().trim();
            // 1) Try cache / DB (this helper already logs timings)
            const lookStart = Date.now();
            let userObj = null;
            try {
                userObj = await getUserWithCache(normalizedEmail);
            } catch (err) {
                console.warn('[PERF] getUserWithCache failed, falling back to direct DB', err.message);
            }
            console.log(`[PERF] lookupTotal=${Date.now() - lookStart}ms`);

            if (!userObj) {
                // If helper didn't find, do a minimal DB read (include password field)
                const dbStart = Date.now();
                const doc = await User.findOne({
                        email: normalizedEmail
                    })
                    .select('+password tokenVersion failedLoginAttempts lockUntil isActive role lastLogin email isEmailVerified')
                    .lean();
                userObj = doc;
                console.log(`[PERF] fallback DB lookup=${Date.now() - dbStart}ms`);
            }

            if (!userObj) {
                return res.status(401).json({
                    ok: false,
                    error: 'User with this email was not found',
                });
            }

            // CRITICAL: Always check email verification status fresh from DB (not cache)
            // This ensures we have the latest verification status even if cache is stale
            const freshVerificationCheck = await User.findOne({
                    email: normalizedEmail
                },
                'isEmailVerified'
            ).lean();

            // Check active
            if (!userObj.isActive) {
                return res.status(403).json({
                    ok: false,
                    error: 'Account disabled',
                });
            }

            // Check email verification (use fresh DB check if available, otherwise fall back to cached value)
            const isEmailVerified =
                freshVerificationCheck && typeof freshVerificationCheck.isEmailVerified === 'boolean' ?
                freshVerificationCheck.isEmailVerified :
                userObj.isEmailVerified;
            if (!isEmailVerified) {
                // Invalidate cache to force refresh on next attempt
                if (isRedisReady()) {
                    try {
                        await deleteCache(`user:lookup:${normalizedEmail}`);
                    } catch (e) {
                        console.warn('[CACHE] Error invalidating cache on verification check', e.message);
                    }
                }
                return res.status(403).json({
                    ok: false,
                    error: 'Email not verified. Please verify your email before logging in.',
                    requiresVerification: true,
                });
            }

            // Update userObj with fresh verification status
            userObj.isEmailVerified = isEmailVerified;

            // Account lock check (userObj may be plain object from lean/cache)
            const isLocked =
                userObj.lockUntil && new Date(userObj.lockUntil).getTime() > Date.now();
            if (isLocked) {
                const lockUntil = userObj.lockUntil ? new Date(userObj.lockUntil) : null;
                return res.status(423).json({
                    ok: false,
                    error: 'Your account is locked due to too many failed login attempts. Please try again after 30 minutes.',
                    meta: {
                        lockUntil,
                    },
                });
            }

            // 2) Password verify (bcrypt)
            const bcryptStart = Date.now();
            const passwordHash = userObj.password;
            const ok = await bcrypt.compare(password, passwordHash);
            console.log(`[PERF] bcrypt.compare=${Date.now() - bcryptStart}ms`);

            if (!ok) {
                // Increment failed attempts & optionally lock the account (atomic updates)
                const MAX_FAIL = 5;
                const LOCK_TIME_MS = 30 * 60 * 1000; // 30 minutes

                const updStart = Date.now();
                const updated = await User.findOneAndUpdate({
                    email: normalizedEmail
                }, {
                    $inc: {
                        failedLoginAttempts: 1
                    },
                }, {
                    new: true,
                    select: 'failedLoginAttempts lockUntil'
                }).lean();

                if (updated && updated.failedLoginAttempts >= MAX_FAIL) {
                    await User.updateOne({
                        email: normalizedEmail
                    }, {
                        $set: {
                            lockUntil: new Date(Date.now() + LOCK_TIME_MS)
                        }
                    });
                }

                // Invalidate cache because user state changed
                if (isRedisReady()) {
                    try {
                        await deleteCache(`user:lookup:${normalizedEmail}`);
                    } catch (e) {
                        console.warn('[CACHE] invalidate error', e.message);
                    }
                }

                console.log(`[PERF] failedAttemptUpdate=${Date.now() - updStart}ms`);

                // If the account has just been locked by this attempt, return a lock response
                const nowLocked =
                    updated &&
                    updated.lockUntil &&
                    new Date(updated.lockUntil).getTime() > Date.now();
                if (nowLocked) {
                    return res.status(423).json({
                        ok: false,
                        error: 'Your account has been locked due to too many failed login attempts. Please try again in 30 minutes.',
                        meta: {
                            lockUntil: updated.lockUntil,
                        },
                    });
                }

                return res.status(401).json({
                    ok: false,
                    error: 'Incorrect password.',
                });
            }

            // 3) Successful login: sign tokens
            const userId = String(userObj._id);
            const tokenVersion = typeof userObj.tokenVersion === 'number' ? userObj.tokenVersion : 0;
            const payload = {
                sub: userId,
                id: userId,
                email: userObj.email,
                role: userObj.role,
                tokenVersion,
            };

            const signStart = Date.now();
            const accessToken = await signAccessToken(payload);
            const refreshToken = await signRefreshToken(payload);
            console.log(`[PERF] jwtSign=${Date.now() - signStart}ms`);

            // 4) Set refresh token cookie (fast, for SPA token refresh)
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS) * 24 * 60 * 60 * 1000,
            });

            // 5) Create opaque session cookie for extension + dashboard
            const sessionId = await createSession(userId);
            res.cookie('session', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS) * 24 * 60 * 60 * 1000,
            });

            // 6) Update lastLogin & reset counters ASYNC — do NOT await (fire-and-forget)
            (async () => {
                try {
                    await User.updateOne({
                        _id: payload.sub
                    }, {
                        $set: {
                            failedLoginAttempts: 0,
                            lockUntil: null,
                            lastLogin: new Date()
                        }
                    });

                    // Invalidate cache because state changed (optional)
                    if (isRedisReady()) {
                        try {
                            await deleteCache(`user:lookup:${normalizedEmail}`);
                        } catch (error) {
                            console.warn('[CACHE] invalidate error after login', error.message);
                        }
                    }
                } catch (e) {
                    console.warn('[ASYNC] Background user update failed', e.message);
                }
            })();

            const totalTime = Date.now() - start;
            console.log(`[PERF] Login total latency: ${totalTime}ms`);

            return res.json({
                ok: true,
                data: {
                    accessToken,
                    user: {
                        id: payload.id,
                        email: payload.email,
                        role: payload.role,
                    },
                },
            });
        });
    } catch (error) {
        next(error);
    }
});

/*
  POST /auth/refresh
  - Accepts refreshToken from cookie or body
  - Verifies refresh token
  - Checks tokenVersion in DB (revocation)
  - Issues new access token (and optionally a rotated refresh token)
*/
router.post('/refresh', async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                ok: false,
                error: 'Missing refreshToken',
            });
        }

        let decoded;
        try {
            decoded = await verifyRefreshToken(refreshToken);
        } catch (e) {
            return res.status(401).json({
                ok: false,
                error: 'Invalid refresh token',
            });
        }

        const userId = decoded.sub;

        const user = await User.findById(userId)
            .select('tokenVersion isActive role email isEmailVerified')
            .lean();

        if (!user || !user.isActive) {
            return res.status(401).json({
                ok: false,
                error: 'Invalid token / user not active',
            });
        }

        // Enforce email verification
        if (!user.isEmailVerified) {
            return res.status(403).json({
                ok: false,
                error: 'Email not verified. Please verify your email before logging in.',
                requiresVerification: true,
            });
        }

        // Safe fallback values
        const dbTokenVersion = user.tokenVersion ?? 0;
        const tokenVersionFromToken = decoded.tokenVersion ?? 0;

        console.log("DB tokenVersion:", dbTokenVersion);
        console.log("Token tokenVersion:", tokenVersionFromToken);

        // Compare token versions
        if (dbTokenVersion !== tokenVersionFromToken) {
            return res.status(401).json({
                ok: false,
                error: 'Refresh token revoked',
            });
        }

        // Generate new access token
        const newAccess = await signAccessToken({
            sub: userId,
            id: userId,
            role: user.role,
            email: user.email,
            tokenVersion: dbTokenVersion,
        });

        res.json({
            ok: true,
            data: {
                accessToken: newAccess,
            },
        });

    } catch (error) {
        next(error);
    }
});

/*
  POST /auth/logout
  - Optionally revoke refresh tokens by incrementing tokenVersion
*/
router.post('/logout', async (req, res, next) => {
    try {
        // We try multiple strategies to determine the user and *always*
        // clear the refresh cookie so logout never fails with 400/404.

        let userId = req.body.userId;
        let accessToken = null;
        let decodedAccess = null;

        // 1) Try to extract from access token if available
        if (req.headers.authorization) {
            try {
                const {
                    verifyAccessToken
                } = await import('../utils/jwt.js');
                accessToken = req.headers.authorization.split(' ')[1];
                decodedAccess = await verifyAccessToken(accessToken);
                if (!userId) {
                    userId = decodedAccess.sub;
                }
            } catch (e) {
                // Access token invalid or missing - we'll fall back to refresh token / body
            }
        }

        // 2) Fallback to refresh token cookie (most reliable for logout)
        if (!userId && req.cookies && req.cookies.refreshToken) {
            try {
                const decodedRefresh = await verifyRefreshToken(
                    req.cookies.refreshToken
                );
                userId = decodedRefresh.sub;
            } catch (e) {
                // Invalid / expired refresh token – continue, we'll still clear cookie
            }
        }

        // 3) If we could resolve a user, revoke their refresh tokens
        if (userId) {
            const user = await User.findById(userId);
            if (user) {
                await user.incrementTokenVersion(); // revokes old refresh tokens
            }
        }

        // 4) Blacklist current access token in Redis so it can't be reused
        if (accessToken && decodedAccess && decodedAccess.exp) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const ttlSeconds = Math.max(decodedAccess.exp - nowSeconds, 1);
            await blacklistAccessToken(accessToken, ttlSeconds);
        }

        // 5) Clear refresh token cookie regardless of whether we found a user
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        // 6) Clear opaque session cookie and destroy session if present
        const sessionId = req.cookies?.session;
        if (sessionId) {
            await destroySession(sessionId);
        }
        res.clearCookie('session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        // Always return success – from the client's perspective,
        // the session is now terminated.
        res.json({
            ok: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        next(error);
    }
});

// Check email availability endpoint
router.get('/check-email', async (req, res, next) => {
    try {
        const {
            email
        } = req.query;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                ok: false,
                error: 'Email is required',
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await User.findOne({
            email: normalizedEmail
        }).lean();

        res.json({
            ok: true,
            data: {
                available: !existingUser,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;