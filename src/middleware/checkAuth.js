/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to request object
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches decoded user data to req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const checkAuth = async (req, res, next) => {
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

    // Normalize roles from token
    const rawRoles = Array.isArray(decoded.roles) ? decoded.roles : (decoded.roles ? [decoded.roles] : []);
    let roles = rawRoles.map(r => String(r).toLowerCase());
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

    // If this is a student, refresh OrgOfficer membership from DB to avoid stale token roles
    try {
      const studentId = decoded.studentId || null;
      if (studentId) {
        const [rows] = await db.query(
          `SELECT 1 FROM organizationmembers WHERE student_id = ? AND is_active = TRUE LIMIT 1`,
          [studentId]
        );
        const hasActiveMembership = Array.isArray(rows) && rows.length > 0;

        // Ensure roles accurately reflect current membership
        const hasOrgRoleInToken = roles.includes('orgofficer');
        if (hasActiveMembership && !hasOrgRoleInToken) {
          roles.push('orgofficer');
        }
        if (!hasActiveMembership && hasOrgRoleInToken) {
          roles = roles.filter(r => r !== 'orgofficer');
        }

        // Update req.user.roles to the refreshed value
        req.user.roles = roles;
      }
    } catch (refreshErr) {
      // Non-fatal: log and continue with token roles
      console.warn('Failed to refresh user roles from DB:', refreshErr?.message || refreshErr);
    }

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
