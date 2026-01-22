/**
 * Setup script to generate encryption key
 * Run this once during initial setup
 * 
 * Usage: node scripts/generate_encryption_key.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n🔐 Encryption Key Generator\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Generate encryption key (32 bytes = 256 bits)
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('Generated Encryption Key:');
console.log(`ENCRYPTION_KEY=${encryptionKey}\n`);

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists');
  console.log('Please manually add the following line to your .env file:\n');
  console.log(`ENCRYPTION_KEY=${encryptionKey}\n`);
  console.log('⚠️  DO NOT COMMIT THIS KEY TO VERSION CONTROL!\n');
} else {
  console.log('Creating .env file...');
  
  let envContent = '';
  
  // Read from .env.example if it exists
  if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }
  
  // Add encryption key
  envContent += `\n# Encryption Key (Generated ${new Date().toISOString()})\n`;
  envContent += `ENCRYPTION_KEY=${encryptionKey}\n`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created with encryption key\n');
}

// Generate JWT secret if not exists
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('Generated JWT Secret (if needed):');
console.log(`JWT_SECRET=${jwtSecret}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n⚠️  SECURITY REMINDER:');
console.log('1. Never commit .env files to version control');
console.log('2. Use different keys for development and production');
console.log('3. Store production keys securely (e.g., environment variables)');
console.log('4. Rotate keys periodically (every 90 days recommended)');
console.log('5. Keep backups of keys in secure location\n');

// Test encryption
console.log('Testing encryption...');
try {
  // Temporarily set environment variable
  process.env.ENCRYPTION_KEY = encryptionKey;
  
  const { encryptData, decryptData } = require('../src/utils/encryption');
  
  const testData = 'Sensitive Information';
  const encrypted = encryptData(testData);
  const decrypted = decryptData(encrypted);
  
  if (decrypted === testData) {
    console.log('✅ Encryption test passed\n');
    console.log(`Original:  ${testData}`);
    console.log(`Encrypted: ${encrypted.substring(0, 40)}...`);
    console.log(`Decrypted: ${decrypted}\n`);
  } else {
    console.log('❌ Encryption test failed\n');
  }
} catch (error) {
  console.log('⚠️  Could not test encryption:', error.message);
  console.log('You may need to install dependencies first: npm install\n');
}

console.log('✅ Setup complete!\n');
