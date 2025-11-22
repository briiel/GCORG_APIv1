const db = require('../config/db');

// Ensure certificate_requests table exists (idempotent)
async function ensureSchema() {
	await db.query(`
		CREATE TABLE IF NOT EXISTS certificate_requests (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			event_id INT NOT NULL,
			student_id VARCHAR(20) NOT NULL,
			status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
			requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			processed_at DATETIME NULL,
			processed_by VARCHAR(20) NULL,
			rejection_reason VARCHAR(500) NULL,
			certificate_url VARCHAR(500) NULL,
			KEY idx_event_student (event_id, student_id),
			KEY idx_status (status),
			KEY idx_requested_at (requested_at),
			FOREIGN KEY (event_id) REFERENCES created_events(event_id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
	`);
}

// Create a certificate request
const createCertificateRequest = async ({ event_id, student_id }) => {
	await ensureSchema();
	const query = `INSERT INTO certificate_requests (event_id, student_id, status) VALUES (?, ?, 'pending')`;
	const [result] = await db.query(query, [event_id, student_id]);
	return result.insertId;
};

// Get all certificate requests for an organization
const getCertificateRequestsByOrg = async (org_id) => {
	await ensureSchema();
	const query = `
		SELECT 
			cr.id, cr.event_id, cr.student_id, cr.status, 
			cr.requested_at, cr.processed_at, cr.rejection_reason, cr.certificate_url,
			e.title AS event_title, e.location AS event_location, 
			e.start_date AS event_start_date, e.end_date AS event_end_date,
			s.first_name, s.middle_initial, s.last_name, s.suffix, s.email AS student_email,
			s.department, s.program
		FROM certificate_requests cr
		INNER JOIN created_events e ON cr.event_id = e.event_id
		INNER JOIN students s ON cr.student_id = s.id
		WHERE e.created_by_org_id = ? AND e.created_by_osws_id IS NULL
		ORDER BY cr.requested_at DESC
	`;
	const [rows] = await db.query(query, [org_id]);
	return rows;
};

// Get certificate request by ID
const getCertificateRequestById = async (request_id) => {
	await ensureSchema();
	const query = `
		SELECT 
			cr.*, 
			e.title AS event_title, e.created_by_org_id, e.created_by_osws_id,
			s.first_name, s.middle_initial, s.last_name, s.suffix, s.email AS student_email
		FROM certificate_requests cr
		INNER JOIN created_events e ON cr.event_id = e.event_id
		INNER JOIN students s ON cr.student_id = s.id
		WHERE cr.id = ?
		LIMIT 1
	`;
	const [rows] = await db.query(query, [request_id]);
	return rows[0] || null;
};

// Update certificate request status (approve or reject)
const updateCertificateRequestStatus = async (request_id, { status, processed_by, rejection_reason = null, certificate_url = null }) => {
	await ensureSchema();
	const query = `
		UPDATE certificate_requests 
		SET status = ?, processed_at = NOW(), processed_by = ?, rejection_reason = ?, certificate_url = ?
		WHERE id = ?
	`;
	await db.query(query, [status, processed_by, rejection_reason, certificate_url, request_id]);
};

// Check if student already has a pending or approved request for an event
const hasPendingOrApprovedRequest = async (event_id, student_id) => {
	await ensureSchema();
	const query = `
		SELECT COUNT(*) AS cnt 
		FROM certificate_requests 
		WHERE event_id = ? AND student_id = ? AND status IN ('pending', 'approved')
	`;
	const [rows] = await db.query(query, [event_id, student_id]);
	return (rows[0]?.cnt || 0) > 0;
};

module.exports = {
	createCertificateRequest,
	getCertificateRequestsByOrg,
	getCertificateRequestById,
	updateCertificateRequestStatus,
	hasPendingOrApprovedRequest
};
