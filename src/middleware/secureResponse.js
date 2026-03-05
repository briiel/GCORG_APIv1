// Sanitizes responses to strip sensitive fields and applies security headers.
// JWT tokens are intentionally NOT removed — they are required for auth flows.

const sensitiveFields = [
    'password',
    'password_hash',
    'passwordHash',
    'secret',
    'apiKey',
    'api_key',
    'privateKey',
    'private_key',
    'encryptionKey',
    'encryption_key'
];

// Recursively remove sensitive fields from an object or array
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));

    const sanitized = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
            if (!isSensitive) sanitized[key] = sanitizeObject(obj[key]);
        }
    }
    return sanitized;
}

// Intercepts res.json() to sanitize all outgoing response data
const secureResponseMiddleware = (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        return originalJson.call(this, sanitizeObject(data));
    };
    next();
};

// Applies standard security headers to every response
const securityHeadersMiddleware = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    next();
};

// Masks PII (emails, tokens, keys, cards) in log output
function maskSensitiveData(data) {
    if (!data) return data;
    let masked = JSON.stringify(data);
    masked = masked.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]');
    masked = masked.replace(/eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi, '[TOKEN]');
    masked = masked.replace(/[a-f0-9]{32,}/gi, '[KEY]');
    masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
    return JSON.parse(masked);
}

module.exports = { secureResponseMiddleware, securityHeadersMiddleware, sanitizeObject, maskSensitiveData };
