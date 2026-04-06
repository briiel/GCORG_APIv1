// Authentication routes (RBAC): register, login, verify token, and privacy policy endpoints

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Strict rate limit for auth endpoints: 10 requests per 15 minutes to resist brute force
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, logBlocked: true });

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/verify', authenticateToken, authController.verifyToken);
router.post('/accept-privacy-policy', authenticateToken, authLimiter, authController.acceptPrivacyPolicy);
router.get('/privacy-policy-status', authenticateToken, authController.getPrivacyPolicyStatus);

module.exports = router;