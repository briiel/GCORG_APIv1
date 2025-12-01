const notificationModel = require('../models/notificationModel');
const { templates, render } = require('./notificationTemplates');
const types = require('./notificationTypes');

// Create a notification. Accepts either a raw message or a `type` which resolves
// to a template. `metadata` may be an object and will be stored as JSON.
const createNotification = async (data) => {
	// data may include: user_id, message, event_id, panel, org_id, type, metadata, priority
	const payload = { ...data };
	try {
		if (!payload.message && payload.type) {
			const tmpl = templates[payload.type];
			if (tmpl) {
				payload.panel = payload.panel || tmpl.panel || 'global';
				const vars = payload.templateVars || {};
				payload.message = render(tmpl.defaultMessage, vars);
			}
		}
	} catch (e) {
		// If template rendering fails, fall back to provided message or empty string
		console.warn('Notification template render failed:', e && e.message ? e.message : e);
		payload.message = payload.message || '';
	}

	return notificationModel.createNotification(payload);
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