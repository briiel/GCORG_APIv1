const notificationModel = require('../models/notificationModel');

const createNotification = async (data) => {
	return notificationModel.createNotification(data);
};

const getNotificationsForUser = async (user_id) => {
	return notificationModel.getNotificationsForUser(user_id);
};

const markAsRead = async (notification_id) => {
	return notificationModel.markAsRead(notification_id);
};

module.exports = { createNotification, getNotificationsForUser, markAsRead };