// Database operations for organization role requests

const db = require('../config/db');

// Fetch all non-deleted student organizations (for role request form dropdown)
const getAllOrganizations = async () => {
  const [organizations] = await db.query(
    `SELECT id AS org_id, org_name, department 
     FROM student_organizations 
     WHERE deleted_at IS NULL
     ORDER BY org_name ASC`
  );
  return organizations;
};

// Fetch a single role request by its ID, or null if not found
const getRoleRequestById = async (requestId) => {
  const [requests] = await db.query(
    `SELECT 
      request_id,
      student_id,
      org_id,
      requested_position,
      justification,
      status,
      requested_at,
      reviewed_at,
      reviewed_by_admin_id,
      review_notes
     FROM organization_role_requests 
     WHERE request_id = ?
     LIMIT 1`,
    [requestId]
  );
  return requests.length > 0 ? requests[0] : null;
};

// Insert a new role request row and return the result
const createRoleRequest = async (requestData) => {
  const { student_id, org_id, requested_position, justification } = requestData;
  
  const [result] = await db.query(
    `INSERT INTO organization_role_requests 
     (student_id, org_id, requested_position, justification, status, requested_at) 
     VALUES (?, ?, ?, ?, 'pending', UTC_TIMESTAMP())`,
    [student_id, org_id, requested_position, justification || null]
  );
  
  return result;
};

// Check whether the student already has a pending request for the given org
const hasPendingRequest = async (studentId, orgId) => {
  const [requests] = await db.query(
    `SELECT request_id 
     FROM organization_role_requests 
     WHERE student_id = ? AND org_id = ? AND status = 'pending'`,
    [studentId, orgId]
  );
  return requests.length > 0;
};

// Check whether the student is already an active officer in the given org
const isOfficerInOrg = async (studentId, orgId) => {
  const [memberships] = await db.query(
    `SELECT member_id 
     FROM organizationmembers 
     WHERE student_id = ? AND org_id = ? AND is_active = TRUE AND deleted_at IS NULL`,
    [studentId, orgId]
  );
  return memberships.length > 0;
};

// Fetch all pending role requests joined with student and org details
const getPendingRequests = async () => {
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
      COALESCE(s.year_level, 4) AS year_level,
      o.org_name,
      o.department
     FROM organization_role_requests orr
     JOIN students s ON orr.student_id = s.id
     JOIN student_organizations o ON orr.org_id = o.id
     WHERE orr.status = 'pending' AND o.deleted_at IS NULL
     ORDER BY orr.requested_at ASC`
  );
  return requests;
};

// Fetch all role requests with optional status filter
const getAllRequests = async (status = null) => {
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
      COALESCE(s.year_level, 4) AS year_level,
      o.org_name,
      o.department,
      ra.name AS reviewer_name
     FROM organization_role_requests orr
     JOIN students s ON orr.student_id = s.id
     JOIN student_organizations o ON orr.org_id = o.id
     LEFT JOIN osws_admins ra ON orr.reviewed_by_admin_id = ra.id
     WHERE o.deleted_at IS NULL
  `;

  const params = [];

  if (status) {
    query += ` AND orr.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY orr.requested_at DESC`;

  const [requests] = await db.query(query, params);
  return requests;
};

// Fetch a student's own role requests
const getStudentRequests = async (studentId) => {
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
     WHERE orr.student_id = ? AND o.deleted_at IS NULL
     ORDER BY orr.requested_at DESC`,
    [studentId]
  );
  return requests;
};

// Update the status and review metadata of a role request
const updateRequestStatus = async (requestId, updateData) => {
  const { status, reviewed_by_admin_id, review_notes } = updateData;
  
  const [result] = await db.query(
    `UPDATE organization_role_requests 
     SET status = ?, 
         reviewed_at = UTC_TIMESTAMP(), 
         reviewed_by_admin_id = ?,
         review_notes = ?
     WHERE request_id = ?`,
    [status, reviewed_by_admin_id, review_notes || null, requestId]
  );
  
  return result;
};

// Insert a student as an active member of an organization
const addOrganizationMember = async (memberData) => {
  const { student_id, org_id, position, added_by_admin_id } = memberData;
  
  const [result] = await db.query(
    `INSERT INTO organizationmembers 
     (student_id, org_id, position, is_active, added_by_admin_id) 
     VALUES (?, ?, ?, TRUE, ?)`,
    [student_id, org_id, position, added_by_admin_id]
  );
  
  return result;
};

module.exports = {
  getAllOrganizations,
  getRoleRequestById,
  createRoleRequest,
  hasPendingRequest,
  isOfficerInOrg,
  getPendingRequests,
  getAllRequests,
  getStudentRequests,
  updateRequestStatus,
  addOrganizationMember
};
