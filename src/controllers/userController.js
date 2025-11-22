const userService = require('../services/userService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

exports.getUsers = async (req, res) => {
    try {
        const users = await userService.fetchAllusers();
        return handleSuccessResponse(res, users);
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
        const members = await userService.fetchOrganizationMembers(orgId);
        return handleSuccessResponse(res, members);
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