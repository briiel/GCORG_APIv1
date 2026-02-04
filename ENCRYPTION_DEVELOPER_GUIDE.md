# AES Encryption - Developer Quick Reference

## 📚 Quick Usage Guide

### Importing Encryption Utilities

```javascript
const { encryptData, decryptData, encryptFields, decryptFields } = require('../utils/encryption');
```

## 🔐 Common Use Cases

### 1. Encrypt a Single Field (e.g., Email)

```javascript
// When CREATING a new user/admin/org
const encryptedEmail = encryptData(email);

await db.query(
    'INSERT INTO students (id, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
    [student_id, encryptedEmail, hashedPassword, first_name, last_name]
);
```

### 2. Check for Duplicate Encrypted Emails

```javascript
// WRONG ❌ - This will NOT work with encrypted emails
const [existing] = await db.query('SELECT id FROM students WHERE email = ?', [email]);

// CORRECT ✅ - Fetch all and decrypt to compare
const [allStudents] = await db.query('SELECT id, email FROM students');

for (const student of allStudents) {
    try {
        let studentEmail = student.email;
        // Decrypt if encrypted (check format: iv:authTag:data)
        if (studentEmail && studentEmail.includes(':') && studentEmail.split(':').length === 3) {
            studentEmail = decryptData(studentEmail);
        }
        if (studentEmail === email) {
            throw new Error('Email already exists');
        }
    } catch (err) {
        continue; // Skip on decryption error
    }
}
```

### 3. Decrypt When Fetching from Database

```javascript
// In model files
function decryptEmailField(record) {
    if (!record || !record.email) return record;
    
    try {
        // Check if email looks encrypted (format: iv:authTag:data)
        if (typeof record.email === 'string' && record.email.includes(':')) {
            const parts = record.email.split(':');
            if (parts.length === 3) {
                try {
                    record.email = decryptData(record.email);
                } catch (err) {
                    console.error('Failed to decrypt email, using as-is:', err.message);
                }
            }
        }
    } catch (error) {
        console.error('Error decrypting email field:', error);
    }
    
    return record;
}

// Apply to array of records
function decryptEmailArray(records) {
    return records.map(record => decryptEmailField(record));
}

// Usage in model function
const getAllUsers = async () => {
    const [rows] = await db.query('SELECT id, email, name FROM users');
    return decryptEmailArray(rows); // Decrypt before returning
};
```

### 4. Encrypt Multiple Fields in an Object

```javascript
const userData = {
    email: 'student@gordon.edu.ph',
    phone: '+639123456789',
    address: '123 Main St',
    firstName: 'John',
    lastName: 'Doe'
};

// Encrypt specific sensitive fields
const encrypted = encryptFields(userData, ['email', 'phone', 'address']);

// Later, decrypt when needed
const decrypted = decryptFields(encrypted, ['email', 'phone', 'address']);
```

### 5. Check if Data is Encrypted

```javascript
function isEncrypted(value) {
    return value && 
           typeof value === 'string' && 
           value.includes(':') && 
           value.split(':').length === 3;
}

// Usage
if (isEncrypted(user.email)) {
    user.email = decryptData(user.email);
}
```

## 🛡️ Best Practices

### DO ✅

1. **Always encrypt sensitive data before storing**
   ```javascript
   const encryptedEmail = encryptData(email);
   ```

2. **Always decrypt when fetching from database** (in models)
   ```javascript
   return decryptEmailArray(rows);
   ```

3. **Handle decryption errors gracefully**
   ```javascript
   try {
       email = decryptData(encryptedEmail);
   } catch (err) {
       console.error('Decryption failed:', err.message);
       // Use original value or handle appropriately
   }
   ```

4. **Check encryption format before decrypting**
   ```javascript
   if (email.includes(':') && email.split(':').length === 3) {
       email = decryptData(email);
   }
   ```

### DON'T ❌

1. **Don't query encrypted fields directly**
   ```javascript
   // ❌ WRONG - won't find encrypted emails
   SELECT * FROM users WHERE email = 'plain@email.com'
   ```

2. **Don't encrypt passwords** (use bcrypt instead)
   ```javascript
   // ❌ WRONG
   const encryptedPassword = encryptData(password);
   
   // ✅ CORRECT
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

3. **Don't display encrypted data to users**
   ```javascript
   // ❌ WRONG - shows gibberish
   res.json({ email: encryptedEmail });
   
   // ✅ CORRECT - decrypt first
   res.json({ email: decryptData(encryptedEmail) });
   ```

4. **Don't forget to decrypt in model/service layers**
   ```javascript
   // ❌ WRONG - returns encrypted data
   const [users] = await db.query('SELECT * FROM students');
   return users;
   
   // ✅ CORRECT - decrypt before returning
   const [users] = await db.query('SELECT * FROM students');
   return decryptEmailArray(users);
   ```

## 🔍 Debugging

### Check if Encryption Key is Set

```javascript
if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY not set!');
}

if (process.env.ENCRYPTION_KEY.length !== 64) {
    console.error('ENCRYPTION_KEY must be 64 hex characters!');
}
```

### Test Encryption/Decryption

```bash
node src/scripts/test-encryption-system.js
```

### Visual Inspection

Encrypted data looks like this:
```
nK7m9Pq3sT8vW1xY2zA3:dE5f6G7h8I9j0K1l2M3n:ciphertext_base64_here
```

Plain data looks like this:
```
student@gordoncollege.edu.ph
```

## 📋 Checklist for New Features

When adding features that handle user data:

- [ ] Import encryption utilities if handling emails
- [ ] Encrypt emails before INSERT/UPDATE
- [ ] Decrypt emails when SELECT (in model layer)
- [ ] Use decryption loop for duplicate checks
- [ ] Handle both encrypted and plain data (backward compatibility)
- [ ] Add try-catch for decryption operations
- [ ] Test with encrypted data

## 🧪 Testing Encrypted Features

```javascript
// Example test for registration
const testEmail = 'test@gordon.edu.ph';

// 1. Register user
const response = await registerUser(testEmail, password, ...);

// 2. Check database has encrypted email
const [user] = await db.query('SELECT email FROM students WHERE id = ?', [userId]);
assert(user.email.includes(':'), 'Email should be encrypted');

// 3. Login should decrypt and work
const loginResponse = await login(testEmail, password);
assert(loginResponse.success, 'Login should work with plain email');

// 4. Duplicate registration should be blocked
const duplicateResponse = await registerUser(testEmail, password, ...);
assert(duplicateResponse.error, 'Duplicate email should be rejected');
```

## 📞 Support

If you encounter encryption issues:

1. Check `ENCRYPTION_KEY` is set in `.env`
2. Run `node src/scripts/test-encryption-system.js`
3. Check error logs for "decrypt" or "encrypt" errors
4. Verify data format (should have 2 colons if encrypted)
5. See `AES_ENCRYPTION_IMPLEMENTATION_REPORT.md` for details

## 🔗 Related Files

- `src/utils/encryption.js` - Core encryption utilities
- `src/scripts/test-encryption-system.js` - Test suite
- `src/scripts/encrypt-sensitive-data.js` - Migration script
- `AES_ENCRYPTION_IMPLEMENTATION_REPORT.md` - Detailed documentation
