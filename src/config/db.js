const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Connection pool resilience settings to prevent ECONNRESET errors
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // Automatically remove broken connections from the pool
    removeNodeErrorCount: 3,
    // Retry failed connections
    acquireTimeout: 60000,
    // Timeout for connection establishment
    connectTimeout: 60000,
    // Prevent idle connections from timing out
    idleTimeout: 60000,
    // Maximum time a connection can be used before being retired
    maxIdle: 10,
    // ssl: {
    //     rejectUnauthorized: false
    // }
});

// Handle connection errors gracefully
db.on('connection', (connection) => {
    console.log('New DB connection established');
    
    connection.on('error', (err) => {
        console.error('Database connection error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
            console.log('Connection lost, will be recycled');
        }
    });
});

module.exports = db.promise();
