const userModel = require('../models/userModel');

const fetchAllusers = async () => {
    try {
        const users = await userModel.getAllUsers();
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

const fetchUserById = async(id) => {
    try {
        const user = await userModel.getUserById(id);
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