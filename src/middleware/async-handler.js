/**
 * Async Handler Middleware
 * Wraps async route handlers to catch errors automatically
 * Eliminates the need for try-catch blocks in controllers
 */

/**
 * Wraps an async function and catches any errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = asyncHandler;
