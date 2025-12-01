/**
 * Notification Controller
 * Handles notification retrieval and status updates
 */

const notificationService = require('../services/notificationService');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');

exports.getNotifications = async (req, res) => {
	try {
		const user_id = String(req.user.id);
		// Panel may be provided by frontend: 'student' | 'organization' | 'admin' | 'osws_admin'
		let panel = req.query.panel || null;
		// Normalize frontend panel names to backend model expectations
		if (panel === 'osws_admin') panel = 'osws';
		const org_id = req.user.organization?.org_id || req.user.organization_id || req.user.orgId || null;
		const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
		const per_page = req.query.per_page ? parseInt(req.query.per_page, 10) : undefined;
		const result = await notificationService.getNotificationsForUser(user_id, { panel, org_id, page, per_page });
		if (result && result.items && Array.isArray(result.items)) {
			return handleSuccessResponse(res, result);
		}
		return handleSuccessResponse(res, { items: Array.isArray(result) ? result : [] });
	} catch (error) {
		return handleErrorResponse(res, error.message);
	}
};

exports.markAsRead = async (req, res) => {
	try {
		const { id } = req.params;
		await notificationService.markAsRead(id);
		return handleSuccessResponse(res, { message: 'Notification marked as read' });
	} catch (error) {
		return handleErrorResponse(res, error.message);
	}
};

exports.markAllAsRead = async (req, res) => {
	try {
		const user_id = String(req.user.id);
		let panel = req.query.panel || null;
		if (panel === 'osws_admin') panel = 'osws';
		const org_id = req.user.organization?.org_id || req.user.organization_id || req.user.orgId || null;
		await notificationService.markAllAsRead(user_id, { panel, org_id });
		return handleSuccessResponse(res, { message: 'All notifications marked as read' });
	} catch (error) {
		return handleErrorResponse(res, error.message);
	}
};