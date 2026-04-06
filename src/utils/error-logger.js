// Error logger: colorized console output in development, file-based in production

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

const formatTimestamp = () => new Date().toISOString();

// Resolve today's log file path, creating the logs directory if needed
const getLogFilePath = () => {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
        try { fs.mkdirSync(logsDir, { recursive: true }); }
        catch (err) { console.error('Failed to create logs directory:', err.message); }
    }
    const date = new Date().toISOString().split('T')[0];
    return path.join(logsDir, `error-${date}.log`);
};

// Append a log entry to the daily file (production only)
const writeToFile = (logEntry) => {
    if (process.env.NODE_ENV === 'production') {
        try { fs.appendFileSync(getLogFilePath(), logEntry + '\n', 'utf8'); }
        catch (err) { console.error('Failed to write to log file:', err.message); }
    }
};

// Build a structured error info object, optionally enriched with request context
const formatError = (err, req = null) => {
    const errorInfo = {
        timestamp: formatTimestamp(),
        name: err.name || 'Error',
        message: err.message || 'Unknown error',
        statusCode: err.statusCode || 500,
        stack: err.stack,
        isOperational: err.isOperational || false
    };
    if (req) {
        errorInfo.request = {
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.user?.userId || req.user?.id || null
        };
    }
    if (err.errors) errorInfo.validationErrors = err.errors;
    if (err.originalError) {
        errorInfo.originalError = {
            message: err.originalError.message,
            code: err.originalError.code,
            errno: err.originalError.errno
        };
    }
    return errorInfo;
};

// Print a colorized error report to the console (verbose in dev, compact in prod)
const logToConsole = (errorInfo) => {
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
        console.error('\n' + colors.red + '═══════════════════════════════════════════════════════════' + colors.reset);
        console.error(colors.red + '[ERROR] ERROR OCCURRED' + colors.reset);
        console.error(colors.red + '═══════════════════════════════════════════════════════════' + colors.reset);
        console.error(colors.cyan + 'Timestamp:' + colors.reset, errorInfo.timestamp);
        console.error(colors.cyan + 'Type:' + colors.reset, errorInfo.name);
        console.error(colors.cyan + 'Status Code:' + colors.reset, errorInfo.statusCode);
        console.error(colors.cyan + 'Message:' + colors.reset, errorInfo.message);
        console.error(colors.cyan + 'Operational:' + colors.reset, errorInfo.isOperational);
        if (errorInfo.request) {
            console.error(colors.yellow + '\n[INFO] Request Context:' + colors.reset);
            console.error(colors.gray + '  Method:' + colors.reset, errorInfo.request.method);
            console.error(colors.gray + '  URL:' + colors.reset, errorInfo.request.url);
            console.error(colors.gray + '  IP:' + colors.reset, errorInfo.request.ip);
            console.error(colors.gray + '  User ID:' + colors.reset, errorInfo.request.userId || 'N/A');
        }
        if (errorInfo.validationErrors && errorInfo.validationErrors.length > 0) {
            console.error(colors.magenta + '\n[WARN] Validation Errors:' + colors.reset);
            errorInfo.validationErrors.forEach(err => console.error(colors.gray + '  -' + colors.reset, err));
        }
        if (errorInfo.originalError) {
            console.error(colors.yellow + '\n[INFO] Original Error:' + colors.reset);
            console.error(colors.gray + '  Message:' + colors.reset, errorInfo.originalError.message);
            console.error(colors.gray + '  Code:' + colors.reset, errorInfo.originalError.code);
        }
        if (errorInfo.stack) {
            console.error(colors.blue + '\n[INFO] Stack Trace:' + colors.reset);
            console.error(colors.gray + errorInfo.stack + colors.reset);
        }
        console.error(colors.red + '═══════════════════════════════════════════════════════════' + colors.reset + '\n');
    } else {
        console.error(`[${errorInfo.timestamp}] ${errorInfo.name}: ${errorInfo.message}`);
    }
};

// Log an error to console and to file (production)
const logError = (err, req = null) => {
    const errorInfo = formatError(err, req);
    logToConsole(errorInfo);
    writeToFile(JSON.stringify(errorInfo, null, 2));
    return errorInfo;
};

// Log an informational message
const logInfo = (message, context = {}) => {
    const logEntry = { timestamp: formatTimestamp(), level: 'INFO', message, ...context };
    if (process.env.NODE_ENV !== 'production') console.log(colors.cyan + '[INFO] ' + colors.reset + message, context);
    writeToFile(JSON.stringify(logEntry));
};

// Log a warning message
const logWarning = (message, context = {}) => {
    const logEntry = { timestamp: formatTimestamp(), level: 'WARNING', message, ...context };
    if (process.env.NODE_ENV !== 'production') console.warn(colors.yellow + '[WARN] ' + colors.reset + message, context);
    writeToFile(JSON.stringify(logEntry));
};

module.exports = { logError, logInfo, logWarning };
