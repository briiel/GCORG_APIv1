// UNUSED — database retry logic with exponential backoff, not yet integrated into any model or route

/* COMMENTED OUT - Retry logic not integrated

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
           error.errno === -104 ||
           error.message?.includes('Connection lost') ||
           error.message?.includes('ECONNRESET');
};

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
            if (!isRetryableError(error)) {
                console.error(`${operationName} failed with non-retryable error:`, error.message);
                throw error;
            }
            if (attempt > maxRetries) {
                console.error(`${operationName} failed after ${maxRetries} retries:`, error.message);
                throw error;
            }
            console.warn(
                `${operationName} failed (attempt ${attempt}/${maxRetries + 1}): ${error.message}. ` +
                `Retrying in ${delay}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2 + Math.random() * 100, maxDelay);
        }
    }

    throw lastError;
};

module.exports = { retryQuery, isRetryableError };
*/
