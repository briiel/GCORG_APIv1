const db = require('../config/db');

// Ensure notifications table exists (idempotent)
async function ensureSchema() {
	await db.query(`
		CREATE TABLE IF NOT EXISTS notifications (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			user_id VARCHAR(20) NULL,
			message VARCHAR(500) NOT NULL,
			event_id INT NULL,
			is_read TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			KEY idx_user_created (user_id, created_at),
			KEY idx_event (event_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
	`);
}

// Create notification
const createNotification = async ({ user_id = null, message, event_id = null }) => {
	await ensureSchema();
	const query = `INSERT INTO notifications (user_id, message, event_id) VALUES (?, ?, ?)`;
	await db.query(query, [user_id, message, event_id]);
};

// Get notifications for a user (includes global: user_id IS NULL)
const getNotificationsForUser = async (user_id) => {
	await ensureSchema();
	const query = `
		SELECT n.*, e.title AS event_title
		FROM notifications n
		LEFT JOIN created_events e ON n.event_id = e.event_id
		WHERE n.user_id IS NULL OR n.user_id = ?
		ORDER BY n.created_at DESC, n.id DESC
	`;
	const [rows] = await db.query(query, [user_id]);
	return rows;
};

// Mark notification as read
const markAsRead = async (notification_id) => {
	await ensureSchema();
	const query = `UPDATE notifications SET is_read = TRUE WHERE id = ?`;
	await db.query(query, [notification_id]);
};

module.exports = { createNotification, getNotificationsForUser, markAsRead };