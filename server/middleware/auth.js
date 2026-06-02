import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, JWT_RENEW_THRESHOLD_MS } from '../config/constants.js';
import { config } from '../config/env.js';

export function signToken(userId, name, email) {
  return jwt.sign({ sub: userId, name, email }, config.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { id: decoded.sub, name: decoded.name, email: decoded.email };

    const expMs = decoded.exp * 1000;
    if (expMs - Date.now() < JWT_RENEW_THRESHOLD_MS) {
      const fresh = signToken(decoded.sub, decoded.name, decoded.email);
      res.setHeader('X-New-Token', fresh);
      res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');
    }

    next();
  } catch {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
}
