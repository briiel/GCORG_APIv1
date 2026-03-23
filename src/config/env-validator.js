function isHex(str) {
  return typeof str === 'string' && /^[0-9a-fA-F]+$/.test(str);
}

function validateEnvironment() {
  const requiredVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'CRON_JOB_SECRET',
    'ENCRYPTION_KEY'
  ];

  const missing = requiredVars.filter((name) => !process.env[name] || String(process.env[name]).trim() === '');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const encryptionKey = String(process.env.ENCRYPTION_KEY).trim();
  if (encryptionKey.length !== 64 || !isHex(encryptionKey)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal string.');
  }
}

module.exports = { validateEnvironment };
