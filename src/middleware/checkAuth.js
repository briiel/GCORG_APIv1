// Verifies JWT and attaches decoded user info to req.user

const jwt = require('jsonwebtoken');
const db = require('../config/db');

const checkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Invalid token format. Use "Bearer <token>"' });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. Token is missing.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize roles and build req.user
    const rawRoles = Array.isArray(decoded.roles) ? decoded.roles : (decoded.roles ? [decoded.roles] : []);
    let roles = rawRoles.map(r => String(r).toLowerCase());
    const userTypeNorm = decoded.userType ? String(decoded.userType).toLowerCase() : '';
    const canonicalId = decoded.id || decoded.legacyId || decoded.userId || decoded.studentId || null;

    req.user = {
      userId: decoded.userId || null,
      email: decoded.email,
      roles,
      rawRoles,
      organization: decoded.organization || null,
      userType: userTypeNorm,
      legacyId: decoded.legacyId || null,
      studentId: decoded.studentId || null,
      role: userTypeNorm,
      id: canonicalId
    };

    // Refresh OrgOfficer membership from DB to avoid stale token roles
    try {
      const studentId = decoded.studentId || null;
      if (studentId) {
        const [rows] = await db.query(
          `SELECT 1 FROM organizationmembers WHERE student_id = ? AND is_active = TRUE LIMIT 1`,
          [studentId]
        );
        const hasActiveMembership = Array.isArray(rows) && rows.length > 0;

        const hasOrgRoleInToken = roles.includes('orgofficer');
        if (hasActiveMembership && !hasOrgRoleInToken) roles.push('orgofficer');
        if (!hasActiveMembership && hasOrgRoleInToken) roles = roles.filter(r => r !== 'orgofficer');

        req.user.roles = roles;
      }
    } catch (refreshErr) {
      console.warn('Failed to refresh user roles from DB:', refreshErr?.message || refreshErr);
    }

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};

module.exports = checkAuth;
