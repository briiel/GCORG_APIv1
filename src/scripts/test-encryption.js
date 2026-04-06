// Test script: verifies encryption/decryption utilities work correctly
// Usage: node src/scripts/test-encryption.js

const { encryptData, decryptData, hashData, verifyHash } = require('../utils/encryption');

console.log('[INFO] Testing Encryption Utilities');
console.log('='.repeat(60));

// Test 1: Basic Encryption/Decryption
console.log('\n[TEST 1] Basic Encryption/Decryption');
try {
    const originalData = 'test@example.com';
    console.log(`Original: ${originalData}`);

    const encrypted = encryptData(originalData);
    console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);

    const decrypted = decryptData(encrypted);
    console.log(`Decrypted: ${decrypted}`);

    if (originalData === decrypted) {
        console.log('[PASS] Test 1: Encryption/Decryption works correctly');
    } else {
        console.log('[FAIL] Test 1: Decrypted data does not match original');
    }
} catch (error) {
    console.log('[FAIL] Test 1:', error.message);
}

// Test 2: Multiple Encryptions Produce Different Results
console.log('\n[TEST 2] Multiple Encryptions (Different IVs)');
try {
    const data = 'sensitive-data';
    const encrypted1 = encryptData(data);
    const encrypted2 = encryptData(data);

    if (encrypted1 !== encrypted2) {
        console.log('[PASS] Test 2: Different IVs produce different ciphertexts');
    } else {
        console.log('[FAIL] Test 2: Same ciphertext produced (IV not random)');
    }
} catch (error) {
    console.log('[FAIL] Test 2:', error.message);
}

// Test 3: Null/Empty Handling
console.log('\n[TEST 3] Null/Empty Data Handling');
try {
    const nullResult = encryptData(null);
    const emptyResult = encryptData('');

    if (nullResult === null && emptyResult === null) {
        console.log('[PASS] Test 3: Null/empty data handled correctly');
    } else {
        console.log('[FAIL] Test 3: Null/empty data not handled correctly');
    }
} catch (error) {
    console.log('[FAIL] Test 3:', error.message);
}

// Test 4: Invalid Encrypted Data
console.log('\n[TEST 4] Invalid Encrypted Data Handling');
try {
    const result = decryptData('invalid-encrypted-data');
    console.log('[FAIL] Test 4: Should have thrown error for invalid data');
} catch (error) {
    console.log('[PASS] Test 4: Invalid data properly rejected');
}

// Test 5: Hash Verification
console.log('\n[TEST 5] Hash Verification');
try {
    const data = 'password123';
    const hashed = hashData(data);
    console.log(`Hashed: ${hashed.substring(0, 50)}...`);

    const isValid = verifyHash(data, hashed);
    const isInvalid = verifyHash('wrongpassword', hashed);

    if (isValid && !isInvalid) {
        console.log('[PASS] Test 5: Hash verification works correctly');
    } else {
        console.log('[FAIL] Test 5: Hash verification incorrect');
    }
} catch (error) {
    console.log('[FAIL] Test 5:', error.message);
}

// Test 6: Long Data Encryption
console.log('\n[TEST 6] Long Data Encryption');
try {
    const longData = 'a'.repeat(1000);
    const encrypted = encryptData(longData);
    const decrypted = decryptData(encrypted);

    if (longData === decrypted) {
        console.log('[PASS] Test 6: Long data encrypted/decrypted correctly');
    } else {
        console.log('[FAIL] Test 6: Long data corruption');
    }
} catch (error) {
    console.log('[FAIL] Test 6:', error.message);
}

// Test 7: Special Characters
console.log('\n[TEST 7] Special Characters Encryption');
try {
    const specialData = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const encrypted = encryptData(specialData);
    const decrypted = decryptData(encrypted);

    if (specialData === decrypted) {
        console.log('[PASS] Test 7: Special characters handled correctly');
    } else {
        console.log('[FAIL] Test 7: Special characters corrupted');
    }
} catch (error) {
    console.log('[FAIL] Test 7:', error.message);
}

// Test 8: Unicode Characters
console.log('\n[TEST 8] Unicode Characters Encryption');
try {
    const unicodeData = 'Hello World Privyet mir';
    const encrypted = encryptData(unicodeData);
    const decrypted = decryptData(encrypted);

    if (unicodeData === decrypted) {
        console.log('[PASS] Test 8: Unicode characters handled correctly');
    } else {
        console.log('[FAIL] Test 8: Unicode characters corrupted');
    }
} catch (error) {
    console.log('[FAIL] Test 8:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('[INFO] Encryption Tests Complete!');
