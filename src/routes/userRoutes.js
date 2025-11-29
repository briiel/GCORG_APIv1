const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware'); // Import middleware
const rateLimit = require('../middleware/rateLimit');

// General API rate limit
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 requests per minute

router.get('/users', authenticateToken, apiLimiter, userController.getUsers); // Protect route
router.get('/users/:id', authenticateToken, apiLimiter, userController.getUserById); // Protect route
router.get('/users/organization/:orgId/members', authenticateToken, apiLimiter, userController.getOrganizationMembers); // Get org members
router.delete('/users/organization/:orgId/members/:memberId', authenticateToken, apiLimiter, userController.removeOrganizationMember); // Remove org member

module.exports = router;