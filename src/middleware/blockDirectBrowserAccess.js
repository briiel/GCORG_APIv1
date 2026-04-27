/**
 * blockDirectBrowserAccess — middleware
 *
 * When a browser navigates directly to an API URL (address bar / curl / Postman
 * without proper headers), it sends a plain GET with Accept: text/html and no
 * Authorization header.  We silently destroy the TCP socket so the browser
 * shows "This site can't be reached" rather than leaking any API structure or
 * encrypted payloads.
 *
 * Requests are PASSED THROUGH when ANY of these conditions is true:
 *   1. The method is not GET  (POST, PATCH, DELETE, OPTIONS … all go through)
 *   2. The path does NOT start with /api  (health check, static files)
 *   3. The request carries a valid-looking Authorization: Bearer <token> header
 *   4. The Accept header explicitly requests JSON  (programmatic client)
 *   5. The request carries the X-Requested-With: XMLHttpRequest header
 *   6. The public metrics endpoint  GET /api/metrics/visits  (unauthenticated)
 */
module.exports = function blockDirectBrowserAccess(req, res, next) {
    // Only police GET (browser navigation sends GET)
    if (req.method !== 'GET') return next();

    // Only police /api/* paths
    if (!req.path.startsWith('/api')) return next();

    // Allow the public visits metrics endpoint (unauthenticated, intentionally GET)
    if (req.path === '/api/metrics/visits') return next();

    // Allow cron webhook (POST — already excluded by method check, but be explicit)
    if (req.path.startsWith('/api/cron')) return next();

    const authHeader = req.headers['authorization'] || '';
    const acceptHeader = req.headers['accept'] || '';
    const xrw = req.headers['x-requested-with'] || '';

    // Programmatic clients send Authorization: Bearer <token>
    const hasBearerToken = /^Bearer\s+\S+/i.test(authHeader);

    // JSON-aware client explicitly requests application/json
    const acceptsJson = acceptHeader.includes('application/json');

    // XMLHttpRequest marker used by some HTTP clients
    const isXhrClient = xrw.toLowerCase() === 'xmlhttprequest';

    if (hasBearerToken || acceptsJson || isXhrClient) {
        return next(); // Legitimate programmatic request — let it through
    }

    // Pure browser navigation (no token, no JSON accept, no XHR header).
    // Destroy the connection silently — browser will show "This site can't be reached".
    req.socket.destroy();
};
