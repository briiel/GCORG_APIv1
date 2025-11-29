const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticateToken = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Notification rate limit
const notificationLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 }); // 60 requests per minute

router.get('/', authenticateToken, notificationLimiter, notificationController.getNotifications);
router.patch('/:id/read', authenticateToken, notificationLimiter, notificationController.markAsRead);
router.patch('/read-all', authenticateToken, notificationLimiter, notificationController.markAllAsRead);

module.exports = router;