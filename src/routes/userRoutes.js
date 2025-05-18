const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware'); // Import middleware

router.get('/users', authenticateToken, userController.getUsers); // Protect route
router.get('/users/:id', authenticateToken, userController.getUserById); // Protect route

module.exports = router;