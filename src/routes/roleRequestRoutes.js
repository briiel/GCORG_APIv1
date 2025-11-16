/**
 * Role Request Routes
 * Endpoints for managing organization role requests
 */

const express = require('express');
const router = express.Router();
const roleRequestController = require('../controllers/roleRequestController');
const checkAuth = require('../middleware/checkAuth');
const { checkRole } = require('../middleware/checkRole');

/**
 * @route   GET /api/organizations
 * @desc    Get all organizations (for role request dropdown)
 * @access  Protected - Any authenticated user
 */
router.get('/organizations', 
  checkAuth, 
  roleRequestController.getAllOrganizations
);

/**
 * @route   POST /api/roles/request
 * @desc    Submit a new role request (Student -> OrgOfficer)
 * @access  Protected - Student only
 */
router.post('/roles/request', 
  checkAuth, 
  checkRole(['Student']), 
  roleRequestController.submitRoleRequest
);

/**
 * @route   GET /api/roles/my-requests
 * @desc    Get current user's role requests
 * @access  Protected - Any authenticated user
 */
router.get('/roles/my-requests', 
  checkAuth, 
  roleRequestController.getMyRequests
);

/**
 * @route   GET /api/admin/requests
 * @desc    Get all role requests (with optional status filter)
 * @access  Protected - Admin only
 */
router.get('/admin/requests', 
  checkAuth, 
  checkRole(['OSWSAdmin']), 
  roleRequestController.getAllRequests
);

/**
 * @route   GET /api/admin/requests/pending
 * @desc    Get pending role requests
 * @access  Protected - Admin only
 */
router.get('/admin/requests/pending', 
  checkAuth, 
  checkRole(['OSWSAdmin']), 
  roleRequestController.getPendingRequests
);

/**
 * @route   POST /api/admin/approve/:requestId
 * @desc    Approve a role request (transactional)
 * @access  Protected - Admin only
 */
router.post('/admin/approve/:requestId', 
  checkAuth, 
  checkRole(['OSWSAdmin']), 
  roleRequestController.approveRequest
);

/**
 * @route   POST /api/admin/reject/:requestId
 * @desc    Reject a role request
 * @access  Protected - Admin only
 */
router.post('/admin/reject/:requestId', 
  checkAuth, 
  checkRole(['OSWSAdmin']), 
  roleRequestController.rejectRequest
);

module.exports = router;
