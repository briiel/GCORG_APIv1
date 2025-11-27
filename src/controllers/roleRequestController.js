/**
 * Role Request Controller
 * Handles organization role requests and approvals
 */

const db = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * Get all organizations (for dropdown in role request form)
 * @access Any authenticated user
 */
const getAllOrganizations = async (req, res) => {
  try {
    const [organizations] = await db.query(
      `SELECT id AS org_id, org_name, department 
       FROM student_organizations 
       ORDER BY org_name ASC`
    );

    return res.status(200).json({
      success: true,
      organizations: organizations
    });

  } catch (error) {
    console.error('Get all organizations error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching organizations.'
    });
  }
};

/**
 * Submit a new role request (Student -> OrgOfficer)
 * @access Student only
 */
const submitRoleRequest = async (req, res) => {
  const { org_id, requested_position, justification } = req.body;
  const studentId = req.user.studentId;

  // Only students can submit role requests
  if (!studentId) {
    return res.status(403).json({
      success: false,
      message: 'Only students can request organization officer roles.'
    });
  }

  // Validation
  if (!org_id || !requested_position) {
    return res.status(400).json({
      success: false,
      message: 'Organization and position are required.'
    });
  }

  try {
    // Check if organization exists
    const [orgs] = await db.query(
      `SELECT id, org_name FROM student_organizations WHERE id = ?`,
      [org_id]
    );

    if (orgs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    // Check if user already has a pending request for this organization
    const [existingRequests] = await db.query(
      `SELECT request_id FROM organization_role_requests 
       WHERE student_id = ? AND org_id = ? AND status = 'pending'`,
      [studentId, org_id]
    );

    if (existingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request for this organization.'
      });
    }

    // Check if user is already an officer in this organization
    const [existingMemberships] = await db.query(
      `SELECT member_id FROM organizationmembers 
       WHERE student_id = ? AND org_id = ? AND is_active = TRUE`,
      [studentId, org_id]
    );

    if (existingMemberships.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already an officer in this organization.'
      });
    }

    // Create the request
    await db.query(
      `INSERT INTO organization_role_requests 
       (student_id, org_id, requested_position, justification, status) 
       VALUES (?, ?, ?, ?, 'pending')`,
      [studentId, org_id, requested_position, justification || null]
    );

    // Notify OSWS admins about a new role request
    try {
      // Fetch student name for a clearer message
      const [srows] = await db.query(`SELECT first_name, middle_initial, last_name, suffix FROM students WHERE id = ? LIMIT 1`, [studentId]);
      const s = srows[0] || {};
      const studentName = [s.first_name, s.middle_initial ? `${s.middle_initial}.` : '', s.last_name, s.suffix || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ');

      // Fetch organization name (we already validated existence earlier)
      const [orgRows] = await db.query(`SELECT org_name FROM student_organizations WHERE id = ? LIMIT 1`, [org_id]);
      const orgName = orgRows[0]?.org_name || String(org_id);

      const msg = `New role request submitted by ${studentName} for ${orgName}`;
      // user_id is NULL so it is visible as a global/admin notification; panel='admin' scopes it to admin panel
      await notificationService.createNotification({ user_id: null, message: msg, panel: 'admin', type: 'role_request' });
    } catch (nerr) {
      console.warn('Notification create failed (roleRequest):', nerr?.message || nerr);
    }

    return res.status(201).json({
      success: true,
      message: 'Role request submitted successfully. Please wait for admin approval.'
    });

  } catch (error) {
    console.error('Submit role request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting your request.'
    });
  }
};

/**
 * Get all pending role requests
 * @access Admin only
 */
const getPendingRequests = async (req, res) => {
  try {
    const [requests] = await db.query(
      `SELECT 
        orr.request_id,
        orr.student_id,
        orr.org_id,
        orr.requested_position,
        orr.justification,
        orr.requested_at,
        s.email,
        s.first_name,
        s.last_name,
        s.id as student_id,
        o.org_name,
        o.department
       FROM organization_role_requests orr
       JOIN students s ON orr.student_id = s.id
       JOIN student_organizations o ON orr.org_id = o.id
       WHERE orr.status = 'pending'
       ORDER BY orr.requested_at ASC`
    );

    return res.status(200).json({
      success: true,
      requests: requests
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching requests.'
    });
  }
};

/**
 * Get all role requests (pending, approved, rejected)
 * @access Admin only
 */
const getAllRequests = async (req, res) => {
  const { status } = req.query;

  try {
    let query = `
      SELECT 
        orr.request_id,
        orr.student_id,
        orr.org_id,
        orr.requested_position,
        orr.justification,
        orr.status,
        orr.requested_at,
        orr.reviewed_at,
        orr.review_notes,
        s.email,
        s.first_name,
        s.last_name,
        s.id as student_id,
        o.org_name,
        o.department,
        ra.name AS reviewer_name
       FROM organization_role_requests orr
       JOIN students s ON orr.student_id = s.id
       JOIN student_organizations o ON orr.org_id = o.id
       LEFT JOIN osws_admins ra ON orr.reviewed_by_admin_id = ra.id
    `;

    const params = [];

    if (status) {
      query += ` WHERE orr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY orr.requested_at DESC`;

    const [requests] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      requests: requests
    });

  } catch (error) {
    console.error('Get all requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching requests.'
    });
  }
};

/**
 * Approve a role request (TRANSACTION)
 * @access Admin only
 */
const approveRequest = async (req, res) => {
  const { requestId } = req.params;
  const { review_notes } = req.body;
  const reviewerAdminId = req.user.legacyId; // Admin's ID from osws_admins

  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: 'Request ID is required.'
    });
  }

  const connection = await db.getConnection();
  try {
    // Start transaction
    await connection.beginTransaction();

    // Step 1: Get request details
    const [requests] = await connection.query(
      `SELECT student_id, org_id, requested_position, status 
       FROM organization_role_requests 
       WHERE request_id = ? FOR UPDATE`,
      [requestId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Request not found.'
      });
    }

    const request = requests[0];

    // Check if already processed
    if (request.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Request has already been ${request.status}.`
      });
    }

    // Step 2: Update request status to 'approved'
    await connection.query(
      `UPDATE organization_role_requests 
       SET status = 'approved', 
           reviewed_at = UTC_TIMESTAMP(), 
           reviewed_by_admin_id = ?,
           review_notes = ?
       WHERE request_id = ?`,
      [reviewerAdminId, review_notes || null, requestId]
    );

    // Step 3: Add to organizationmembers
    await connection.query(
      `INSERT INTO organizationmembers 
       (student_id, org_id, position, is_active, added_by_admin_id) 
       VALUES (?, ?, ?, TRUE, ?)`,
      [request.student_id, request.org_id, request.requested_position, reviewerAdminId]
    );

    // Commit transaction
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Role request approved successfully.'
    });

  } catch (error) {
    // Rollback on error
    try { await connection.rollback(); } catch (_) {}
    console.error('Approve request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while approving the request.'
    });
  } finally {
    // Always release the connection
    try { connection.release(); } catch (_) {}
  }
};

/**
 * Decline a role request
 * @access Admin only
 */
const rejectRequest = async (req, res) => {
  const { requestId } = req.params;
  const { review_notes } = req.body;
  const reviewerAdminId = req.user.legacyId; // Admin's ID from osws_admins

  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: 'Request ID is required.'
    });
  }

  try {
    // Check if request exists and is pending
    const [requests] = await db.query(
      `SELECT status FROM organization_role_requests WHERE request_id = ?`,
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found.'
      });
    }

    if (requests[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request has already been ${requests[0].status}.`
      });
    }

    // Update request status to 'rejected'
    await db.query(
      `UPDATE organization_role_requests 
       SET status = 'rejected', 
           reviewed_at = UTC_TIMESTAMP(), 
           reviewed_by_admin_id = ?,
           review_notes = ?
       WHERE request_id = ?`,
      [reviewerAdminId, review_notes || null, requestId]
    );

    return res.status(200).json({
      success: true,
      message: 'Role request declined.'
    });

  } catch (error) {
    console.error('Decline request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while declining the request.'
    });
  }
};

/**
 * Get user's own role requests
 * @access Authenticated users
 */
const getMyRequests = async (req, res) => {
  const studentId = req.user.studentId;

  if (!studentId) {
    return res.status(403).json({
      success: false,
      message: 'Only students can view role requests.'
    });
  }

  try {
    const [requests] = await db.query(
      `SELECT 
        orr.request_id,
        orr.org_id,
        orr.requested_position,
        orr.justification,
        orr.status,
        orr.requested_at,
        orr.reviewed_at,
        orr.review_notes,
        o.org_name,
        o.department,
        ra.name AS reviewer_name
       FROM organization_role_requests orr
       JOIN student_organizations o ON orr.org_id = o.id
       LEFT JOIN osws_admins ra ON orr.reviewed_by_admin_id = ra.id
       WHERE orr.student_id = ?
       ORDER BY orr.requested_at DESC`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      requests: requests
    });

  } catch (error) {
    console.error('Get my requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching your requests.'
    });
  }
};

module.exports = {
  getAllOrganizations,
  submitRoleRequest,
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  getMyRequests
};
