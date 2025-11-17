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
}