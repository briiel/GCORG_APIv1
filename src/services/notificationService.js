const notificationModel = require('../models/notificationModel');

const createNotification = async (data) => {
	// data may include: user_id, message, event_id, panel, org_id, type
	return notificationModel.createNotification(data);
};

const getNotificationsForUser = async (user_id, options = {}) => {
	// options may include panel, org_id, page, per_page
	return notificationModel.getNotificationsForUser(user_id, options);
};

const markAsRead = async (notification_id) => {
	return notificationModel.markAsRead(notification_id);
};

const markAllAsRead = async (user_id, options = {}) => {
    return notificationModel.markAllAsRead(user_id, options);
};

module.exports = { createNotification, getNotificationsForUser, markAsRead, markAllAsRead };