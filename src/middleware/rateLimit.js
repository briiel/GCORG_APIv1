// In-memory rate limiter. For multi-process production use a Redis-backed solution.
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 60; // 60 requests per window per IP

function rateLimit(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = typeof options.max === 'number' ? options.max : DEFAULT_MAX;

  // Each limiter instance has its own store to avoid cross-limiter count interference
  const stores = new Map();

  const cleanupIntervalMs = typeof options.cleanupIntervalMs === 'number'
    ? options.cleanupIntervalMs
    : Math.max(5 * 60 * 1000, windowMs * 2);
  const enableBlockLogging = !!options.logBlocked;

  // Periodic cleanup to prevent unbounded memory growth
  const cleanupTimer = setInterval(() => {
    try {
      const now = Date.now();
      for (const [key, entry] of stores.entries()) {
        if (now - entry.start > cleanupIntervalMs) stores.delete(key);
      }
    } catch (e) { }
  }, cleanupIntervalMs);

  return (req, res, next) => {
    try {
      // Resolve client IP — prefer req.ip, then X-Forwarded-For
      const forwarded = req.headers && req.headers['x-forwarded-for'];
      const forwardedIp = forwarded ? String(forwarded).split(',')[0].trim() : null;
      const key = req.ip || forwardedIp || req.connection?.remoteAddress || 'global';
      const now = Date.now();

      let entry = stores.get(key);
      if (!entry) {
        entry = { count: 1, start: now };
        stores.set(key, entry);
        return next();
      }

      // Reset window if expired
      if (now - entry.start > windowMs) {
        entry.count = 1;
        entry.start = now;
        stores.set(key, entry);
        return next();
      }

      entry.count++;
      stores.set(key, entry);

      if (entry.count > max) {
        if (enableBlockLogging && process.env.NODE_ENV !== 'production') {
          try {
            const route = req.originalUrl || req.url || '<unknown>';
            console.warn(`[rateLimit] Blocked ${key} on ${route} (${req.method}) - count=${entry.count} max=${max}`);
          } catch (e) { }
        }
        res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' });
        return;
      }

      return next();
    } catch (err) {
      return next(); // Fail-open on limiter errors
    }
  };
}

module.exports = rateLimit;
