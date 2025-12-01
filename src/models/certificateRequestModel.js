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

	// Ensure the `status` column supports all statuses used by the app.
	// If the table already exists this will ALTER the column to include new enum values.
	try {
		await db.query(`ALTER TABLE certificate_requests MODIFY COLUMN status ENUM('pending','processing','sent','approved','rejected') NOT NULL DEFAULT 'pending'`);
	} catch (e) {
		// If ALTER fails (rare), log and continue — schema will still work for new installs.
		console.warn('Could not ALTER certificate_requests.status column:', e && e.message ? e.message : e);
	}
}

// Create a certificate request
const createCertificateRequest = async ({ event_id, student_id }) => {
	await ensureSchema();
	// Use CONVERT_TZ to store the current time in the server's timezone explicitly
	// This ensures consistent behavior regardless of session timezone settings
	const query = `
		INSERT INTO certificate_requests (event_id, student_id, status, requested_at) 
		VALUES (?, ?, 'pending', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', ?))
	`;
	const [result] = await db.query(query, [event_id, student_id, SERVER_TZ_OFFSET]);
	return result.insertId;
};

// Get all certificate requests for an organization
const { parseMysqlLocalStringToDate } = require('../utils/dbDate');
// Use SERVER_TZ_OFFSET to correctly interpret DATETIME values stored by MySQL.
// The MySQL server timezone determines what CURRENT_TIMESTAMP() produces.
// For AlwaysData servers in CET (Central European Time), this should be '+01:00'.
// Fall back to EVENT_TZ_OFFSET (event-local) only if SERVER_TZ_OFFSET is not set.
const SERVER_TZ_OFFSET = process.env.SERVER_TZ_OFFSET || process.env.EVENT_TZ_OFFSET || '+08:00';
const EVENT_TZ_OFFSET = process.env.EVENT_TZ_OFFSET || '+08:00';

// Convert a JS Date (assumed UTC) to a local datetime string using an offset like '+08:00'.
// Returns 'YYYY-MM-DD HH:mm:ss' and an ISO with offset 'YYYY-MM-DDTHH:mm:ss+08:00'.
function formatDateToOffsetStrings(dateObj, offset = '+00:00') {
	if (!dateObj || isNaN(dateObj.getTime())) return { local: null, iso_with_offset: null };
	// offset format: (+|-)HH:MM
	const m = String(offset).match(/^([+-])(\d{2}):(\d{2})$/);
	let totalMinutes = 0;
	if (m) {
		const sign = m[1] === '-' ? -1 : 1;
		totalMinutes = sign * (Number(m[2]) * 60 + Number(m[3]));
	} else {
		// fallback: try '+08' style
		const m2 = String(offset).match(/^([+-])(\d{2})$/);
		if (m2) {
			const sign = m2[1] === '-' ? -1 : 1;
			totalMinutes = sign * (Number(m2[2]) * 60);
		}
	}
	// dateObj is UTC; compute local by adding offset minutes
	const localMs = dateObj.getTime() + totalMinutes * 60 * 1000;
	const local = new Date(localMs);
	const YYYY = local.getUTCFullYear();
	const MM = String(local.getUTCMonth() + 1).padStart(2, '0');
	const DD = String(local.getUTCDate()).padStart(2, '0');
	const hh = String(local.getUTCHours()).padStart(2, '0');
	const mm = String(local.getUTCMinutes()).padStart(2, '0');
	const ss = String(local.getUTCSeconds()).padStart(2, '0');
	const localStr = `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
	// Build ISO with offset
	const iso = `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${offset}`;
	return { local: localStr, iso_with_offset: iso };
}

const getCertificateRequestsByOrg = async (org_id, page = undefined, per_page = undefined) => {
	await ensureSchema();
	const baseWhere = `e.created_by_org_id = ? AND e.created_by_osws_id IS NULL`;
	const countSql = `SELECT COUNT(*) AS cnt FROM certificate_requests cr INNER JOIN created_events e ON cr.event_id = e.event_id WHERE ${baseWhere}`;
	const pageNum = page ? Math.max(1, parseInt(page, 10)) : undefined;
	const pp = per_page ? Math.max(1, Math.min(100, parseInt(per_page, 10))) : undefined;
	let rows = [];
	let total = 0;
	if (pageNum && pp) {
		const [[countRows]] = await db.query(countSql, [org_id]);
		total = Number(countRows?.cnt || 0);
		const offset = (pageNum - 1) * pp;
		const query = `
		SELECT 
			cr.id, cr.event_id, cr.student_id, cr.status, 
			cr.requested_at, cr.processed_at, cr.rejection_reason, cr.certificate_url,
			e.title AS event_title, e.location AS event_location, 
			e.start_date AS event_start_date, e.end_date AS event_end_date,
			s.first_name, s.middle_initial, s.last_name, s.suffix, s.email AS student_email,
			s.department, s.program, COALESCE(s.year_level, 4) AS year_level
		FROM certificate_requests cr
		INNER JOIN created_events e ON cr.event_id = e.event_id
		INNER JOIN students s ON cr.student_id = s.id
		WHERE ${baseWhere}
		ORDER BY cr.requested_at DESC
		LIMIT ? OFFSET ?
	`;
		const [qrows] = await db.query(query, [org_id, pp, offset]);
		rows = qrows;
	} else {
		const query = `
		SELECT 
			cr.id, cr.event_id, cr.student_id, cr.status, 
			cr.requested_at, cr.processed_at, cr.rejection_reason, cr.certificate_url,
			e.title AS event_title, e.location AS event_location, 
			e.start_date AS event_start_date, e.end_date AS event_end_date,
			s.first_name, s.middle_initial, s.last_name, s.suffix, s.email AS student_email,
			s.department, s.program, COALESCE(s.year_level, 4) AS year_level
		FROM certificate_requests cr
		INNER JOIN created_events e ON cr.event_id = e.event_id
		INNER JOIN students s ON cr.student_id = s.id
		WHERE ${baseWhere}
		ORDER BY cr.requested_at DESC
		`;
		const [qrows] = await db.query(query, [org_id]);
		rows = qrows;
		total = rows.length;
	}
	// Convert DATETIME strings (returned as strings by dateStrings: true) into
	// explicit ISO UTC strings and event-local formatted strings so the frontend
	// can display either UTC or event-local times without ambiguity.
	const mapped = (rows || []).map(r => {
		const out = { ...r };
		try {
			if (out.requested_at) {
					// Interpret the MySQL DATETIME as occurring in the SERVER timezone (SERVER_TZ_OFFSET)
					// because CURRENT_TIMESTAMP() stores time in the server's timezone.
					// Convert it to a UTC JS Date so the frontend gets a correct ISO instant.
					const d = parseMysqlLocalStringToDate(out.requested_at, SERVER_TZ_OFFSET);
					out.requested_at = d ? d.toISOString() : null;
					// Also provide event-local formatted strings for display in the event's timezone
					const f = d ? formatDateToOffsetStrings(d, EVENT_TZ_OFFSET) : { local: null, iso_with_offset: null };
					out.requested_at_local = f.local;
					out.requested_at_local_iso = f.iso_with_offset;
				}
		} catch (_) { /* keep originals on error */ }
		try {
			if (out.processed_at) {
					const d2 = parseMysqlLocalStringToDate(out.processed_at, SERVER_TZ_OFFSET);
					out.processed_at = d2 ? d2.toISOString() : null;
					const f2 = d2 ? formatDateToOffsetStrings(d2, EVENT_TZ_OFFSET) : { local: null, iso_with_offset: null };
					out.processed_at_local = f2.local;
					out.processed_at_local_iso = f2.iso_with_offset;
				}
		} catch (_) { /* keep originals on error */ }
		return out;
	});
	if (pageNum && pp) {
		return { items: mapped, total, page: pageNum, per_page: pp, total_pages: Math.ceil(total / pp) };
	}
	return mapped;
};

// Get certificate request by ID
const getCertificateRequestById = async (request_id) => {
	await ensureSchema();
	const query = `
		SELECT 
			cr.*, 
			e.title AS event_title, e.created_by_org_id, e.created_by_osws_id,
			s.first_name, s.middle_initial, s.last_name, s.suffix, s.email AS student_email, COALESCE(s.year_level, 4) AS year_level
		FROM certificate_requests cr
		INNER JOIN created_events e ON cr.event_id = e.event_id
		INNER JOIN students s ON cr.student_id = s.id
		WHERE cr.id = ?
		LIMIT 1
	`;
	const [rows] = await db.query(query, [request_id]);
	const row = rows[0] || null;
	if (!row) return null;
	// Normalize timestamps to ISO UTC and add event-local formatted strings
	try {
		if (row.requested_at) {
				// Parse using SERVER_TZ_OFFSET (the timezone of the MySQL server)
				const d = parseMysqlLocalStringToDate(row.requested_at, SERVER_TZ_OFFSET);
				row.requested_at = d ? d.toISOString() : null;
				// Provide event-local formatted versions for display
				const f = d ? formatDateToOffsetStrings(d, EVENT_TZ_OFFSET) : { local: null, iso_with_offset: null };
				row.requested_at_local = f.local;
				row.requested_at_local_iso = f.iso_with_offset;
			}
	} catch (_) {}
	try {
		if (row.processed_at) {
			const d2 = parseMysqlLocalStringToDate(row.processed_at, SERVER_TZ_OFFSET);
			row.processed_at = d2 ? d2.toISOString() : null;
			const f2 = d2 ? formatDateToOffsetStrings(d2, EVENT_TZ_OFFSET) : { local: null, iso_with_offset: null };
			row.processed_at_local = f2.local;
			row.processed_at_local_iso = f2.iso_with_offset;
		}
	} catch (_) {}
	return row;
};

// Update certificate request status (approve or reject)
const updateCertificateRequestStatus = async (request_id, { status, processed_by, rejection_reason = null, certificate_url = null }) => {
	await ensureSchema();
	const query = `
		UPDATE certificate_requests 
		SET status = ?, processed_at = UTC_TIMESTAMP(), processed_by = ?, rejection_reason = ?, certificate_url = ?
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
