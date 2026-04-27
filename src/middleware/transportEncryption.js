// Transport encryption middleware: Hybrid RSA + AES-256-GCM architecture
//
// INCOMING REQUEST:
// 1. Frontend sends 'X-Session-Key' header containing a single-use AES-256-GCM key,
//    encrypted with the Backend's RSA Public Key (Base64 encoded).
// 2. Midleware decrypts 'X-Session-Key' using Backend's RSA Private Key -> sets req.aesSessionKey.
// 3. IF X-Encrypted: true, middleware uses req.aesSessionKey to decrypt the AES-GCM payload.
//
// OUTGOING RESPONSE:
// 4. Middleware intercepts res.json().
// 5. Encrypts the response payload using the same req.aesSessionKey (provided by the frontend).
// 6. Response carries X-Encrypted: true.

const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

// Load the RSA private key from environment variables
function getRsaPrivateKey() {
    let key = process.env.RSA_PRIVATE_KEY;
    if (!key) {
        throw new Error('[TransportEncryption] RSA_PRIVATE_KEY is missing from environment.');
    }
    // Fix escaped newlines if dotenv parsed it as a single flat string
    if (key.includes('\\n')) {
        key = key.replace(/\\n/g, '\n');
    }
    return key;
}

// Decrypt the single-use AES session key using the backend's RSA Private Key
function decryptSessionKey(encryptedSessionKeyB64) {
    try {
        const encryptedBuffer = Buffer.from(encryptedSessionKeyB64, 'base64');
        const privateKey = getRsaPrivateKey();
        const decryptedBuffer = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            encryptedBuffer
        );
        return decryptedBuffer; // Valid 32-byte AES key
    } catch (err) {
        throw new Error('RSA Decryption failed: ' + err.message);
    }
}

// Encrypt plaintext to "<iv_b64>:<authTag_b64>:<ciphertext_b64>" using the provided AES key
function encryptPayload(plaintext, aesKeyBuffer) {
    const iv  = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, aesKeyBuffer, iv, { authTagLength: TAG_LENGTH });
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted    += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

// Decrypt a "<iv_b64>:<authTag_b64>:<ciphertext_b64>" string back to plaintext using the provided AES key
function decryptPayload(encryptedStr, aesKeyBuffer) {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) throw new Error('[TransportEncryption] Invalid encrypted payload format.');
    const iv         = Buffer.from(parts[0], 'base64');
    const authTag    = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, aesKeyBuffer, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted  = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted     += decipher.final('utf8');
    return decrypted;
}

// Returns true for request types that should skip body encryption
function isExcluded(req) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('multipart/form-data')) return true;
    return false;
}

// Middleware 1: Extact session key and decrypt incoming request body
const decryptRequestBody = (req, res, next) => {
    // Completely ignore health checks and public webhooks
    if (req.path === '/health' || req.path === '/' || req.path.startsWith('/api/cron')) return next();
    
    // Not an API route requiring crypto
    if (!req.path.startsWith('/api')) return next();

    // 1. Every crypto-enabled request MUST have an X-Session-Key header (even GETs, so server can encrypt response)
    const sessionKeyHeader = req.headers['x-session-key'];
    if (!sessionKeyHeader) {
        // Exclude completely unprotected routes or OPTIONS
        if (req.method === 'OPTIONS') return next();
        return res.status(400).json({ success: false, message: 'Missing X-Session-Key header.' });
    }

    try {
        // Decrypt the AES key and attach it to the request for the response middleware to use
        req.aesSessionKey = decryptSessionKey(sessionKeyHeader);
    } catch (err) {
        console.error('[TransportEncryption] Session key RSA decryption failed:', err.message);
        return res.status(400).json({ success: false, message: 'Invalid session key.' });
    }

    // 2. If it's a GET request or multipart upload, no payload to decrypt, skip to next middleware
    if (isExcluded(req) || req.headers['x-encrypted'] !== 'true') return next();

    // 3. Otherwise, decrypt the incoming JSON payload using the AES key
    try {
        const body = req.body;
        const encryptedStr = typeof body === 'string' ? body : (body && typeof body.payload === 'string' ? body.payload : null);
        if (!encryptedStr) {
            return res.status(400).json({ success: false, message: 'Encrypted request body missing or invalid.' });
        }
        
        req.body = JSON.parse(decryptPayload(encryptedStr, req.aesSessionKey));
        next();
    } catch (err) {
        console.error('[TransportEncryption] Request body AES decryption failed:', err.message);
        return res.status(400).json({ success: false, message: 'Request payload could not be decrypted.' });
    }
};

// Middleware 2: wrap all outgoing res.json() calls in an AES-256-GCM ciphertext envelope
const encryptResponseBody = (req, res, next) => {
    if (!req.path.startsWith('/api') || req.path.startsWith('/api/cron')) return next();
    
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        try {
            // Only encrypt if we successfully received an AES session key from the client!
            if (req.aesSessionKey) {
                const encryptedStr = encryptPayload(JSON.stringify(data), req.aesSessionKey);
                res.setHeader('X-Encrypted', 'true');
                return originalJson(encryptedStr);
            } else {
                // Return plain JSON if no session key (e.g. error before session key was parsed)
                return originalJson(data);
            }
        } catch (err) {
            console.error('[TransportEncryption] Response encryption failed:', err.message);
            return originalJson(data);
        }
    };
    next();
};

module.exports = { decryptRequestBody, encryptResponseBody };
