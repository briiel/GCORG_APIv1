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

// Delete OSWS Admin
exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return handleErrorResponse(res, 'Admin ID is required.', 400);
        await db.query('DELETE FROM osws_admins WHERE id = ?', [id]);
        return handleSuccessResponse(res, { message: 'Admin account deleted.' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getManageUsers = async (req, res) => {
    try {
        // Get all OSWS admins
        const [admins] = await db.query('SELECT id, email, name FROM osws_admins');
        // Get all student organizations
        const [organizations] = await db.query('SELECT id, email, org_name AS name, department FROM student_organizations');
        return handleSuccessResponse(res, { admins, organizations });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};