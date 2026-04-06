// Role request routes: students submit requests, admins approve/reject

const express = require('express');
const router = express.Router();
const roleRequestController = require('../controllers/roleRequestController');
const authenticateToken = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/checkRole');
const rateLimit = require('../middleware/rateLimit');

const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });  // 5 per 15 min
const apiLimiter     = rateLimit({ windowMs: 60 * 1000,       max: 100 }); // 100 per min

// GET /api/organizations — all organizations (for dropdown)
router.get('/organizations', authenticateToken, apiLimiter, roleRequestController.getAllOrganizations);

// POST /api/roles/request — student submits a new role request
router.post('/roles/request', authenticateToken, checkRole(['Student']), requestLimiter, roleRequestController.submitRoleRequest);

// GET /api/roles/my-requests — current user's own requests
router.get('/roles/my-requests', authenticateToken, apiLimiter, roleRequestController.getMyRequests);

// GET /api/admin/requests — all requests with optional status filter (admin only)
router.get('/admin/requests', authenticateToken, checkRole(['OSWSAdmin']), apiLimiter, roleRequestController.getAllRequests);

// GET /api/admin/requests/pending — pending requests (admin only)
router.get('/admin/requests/pending', authenticateToken, checkRole(['OSWSAdmin']), apiLimiter, roleRequestController.getPendingRequests);

// POST /api/admin/approve/:requestId — approve and create membership (transactional, admin only)
router.post('/admin/approve/:requestId', authenticateToken, checkRole(['OSWSAdmin']), apiLimiter, roleRequestController.approveRequest);

// POST /api/admin/reject/:requestId — decline a request (admin only)
router.post('/admin/reject/:requestId', authenticateToken, checkRole(['OSWSAdmin']), apiLimiter, roleRequestController.rejectRequest);

module.exports = router;
