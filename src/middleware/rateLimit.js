// Simple in-memory rate limiter middleware
// Not suitable for multi-process production; for production use Redis-backed limiter.
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 60; // 60 requests per window per IP

const stores = new Map();

function rateLimit(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = typeof options.max === 'number' ? options.max : DEFAULT_MAX;

  return (req, res, next) => {
    try {
      const key = req.ip || req.connection.remoteAddress || 'global';
      const now = Date.now();
      let entry = stores.get(key);
      if (!entry) {
        entry = { count: 1, start: now };
        stores.set(key, entry);
        return next();
      }
      if (now - entry.start > windowMs) {
        // reset window
        entry.count = 1;
        entry.start = now;
        stores.set(key, entry);
        return next();
      }
      entry.count++;
      stores.set(key, entry);
      if (entry.count > max) {
        res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' });
        return;
      }
      return next();
    } catch (err) {
      // Fail-open on limiter errors
      return next();
    }
  };
}

module.exports = rateLimit;
