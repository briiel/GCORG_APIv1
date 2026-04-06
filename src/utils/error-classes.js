// Custom error classes for categorized HTTP error handling (400–500)

// Base operational error with status code and stack trace
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

// 400 – Input validation failure; carries an optional errors array
class ValidationError extends AppError {
    constructor(message = 'Validation failed', errors = []) {
        super(message, 400);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

// 401 – Authentication failure
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

// 403 – Insufficient permissions
class AuthorizationError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

// 404 – Resource not found
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

// 409 – Duplicate / conflict
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}

// 500 – Database operation failure; stores the original error for debugging
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500);
        this.name = 'DatabaseError';
        this.originalError = originalError;
    }
}

// 429 – Rate limit exceeded
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
