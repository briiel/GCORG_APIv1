const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware'); // Import middleware
const rateLimit = require('../middleware/rateLimit');

// General API rate limit
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 requests per minute

router.post('/users/fetch/:resource', authenticateToken, apiLimiter, (req, res) => {
    const resource = req.params.resource || req.body?.resource;
    if (resource === 'user_by_id') {
        const { id } = req.body;
        req.params = { ...req.params, id };
        return userController.getUserById(req, res);
    }
    if (resource === 'org_members') {
        const { org_id } = req.body;
        req.params = { ...req.params, orgId: org_id };
        return userController.getOrganizationMembers(req, res);
    }
    // Default: list all users
    return userController.getUsers(req, res);
});
router.get('/users', authenticateToken, apiLimiter, userController.getUsers); // Protect route
// Static/specific routes MUST come before /users/:id to avoid param capture
router.get('/users/organization/:orgId/members', authenticateToken, apiLimiter, userController.getOrganizationMembers); // Get org members
router.delete('/users/organization/:orgId/members/:memberId', authenticateToken, apiLimiter, userController.removeOrganizationMember); // Remove org member
router.get('/users/:id', authenticateToken, apiLimiter, userController.getUserById); // Protect route

module.exports = router;
