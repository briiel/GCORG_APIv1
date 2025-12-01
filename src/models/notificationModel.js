const db = require('../config/db');
const { parseMysqlLocalStringToDate } = require('../utils/dbDate');
const SERVER_TZ_OFFSET = process.env.SERVER_TZ_OFFSET || process.env.EVENT_TZ_OFFSET || '+08:00';

// Ensure notifications table exists (idempotent) and attempt to add
// missing columns/indexes when running against an older schema.
async function ensureSchema() {
	// Create table if it does not exist
	await db.query(`
		CREATE TABLE IF NOT EXISTS notifications (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			user_id VARCHAR(50) NULL,
			message VARCHAR(1000) NOT NULL,
			event_id INT NULL,
			panel VARCHAR(50) NULL,
			org_id VARCHAR(50) NULL,
			type VARCHAR(50) NULL,
			is_read TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			KEY idx_user_created (user_id, created_at),
			KEY idx_event (event_id),
			KEY idx_panel_org (panel, org_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
	`);

	// Try to add the `panel` column and other optional columns if they are missing.
	// Some MySQL versions support `ADD COLUMN IF NOT EXISTS`; wrap in try/catch to
	// tolerate older servers or existing columns/indexes.
	try {
		await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS panel VARCHAR(50) NULL`);
	} catch (err) {
		// Ignore duplicate-column errors, rethrow others
		if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) throw err;
	}

	try {
		await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS org_id VARCHAR(50) NULL`);
	} catch (err) {
		if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) throw err;
	}

	try {
		await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL`);
	} catch (err) {
		if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) throw err;
	}

	// Add metadata JSON column for structured payloads
	try {
		await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSON NULL`);
	} catch (err) {
		// Some MySQL versions may not accept JSON type; ignore duplicate column errors
		if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
			// If JSON not supported, try TEXT as fallback
			try { await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata TEXT NULL`); } catch (_) { }
		}
	}

	// Add priority and read_at columns for future features
	try {
		await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TINYINT NOT NULL DEFAULT 1`);
	} catch (err) {
		if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) throw err;
	}

	try {
		await db.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at DATETIME NULL`);
	} catch (err) {
		if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) throw err;
	}

	// Ensure an index for panel/org exists; ignore if it already exists.
	try {
		await db.query(`ALTER TABLE notifications ADD INDEX idx_panel_org (panel, org_id)`);
	} catch (err) {
		// ER_DUP_KEYNAME (errno 1022/1007 depending) means index exists - ignore
		if (!(err && (err.code === 'ER_DUP_KEYNAME' || err.errno === 1022 || err.errno === 1007))) throw err;
	}
}

// Create notification
const createNotification = async ({ user_id = null, message, event_id = null, panel = null, org_id = null, type = null, metadata = null, priority = 1 }) => {
	await ensureSchema();
	// default to global panel when no panel specified so messages are broadly visible
	if (!panel) panel = 'global';

	const query = `INSERT INTO notifications (user_id, message, event_id, panel, org_id, type, metadata, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
	// Store metadata as JSON string when object provided
	const metaToStore = (metadata && typeof metadata === 'object') ? JSON.stringify(metadata) : metadata;
	await db.query(query, [user_id, message, event_id, panel, org_id, type, metaToStore, priority]);
};

// Get notifications for a user with optional panel/org filtering
// options: { panel: 'student'|'organization'|'admin'|null, org_id: string|null }
const getNotificationsForUser = async (user_id, options = {}) => {
	await ensureSchema();

	const { panel = null, org_id = null } = options;

	// Base SQL selects notifications and joins event title when available
	let sql = `
		SELECT n.*, e.title AS event_title,
		CASE
			WHEN n.panel IS NULL OR n.panel = 'global' THEN 'Global'
			WHEN n.panel = 'student' THEN 'Student'
			WHEN n.panel = 'organization' THEN 'Organization'
			WHEN n.panel = 'osws' THEN 'OSWS'
			WHEN n.panel = 'admin' THEN 'Admin'
			ELSE n.panel
		END AS label
		FROM notifications n
		LEFT JOIN created_events e ON n.event_id = e.event_id
		WHERE (n.user_id IS NULL OR n.user_id = ?)
	`;
	const params = [user_id];

	if (panel === 'student') {
		// Student panel: exclude organization-only notifications
		sql += ` AND (n.panel IS NULL OR n.panel = 'student' OR n.panel = 'global')`;
	} else if (panel === 'organization') {
		// Organization panel: show organization-scoped notifications for this org and global
		sql += ` AND (n.panel IS NULL OR n.panel = 'global' OR (n.panel = 'organization' AND n.org_id = ?))`;
		params.push(org_id);
	} else if (panel === 'admin') {
		sql += ` AND (n.panel IS NULL OR n.panel = 'global' OR n.panel = 'admin')`;
	} else if (panel === 'osws') {
		// OSWS panel: show OSWS-scoped notifications and global messages
		sql += ` AND (n.panel IS NULL OR n.panel = 'global' OR n.panel = 'osws')`;
	} else {
		// No panel provided: return all notifications visible to the user
	}

	sql += ` ORDER BY n.created_at DESC, n.id DESC`;

	// Pagination support
	const page = options.page ? Math.max(1, parseInt(options.page, 10)) : undefined;
	const per_page = options.per_page ? Math.max(1, Math.min(100, parseInt(options.per_page, 10))) : undefined;

	let rows = [];
	let total = 0;
	if (page && per_page) {
		// Count with same WHERE clause
		const countSql = `SELECT COUNT(*) AS cnt FROM notifications n LEFT JOIN created_events e ON n.event_id = e.event_id WHERE (n.user_id IS NULL OR n.user_id = ?)` + (sql.includes('AND (n.panel') ? sql.split('WHERE (n.user_id IS NULL OR n.user_id = ?)')[1].replace(/^\s+/, ' WHERE ') : '');
		const [[cnt]] = await db.query(countSql, params);
		total = Number(cnt?.cnt || 0);
		const offset = (page - 1) * per_page;
		const pagedSql = sql + ' LIMIT ? OFFSET ?';
		const pagedParams = params.concat([per_page, offset]);
		const [qrows] = await db.query(pagedSql, pagedParams);
		rows = qrows;
	} else {
		const [qrows] = await db.query(sql, params);
		rows = qrows;
		total = rows.length;
	}
	// Normalize created_at (DATETIME without timezone) into an ISO UTC instant
	// using the server-configured timezone offset. This prevents the frontend
	// from misinterpreting the DATETIME as UTC and shifting displayed times.
	const mapped = (rows || []).map(r => {
		try {
			const out = { ...r };
			if (r.created_at) {
				const d = parseMysqlLocalStringToDate(r.created_at, SERVER_TZ_OFFSET);
				out.created_at = d ? d.toISOString() : null;
			}
			if (r.read_at) {
				const rd = parseMysqlLocalStringToDate(r.read_at, SERVER_TZ_OFFSET);
				out.read_at = rd ? rd.toISOString() : null;
			}
			return out;
		} catch (_) {}
		return r;
	});
	if (page && per_page) {
		return { items: mapped, total, page, per_page, total_pages: Math.ceil(total / per_page) };
	}
	return mapped;
};

// Mark notification as read
const markAsRead = async (notification_id) => {
	await ensureSchema();
	const query = `UPDATE notifications SET is_read = TRUE, read_at = UTC_TIMESTAMP() WHERE id = ?`;
	await db.query(query, [notification_id]);
};

// Mark all notifications as read for a user within optional panel/org filters
const markAllAsRead = async (user_id, options = {}) => {
	await ensureSchema();

	const { panel = null, org_id = null } = options;

	let sql = `UPDATE notifications n SET n.is_read = TRUE, n.read_at = UTC_TIMESTAMP() WHERE (n.user_id IS NULL OR n.user_id = ?)`;
	const params = [user_id];

	if (panel === 'student') {
		sql += ` AND (n.panel IS NULL OR n.panel = 'student' OR n.panel = 'global')`;
	} else if (panel === 'organization') {
		sql += ` AND (n.panel IS NULL OR n.panel = 'global' OR (n.panel = 'organization' AND n.org_id = ?))`;
		params.push(org_id);
	} else if (panel === 'admin') {
		sql += ` AND (n.panel IS NULL OR n.panel = 'global' OR n.panel = 'admin')`;
	} else if (panel === 'osws') {
		sql += ` AND (n.panel IS NULL OR n.panel = 'global' OR n.panel = 'osws')`;
	}

	await db.query(sql, params);
};

module.exports = { createNotification, getNotificationsForUser, markAsRead, markAllAsRead };