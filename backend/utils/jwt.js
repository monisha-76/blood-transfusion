const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'jeevansetu_super_secret_jwt_key_2026_change_in_production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'jeevansetu_super_secret_jwt_key_2026_change_in_production';
  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  verifyToken
};
