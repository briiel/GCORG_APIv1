// const notificationService = require('../services/notificationService');
// const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');

// exports.getNotifications = async (req, res) => {
//     try {
//         const user_id = req.user.id;
//         const notifications = await notificationService.getNotificationsForUser(user_id);
//         return handleSuccessResponse(res, notifications);
//     } catch (error) {
//         return handleErrorResponse(res, error.message);
//     }
// };

// exports.markAsRead = async (req, res) => {
//     try {
//         const { id } = req.params;
//         await notificationService.markAsRead(id);
//         return handleSuccessResponse(res, { message: 'Notification marked as read' });
//     } catch (error) {
//         return handleErrorResponse(res, error.message);
//     }
// };