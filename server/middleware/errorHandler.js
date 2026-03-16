export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  if (status >= 500) console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  return res.status(status).json({ success: false, error: code });
}
