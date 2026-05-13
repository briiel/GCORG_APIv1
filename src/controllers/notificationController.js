// Notification Controller — retrieves and marks user notifications as read

const notificationService = require('../services/notificationService');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');

const normalizePanel = (panel) => {
	if (!panel) return null;
	const raw = String(panel).trim().toLowerCase();
	if (raw === 'osws_admin' || raw === 'admin') return 'osws';
	return raw;
};

const resolveUserId = (user) => {
	const resolved = user?.studentId || user?.legacyId || user?.id;
	return resolved ? String(resolved) : null;
};

exports.getNotifications = async (req, res) => {
	try {
		const user_id = resolveUserId(req.user);
		if (!user_id) return handleErrorResponse(res, 'Invalid authenticated user context', 401);
		// Panel may be provided by frontend: 'student' | 'organization' | 'admin' | 'osws_admin'
		const panel = normalizePanel(req.body?.panel);
		const org_id = req.user.organization?.org_id || req.user.organization_id || req.user.orgId || null;
		if (panel === 'organization' && !org_id) {
			return handleErrorResponse(res, 'Organization context is required for organization panel notifications', 400);
		}
		const page = (req.body.page) ? parseInt(req.body.page, 10) : (req.query.page ? parseInt(req.query.page, 10) : undefined);
		const per_page = (req.body.per_page) ? parseInt(req.body.per_page, 10) : (req.query.per_page ? parseInt(req.query.per_page, 10) : undefined);
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
		const user_id = resolveUserId(req.user);
		if (!user_id) return handleErrorResponse(res, 'Invalid authenticated user context', 401);
		const panel = normalizePanel(req.body?.panel || req.query?.panel);
		const org_id = req.user.organization?.org_id || req.user.organization_id || req.user.orgId || null;
		await notificationService.markAsRead(id, user_id, { panel, org_id });
		return handleSuccessResponse(res, { message: 'Notification marked as read' });
	} catch (error) {
		return handleErrorResponse(res, error.message);
	}
};

exports.markAllAsRead = async (req, res) => {
	try {
		const user_id = resolveUserId(req.user);
		if (!user_id) return handleErrorResponse(res, 'Invalid authenticated user context', 401);
		const panel = normalizePanel(req.body?.panel);
		const org_id = req.user.organization?.org_id || req.user.organization_id || req.user.orgId || null;
		if (panel === 'organization' && !org_id) {
			return handleErrorResponse(res, 'Organization context is required for organization panel notifications', 400);
		}
		await notificationService.markAllAsRead(user_id, { panel, org_id });
		return handleSuccessResponse(res, { message: 'All notifications marked as read' });
	} catch (error) {
		return handleErrorResponse(res, error.message);
	}
};
