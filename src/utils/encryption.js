// AES-256-GCM encryption utility for sensitive database fields (encryptData, decryptData, hashData, etc.)

const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Load and validate the 32-byte hex encryption key from env
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error('ENCRYPTION_KEY not found in environment variables');
    if (key.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
    return Buffer.from(key, 'hex');
}

// Generate a random 32-byte encryption key (for setup only)
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

// Encrypt plaintext; returns "iv:authTag:ciphertext" (all base64)
function encryptData(plaintext) {
    if (!plaintext) return null;
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Failed to encrypt data');
    }
}

// Decrypt an "iv:authTag:ciphertext" string back to plaintext
function decryptData(encryptedData) {
    if (!encryptedData) return null;
    try {
        const key = getEncryptionKey();
        const parts = encryptedData.split(':');
        if (parts.length !== 3) throw new Error('Invalid encrypted data format');
        const iv = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        const encrypted = parts[2];
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        throw new Error('Failed to decrypt data');
    }
}

// One-way PBKDF2-SHA256 hash with random salt; returns "salt:hash" (both hex)
function hashData(data) {
    if (!data) return null;
    const salt = crypto.randomBytes(SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 32, 'sha256');
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Verify data against a previously produced hashData result
function verifyHash(data, hashedData) {
    if (!data || !hashedData) return false;
    try {
        const parts = hashedData.split(':');
        if (parts.length !== 2) return false;
        const salt = Buffer.from(parts[0], 'hex');
        const originalHash = Buffer.from(parts[1], 'hex');
        const hash = crypto.pbkdf2Sync(data, salt, 100000, 32, 'sha256');
        return crypto.timingSafeEqual(hash, originalHash);
    } catch (error) {
        return false;
    }
}

// Encrypt selected fields of an object in place
function encryptFields(obj, fields) {
    if (!obj) return null;
    const encrypted = { ...obj };
    for (const field of fields) {
        if (encrypted[field]) encrypted[field] = encryptData(String(encrypted[field]));
    }
    return encrypted;
}

// Decrypt selected fields of an object in place (keeps original value on failure)
function decryptFields(obj, fields) {
    if (!obj) return null;
    const decrypted = { ...obj };
    for (const field of fields) {
        if (decrypted[field]) {
            try {
                decrypted[field] = decryptData(decrypted[field]);
            } catch (error) {
                console.error(`Failed to decrypt field ${field}:`, error.message);
            }
        }
    }
    return decrypted;
}

module.exports = {
    generateEncryptionKey,
    encryptData,
    decryptData,
    hashData,
    verifyHash,
    encryptFields,
    decryptFields
};
