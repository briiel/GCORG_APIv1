const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract from "Bearer <token>"

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Attach decoded user info to request
    req.user = decoded;

    // Backwards-compatible fields for legacy code
    if (decoded.userType && !decoded.role) req.user.role = decoded.userType;
    if (decoded.legacyId && !decoded.id) req.user.id = decoded.legacyId;

    // Refresh OrgOfficer membership from DB to avoid stale token roles
    try {
        const studentId = decoded.studentId || null;
        if (studentId) {
            const [rows] = await db.query(
                `SELECT 1 FROM organizationmembers WHERE student_id = ? AND is_active = TRUE LIMIT 1`,
                [studentId]
            );
            const hasActiveMembership = Array.isArray(rows) && rows.length > 0;

            let roles = Array.isArray(decoded.roles)
                ? decoded.roles.map(r => String(r).toLowerCase())
                : (decoded.roles ? [String(decoded.roles).toLowerCase()] : []);

            const hasOrgRoleInToken = roles.includes('orgofficer');
            if (hasActiveMembership && !hasOrgRoleInToken) roles.push('orgofficer');
            if (!hasActiveMembership && hasOrgRoleInToken) roles = roles.filter(r => r !== 'orgofficer');

            req.user.roles = roles;
        }
    } catch (refreshErr) {
        console.warn('[authMiddleware] Failed to refresh user roles from DB:', refreshErr?.message || refreshErr);
    }

    next();
};

module.exports = authenticateToken;
