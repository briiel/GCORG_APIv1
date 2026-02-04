/**
 * Error Logger
 * Handles error logging with console and file output
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

/**
 * Format timestamp for logs
 */
const formatTimestamp = () => {
    return new Date().toISOString();
};

/**
 * Get log file path
 */
const getLogFilePath = () => {
    const logsDir = path.join(__dirname, '../../logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch (err) {
            console.error('Failed to create logs directory:', err.message);
        }
    }

    const date = new Date().toISOString().split('T')[0];
    return path.join(logsDir, `error-${date}.log`);
};

/**
 * Write to log file
 */
const writeToFile = (logEntry) => {
    if (process.env.NODE_ENV === 'production') {
        try {
            const logFilePath = getLogFilePath();
            fs.appendFileSync(logFilePath, logEntry + '\n', 'utf8');
        } catch (err) {
            console.error('Failed to write to log file:', err.message);
        }
    }
};

/**
 * Format error for logging
 */
const formatError = (err, req = null) => {
    const errorInfo = {
        timestamp: formatTimestamp(),
        name: err.name || 'Error',
        message: err.message || 'Unknown error',
        statusCode: err.statusCode || 500,
        stack: err.stack,
        isOperational: err.isOperational || false
    };

    // Add request context if available
    if (req) {
        errorInfo.request = {
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?.userId || req.user?.id || null
        };
    }

    // Add validation errors if present
    if (err.errors) {
        errorInfo.validationErrors = err.errors;
    }

    // Add original error for database errors
    if (err.originalError) {
        errorInfo.originalError = {
            message: err.originalError.message,
            code: err.originalError.code,
            errno: err.originalError.errno
        };
    }

    return errorInfo;
};

/**
 * Log error to console with colors (development)
 */
const logToConsole = (errorInfo) => {
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
        console.error('\n' + colors.red + '═══════════════════════════════════════════════════════════' + colors.reset);
        console.error(colors.red + '❌ ERROR OCCURRED' + colors.reset);
        console.error(colors.red + '═══════════════════════════════════════════════════════════' + colors.reset);
        console.error(colors.cyan + 'Timestamp:' + colors.reset, errorInfo.timestamp);
        console.error(colors.cyan + 'Type:' + colors.reset, errorInfo.name);
        console.error(colors.cyan + 'Status Code:' + colors.reset, errorInfo.statusCode);
        console.error(colors.cyan + 'Message:' + colors.reset, errorInfo.message);
        console.error(colors.cyan + 'Operational:' + colors.reset, errorInfo.isOperational);

        if (errorInfo.request) {
            console.error(colors.yellow + '\n📍 Request Context:' + colors.reset);
            console.error(colors.gray + '  Method:' + colors.reset, errorInfo.request.method);
            console.error(colors.gray + '  URL:' + colors.reset, errorInfo.request.url);
            console.error(colors.gray + '  IP:' + colors.reset, errorInfo.request.ip);
            console.error(colors.gray + '  User ID:' + colors.reset, errorInfo.request.userId || 'N/A');
        }

        if (errorInfo.validationErrors && errorInfo.validationErrors.length > 0) {
            console.error(colors.magenta + '\n⚠️  Validation Errors:' + colors.reset);
            errorInfo.validationErrors.forEach(err => {
                console.error(colors.gray + '  -' + colors.reset, err);
            });
        }

        if (errorInfo.originalError) {
            console.error(colors.yellow + '\n🔍 Original Error:' + colors.reset);
            console.error(colors.gray + '  Message:' + colors.reset, errorInfo.originalError.message);
            console.error(colors.gray + '  Code:' + colors.reset, errorInfo.originalError.code);
        }

        if (errorInfo.stack) {
            console.error(colors.blue + '\n📚 Stack Trace:' + colors.reset);
            console.error(colors.gray + errorInfo.stack + colors.reset);
        }

        console.error(colors.red + '═══════════════════════════════════════════════════════════' + colors.reset + '\n');
    } else {
        // Production: simpler console output
        console.error(`[${errorInfo.timestamp}] ${errorInfo.name}: ${errorInfo.message}`);
    }
};

/**
 * Main error logging function
 */
const logError = (err, req = null) => {
    const errorInfo = formatError(err, req);

    // Log to console
    logToConsole(errorInfo);

    // Log to file (production only)
    const logEntry = JSON.stringify(errorInfo, null, 2);
    writeToFile(logEntry);

    return errorInfo;
};

/**
 * Log info message
 */
const logInfo = (message, context = {}) => {
    const logEntry = {
        timestamp: formatTimestamp(),
        level: 'INFO',
        message,
        ...context
    };

    if (process.env.NODE_ENV !== 'production') {
        console.log(colors.cyan + 'ℹ️ ' + colors.reset + message, context);
    }

    writeToFile(JSON.stringify(logEntry));
};

/**
 * Log warning message
 */
const logWarning = (message, context = {}) => {
    const logEntry = {
        timestamp: formatTimestamp(),
        level: 'WARNING',
        message,
        ...context
    };

    if (process.env.NODE_ENV !== 'production') {
        console.warn(colors.yellow + '⚠️  ' + colors.reset + message, context);
    }

    writeToFile(JSON.stringify(logEntry));
};

module.exports = {
    logError,
    logInfo,
    logWarning
};
