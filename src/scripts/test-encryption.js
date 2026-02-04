/**
 * Test Script: Encryption/Decryption Verification
 * 
 * Tests the encryption utilities to ensure they work correctly
 * 
 * Usage:
 * node src/scripts/test-encryption.js
 */

const { encryptData, decryptData, hashData, verifyHash } = require('../utils/encryption');

console.log('🔐 Testing Encryption Utilities');
console.log('='.repeat(60));

// Test 1: Basic Encryption/Decryption
console.log('\n📝 Test 1: Basic Encryption/Decryption');
try {
    const originalData = 'test@example.com';
    console.log(`Original: ${originalData}`);

    const encrypted = encryptData(originalData);
    console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);

    const decrypted = decryptData(encrypted);
    console.log(`Decrypted: ${decrypted}`);

    if (originalData === decrypted) {
        console.log('✅ Test 1 PASSED: Encryption/Decryption works correctly');
    } else {
        console.log('❌ Test 1 FAILED: Decrypted data does not match original');
    }
} catch (error) {
    console.log('❌ Test 1 FAILED:', error.message);
}

// Test 2: Multiple Encryptions Produce Different Results
console.log('\n📝 Test 2: Multiple Encryptions (Different IVs)');
try {
    const data = 'sensitive-data';
    const encrypted1 = encryptData(data);
    const encrypted2 = encryptData(data);

    if (encrypted1 !== encrypted2) {
        console.log('✅ Test 2 PASSED: Different IVs produce different ciphertexts');
    } else {
        console.log('❌ Test 2 FAILED: Same ciphertext produced (IV not random)');
    }
} catch (error) {
    console.log('❌ Test 2 FAILED:', error.message);
}

// Test 3: Null/Empty Handling
console.log('\n📝 Test 3: Null/Empty Data Handling');
try {
    const nullResult = encryptData(null);
    const emptyResult = encryptData('');

    if (nullResult === null && emptyResult === null) {
        console.log('✅ Test 3 PASSED: Null/empty data handled correctly');
    } else {
        console.log('❌ Test 3 FAILED: Null/empty data not handled correctly');
    }
} catch (error) {
    console.log('❌ Test 3 FAILED:', error.message);
}

// Test 4: Invalid Encrypted Data
console.log('\n📝 Test 4: Invalid Encrypted Data Handling');
try {
    const result = decryptData('invalid-encrypted-data');
    console.log('❌ Test 4 FAILED: Should have thrown error for invalid data');
} catch (error) {
    console.log('✅ Test 4 PASSED: Invalid data properly rejected');
}

// Test 5: Hash Verification
console.log('\n📝 Test 5: Hash Verification');
try {
    const data = 'password123';
    const hashed = hashData(data);
    console.log(`Hashed: ${hashed.substring(0, 50)}...`);

    const isValid = verifyHash(data, hashed);
    const isInvalid = verifyHash('wrongpassword', hashed);

    if (isValid && !isInvalid) {
        console.log('✅ Test 5 PASSED: Hash verification works correctly');
    } else {
        console.log('❌ Test 5 FAILED: Hash verification incorrect');
    }
} catch (error) {
    console.log('❌ Test 5 FAILED:', error.message);
}

// Test 6: Long Data Encryption
console.log('\n📝 Test 6: Long Data Encryption');
try {
    const longData = 'a'.repeat(1000);
    const encrypted = encryptData(longData);
    const decrypted = decryptData(encrypted);

    if (longData === decrypted) {
        console.log('✅ Test 6 PASSED: Long data encrypted/decrypted correctly');
    } else {
        console.log('❌ Test 6 FAILED: Long data corruption');
    }
} catch (error) {
    console.log('❌ Test 6 FAILED:', error.message);
}

// Test 7: Special Characters
console.log('\n📝 Test 7: Special Characters Encryption');
try {
    const specialData = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const encrypted = encryptData(specialData);
    const decrypted = decryptData(encrypted);

    if (specialData === decrypted) {
        console.log('✅ Test 7 PASSED: Special characters handled correctly');
    } else {
        console.log('❌ Test 7 FAILED: Special characters corrupted');
    }
} catch (error) {
    console.log('❌ Test 7 FAILED:', error.message);
}

// Test 8: Unicode Characters
console.log('\n📝 Test 8: Unicode Characters Encryption');
try {
    const unicodeData = '你好世界 🔐 مرحبا العالم';
    const encrypted = encryptData(unicodeData);
    const decrypted = decryptData(encrypted);

    if (unicodeData === decrypted) {
        console.log('✅ Test 8 PASSED: Unicode characters handled correctly');
    } else {
        console.log('❌ Test 8 FAILED: Unicode characters corrupted');
    }
} catch (error) {
    console.log('❌ Test 8 FAILED:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('🎉 Encryption Tests Complete!');
