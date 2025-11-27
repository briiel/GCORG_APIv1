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
    connectTimeout: 30000, // Increased to 30 seconds for slow cloud DBs
    // SSL configuration for production databases
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : undefined
    ,
    // Return date/time fields as strings to avoid automatic JS Date conversion
    // by the driver. This makes timezone handling explicit and deterministic
    // in application code (we provide `src/utils/dbDate.js` to parse these).
    dateStrings: true
};
// Allow specifying a connection timezone so the mysql2 driver parses
// TIMESTAMP/DATETIME fields consistently. Prefer using the pool `timezone`
// option (applies driver-side) instead of issuing `SET time_zone` on every
// connection which can produce double-conversion issues when the app already
// handles timezone conversion via SQL (e.g. CONVERT_TZ) or the server uses UTC.
const dbTimeZone = process.env.DB_TIME_ZONE || process.env.DB_TIMEZONE || null;
// By default we DO NOT set the mysql2 driver's `timezone` option because
// the application uses SQL `CONVERT_TZ(..., EVENT_TZ_OFFSET, '+00:00')`
// in queries and also may rely on the DB server timezone. Setting both the
// driver timezone and converting in SQL leads to double timezone shifts.
//
// If you really want the driver to parse/serialize dates using the given
// offset, explicitly opt in by setting `DB_SET_DRIVER_TZ=true` in your env.
const setDriverTz = process.env.DB_SET_DRIVER_TZ === 'true';
if (dbTimeZone && setDriverTz) {
    // mysql2 accepts offsets like '+08:00' or 'Z'. Only apply when explicitly enabled.
    poolConfig.timezone = dbTimeZone;

    // If you also want to set the MySQL session time_zone, set `DB_SET_SESSION_TZ=true`.
}

const pool = mysql.createPool(poolConfig);

// Decide whether to set the MySQL session timezone on new connections.
// For production deployments it's safer to force the DB session to UTC so
// `NOW()` and other server-side functions return UTC. This prevents surprises
// when the cloud DB server's SYSTEM timezone is not UTC (Alwaysdata often
// uses SYSTEM). We enable this behavior when either `DB_SET_SESSION_TZ=true`
// or when running in production (`NODE_ENV=production`). To opt-out set
// `DB_SET_SESSION_TZ=false` explicitly.
const shouldSetSessionTz = (process.env.DB_SET_SESSION_TZ === 'true') || (process.env.NODE_ENV === 'production');
if (shouldSetSessionTz) {
    const tzToSet = dbTimeZone || '+00:00';
    pool.on('connection', (conn) => {
        try {
            conn.query(`SET time_zone = ${mysql.escape(tzToSet)}`, (err) => {
                if (err) console.warn('Failed to set session time_zone:', err && err.message ? err.message : err);
                else console.info('Applied session time_zone =', tzToSet);
            });
        } catch (e) {
            console.warn('Failed to apply session time_zone on new connection:', e && e.message ? e.message : e);
        }
    });
}
// Handle connection errors
pool.on('error', (err) => {
    console.error('Database pool error:', err.code, err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        
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
                               err.code === 'ENOTFOUND' ||
                               err.errno === -104;
            
            if (isRetryable && attempt < maxRetries) {
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
                
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
                                   err.code === 'ENOTFOUND' ||
                                   err.errno === -104;
                
                if (isRetryable && attempt < maxRetries) {
                    const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
                    
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
