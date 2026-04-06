// Role-Based Access Control middleware factory

const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
      }

      const userRoles = Array.isArray(req.user.roles)
        ? req.user.roles.map(r => String(r).toLowerCase())
        : [];
      const allowedLower = Array.isArray(allowedRoles)
        ? allowedRoles.map(r => String(r).toLowerCase())
        : [];

      const hasRequiredRoleToken =
        userRoles.some(role => allowedLower.includes(role)) ||
        (req.user.userType && allowedLower.includes(String(req.user.userType).toLowerCase()));

      // Verify live DB membership when OrgOfficer role is required to prevent stale-token access
      const needsOrgOfficerCheck = allowedLower.includes('orgofficer');

      if (needsOrgOfficerCheck) {
        const db = require('../config/db');
        const studentId = req.user.studentId;

        if (!studentId) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
            userRoles: req.user.roles
          });
        }

        try {
          const [rows] = await db.query(
            `SELECT 1 FROM organizationmembers WHERE student_id = ? AND is_active = TRUE LIMIT 1`,
            [studentId]
          );
          const hasActiveMembership = Array.isArray(rows) ? rows.length > 0 : false;

          if (!hasActiveMembership) {
            return res.status(403).json({
              success: false,
              message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
              userRoles: req.user.roles
            });
          }

          return next();
        } catch (dbErr) {
          console.error('Error verifying OrgOfficer membership:', dbErr);
          return res.status(500).json({ success: false, message: 'Authorization check failed.' });
        }
      }

      if (!hasRequiredRoleToken) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
          userRoles: req.user.roles
        });
      }

      next();

    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ success: false, message: 'Authorization check failed.' });
    }
  };
};

// Convenience role middleware shortcuts
const isStudent = checkRole(['Student']);
const isOrgOfficer = checkRole(['OrgOfficer']);
const isAdmin = checkRole(['OSWSAdmin']);
const isOfficerOrAdmin = checkRole(['OrgOfficer', 'OSWSAdmin']);

module.exports = { checkRole, isStudent, isOrgOfficer, isAdmin, isOfficerOrAdmin };
