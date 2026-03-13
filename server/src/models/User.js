import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        select: false, // hide by default
    },
    // email verification state
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationCode: {
        type: String,
        default: null,
    },
    emailVerificationExpires: {
        type: Date,
        default: null,
    },
    // password reset state
    passwordResetCode: {
        type: String,
        default: null,
    },
    passwordResetExpires: {
        type: Date,
        default: null,
    },
    role: {
        type: String,
        required: true,
        default: 'user',
        enum: ['admin', 'user'],
    },
    lastLogin: {
        type: Date,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // tokenVersion: used to revoke refresh tokens when incremented
    tokenVersion: {
        type: Number,
        default: 0,
      },
    // brute-force protection
    failedLoginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        },
    },
    toObject: {
        transform(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        },
    },
});

/*
  INDEX STRATEGY:
  - Unique email globally
*/
userSchema.index({
    email: 1
}, {
    unique: true
});

// Use configurable bcrypt cost so we can tune perf vs security.
// In development we default to a lower cost for faster feedback.
const BCRYPT_SALT_ROUNDS =
    process.env.BCRYPT_SALT_ROUNDS ?
    parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) :
    process.env.NODE_ENV === 'production' ?
    12 :
    8;

// HASH password before save
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
        next();
    } catch (err) {
        next(err);
    }
});

// instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    // `this.password` must be selected by caller when using comparePassword
    return await bcrypt.compare(candidatePassword, this.password);
};

// increment tokenVersion (revokes previous refresh tokens)
userSchema.methods.incrementTokenVersion = async function() {
    this.tokenVersion = (this.tokenVersion || 0) + 1;
    await this.save();
};

// check if account is locked
userSchema.methods.isLocked = function() {
    if (!this.lockUntil) return false;
    return this.lockUntil.getTime() > Date.now();
};

export const User = mongoose.model('User', userSchema);