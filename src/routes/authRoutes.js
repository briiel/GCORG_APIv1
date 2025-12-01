/**
 * Authentication Routes (RBAC-enabled)
 * Individual user authentication with role-based access control
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const checkAuth = require('../middleware/checkAuth');
const rateLimit = require('../middleware/rateLimit');

// Stricter rate limit for auth endpoints to prevent brute force
// Enable `logBlocked: true` so development logs show when a request is blocked.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, logBlocked: true }); // 10 requests per 15 minutes

/**
 * @route   POST /api/auth/register
 * @desc    Register a new student user
 * @access  Public
 */
router.post('/register', authLimiter, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login with personal email and get JWT with roles
 * @access  Public
 */
router.post('/login', authLimiter, authController.login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token validity
 * @access  Protected
 */
router.get('/verify', checkAuth, authController.verifyToken);

/**
 * @route   POST /api/auth/accept-privacy-policy
 * @desc    Accept data privacy policy
 * @access  Protected
 */
router.post('/accept-privacy-policy', checkAuth, authLimiter, authController.acceptPrivacyPolicy);

module.exports = router;