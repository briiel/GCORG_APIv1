// Simple in-memory rate limiter middleware
// Not suitable for multi-process production; for production use Redis-backed limiter.
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 60; // 60 requests per window per IP

function rateLimit(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = typeof options.max === 'number' ? options.max : DEFAULT_MAX;

  // Each limiter instance keeps its own in-memory store (map of key -> {count, start}).
  // Sharing a single global store across different limiter instances caused counts
  // from other endpoints to interfere with stricter limits (e.g. authLimiter).
  const stores = new Map();

  // Optional cleanup and logging options
  const cleanupIntervalMs = typeof options.cleanupIntervalMs === 'number'
    ? options.cleanupIntervalMs
    : Math.max(5 * 60 * 1000, windowMs * 2); // default: 5 minutes or 2x window
  const enableBlockLogging = !!options.logBlocked;

  // Periodic cleanup to prevent unbounded memory growth in high-traffic apps.
  const cleanupTimer = setInterval(() => {
    try {
      const now = Date.now();
      for (const [key, entry] of stores.entries()) {
        // Remove entries where the window start is far in the past (stale)
        if (now - entry.start > cleanupIntervalMs) {
          stores.delete(key);
        }
      }
    } catch (e) {
      // swallow errors to avoid crashing the app
    }
  }, cleanupIntervalMs);

  return (req, res, next) => {
    try {
      // Prefer Express's req.ip (respects app.set('trust proxy')). If missing,
      // fall back to X-Forwarded-For header or connection address.
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
        if (enableBlockLogging && process.env.NODE_ENV !== 'production') {
          try {
            const route = req.originalUrl || req.url || '<unknown>';
            console.warn(`[rateLimit] Blocked ${key} on ${route} (${req.method}) - count=${entry.count} max=${max}`);
          } catch (e) {}
        }
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
