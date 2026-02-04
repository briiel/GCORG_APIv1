/**
 * Error Handler Utility
 * Provides standardized success and error response formatting
 */

const { logError } = require('./error-logger');

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const handleSuccessResponse = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data
    });
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 500)
 * @param {Object} errors - Additional error details (optional)
 */
const handleErrorResponse = (res, message, statusCode = 500, errors = null) => {
    const response = {
        success: false,
        message: message || 'Internal Server Error'
    };

    // Add validation errors if present
    if (errors && Array.isArray(errors) && errors.length > 0) {
        response.errors = errors;
    }

    // Log error (but don't log validation errors as they're expected)
    if (statusCode >= 500) {
        console.error(`[${statusCode}] ${message}`);
    }

    res.status(statusCode).json(response);
};

/**
 * Format validation errors from various sources
 * @param {Array|Object} errors - Validation errors
 * @returns {Array} - Formatted error array
 */
const formatValidationErrors = (errors) => {
    if (Array.isArray(errors)) {
        return errors;
    }

    if (typeof errors === 'object') {
        return Object.keys(errors).map(key => ({
            field: key,
            message: errors[key]
        }));
    }

    return [];
};

/**
 * Sanitize error for client response
 * Removes sensitive information from error objects
 * @param {Error} err - Error object
 * @returns {Object} - Sanitized error info
 */
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
