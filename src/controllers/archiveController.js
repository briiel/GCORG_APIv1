/**
 * Archive/Trash Controller
 * Handles soft-deleted items management, restore, and permanent deletion
 */

const archiveModel = require('../models/archiveModel');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

// ============================================
// Get All Archived/Trashed Items
// ============================================

// Get all trashed items (events, admins, organizations, members)
exports.getTrash = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);
        
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        let trashedData = {
            events: [],
            admins: [],
            organizations: [],
            members: []
        };
        
        // OSWS Admins can see archived admins only (removed organizations and members)
        if (userRoles.includes('oswsadmin')) {
            trashedData.admins = await archiveModel.getTrashedAdmins();
        }
        
        // Organization Officers can see their archived members
        if (userRoles.includes('orgofficer')) {
            const orgId = user.organization?.org_id || user.legacyId;
            if (orgId) {
                trashedData.members = await archiveModel.getTrashedMembersByOrg(orgId);
            }
        }
        
        return handleSuccessResponse(res, trashedData);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// ============================================
// Restore Operations
// ============================================

// Restore OSWS Admin
exports.restoreAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Only OSWS admins can restore admins
        if (!user?.roles?.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const restored = await archiveModel.restoreAdmin(id);
        if (!restored) {
            return handleErrorResponse(res, 'Admin not found or already restored', 404);
        }
        
        return handleSuccessResponse(res, { message: 'Admin account restored successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Restore Student Organization
exports.restoreOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Only OSWS admins can restore organizations
        if (!user?.roles?.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const restored = await archiveModel.restoreOrganization(id);
        if (!restored) {
            return handleErrorResponse(res, 'Organization not found or already restored', 404);
        }
        
        return handleSuccessResponse(res, { message: 'Organization account restored successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Restore Organization Member
exports.restoreMember = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // OSWS admins or org officers can restore members
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        if (!userRoles.includes('oswsadmin') && !userRoles.includes('orgofficer')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const restored = await archiveModel.restoreMember(id);
        if (!restored) {
            return handleErrorResponse(res, 'Member not found or already restored', 404);
        }
        
        return handleSuccessResponse(res, { message: 'Member restored successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// ============================================
// Permanent Delete Operations
// ============================================

// Permanently delete OSWS Admin
exports.permanentDeleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Only OSWS admins can permanently delete admins
        if (!user?.roles?.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const deleted = await archiveModel.permanentDeleteAdmin(id);
        if (!deleted) {
            return handleErrorResponse(res, 'Admin not found in trash', 404);
        }
        
        return handleSuccessResponse(res, { message: 'Admin account permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Permanently delete Student Organization
exports.permanentDeleteOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Only OSWS admins can permanently delete organizations
        if (!user?.roles?.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const deleted = await archiveModel.permanentDeleteOrganization(id);
        if (!deleted) {
            return handleErrorResponse(res, 'Organization not found in trash', 404);
        }
        
        return handleSuccessResponse(res, { message: 'Organization account permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Permanently delete Organization Member
exports.permanentDeleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // OSWS admins or org officers can permanently delete members
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        if (!userRoles.includes('oswsadmin') && !userRoles.includes('orgofficer')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const deleted = await archiveModel.permanentDeleteMember(id);
        if (!deleted) {
            return handleErrorResponse(res, 'Member not found in trash', 404);
        }
        
        return handleSuccessResponse(res, { message: 'Member permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// ============================================
// Auto-cleanup Operations
// ============================================

// Get count of expired items (for monitoring/dashboard)
exports.getExpiredItemsCount = async (req, res) => {
    try {
        const user = req.user;
        
        // Only OSWS admins can check expired items
        if (!user?.roles?.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const counts = await archiveModel.getExpiredItemsCount();
        return handleSuccessResponse(res, counts);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Manually trigger auto-cleanup of expired items
exports.triggerAutoCleanup = async (req, res) => {
    try {
        const user = req.user;
        
        // Only OSWS admins can trigger cleanup
        if (!user?.roles?.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        
        const deleted = await archiveModel.autoDeleteExpiredItems();
        return handleSuccessResponse(res, {
            message: 'Auto-cleanup completed',
            deleted
        });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

module.exports = exports;
