/**
 * Admin Controller
 * Handles OSWS admin management operations
 */

const db = require('../config/db');
const bcrypt = require('bcrypt');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');

// Add OSWS Admin
exports.addAdmin = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return handleErrorResponse(res, 'Email, password, and name are required.', 400);
        }
        // Check if admin already exists
        const [existing] = await db.query('SELECT * FROM osws_admins WHERE email = ?', [email]);
        if (existing.length > 0) {
            return handleErrorResponse(res, 'Admin email already exists.', 400);
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO osws_admins (email, password_hash, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name]
        );
        return handleSuccessResponse(res, { message: 'Admin account created.' }, 201);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Delete OSWS Admin (soft delete - moves to archive/trash)
exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return handleErrorResponse(res, 'Admin ID is required.', 400);
        
        const user = req.user;
        const deletedBy = user?.legacyId || user?.id || null;
        
        // Soft delete - set deleted_at timestamp and deleted_by
        await db.query(
            'UPDATE osws_admins SET deleted_at = UTC_TIMESTAMP(), deleted_by = ? WHERE id = ?',
            [deletedBy, id]
        );
        return handleSuccessResponse(res, { message: 'Admin account moved to archive.' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getManageUsers = async (req, res) => {
    try {
        // Get all OSWS admins (exclude deleted/archived)
        const [admins] = await db.query(
            'SELECT id, email, name FROM osws_admins WHERE deleted_at IS NULL'
        );
        // Get all student organizations (exclude deleted/archived)
        const [organizations] = await db.query(
            'SELECT id, email, org_name AS name, department FROM student_organizations WHERE deleted_at IS NULL'
        );
        return handleSuccessResponse(res, { admins, organizations });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Get latest active privacy policy
exports.getPrivacyPolicy = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, content, created_at, updated_at FROM privacy_policies WHERE active = 1 ORDER BY id DESC LIMIT 1'
        );
        const policy = rows.length > 0 ? rows[0] : { id: null, content: '' };
        return handleSuccessResponse(res, { policy });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};
