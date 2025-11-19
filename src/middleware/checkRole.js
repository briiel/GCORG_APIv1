/**
 * Role-Based Access Control Middleware
 * Checks if authenticated user has required role(s)
 */

/**
 * Factory function to create role checking middleware
 * 
 * @param {Array<string>} allowedRoles - Array of role names that are allowed (e.g., ['OSWSAdmin', 'OrgOfficer'])
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Allow only admins
 * router.get('/admin/dashboard', checkAuth, checkRole(['OSWSAdmin']), controller.getDashboard);
 * 
 * @example
 * // Allow admins OR org officers
 * router.post('/events', checkAuth, checkRole(['OSWSAdmin', 'OrgOfficer']), controller.createEvent);
 */
const checkRole = (allowedRoles) => {
  // Return middleware function
  return (req, res, next) => {
    try {
      // Ensure user is authenticated (checkAuth should run first)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please log in.'
        });
      }

      // Ensure user has roles (role-based checks will also consider normalized userType)
      const userRoles = Array.isArray(req.user.roles) ? req.user.roles.map(r => String(r).toLowerCase()) : [];

      // Normalize allowedRoles to lowercase for case-insensitive comparison
      const allowedLower = Array.isArray(allowedRoles) ? allowedRoles.map(r => String(r).toLowerCase()) : [];

      // Check if user has at least one of the allowed roles or matches the userType
      const hasRequiredRole = userRoles.some(role => allowedLower.includes(role)) || (req.user.userType && allowedLower.includes(String(req.user.userType).toLowerCase()));

      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
          userRoles: req.user.roles
        });
      }

      // User has required role, proceed
      next();

    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed.'
      });
    }
  };
};

/**
 * Helper middleware: Check if user is a Student
 */
const isStudent = checkRole(['Student']);

/**
 * Helper middleware: Check if user is an Organization Officer
 */
const isOrgOfficer = checkRole(['OrgOfficer']);

/**
 * Helper middleware: Check if user is an OSWS Admin
 */
const isAdmin = checkRole(['OSWSAdmin']);

/**
 * Helper middleware: Check if user is an officer OR admin
 */
const isOfficerOrAdmin = checkRole(['OrgOfficer', 'OSWSAdmin']);

module.exports = {
  checkRole,
  isStudent,
  isOrgOfficer,
  isAdmin,
  isOfficerOrAdmin
};
