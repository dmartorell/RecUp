import jwt from 'jsonwebtoken';
import { logDbError } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

export function signToken(userId, name, email) {
  return jwt.sign(
    { sub: userId, name, email },
    JWT_SECRET,
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.sub, name: decoded.name, email: decoded.email };
    next();
  } catch (err) {
    logDbError(err, 'authMiddleware');
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
}
