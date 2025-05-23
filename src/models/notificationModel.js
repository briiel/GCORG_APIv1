// const db = require('../config/db');

// // Create notification(s)
// const createNotification = async ({ user_id, message, event_id }) => {
//     const query = `INSERT INTO notifications (user_id, message, event_id) VALUES (?, ?, ?)`;
//     await db.query(query, [user_id, message, event_id]);
// };

// // Get notifications for a user (or all students)
// const getNotificationsForUser = async (user_id) => {
//     const query = `
//         SELECT n.*, e.title AS event_title
//         FROM notifications n
//         LEFT JOIN created_events e ON n.event_id = e.event_id
//         WHERE n.user_id IS NULL OR n.user_id = ?
//         ORDER BY n.created_at DESC
//     `;
//     const [rows] = await db.query(query, [user_id]);
//     return rows;
// };

// // Mark notification as read
// const markAsRead = async (notification_id) => {
//     const query = `UPDATE notifications SET is_read = TRUE WHERE id = ?`;
//     await db.query(query, [notification_id]);
// };

// module.exports = { createNotification, getNotificationsForUser, markAsRead };