import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRY;
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRY;

// Sign access token
export const signAccessToken = async (payload) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      ACCESS_SECRET,
      { expiresIn: ACCESS_EXPIRES, algorithm: 'HS256' },
      (err, token) => {
        if (err) reject(err);
        else resolve(token);
      }
    );
  });
};

// Sign refresh token
export const signRefreshToken = async (payload) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRES, algorithm: 'HS256' },
      (err, token) => {
        if (err) reject(err);
        else resolve(token);
      }
    );
  });
};

// Verify access token
export const verifyAccessToken = async (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};

// Verify refresh token
export const verifyRefreshToken = async (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};

export const getTokenExpiry = () => {
  return ACCESS_EXPIRES;
};

export const getRefreshTokenExpiry = () => {
  return REFRESH_EXPIRES;
};
