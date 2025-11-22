const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware'); // Import middleware

router.get('/users', authenticateToken, userController.getUsers); // Protect route
router.get('/users/:id', authenticateToken, userController.getUserById); // Protect route
router.get('/users/organization/:orgId/members', authenticateToken, userController.getOrganizationMembers); // Get org members
router.delete('/users/organization/:orgId/members/:memberId', authenticateToken, userController.removeOrganizationMember); // Remove org member

module.exports = router;