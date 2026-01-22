/**
 * Encryption Utility for Sensitive Data
 * Provides AES-256-GCM encryption for sensitive database fields
 * 
 * Usage:
 * const { encryptData, decryptData } = require('./utils/encryption');
 * const encrypted = encryptData(sensitiveString);
 * const decrypted = decryptData(encrypted);
 */

const crypto = require('crypto');
require('dotenv').config();

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment variable
 * Key should be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
        throw new Error('ENCRYPTION_KEY not found in environment variables');
    }
    
    // Convert hex string to buffer (should be 64 hex chars = 32 bytes)
    if (key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
    }
    
    return Buffer.from(key, 'hex');
}

/**
 * Generate a random encryption key (for setup/initialization)
 * Run this once to generate a key for your .env file
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt sensitive data
 * Returns encrypted data in format: iv:authTag:encryptedData (all base64)
 * 
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data string
 */
function encryptData(plaintext) {
    if (!plaintext) return null;
    
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        // Format: iv:authTag:encryptedData (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt sensitive data
 * 
 * @param {string} encryptedData - Encrypted data string
 * @returns {string} Decrypted plaintext
 */
function decryptData(encryptedData) {
    if (!encryptedData) return null;
    
    try {
        const key = getEncryptionKey();
        const parts = encryptedData.split(':');
        
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        
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

/**
 * Hash sensitive data (one-way, for searching/comparison)
 * Uses SHA-256 with salt
 * 
 * @param {string} data - Data to hash
 * @returns {string} Hashed data in format: salt:hash (both hex)
 */
function hashData(data) {
    if (!data) return null;
    
    const salt = crypto.randomBytes(SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 32, 'sha256');
    
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify hashed data
 * 
 * @param {string} data - Original data
 * @param {string} hashedData - Previously hashed data
 * @returns {boolean} True if data matches
 */
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

/**
 * Encrypt object fields (selective encryption)
 * 
 * @param {object} obj - Object to encrypt
 * @param {string[]} fields - Field names to encrypt
 * @returns {object} Object with encrypted fields
 */
function encryptFields(obj, fields) {
    if (!obj) return null;
    
    const encrypted = { ...obj };
    
    for (const field of fields) {
        if (encrypted[field]) {
            encrypted[field] = encryptData(String(encrypted[field]));
        }
    }
    
    return encrypted;
}

/**
 * Decrypt object fields
 * 
 * @param {object} obj - Object with encrypted fields
 * @param {string[]} fields - Field names to decrypt
 * @returns {object} Object with decrypted fields
 */
function decryptFields(obj, fields) {
    if (!obj) return null;
    
    const decrypted = { ...obj };
    
    for (const field of fields) {
        if (decrypted[field]) {
            try {
                decrypted[field] = decryptData(decrypted[field]);
            } catch (error) {
                console.error(`Failed to decrypt field ${field}:`, error.message);
                // Keep original value if decryption fails (might be unencrypted legacy data)
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
