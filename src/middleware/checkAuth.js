/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to request object
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches decoded user data to req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const checkAuth = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Check if header follows "Bearer <token>" format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Use "Bearer <token>"'
      });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is missing.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize and attach user info to request object
    const rawRoles = Array.isArray(decoded.roles) ? decoded.roles : (decoded.roles ? [decoded.roles] : []);
    const roles = rawRoles.map(r => String(r).toLowerCase());
    const userTypeNorm = decoded.userType ? String(decoded.userType).toLowerCase() : (decoded.userType || '');

    // Determine canonical id value from possible token fields
    const canonicalId = decoded.id || decoded.legacyId || decoded.userId || decoded.studentId || null;

    req.user = {
      userId: decoded.userId || null,
      email: decoded.email,
      // canonical lowercase roles array (e.g. ['student','orgofficer'])
      roles,
      // original decoded roles preserved for compatibility
      rawRoles,
      organization: decoded.organization || null,
      // normalized user type (lowercase) and legacy fields
      userType: userTypeNorm,
      legacyId: decoded.legacyId || null,
      studentId: decoded.studentId || null,
      // Backwards compatibility: set `role` to normalized userType and `id` to canonicalId
      role: userTypeNorm,
      id: canonicalId
    };

    // Continue to next middleware
    next();

  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.'
      });
    }

    // Handle other errors
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

module.exports = checkAuth;
