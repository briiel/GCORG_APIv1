const mysql = require('mysql2');
require('dotenv').config();

const poolConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 5, // Reduced to avoid overwhelming the DB
    queueLimit: 0,
    maxIdle: 2, // Keep fewer idle connections
    idleTimeout: 30000, // Close idle connections faster (30 seconds)
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // Keep-alive after 10 seconds
    connectTimeout: 10000, // Faster timeout (10 seconds)
    acquireTimeout: 10000,
    timeout: 20000, // Faster query timeout
    // SSL configuration for production databases
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : undefined
};

const db = mysql.createPool(poolConfig);

// Handle connection errors
db.on('error', (err) => {
    console.error('Database pool error:', err.code, err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        console.log('Database connection lost. Pool will reconnect automatically.');
    }
});

const promisePool = db.promise();

// Wrapper with automatic retry logic
const queryWithRetry = async (sql, params, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await promisePool.query(sql, params);
            return result;
        } catch (err) {
            lastError = err;
            const isRetryable = err.code === 'ECONNRESET' || 
                               err.code === 'PROTOCOL_CONNECTION_LOST' ||
                               err.code === 'ETIMEDOUT' ||
                               err.errno === -104;
            
            if (isRetryable && attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
                console.log(`Database query failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, err.code);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw lastError;
            }
        }
    }
    
    throw lastError;
};

// Export both the original pool and the retry wrapper
module.exports = promisePool;
module.exports.query = queryWithRetry;
module.exports.execute = async (sql, params) => {
    const [rows] = await queryWithRetry(sql, params);
    return [rows];
};
