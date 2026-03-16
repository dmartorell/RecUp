import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JWT_EXPIRES_IN } from '../config/constants.js';

export function signToken(userId, name, email) {
  return jwt.sign(
    { sub: userId, name, email },
    config.jwtSecret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { id: decoded.sub, name: decoded.name, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
}
