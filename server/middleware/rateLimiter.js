import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from '../config/constants.js';

export function createRateLimiter({ windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ success: false, error: 'RATE_LIMITED' });
    }
    recent.push(now);
    attempts.set(key, recent);
    next();
  };
}
