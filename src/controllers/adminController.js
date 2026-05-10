// OSWS Admin Controller — admin account creation, soft-delete, and user listing

const db = require('../config/db');
const bcrypt = require('bcrypt');
const { handleSuccessResponse, handleErrorResponse } = require('../utils/errorHandler');
const asyncHandler = require('../middleware/async-handler');
const { ValidationError, ConflictError, DatabaseError } = require('../utils/error-classes');

// Add OSWS Admin
exports.addAdmin = asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        throw new ValidationError('Email, password, and name are required.');
    }

    // Check if admin already exists
    const [existingAdmin] = await db.query('SELECT id FROM osws_admins WHERE email = ? LIMIT 1', [email]);
    if (existingAdmin.length > 0) {
        throw new ConflictError('Admin email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.query(
        'INSERT INTO osws_admins (email, password_hash, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name]
    );

    return handleSuccessResponse(res, { message: 'Admin account created.' }, 201);
});

// Delete OSWS Admin (soft delete - moves to archive/trash)
exports.deleteAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        throw new ValidationError('Admin ID is required.');
    }

    const user = req.user;
    const deletedBy = user?.legacyId || user?.id || null;

    // Soft delete - set deleted_at timestamp and deleted_by
    await db.query(
        'UPDATE osws_admins SET deleted_at = UTC_TIMESTAMP(), deleted_by = ? WHERE id = ?',
        [deletedBy, id]
    );

    return handleSuccessResponse(res, { message: 'Admin account moved to archive.' });
});

exports.getManageUsers = asyncHandler(async (req, res) => {
    // Get all OSWS admins (exclude deleted/archived)
    const [admins] = await db.query(
        'SELECT id, email, name FROM osws_admins WHERE deleted_at IS NULL'
    );

    // Get all student organizations (exclude deleted/archived)
    const [organizations] = await db.query(
        'SELECT id, email, org_name AS name, department FROM student_organizations WHERE deleted_at IS NULL'
    );

    return handleSuccessResponse(res, { admins, organizations });
});

