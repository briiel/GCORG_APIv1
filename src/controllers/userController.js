/**
 * User Controller
 * Handles user and organization member management operations
 */

const userService = require('../services/userService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

exports.getUsers = async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
        const per_page = req.query.per_page ? parseInt(req.query.per_page, 10) : undefined;
        const result = await userService.fetchAllusers({ page, per_page });
        // If service returned paginated object, forward it; otherwise wrap legacy array
        if (result && result.items && Array.isArray(result.items)) {
            return handleSuccessResponse(res, result);
        }
        return handleSuccessResponse(res, { items: Array.isArray(result) ? result : [] });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getUserById = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await userService.fetchUserById(userId);
        if (!user) {
            return handleErrorResponse(res, 'User not found');
        }
        return handleSuccessResponse(res, user);
        } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getOrganizationMembers = async (req, res) => {
    try {
        const orgId = parseInt(req.params.orgId);
        const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
        const per_page = req.query.per_page ? parseInt(req.query.per_page, 10) : undefined;
        const result = await userService.fetchOrganizationMembers(orgId, { page, per_page });
        if (result && result.items && Array.isArray(result.items)) {
            return handleSuccessResponse(res, result);
        }
        return handleSuccessResponse(res, { items: Array.isArray(result) ? result : [] });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.removeOrganizationMember = async (req, res) => {
    try {
        const orgId = parseInt(req.params.orgId);
        const memberId = parseInt(req.params.memberId);
        await userService.removeOrganizationMember(orgId, memberId);
        return handleSuccessResponse(res, { message: 'Member removed successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
}