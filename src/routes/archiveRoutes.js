const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const authenticateToken = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Archive operations rate limiters
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 50 }); // 50 requests per minute
const modifyLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 requests per minute for restore/delete

// Get all archived/trashed items
router.get('/archive/trash', authenticateToken, apiLimiter, archiveController.getTrash);

// Restore operations
router.post('/archive/admins/:id/restore', authenticateToken, modifyLimiter, archiveController.restoreAdmin);
router.post('/archive/organizations/:id/restore', authenticateToken, modifyLimiter, archiveController.restoreOrganization);
router.post('/archive/members/:id/restore', authenticateToken, modifyLimiter, archiveController.restoreMember);

// Permanent delete operations
router.delete('/archive/admins/:id', authenticateToken, modifyLimiter, archiveController.permanentDeleteAdmin);
router.delete('/archive/organizations/:id', authenticateToken, modifyLimiter, archiveController.permanentDeleteOrganization);
router.delete('/archive/members/:id', authenticateToken, modifyLimiter, archiveController.permanentDeleteMember);

// Auto-cleanup operations (admin only)
router.get('/archive/expired-count', authenticateToken, apiLimiter, archiveController.getExpiredItemsCount);
router.post('/archive/cleanup', authenticateToken, modifyLimiter, archiveController.triggerAutoCleanup);

module.exports = router;
