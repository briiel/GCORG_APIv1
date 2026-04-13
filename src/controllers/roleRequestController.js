// Role Request Controller — handles student org role requests and admin approvals

const db = require('../config/db');
const roleRequestModel = require('../models/roleRequestModel');
const notificationService = require('../services/notificationService');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');
const { decryptData } = require('../utils/encryption');

// Safely decrypt an encrypted field — returns original if not encrypted or decryption fails
const safeDecrypt = (value) => {
  if (value && typeof value === 'string' && value.split(':').length === 3) {
    try { return decryptData(value); } catch { return value; }
  }
  return value;
};

// Get all organizations (for role request form dropdown)
const getAllOrganizations = async (req, res) => {
  try {
    const [organizations] = await db.query(
      `SELECT id AS org_id, org_name, department FROM student_organizations ORDER BY org_name ASC`
    );
    return handleSuccessResponse(res, { organizations });
  } catch (error) {
    console.error('Get all organizations error:', error);
    return handleErrorResponse(res, 'An error occurred while fetching organizations.');
  }
};

// Submit a new role request (Student → OrgOfficer)
const submitRoleRequest = async (req, res) => {
  const { org_id, requested_position, justification } = req.body;
  const studentId = req.user.studentId;

  if (!studentId) return handleErrorResponse(res, 'Only students can request organization officer roles.', 403);
  if (!org_id || !requested_position) return handleErrorResponse(res, 'Organization and position are required.', 400);

  try {
    const [orgs] = await db.query(`SELECT id, org_name FROM student_organizations WHERE id = ?`, [org_id]);
    if (orgs.length === 0) return handleErrorResponse(res, 'Organization not found.', 404);

    // Prevent duplicate pending requests
    const [existingRequests] = await db.query(
      `SELECT request_id FROM organization_role_requests WHERE student_id = ? AND org_id = ? AND status = 'pending'`,
      [studentId, org_id]
    );
    if (existingRequests.length > 0) return handleErrorResponse(res, 'You already have a pending request for this organization.', 400);

    // Prevent re-joining if already a member
    const [existingMemberships] = await db.query(
      `SELECT member_id FROM organizationmembers WHERE student_id = ? AND org_id = ? AND is_active = TRUE`,
      [studentId, org_id]
    );
    if (existingMemberships.length > 0) return handleErrorResponse(res, 'You are already an officer in this organization.', 400);

    await db.query(
      `INSERT INTO organization_role_requests (student_id, org_id, requested_position, justification, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [studentId, org_id, requested_position, justification || null]
    );

    // Notify OSWS admins of new role request
    try {
      const [srows] = await db.query(`SELECT first_name, middle_initial, last_name, suffix FROM students WHERE id = ? LIMIT 1`, [studentId]);
      const s = srows[0] || {};
      const studentName = [s.first_name, s.middle_initial ? `${s.middle_initial}.` : '', s.last_name, s.suffix || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ');
      const [orgRows] = await db.query(`SELECT org_name FROM student_organizations WHERE id = ? LIMIT 1`, [org_id]);
      const orgName = orgRows[0]?.org_name || String(org_id);
      const nt = require('../services/notificationTypes');
      await notificationService.createNotification({ user_id: null, type: nt.ROLE_REQUEST, templateVars: { studentName, orgName }, panel: 'admin' });
    } catch (nerr) {
      console.warn('Notification create failed (roleRequest):', nerr?.message || nerr);
    }

    return handleSuccessResponse(res, { message: 'Role request submitted successfully. Please wait for admin approval.' }, 201);
  } catch (error) {
    console.error('Submit role request error:', error);
    return handleErrorResponse(res, 'An error occurred while submitting your request.');
  }
};

// Get all pending role requests with pagination (admin only)
const getPendingRequests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.body?.page || req.query.page || '1', 10) || 1);
    const per_page = Math.max(1, parseInt(req.body?.per_page || req.query.per_page || '10', 10) || 10);
    const offset = (page - 1) * per_page;

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM organization_role_requests WHERE status = 'pending'`);
    const total = (countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;

    const [requests] = await db.query(
      `SELECT orr.request_id, orr.student_id, orr.org_id, orr.requested_position, orr.justification, orr.requested_at,
              s.email, s.first_name, s.last_name, s.id as student_id, o.org_name, o.department
       FROM organization_role_requests orr
       JOIN students s ON orr.student_id = s.id
       JOIN student_organizations o ON orr.org_id = o.id
       WHERE orr.status = 'pending'
       ORDER BY orr.requested_at ASC
       LIMIT ? OFFSET ?`,
      [per_page, offset]
    );

    const total_pages = Math.max(1, Math.ceil(total / per_page));

    // Decrypt PII before sending to client
    const decrypted = requests.map(r => ({
      ...r,
      first_name: safeDecrypt(r.first_name),
      last_name: safeDecrypt(r.last_name),
      email: safeDecrypt(r.email)
    }));

    return handleSuccessResponse(res, { items: decrypted, total, page, per_page, total_pages });
  } catch (error) {
    console.error('Get pending requests error:', error);
    return handleErrorResponse(res, 'An error occurred while fetching requests.');
  }
};

// Get all role requests (all statuses) with optional filter and pagination (admin only)
const getAllRequests = async (req, res) => {
  const { status } = req.body?.status ? req.body : req.query;
  try {
    const page = Math.max(1, parseInt(req.body?.page || req.query.page || '1', 10) || 1);
    const per_page = Math.max(1, parseInt(req.body?.per_page || req.query.per_page || '10', 10) || 10);
    const offset = (page - 1) * per_page;

    const params = [];
    let where = '';
    if (status) { where = ' WHERE orr.status = ? '; params.push(status); }

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM organization_role_requests orr ${where}`, params);
    const total = (countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;

    const query = `
      SELECT orr.request_id, orr.student_id, orr.org_id, orr.requested_position, orr.justification,
             orr.status, orr.requested_at, orr.reviewed_at, orr.review_notes,
             s.email, s.first_name, s.last_name, s.id as student_id,
             o.org_name, o.department, ra.name AS reviewer_name
      FROM organization_role_requests orr
      JOIN students s ON orr.student_id = s.id
      JOIN student_organizations o ON orr.org_id = o.id
      LEFT JOIN osws_admins ra ON orr.reviewed_by_admin_id = ra.id
      ${where}
      ORDER BY orr.requested_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(per_page, offset);
    const [requests] = await db.query(query, params);
    const total_pages = Math.max(1, Math.ceil(total / per_page));

    const decrypted = requests.map(r => ({
      ...r,
      first_name: safeDecrypt(r.first_name),
      last_name: safeDecrypt(r.last_name),
      email: safeDecrypt(r.email)
    }));

    return handleSuccessResponse(res, { items: decrypted, total, page, per_page, total_pages });
  } catch (error) {
    console.error('Get all requests error:', error);
    return handleErrorResponse(res, 'An error occurred while fetching requests.');
  }
};

// Approve a role request and add student to organizationmembers (transactional, admin only)
const approveRequest = async (req, res) => {
  const { requestId } = req.params;
  const { review_notes } = req.body;
  const reviewerAdminId = req.user.legacyId;

  if (!requestId) return handleErrorResponse(res, 'Request ID is required.', 400);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT student_id, org_id, requested_position, status FROM organization_role_requests WHERE request_id = ? FOR UPDATE`,
      [requestId]
    );
    if (requests.length === 0) { await connection.rollback(); return handleErrorResponse(res, 'Request not found.', 404); }

    const request = requests[0];
    if (request.status !== 'pending') {
      await connection.rollback();
      return handleErrorResponse(res, `Request has already been ${request.status}.`, 400);
    }

    await connection.query(
      `UPDATE organization_role_requests
       SET status = 'approved', reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_id = ?, review_notes = ?
       WHERE request_id = ?`,
      [reviewerAdminId, review_notes || null, requestId]
    );

    await connection.query(
      `INSERT INTO organizationmembers (student_id, org_id, position, is_active, added_by_admin_id)
       VALUES (?, ?, ?, TRUE, ?)`,
      [request.student_id, request.org_id, request.requested_position, reviewerAdminId]
    );

    await connection.commit();

    // Notify student of approval
    try {
      const [orgRows] = await db.query(`SELECT org_name FROM student_organizations WHERE id = ? LIMIT 1`, [request.org_id]);
      const orgName = orgRows[0]?.org_name || String(request.org_id);
      const nt = require('../services/notificationTypes');
      await notificationService.createNotification({
        user_id: String(request.student_id), type: nt.ROLE_REQUEST_APPROVED,
        templateVars: { orgName, position: request.requested_position }, panel: 'student'
      });
    } catch (nerr) {
      console.warn('Notification create failed (approveRoleRequest):', nerr?.message || nerr);
    }

    return handleSuccessResponse(res, { message: 'Role request approved successfully.' });
  } catch (error) {
    try { await connection.rollback(); } catch (_) { }
    console.error('Approve request error:', error);
    return handleErrorResponse(res, 'An error occurred while approving the request.');
  } finally {
    try { connection.release(); } catch (_) { }
  }
};

// Decline a role request (admin only)
const rejectRequest = async (req, res) => {
  const { requestId } = req.params;
  const { review_notes } = req.body;
  const reviewerAdminId = req.user.legacyId;

  if (!requestId) return handleErrorResponse(res, 'Request ID is required.', 400);

  try {
    const [requests] = await db.query(
      `SELECT status, org_id, student_id FROM organization_role_requests WHERE request_id = ?`,
      [requestId]
    );
    if (requests.length === 0) return handleErrorResponse(res, 'Request not found.', 404);
    if (requests[0].status !== 'pending') return handleErrorResponse(res, `Request has already been ${requests[0].status}.`, 400);

    await db.query(
      `UPDATE organization_role_requests
       SET status = 'rejected', reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_id = ?, review_notes = ?
       WHERE request_id = ?`,
      [reviewerAdminId, review_notes || null, requestId]
    );

    // Notify student of rejection
    try {
      const [orgRows] = await db.query(`SELECT org_name FROM student_organizations WHERE id = ? LIMIT 1`, [requests[0].org_id]);
      const orgName = orgRows[0]?.org_name || '';
      const notesText = review_notes ? ` Reason: ${review_notes}` : '';
      const nt = require('../services/notificationTypes');
      await notificationService.createNotification({
        user_id: String(requests[0].student_id), type: nt.ROLE_REQUEST_REJECTED,
        templateVars: { orgName, notes: notesText }, panel: 'student'
      });
    } catch (nerr) {
      console.warn('Notification create failed (rejectRoleRequest):', nerr?.message || nerr);
    }

    return handleSuccessResponse(res, { message: 'Role request declined.' });
  } catch (error) {
    console.error('Decline request error:', error);
    return handleErrorResponse(res, 'An error occurred while declining the request.');
  }
};

// Get current user's own role requests
const getMyRequests = async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) return handleErrorResponse(res, 'Only students can view role requests.', 403);

  try {
    const [requests] = await db.query(
      `SELECT orr.request_id, orr.org_id, orr.requested_position, orr.justification,
              orr.status, orr.requested_at, orr.reviewed_at, orr.review_notes,
              o.org_name, o.department, ra.name AS reviewer_name
       FROM organization_role_requests orr
       JOIN student_organizations o ON orr.org_id = o.id
       LEFT JOIN osws_admins ra ON orr.reviewed_by_admin_id = ra.id
       WHERE orr.student_id = ?
       ORDER BY orr.requested_at DESC`,
      [studentId]
    );
    return handleSuccessResponse(res, { items: requests });
  } catch (error) {
    console.error('Get my requests error:', error);
    return handleErrorResponse(res, 'An error occurred while fetching your requests.');
  }
};

module.exports = { getAllOrganizations, submitRoleRequest, getPendingRequests, getAllRequests, approveRequest, rejectRequest, getMyRequests };
