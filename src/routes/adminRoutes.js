const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/checkRole');
const rateLimit = require('../middleware/rateLimit');

// Admin operations rate limit
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 50 }); // 50 requests per minute

// POST /fetch/:resource — resource name visible in Network tab
router.post('/admin/fetch/:resource', authenticateToken, checkRole(['OSWSAdmin']), adminLimiter, adminController.getManageUsers);
router.get('/admin/manage-users', authenticateToken, checkRole(['OSWSAdmin']), adminLimiter, adminController.getManageUsers);
router.post('/admins', authenticateToken, checkRole(['OSWSAdmin']), adminLimiter, adminController.addAdmin);
router.delete('/admins/:id', authenticateToken, checkRole(['OSWSAdmin']), adminLimiter, adminController.deleteAdmin);

module.exports = router;