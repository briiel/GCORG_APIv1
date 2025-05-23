const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/admin/manage-users', authenticateToken, adminController.getManageUsers);
router.post('/admins', authenticateToken, adminController.addAdmin);
router.delete('/admins/:id', authenticateToken, adminController.deleteAdmin);

module.exports = router;