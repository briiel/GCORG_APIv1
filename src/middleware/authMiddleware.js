const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                        if (err.name === 'TokenExpiredError') {
                            return res.status(401).json({ success: false, message: 'Token expired' });
                        }
                        return res.status(401).json({ success: false, message: 'Invalid token' });
                    }
                
                // Attach the decoded user info to the request object
                req.user = decoded;
                
                // Add backwards-compatible fields for old code
                if (decoded.userType && !decoded.role) {
                    req.user.role = decoded.userType;
                }
                if (decoded.legacyId && !decoded.id) {
                    req.user.id = decoded.legacyId;
                }
                
                next();
            });
};

module.exports = authenticateToken;