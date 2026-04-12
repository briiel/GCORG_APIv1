// Transport encryption middleware: AES-256-GCM encrypt/decrypt for all JSON API payloads
// Wire format (both directions): "<iv_b64>:<authTag_b64>:<ciphertext_b64>" (bare JSON string)
// Requests opt-in via X-Encrypted: true header; responses always carry X-Encrypted: true

const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

// Load and validate the 32-byte hex key from PAYLOAD_ENCRYPTION_KEY env var
function getPayloadKey() {
    const hex = process.env.PAYLOAD_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error('[TransportEncryption] PAYLOAD_ENCRYPTION_KEY must be 64 hex chars (32 bytes).');
    }
    return Buffer.from(hex, 'hex');
}

// Encrypt plaintext to "<iv_b64>:<authTag_b64>:<ciphertext_b64>"
function encryptPayload(plaintext) {
    const key = getPayloadKey();
    const iv  = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted    += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

// Decrypt a "<iv_b64>:<authTag_b64>:<ciphertext_b64>" string back to plaintext
function decryptPayload(encryptedStr) {
    const key   = getPayloadKey();
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) throw new Error('[TransportEncryption] Invalid encrypted payload format.');
    const iv         = Buffer.from(parts[0], 'base64');
    const authTag    = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted  = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted     += decipher.final('utf8');
    return decrypted;
}

// Returns true for request types that should skip encryption (no body of interest)
function isExcluded(req) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('multipart/form-data')) return true;
    return false;
}

// Middleware 1: decrypt incoming request body when X-Encrypted: true is present
const decryptRequestBody = (req, res, next) => {
    if (isExcluded(req) || req.headers['x-encrypted'] !== 'true') return next();
    try {
        const body = req.body;
        const encryptedStr = typeof body === 'string' ? body : (body && typeof body.payload === 'string' ? body.payload : null);
        if (!encryptedStr) {
            return res.status(400).json({ success: false, message: 'Encrypted request body missing or invalid.' });
        }
        req.body = JSON.parse(decryptPayload(encryptedStr));
        next();
    } catch (err) {
        console.error('[TransportEncryption] Request decryption failed:', err.message);
        return res.status(400).json({ success: false, message: 'Request payload could not be decrypted.' });
    }
};

// Middleware 2: wrap all outgoing res.json() calls in an AES-256-GCM ciphertext envelope
const encryptResponseBody = (req, res, next) => {
    if (!req.path.startsWith('/api') && req.path !== '/health' && req.path !== '/') return next();
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        try {
            const encryptedStr = encryptPayload(JSON.stringify(data));
            res.setHeader('X-Encrypted', 'true');
            return originalJson(encryptedStr);
        } catch (err) {
            console.error('[TransportEncryption] Response encryption failed:', err.message);
            return originalJson(data);
        }
    };
    next();
};

module.exports = { decryptRequestBody, encryptResponseBody };
