# Encryption Configuration Guide

## 🔐 Data Encryption Implementation

This system now includes comprehensive encryption for sensitive data at rest and in transit.

## Setup Instructions

### 1. Generate Encryption Key

Run this command in the API directory to generate a new encryption key:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Add to .env File

Add the generated key to your `.env` file:

```env
# Encryption Configuration
ENCRYPTION_KEY=<paste-generated-key-here>

# Example (DO NOT USE THIS KEY - Generate your own!)
# ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

### 3. Update Database Connection for SSL

Ensure your `.env` has SSL enabled for production:

```env
DB_SSL=true
```

### 4. Apply Middleware

The following middleware has been added:
- ✅ `secureResponseMiddleware` - Sanitizes API responses
- ✅ `securityHeadersMiddleware` - Adds security headers
- ✅ Encryption utilities for sensitive fields

## What's Encrypted

### Backend (API)
- ✅ **Passwords**: bcrypt hashing (already implemented)
- ✅ **JWT Tokens**: Signed with secure secret
- ✅ **Database Connection**: SSL/TLS enabled
- 🆕 **Sensitive Fields**: AES-256-GCM encryption available
- 🆕 **API Responses**: Sanitized to prevent leakage

### Frontend (Angular)
- ✅ **HTTPS in Production**: All traffic encrypted
- 🆕 **Secure Storage**: Web Crypto API for localStorage
- 🆕 **Client-side Encryption**: Optional for sensitive data

### Database
- ✅ **Connection Encryption**: SSL/TLS
- ✅ **Password Hashing**: bcrypt
- 🆕 **Field-level Encryption**: Available for PII fields

## Usage Examples

### Backend - Encrypt Sensitive Fields

```javascript
const { encryptData, decryptData, encryptFields } = require('./utils/encryption');

// Encrypt single field
const encrypted = encryptData('sensitive-data');

// Store in database
await db.query('INSERT INTO table (encrypted_field) VALUES (?)', [encrypted]);

// Decrypt when retrieving
const decrypted = decryptData(encrypted);

// Encrypt multiple fields in object
const user = {
  name: 'John Doe',
  ssn: '123-45-6789',
  phone: '555-1234'
};

const encrypted = encryptFields(user, ['ssn', 'phone']);
```

### Frontend - Secure Storage

```typescript
import { SecureStorageService } from './services/secure-storage.service';

constructor(private secureStorage: SecureStorageService) {}

async saveToken(token: string) {
  await this.secureStorage.setSecure('auth_token', token);
}

async getToken(): Promise<string | null> {
  return await this.secureStorage.getSecure('auth_token');
}
```

## Migration Strategy

### For Existing Data

1. **Create migration script** to encrypt existing sensitive fields
2. **Backup database** before migration
3. **Run gradual migration** to minimize downtime
4. **Support both encrypted/unencrypted** during transition

Example migration:

```javascript
// migrations/encrypt_existing_data.js
const db = require('../config/db');
const { encryptData } = require('../utils/encryption');

async function migrateData() {
  const [rows] = await db.query('SELECT id, sensitive_field FROM table WHERE sensitive_field IS NOT NULL');
  
  for (const row of rows) {
    try {
      // Check if already encrypted (has format iv:authTag:data)
      if (row.sensitive_field.split(':').length === 3) {
        continue; // Already encrypted
      }
      
      const encrypted = encryptData(row.sensitive_field);
      await db.query('UPDATE table SET sensitive_field = ? WHERE id = ?', [encrypted, row.id]);
      console.log(`Encrypted record ${row.id}`);
    } catch (error) {
      console.error(`Failed to encrypt record ${row.id}:`, error);
    }
  }
}

migrateData().then(() => console.log('Migration complete'));
```

## Fields Recommended for Encryption

### High Priority (PII)
- Student ID numbers (if not used as primary key)
- Phone numbers
- Addresses
- Emergency contact information
- Geolocation coordinates (latitude/longitude)

### Medium Priority
- Email addresses (consider hashing for lookups)
- Department/program information
- QR code data (if contains PII)

### Low Priority (Already Secured)
- Passwords (already bcrypt hashed)
- JWT tokens (already signed)
- Timestamps and non-sensitive metadata

## Security Best Practices

1. **Never commit encryption keys** to version control
2. **Rotate keys periodically** (e.g., every 90 days)
3. **Use different keys** for dev/staging/production
4. **Monitor failed decryption attempts** for security incidents
5. **Implement key management** service for enterprise use

## Compliance

This encryption implementation helps meet:
- ✅ **GDPR** - Data protection and encryption requirements
- ✅ **HIPAA** - If handling health data
- ✅ **PCI DSS** - If handling payment information
- ✅ **Philippine Data Privacy Act** - Local compliance

## Performance Considerations

- Encryption adds ~1-5ms latency per operation
- Use encryption selectively for sensitive fields only
- Consider caching decrypted data in memory (with caution)
- Database indices on encrypted fields won't work (use searchable encryption if needed)

## Troubleshooting

### "ENCRYPTION_KEY not found"
- Add ENCRYPTION_KEY to your .env file
- Generate a key using the command above

### "Invalid encrypted data format"
- Data might not be encrypted yet
- Run migration script for existing data
- Check if encryption key changed

### Performance Issues
- Reduce number of encrypted fields
- Implement caching layer
- Use async/await properly

## Testing

Test encryption in development:

```bash
# Backend
cd GCORG_APIv1
node -e "const {encryptData, decryptData} = require('./src/utils/encryption'); const encrypted = encryptData('test'); console.log('Encrypted:', encrypted); console.log('Decrypted:', decryptData(encrypted));"

# Frontend
# Open browser console and test SecureStorageService
```

## Key Rotation Procedure

When rotating encryption keys:

1. Generate new key
2. Add as ENCRYPTION_KEY_NEW to .env
3. Update code to decrypt with old key, re-encrypt with new key
4. Run migration to re-encrypt all data
5. Remove old key after successful migration
6. Update ENCRYPTION_KEY to the new value

---

**Last Updated**: January 3, 2026
**Maintained By**: Development Team
