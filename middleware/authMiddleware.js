const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const tokenBlacklist = new Set();

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'spedocity-api',
    audience: 'spedocity-users'
  });
}

function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || 
                req.headers['x-access-token'];
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  
  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(403).json({ message: "Token has been invalidated" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ message: "Token expired" });
    }
    return res.status(403).json({ message: "Invalid token" });
  }
}

function invalidateToken(token) {
  tokenBlacklist.add(token);
  
  // Schedule removal from blacklist after token expiration (basic cleanup)
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, 60 * 60 * 1000); // 1 hour
}

module.exports = {
  verifyToken,
  createToken,
  invalidateToken
};