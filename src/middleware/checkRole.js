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

      // Ensure user has roles
      if (!req.user.roles || !Array.isArray(req.user.roles)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. No roles assigned to user.'
        });
      }

      // Check if user has at least one of the allowed roles
      const hasRequiredRole = req.user.roles.some(role => 
        allowedRoles.includes(role)
      );

      if (!hasRequiredRole) {
        console.log('❌ Role check failed:');
        console.log('   User roles:', req.user.roles);
        console.log('   Required roles:', allowedRoles);
        console.log('   User ID:', req.user.userId);
        console.log('   User Type:', req.user.userType);
        
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
          userRoles: req.user.roles // Include for debugging (remove in production if sensitive)
        });
      }

      console.log('✅ Role check passed:');
      console.log('   User roles:', req.user.roles);
      console.log('   Required roles:', allowedRoles);

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
