const userModel = require('../models/userModel');

const fetchAllusers = async (opts = {}) => {
    try {
        const page = opts.page || opts.page === 0 ? opts.page : undefined;
        const per_page = opts.per_page || opts.perPage || opts.perPage === 0 ? opts.per_page || opts.perPage : undefined;
        if (page !== undefined || per_page !== undefined) {
            return await userModel.getAllUsersPaginated(page, per_page);
        }
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

const fetchOrganizationMembers = async(orgId, opts = {}) => {
    try {
        const page = opts.page || undefined;
        const per_page = opts.per_page || opts.perPage || undefined;
        if (page !== undefined || per_page !== undefined) {
            return await userModel.getOrganizationMembersPaginated(orgId, page, per_page);
        }
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