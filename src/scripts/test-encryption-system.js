/**
 * Comprehensive AES Encryption System Test
 * Tests all encryption functionality across the system
 * 
 * Usage:
 * node src/scripts/test-encryption-system.js
 */

const { encryptData, decryptData, hashData, verifyHash, encryptFields, decryptFields } = require('../utils/encryption');

console.log('🔐 Testing AES Encryption System');
console.log('='.repeat(80));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        console.log(`\n📝 Test ${totalTests}: ${name}`);
        fn();
        passedTests++;
        console.log('✅ PASSED');
    } catch (error) {
        failedTests++;
        console.log('❌ FAILED:', error.message);
    }
}

// Test 1: Basic Encryption/Decryption
test('Basic Encryption/Decryption', () => {
    const original = 'test@example.com';
    const encrypted = encryptData(original);
    const decrypted = decryptData(encrypted);
    
    if (original !== decrypted) {
        throw new Error('Decrypted data does not match original');
    }
    console.log(`  Original: ${original}`);
    console.log(`  Encrypted: ${encrypted.substring(0, 50)}...`);
    console.log(`  Decrypted: ${decrypted}`);
});

// Test 2: Encrypted Format Validation
test('Encrypted Format Validation', () => {
    const data = 'sensitive-data';
    const encrypted = encryptData(data);
    const parts = encrypted.split(':');
    
    if (parts.length !== 3) {
        throw new Error('Encrypted data format is invalid (expected 3 parts)');
    }
    console.log(`  Format check: ${parts.length} parts (iv:authTag:data) ✓`);
});

// Test 3: Different IVs for Same Data
test('Different IVs for Same Data', () => {
    const data = 'test-data';
    const enc1 = encryptData(data);
    const enc2 = encryptData(data);
    
    if (enc1 === enc2) {
        throw new Error('Same ciphertext produced (IV not random)');
    }
    console.log('  Different IVs produce different ciphertexts ✓');
});

// Test 4: Null/Empty Data Handling
test('Null/Empty Data Handling', () => {
    const nullResult = encryptData(null);
    const emptyResult = encryptData('');
    
    if (nullResult !== null || emptyResult !== null) {
        throw new Error('Null/empty data not handled correctly');
    }
    console.log('  Null and empty strings handled correctly ✓');
});

// Test 5: Invalid Data Decryption
test('Invalid Data Decryption', () => {
    try {
        decryptData('invalid-data');
        throw new Error('Should have thrown error for invalid data');
    } catch (err) {
        if (err.message.includes('Should have thrown')) {
            throw err;
        }
        console.log('  Invalid data properly rejected ✓');
    }
});

// Test 6: Hash and Verify
test('Hash and Verify', () => {
    const password = 'mySecurePassword123!';
    const hashed = hashData(password);
    const isValid = verifyHash(password, hashed);
    const isInvalid = verifyHash('wrongPassword', hashed);
    
    if (!isValid || isInvalid) {
        throw new Error('Hash verification failed');
    }
    console.log('  Hash verification works correctly ✓');
});

// Test 7: Long Data Encryption
test('Long Data Encryption', () => {
    const longData = 'a'.repeat(10000);
    const encrypted = encryptData(longData);
    const decrypted = decryptData(encrypted);
    
    if (longData !== decrypted) {
        throw new Error('Long data corrupted during encryption/decryption');
    }
    console.log(`  Successfully encrypted/decrypted ${longData.length} characters ✓`);
});

// Test 8: Special Characters
test('Special Characters', () => {
    const special = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const encrypted = encryptData(special);
    const decrypted = decryptData(encrypted);
    
    if (special !== decrypted) {
        throw new Error('Special characters corrupted');
    }
    console.log('  Special characters preserved ✓');
});

// Test 9: Unicode Characters
test('Unicode Characters', () => {
    const unicode = '你好世界 🔐 مرحبا العالم Привет мир';
    const encrypted = encryptData(unicode);
    const decrypted = decryptData(encrypted);
    
    if (unicode !== decrypted) {
        throw new Error('Unicode characters corrupted');
    }
    console.log('  Unicode characters preserved ✓');
});

// Test 10: Email Encryption (Real-world scenario)
test('Email Encryption Scenario', () => {
    const email = '202211223@gordoncollege.edu.ph';
    const encrypted = encryptData(email);
    const decrypted = decryptData(encrypted);
    
    if (email !== decrypted) {
        throw new Error('Email encryption failed');
    }
    
    // Check if it looks encrypted (format check)
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
        throw new Error('Email not properly encrypted');
    }
    
    console.log(`  Email: ${email}`);
    console.log(`  Encrypted length: ${encrypted.length} characters`);
    console.log('  Email encryption working correctly ✓');
});

// Test 11: Detect Encrypted vs Plain Text
test('Detect Encrypted vs Plain Text', () => {
    const plainEmail = 'test@example.com';
    const encryptedEmail = encryptData(plainEmail);
    
    // Detection logic used in the codebase
    const isEncrypted = (email) => {
        return email && email.includes(':') && email.split(':').length === 3;
    };
    
    if (isEncrypted(plainEmail)) {
        throw new Error('Plain email incorrectly detected as encrypted');
    }
    
    if (!isEncrypted(encryptedEmail)) {
        throw new Error('Encrypted email not detected as encrypted');
    }
    
    console.log('  Encryption detection logic works ✓');
});

// Test 12: encryptFields/decryptFields
test('encryptFields and decryptFields', () => {
    const user = {
        id: '123456789',
        email: 'student@gordon.edu.ph',
        firstName: 'John',
        lastName: 'Doe',
        password_hash: 'hashed_password'
    };
    
    const encrypted = encryptFields(user, ['email']);
    const decrypted = decryptFields(encrypted, ['email']);
    
    if (user.email !== decrypted.email) {
        throw new Error('Field encryption/decryption failed');
    }
    
    if (encrypted.email === user.email) {
        throw new Error('Email was not encrypted');
    }
    
    console.log('  Field-level encryption working correctly ✓');
});

// Test 13: Multiple Field Encryption
test('Multiple Field Encryption', () => {
    const data = {
        email: 'test@example.com',
        phone: '+639123456789',
        ssn: '123-45-6789',
        name: 'John Doe'
    };
    
    const encrypted = encryptFields(data, ['email', 'phone', 'ssn']);
    const decrypted = decryptFields(encrypted, ['email', 'phone', 'ssn']);
    
    if (data.email !== decrypted.email || 
        data.phone !== decrypted.phone || 
        data.ssn !== decrypted.ssn ||
        data.name !== decrypted.name) {
        throw new Error('Multiple field encryption failed');
    }
    
    console.log('  Multiple fields encrypted/decrypted correctly ✓');
});

// Test 14: AES-256-GCM Authentication Tag
test('AES-256-GCM Authentication Tag Validation', () => {
    const data = 'sensitive-data';
    const encrypted = encryptData(data);
    
    // Tamper with the auth tag
    const parts = encrypted.split(':');
    const originalAuthTag = parts[1];
    // Flip some bits in the auth tag to corrupt it
    const tamperedAuthTag = originalAuthTag.substring(0, originalAuthTag.length - 2) + 'FF';
    parts[1] = tamperedAuthTag;
    const tampered = parts.join(':');
    
    try {
        decryptData(tampered);
        throw new Error('Tampered data should have failed decryption');
    } catch (err) {
        if (err.message.includes('should have failed')) {
            throw err;
        }
        console.log('  Authentication tag validation working ✓');
    }
});

// Test 15: Environment Key Check
test('Environment Key Configuration', () => {
    if (!process.env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY not set in environment');
    }
    
    if (process.env.ENCRYPTION_KEY.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be 64 hex characters');
    }
    
    console.log('  ENCRYPTION_KEY properly configured ✓');
});

console.log('\n' + '='.repeat(80));
console.log('📊 Test Results:');
console.log(`   Total Tests: ${totalTests}`);
console.log(`   ✅ Passed: ${passedTests}`);
console.log(`   ❌ Failed: ${failedTests}`);
console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log('='.repeat(80));

if (failedTests === 0) {
    console.log('\n🎉 All tests passed! AES encryption system is working correctly.');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
}
