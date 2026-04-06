// MySQL2 promise pool with connection retry logic and optional session timezone configuration

const mysql = require('mysql2');
require('dotenv').config();

const poolConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    maxIdle: 2,
    idleTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 30000,
    // Enable SSL for production databases
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    // Return dates as strings to keep timezone handling explicit (see utils/dbDate.js)
    dateStrings: true
};

// Optionally apply the mysql2 driver timezone from env (disabled by default to prevent double-offset issues with CONVERT_TZ)
const dbTimeZone = process.env.DB_TIME_ZONE || process.env.DB_TIMEZONE || null;
const setDriverTz = process.env.DB_SET_DRIVER_TZ === 'true';
if (dbTimeZone && setDriverTz) {
    poolConfig.timezone = dbTimeZone;
}

const pool = mysql.createPool(poolConfig);

// Force MySQL session timezone to UTC on each new connection (production default)
const shouldSetSessionTz = (process.env.DB_SET_SESSION_TZ === 'true') || (process.env.NODE_ENV === 'production');
if (shouldSetSessionTz) {
    const tzToSet = dbTimeZone || '+00:00';
    pool.on('connection', (conn) => {
        try {
            conn.query(`SET time_zone = ${mysql.escape(tzToSet)}`, (err) => {
                if (err) console.warn('Failed to set session time_zone:', err?.message ?? err);
                else console.info('Applied session time_zone =', tzToSet);
            });
        } catch (e) {
            console.warn('Failed to apply session time_zone on new connection:', e?.message ?? e);
        }
    });
}

// Log pool-level errors and warn on recoverable disconnects
pool.on('error', (err) => {
    const { logError } = require('./utils/error-logger');
    const { DatabaseError } = require('./utils/error-classes');
    console.error('Database pool error:', err.code, err.message);
    logError(new DatabaseError('Database pool error occurred', err));
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        console.warn('Database connection lost. Pool will attempt to reconnect.');
    }
});

const promisePool = pool.promise();

// Wrap query/execute with automatic exponential-backoff retry for transient errors
const originalQuery   = promisePool.query.bind(promisePool);
const originalExecute = promisePool.execute ? promisePool.execute.bind(promisePool) : null;

const withRetry = (fn) => async (sql, params, maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn(sql, params);
        } catch (err) {
            lastError = err;
            const isRetryable = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code) || err.errno === -104;
            if (isRetryable && attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, Math.min(2000 * Math.pow(2, attempt - 1), 10000)));
            } else {
                throw lastError;
            }
        }
    }
    throw lastError;
};

promisePool.query = withRetry(originalQuery);
if (originalExecute) promisePool.execute = withRetry(originalExecute);

module.exports = promisePool;
