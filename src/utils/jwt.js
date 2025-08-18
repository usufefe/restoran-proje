const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate short-lived QR token (30 minutes)
 */
function generateQRToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Decode JWT token without verification (for debugging)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateToken,
  generateQRToken,
  verifyToken,
  decodeToken
};

