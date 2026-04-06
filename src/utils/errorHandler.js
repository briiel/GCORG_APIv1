// Standardized success/error response helpers and validation error formatters

const { logError } = require('./error-logger');

// Send a JSON success response (default 200)
const handleSuccessResponse = (res, data, statusCode = 200) => {
    res.status(statusCode).json({ success: true, data });
};

// Send a JSON error response; logs 5xx errors to console
const handleErrorResponse = (res, message, statusCode = 500, errors = null) => {
    const response = { success: false, message: message || 'Internal Server Error' };
    if (errors && Array.isArray(errors) && errors.length > 0) response.errors = errors;
    if (statusCode >= 500) console.error(`[${statusCode}] ${message}`);
    res.status(statusCode).json(response);
};

// Normalize validation errors from arrays or key-value objects into a flat array
const formatValidationErrors = (errors) => {
    if (Array.isArray(errors)) return errors;
    if (typeof errors === 'object') {
        return Object.keys(errors).map(key => ({ field: key, message: errors[key] }));
    }
    return [];
};

// Strip stack traces and internal details for safe client-facing error output
const sanitizeError = (err) => {
    const isDev = process.env.NODE_ENV !== 'production';
    return {
        message: err.message || 'An error occurred',
        ...(isDev && { stack: err.stack }),
        ...(err.errors && { errors: err.errors }),
        ...(err.statusCode && { statusCode: err.statusCode })
    };
};

module.exports = {
    handleSuccessResponse,
    handleErrorResponse,
    formatValidationErrors,
    sanitizeError
};
