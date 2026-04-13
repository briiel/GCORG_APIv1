/**
 * Role Request Routes
 * Endpoints for managing organization role requests
 */

const express = require('express');
const router = express.Router();
const roleRequestController = require('../controllers/roleRequestController');
const authenticateToken = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/checkRole');
const rateLimit = require('../middleware/rateLimit');

// Role request rate limits
const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }); // 5 submissions per 15 minutes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 requests per minute

// POST /fetch/:resource — resource name visible in Network tab
router.post('/roles/fetch/:resource', authenticateToken, apiLimiter, (req, res) => {
  const resource = req.params.resource || req.body?.resource;
  if (resource === 'my_requests')      return roleRequestController.getMyRequests(req, res);
  if (resource === 'admin_requests')   return roleRequestController.getAllRequests(req, res);
  if (resource === 'pending_requests') return roleRequestController.getPendingRequests(req, res);
  // Default: organizations list
  return roleRequestController.getAllOrganizations(req, res);
});

/**
 * @route   GET /api/organizations
 * @desc    Get all organizations (for role request dropdown)
 * @access  Protected - Any authenticated user
 */
router.get('/organizations', 
  authenticateToken,
  apiLimiter,
  roleRequestController.getAllOrganizations
);

/**
 * @route   POST /api/roles/request
 * @desc    Submit a new role request (Student -> OrgOfficer)
 * @access  Protected - Student only
 */
router.post('/roles/request', 
  authenticateToken, 
  checkRole(['Student']),
  requestLimiter,
  roleRequestController.submitRoleRequest
);

/**
 * @route   GET /api/roles/my-requests
 * @desc    Get current user's role requests
 * @access  Protected - Any authenticated user
 */
router.get('/roles/my-requests', 
  authenticateToken,
  apiLimiter,
  roleRequestController.getMyRequests
);

/**
 * @route   GET /api/admin/requests
 * @desc    Get all role requests (with optional status filter)
 * @access  Protected - Admin only
 */
router.get('/admin/requests', 
  authenticateToken, 
  checkRole(['OSWSAdmin']),
  apiLimiter,
  roleRequestController.getAllRequests
);

/**
 * @route   GET /api/admin/requests/pending
 * @desc    Get pending role requests
 * @access  Protected - Admin only
 */
router.get('/admin/requests/pending', 
  authenticateToken, 
  checkRole(['OSWSAdmin']),
  apiLimiter,
  roleRequestController.getPendingRequests
);

/**
 * @route   POST /api/admin/approve/:requestId
 * @desc    Approve a role request (transactional)
 * @access  Protected - Admin only
 */
router.post('/admin/approve/:requestId', 
  authenticateToken, 
  checkRole(['OSWSAdmin']),
  apiLimiter,
  roleRequestController.approveRequest
);

/**
 * @route   POST /api/admin/reject/:requestId
 * @desc    Decline a role request
 * @access  Protected - Admin only
 */
router.post('/admin/reject/:requestId', 
  authenticateToken, 
  checkRole(['OSWSAdmin']),
  apiLimiter,
  roleRequestController.rejectRequest
);

module.exports = router;
