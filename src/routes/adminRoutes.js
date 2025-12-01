const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Admin operations rate limit
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 50 }); // 50 requests per minute

router.get('/admin/manage-users', authenticateToken, adminLimiter, adminController.getManageUsers);
router.post('/admins', authenticateToken, adminLimiter, adminController.addAdmin);
router.delete('/admins/:id', authenticateToken, adminLimiter, adminController.deleteAdmin);

// Privacy policy management (admin-only)
// Public endpoint to fetch the current privacy policy (read-only)
router.get('/admin/privacy-policy', adminLimiter, adminController.getPrivacyPolicy);

module.exports = router;