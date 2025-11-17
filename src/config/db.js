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
    // SSL configuration for production databases
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : undefined
};

const pool = mysql.createPool(poolConfig);

// Handle connection errors
pool.on('error', (err) => {
    console.error('Database pool error:', err.code, err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        console.log('Database connection lost. Pool will reconnect automatically.');
    }
});

const promisePool = pool.promise();

// Store the original query method
const originalQuery = promisePool.query.bind(promisePool);
const originalExecute = promisePool.execute ? promisePool.execute.bind(promisePool) : null;

// Wrapper with automatic retry logic
const queryWithRetry = async (sql, params, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await originalQuery(sql, params);
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

// Override the query method with retry logic
promisePool.query = queryWithRetry;

// Override execute if it exists
if (originalExecute) {
    promisePool.execute = async (sql, params, maxRetries = 3) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await originalExecute(sql, params);
                return result;
            } catch (err) {
                lastError = err;
                const isRetryable = err.code === 'ECONNRESET' || 
                                   err.code === 'PROTOCOL_CONNECTION_LOST' ||
                                   err.code === 'ETIMEDOUT' ||
                                   err.errno === -104;
                
                if (isRetryable && attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.log(`Database execute failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, err.code);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw lastError;
                }
            }
        }
        
        throw lastError;
    };
}

module.exports = promisePool;
