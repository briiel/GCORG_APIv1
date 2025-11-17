const userModel = require('../models/userModel');
const { retryQuery } = require('../utils/dbRetry');

const fetchAllusers = async () => {
    try {
        const users = await retryQuery(
            () => userModel.getAllUsers(),
            { operationName: 'Fetch all users' }
        );
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

const fetchUserById = async(id) => {
    try {
        const user = await retryQuery(
            () => userModel.getUserById(id),
            { operationName: `Fetch user by ID ${id}` }
        );
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
    }
}

module.exports = { fetchAllusers, fetchUserById };