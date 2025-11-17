/**
 * Database query retry utility to handle transient connection errors
 */

const isRetryableError = (error) => {
    const retryableCodes = [
        'ECONNRESET',
        'PROTOCOL_CONNECTION_LOST',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
        'ER_LOCK_DEADLOCK'
    ];
    
    return retryableCodes.includes(error.code) || 
           error.errno === -104 || // ECONNRESET errno
           error.message?.includes('Connection lost') ||
           error.message?.includes('ECONNRESET');
};

/**
 * Retry a database query operation with exponential backoff
 * @param {Function} queryFn - Async function that performs the database query
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 100)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 5000)
 * @param {string} options.operationName - Name of the operation for logging
 * @returns {Promise} Result of the query
 */
const retryQuery = async (queryFn, options = {}) => {
    const {
        maxRetries = 3,
        initialDelay = 100,
        maxDelay = 5000,
        operationName = 'Database query'
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;

            // Don't retry if it's not a retryable error
            if (!isRetryableError(error)) {
                console.error(`${operationName} failed with non-retryable error:`, error.message);
                throw error;
            }

            // Don't retry if we've exhausted all attempts
            if (attempt > maxRetries) {
                console.error(`${operationName} failed after ${maxRetries} retries:`, error.message);
                throw error;
            }

            // Log the retry attempt
            console.warn(
                `${operationName} failed (attempt ${attempt}/${maxRetries + 1}): ${error.message}. ` +
                `Retrying in ${delay}ms...`
            );

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));

            // Exponential backoff with jitter
            delay = Math.min(delay * 2 + Math.random() * 100, maxDelay);
        }
    }

    throw lastError;
};

module.exports = {
    retryQuery,
    isRetryableError
};
