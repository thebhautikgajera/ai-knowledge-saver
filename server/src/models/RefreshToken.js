import mongoose from 'mongoose';
import crypto from 'crypto';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    replacedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for userId
refreshTokenSchema.index({ userId: 1 });

// Static method to hash token
refreshTokenSchema.statics.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method to create token document
refreshTokenSchema.statics.createToken = async function (userId, expiresAt) {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = this.hashToken(token);

  await this.create({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
};

// Static method to verify token
refreshTokenSchema.statics.verifyToken = async function (token) {
  const tokenHash = this.hashToken(token);
  const tokenDoc = await this.findOne({ tokenHash }).lean();

  if (!tokenDoc) {
    return null;
  }

  if (tokenDoc.isRevoked || tokenDoc.expiresAt < new Date()) {
    return null;
  }

  return tokenDoc;
};

// Static method to revoke token
refreshTokenSchema.statics.revokeToken = async function (token, replacedBy = null) {
  const tokenHash = this.hashToken(token);
  await this.updateOne(
    { tokenHash },
    { isRevoked: true, replacedBy }
  );
};

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

