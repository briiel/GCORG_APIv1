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
    // Timeout for connection establishment (in milliseconds)
    connectTimeout: 60000,
    // Maximum number of milliseconds to wait when checking out a connection
    acquireTimeout: 60000,
    // Maximum lifetime of a connection in the pool (10 minutes)
    maxIdle: 600000,
    // How often to check for idle connections to kill (in milliseconds)
    idleTimeout: 60000,
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
