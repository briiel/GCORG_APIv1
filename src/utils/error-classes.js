/**
 * Custom Error Classes
 * Provides specific error types for better error handling and categorization
 */

/**
 * Base Application Error
 * All custom errors extend from this class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation Error (400)
 * Used for input validation failures
 */
class ValidationError extends AppError {
    constructor(message = 'Validation failed', errors = []) {
        super(message, 400);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

/**
 * Authentication Error (401)
 * Used when authentication fails
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization Error (403)
 * Used when user lacks permission
 */
class AuthorizationError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

/**
 * Not Found Error (404)
 * Used when a resource is not found
 */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict Error (409)
 * Used for duplicate/conflict scenarios
 */
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}

/**
 * Database Error (500)
 * Used for database operation failures
 */
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500);
        this.name = 'DatabaseError';
        this.originalError = originalError;
    }
}

/**
 * Rate Limit Error (429)
 * Used when rate limit is exceeded
 */
class RateLimitError extends AppError {
    constructor(message = 'Too many requests, please try again later') {
        super(message, 429);
        this.name = 'RateLimitError';
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    RateLimitError
};
