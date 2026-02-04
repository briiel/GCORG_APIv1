const db = require('../config/db');
const { decryptData } = require('../utils/encryption');

/**
 * Decrypt email field if it appears to be encrypted
 */
function decryptEmailField(record) {
    if (!record || !record.email) return record;

    try {
        if (typeof record.email === 'string' && record.email.includes(':')) {
            const parts = record.email.split(':');
            if (parts.length === 3) {
                try {
                    record.email = decryptData(record.email);
                } catch (err) {
                    console.error('Failed to decrypt email in archive, using as-is:', err.message);
                }
            }
        }
    } catch (error) {
        console.error('Error decrypting email field:', error);
    }

    return record;
}

/**
 * Decrypt email fields in array of records
 */
function decryptEmailArray(records) {
    return records.map(record => decryptEmailField(record));
}

// ============================================
// OSWS Admins Archive Operations
// ============================================

// Get all trashed/archived OSWS admins
const getTrashedAdmins = async () => {
    const query = `
        SELECT id, email, name, deleted_at, deleted_by
        FROM osws_admins
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
    `;
    const [rows] = await db.query(query);
    return decryptEmailArray(rows);
};

// Restore a trashed OSWS admin
const restoreAdmin = async (adminId) => {
    const query = `
        UPDATE osws_admins 
        SET deleted_at = NULL, deleted_by = NULL 
        WHERE id = ? AND deleted_at IS NOT NULL
    `;
    const [result] = await db.query(query, [adminId]);
    return result.affectedRows > 0;
};

// Permanently delete an OSWS admin (hard delete)
const permanentDeleteAdmin = async (adminId) => {
    const query = `DELETE FROM osws_admins WHERE id = ? AND deleted_at IS NOT NULL`;
    const [result] = await db.query(query, [adminId]);
    return result.affectedRows > 0;
};

// ============================================
// Student Organizations Archive Operations
// ============================================

// Get all trashed/archived student organizations
const getTrashedOrganizations = async () => {
    const query = `
        SELECT id, email, org_name, department, deleted_at, deleted_by
        FROM student_organizations
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
    `;
    const [rows] = await db.query(query);
    return decryptEmailArray(rows);
};

// Restore a trashed student organization
const restoreOrganization = async (orgId) => {
    const query = `
        UPDATE student_organizations 
        SET deleted_at = NULL, deleted_by = NULL 
        WHERE id = ? AND deleted_at IS NOT NULL
    `;
    const [result] = await db.query(query, [orgId]);
    return result.affectedRows > 0;
};

// Permanently delete a student organization (hard delete)
const permanentDeleteOrganization = async (orgId) => {
    const query = `DELETE FROM student_organizations WHERE id = ? AND deleted_at IS NOT NULL`;
    const [result] = await db.query(query, [orgId]);
    return result.affectedRows > 0;
};

// ============================================
// Organization Members Archive Operations
// ============================================

// Get all trashed/archived organization members (by org)
const getTrashedMembersByOrg = async (orgId) => {
    const query = `
        SELECT 
            om.member_id,
            om.student_id,
            om.org_id,
            om.position,
            om.joined_at,
            om.deleted_at,
            om.deleted_by,
            s.first_name,
            s.last_name,
            s.middle_initial,
            s.suffix,
            s.email,
            s.department,
            s.program,
            so.org_name
        FROM organizationmembers om
        JOIN students s ON om.student_id = s.id
        JOIN student_organizations so ON om.org_id = so.id
        WHERE om.org_id = ? AND om.deleted_at IS NOT NULL
        ORDER BY om.deleted_at DESC
    `;
    const [rows] = await db.query(query, [orgId]);
    return decryptEmailArray(rows);
};

// Get all trashed/archived organization members (all orgs - for OSWS admin)
const getTrashedMembersAll = async () => {
    const query = `
        SELECT 
            om.member_id,
            om.student_id,
            om.org_id,
            om.position,
            om.joined_at,
            om.deleted_at,
            om.deleted_by,
            s.first_name,
            s.last_name,
            s.middle_initial,
            s.suffix,
            s.email,
            s.department,
            s.program,
            so.org_name
        FROM organizationmembers om
        JOIN students s ON om.student_id = s.id
        JOIN student_organizations so ON om.org_id = so.id
        WHERE om.deleted_at IS NOT NULL
        ORDER BY om.deleted_at DESC
    `;
    const [rows] = await db.query(query);
    return decryptEmailArray(rows);
};

// Restore a trashed organization member
const restoreMember = async (memberId) => {
    const query = `
        UPDATE organizationmembers 
        SET deleted_at = NULL, deleted_by = NULL, is_active = TRUE 
        WHERE member_id = ? AND deleted_at IS NOT NULL
    `;
    const [result] = await db.query(query, [memberId]);
    return result.affectedRows > 0;
};

// Permanently delete an organization member (hard delete)
const permanentDeleteMember = async (memberId) => {
    const query = `DELETE FROM organizationmembers WHERE member_id = ? AND deleted_at IS NOT NULL`;
    const [result] = await db.query(query, [memberId]);
    return result.affectedRows > 0;
};

// ============================================
// Auto-cleanup: Delete items older than 30 days
// ============================================

// Get count of items eligible for auto-deletion
const getExpiredItemsCount = async () => {
    const [adminsCount] = await db.query(
        `SELECT COUNT(*) as count FROM osws_admins 
         WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`
    );
    
    const [orgsCount] = await db.query(
        `SELECT COUNT(*) as count FROM student_organizations 
         WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`
    );
    
    const [membersCount] = await db.query(
        `SELECT COUNT(*) as count FROM organizationmembers 
         WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`
    );
    
    return {
        admins: adminsCount[0].count,
        organizations: orgsCount[0].count,
        members: membersCount[0].count
    };
};

// Auto-delete expired items (older than 30 days)
const autoDeleteExpiredItems = async () => {
    let deleted = {
        admins: 0,
        organizations: 0,
        members: 0
    };
    
    // Delete expired admins
    const [adminsResult] = await db.query(
        `DELETE FROM osws_admins 
         WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`
    );
    deleted.admins = adminsResult.affectedRows;
    
    // Delete expired organizations
    const [orgsResult] = await db.query(
        `DELETE FROM student_organizations 
         WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`
    );
    deleted.organizations = orgsResult.affectedRows;
    
    // Delete expired members
    const [membersResult] = await db.query(
        `DELETE FROM organizationmembers 
         WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)`
    );
    deleted.members = membersResult.affectedRows;
    
    return deleted;
};

module.exports = {
    // Admins
    getTrashedAdmins,
    restoreAdmin,
    permanentDeleteAdmin,
    
    // Organizations
    getTrashedOrganizations,
    restoreOrganization,
    permanentDeleteOrganization,
    
    // Members
    getTrashedMembersByOrg,
    getTrashedMembersAll,
    restoreMember,
    permanentDeleteMember,
    
    // Auto-cleanup
    getExpiredItemsCount,
    autoDeleteExpiredItems
};
