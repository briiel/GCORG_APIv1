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

const fetchOrganizationMembers = async(orgId) => {
    try {
        const members = await userModel.getOrganizationMembers(orgId);
        return members;
    } catch (error) {
        console.error('Error fetching organization members:', error);
        throw error;
    }
}

const removeOrganizationMember = async(orgId, memberId) => {
    try {
        await userModel.removeOrganizationMember(orgId, memberId);
    } catch (error) {
        console.error('Error removing organization member:', error);
        throw error;
    }
}

module.exports = { fetchAllusers, fetchUserById, fetchOrganizationMembers, removeOrganizationMember };