/**
 * Secure Response Middleware
 * Sanitizes responses to prevent sensitive data leakage
 * Removes sensitive fields and applies data minimization
 * 
 * IMPORTANT: JWT tokens are intentionally NOT removed from responses
 * as they are required for authentication flows (login, register).
 * They are securely transmitted over HTTPS and have built-in expiration.
 */

const sensitiveFields = [
    'password',
    'password_hash',
    'passwordHash',
    // Note: 'token' is intentionally NOT included here
    // JWT tokens need to be sent in login/auth responses
    'secret',
    'apiKey',
    'api_key',
    'privateKey',
    'private_key',
    'encryptionKey',
    'encryption_key'
];

/**
 * Remove sensitive fields from object
 */
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    const sanitized = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            // Check if field is sensitive
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveFields.some(field => 
                lowerKey.includes(field.toLowerCase())
            );
            
            if (!isSensitive) {
                // Recursively sanitize nested objects
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
    }
    
    return sanitized;
}

/**
 * Middleware to sanitize response data
 */
const secureResponseMiddleware = (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method
    res.json = function(data) {
        // Sanitize the response data
        const sanitized = sanitizeObject(data);
        
        // Call original json method with sanitized data
        return originalJson.call(this, sanitized);
    };
    
    next();
};

/**
 * Apply security headers
 */
const securityHeadersMiddleware = (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Strict Transport Security (HTTPS only)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (formerly Feature-Policy)
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    
    next();
};

/**
 * Mask sensitive data in logs
 */
function maskSensitiveData(data) {
    if (!data) return data;
    
    let masked = JSON.stringify(data);
    
    // Mask email addresses
    masked = masked.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]');
    
    // Mask tokens (JWT-like patterns)
    masked = masked.replace(/eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi, '[TOKEN]');
    
    // Mask long hex strings (likely keys)
    masked = masked.replace(/[a-f0-9]{32,}/gi, '[KEY]');
    
    // Mask credit card numbers
    masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
    
    return JSON.parse(masked);
}

module.exports = {
    secureResponseMiddleware,
    securityHeadersMiddleware,
    sanitizeObject,
    maskSensitiveData
};
