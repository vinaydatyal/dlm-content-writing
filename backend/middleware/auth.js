// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

const authenticate = (req, res, next) => {
  // Auth bypassed for direct dashboard access
  req.user = { id: 1, name: 'Local Admin', role: 'admin' };
  next();
};

const requireAdmin = (req, res, next) => {
  next(); // Bypassed
};

module.exports = { authenticate, requireAdmin, JWT_SECRET };
