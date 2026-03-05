// Archive/Trash Controller — soft-delete management, restore, and permanent deletion

const archiveModel = require('../models/archiveModel');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

// Get all trashed items — admins see archived admins, org officers see their archived members
exports.getTrash = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        let trashedData = { events: [], admins: [], organizations: [], members: [] };

        if (userRoles.includes('oswsadmin')) {
            trashedData.admins = await archiveModel.getTrashedAdmins();
        }

        if (userRoles.includes('orgofficer')) {
            const orgId = user.organization?.org_id || user.legacyId;
            if (orgId) trashedData.members = await archiveModel.getTrashedMembersByOrg(orgId);
        }

        return handleSuccessResponse(res, { items: trashedData });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Restore OSWS Admin (admin only)
exports.restoreAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.roles?.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);
        const restored = await archiveModel.restoreAdmin(id);
        if (!restored) return handleErrorResponse(res, 'Admin not found or already restored', 404);
        return handleSuccessResponse(res, { message: 'Admin account restored successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Restore Student Organization (admin only)
exports.restoreOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.roles?.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);
        const restored = await archiveModel.restoreOrganization(id);
        if (!restored) return handleErrorResponse(res, 'Organization not found or already restored', 404);
        return handleSuccessResponse(res, { message: 'Organization account restored successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Restore Organization Member (admin or org officer)
exports.restoreMember = async (req, res) => {
    try {
        const { id } = req.params;
        const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (!userRoles.includes('oswsadmin') && !userRoles.includes('orgofficer')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        const restored = await archiveModel.restoreMember(id);
        if (!restored) return handleErrorResponse(res, 'Member not found or already restored', 404);
        return handleSuccessResponse(res, { message: 'Member restored successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Permanently delete OSWS Admin (admin only)
exports.permanentDeleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.roles?.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);
        const deleted = await archiveModel.permanentDeleteAdmin(id);
        if (!deleted) return handleErrorResponse(res, 'Admin not found in trash', 404);
        return handleSuccessResponse(res, { message: 'Admin account permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Permanently delete Student Organization (admin only)
exports.permanentDeleteOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.roles?.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);
        const deleted = await archiveModel.permanentDeleteOrganization(id);
        if (!deleted) return handleErrorResponse(res, 'Organization not found in trash', 404);
        return handleSuccessResponse(res, { message: 'Organization account permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Permanently delete Organization Member (admin or org officer)
exports.permanentDeleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (!userRoles.includes('oswsadmin') && !userRoles.includes('orgofficer')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        const deleted = await archiveModel.permanentDeleteMember(id);
        if (!deleted) return handleErrorResponse(res, 'Member not found in trash', 404);
        return handleSuccessResponse(res, { message: 'Member permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Get count of expired/stale archived items (admin only)
exports.getExpiredItemsCount = async (req, res) => {
    try {
        if (!req.user?.roles?.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);
        const counts = await archiveModel.getExpiredItemsCount();
        return handleSuccessResponse(res, counts);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Manually trigger auto-cleanup of expired archived items (admin only)
exports.triggerAutoCleanup = async (req, res) => {
    try {
        if (!req.user?.roles?.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);
        const deleted = await archiveModel.autoDeleteExpiredItems();
        return handleSuccessResponse(res, { message: 'Auto-cleanup completed', deleted });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

module.exports = exports;
