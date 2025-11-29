const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const authenticateToken = require('../middleware/authMiddleware');

// Get all archived/trashed items
router.get('/archive/trash', authenticateToken, archiveController.getTrash);

// Restore operations
router.post('/archive/admins/:id/restore', authenticateToken, archiveController.restoreAdmin);
router.post('/archive/organizations/:id/restore', authenticateToken, archiveController.restoreOrganization);
router.post('/archive/members/:id/restore', authenticateToken, archiveController.restoreMember);

// Permanent delete operations
router.delete('/archive/admins/:id', authenticateToken, archiveController.permanentDeleteAdmin);
router.delete('/archive/organizations/:id', authenticateToken, archiveController.permanentDeleteOrganization);
router.delete('/archive/members/:id', authenticateToken, archiveController.permanentDeleteMember);

// Auto-cleanup operations (admin only)
router.get('/archive/expired-count', authenticateToken, archiveController.getExpiredItemsCount);
router.post('/archive/cleanup', authenticateToken, archiveController.triggerAutoCleanup);

module.exports = router;
