/**
 * Authentication Routes (RBAC-enabled)
 * Individual user authentication with role-based access control
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const checkAuth = require('../middleware/checkAuth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new student user
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login with personal email and get JWT with roles
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token validity
 * @access  Protected
 */
router.get('/verify', checkAuth, authController.verifyToken);

module.exports = router;