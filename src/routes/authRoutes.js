const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Register a new user (student, organization, or admin)
router.post('/register', async (req, res) => {
    const { email, password, userType, name, student_id, org_name, department, first_name, last_name, middle_initial, suffix, program } = req.body;

    if (!email || !password || !userType ||
        (userType === 'student' && (!first_name || !last_name || !student_id || !department || !program)) ||
        (userType === 'organization' && !org_name) ||
        (userType === 'admin' && !name)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields.'
        });
    }

    try {
        let table, query, values;
        if (userType === 'student') {
            table = 'students';
            const [existing] = await db.query(`SELECT * FROM ${table} WHERE email = ? OR id = ?`, [email, student_id]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Email or Student ID already exists.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `INSERT INTO ${table} (id, email, password_hash, first_name, last_name, middle_initial, suffix, department, program) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            values = [student_id, email, hashedPassword, first_name, last_name, middle_initial, suffix, department, program];
        } else if (userType === 'organization') {
            table = 'student_organizations';
            const [existing] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Email already exists.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `INSERT INTO ${table} (email, password_hash, org_name, department) VALUES (?, ?, ?, ?)`;
            values = [email, hashedPassword, org_name, department];
        } else if (userType === 'admin') {
            table = 'osws_admins';
            const [existing] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Admin email already exists.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `INSERT INTO ${table} (email, password_hash, name) VALUES (?, ?, ?)`;
            values = [email, hashedPassword, name];
        } else {
            return res.status(400).json({ success: false, message: 'Invalid userType. Use "student", "organization", or "admin".' });
        }

        await db.query(query, values);

        res.status(201).json({ success: true, message: `${userType} registered successfully.` });
    } catch (error) {
        console.error('Error registering:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});

// Login an existing user (student, organization, or admin)
router.post('/login', async (req, res) => {
    const { emailOrId, password } = req.body;

    if (!emailOrId || !password) {
        return res.status(400).json({ success: false, message: 'Email/Student ID and password are required.' });
    }

    try {
        let user = null;
        let userType = null;

        // Check students table
        const [studentRows] = await db.query(
            `SELECT * FROM students WHERE email = ? OR id = ? LIMIT 1`,
            [emailOrId, emailOrId]
        );
        if (studentRows.length > 0) {
            user = studentRows[0];
            userType = 'student';
        } else {
            // Check organizations table
            const [orgRows] = await db.query(
                `SELECT * FROM student_organizations WHERE email = ? LIMIT 1`,
                [emailOrId]
            );
            if (orgRows.length > 0) {
                user = orgRows[0];
                userType = 'organization';
            } else {
                // Check osws_admins table
                const [adminRows] = await db.query(
                    `SELECT * FROM osws_admins WHERE email = ? LIMIT 1`,
                    [emailOrId]
                );
                if (adminRows.length > 0) {
                    user = adminRows[0];
                    userType = 'admin';
                }
            }
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const payload = {
            id: user.id,
            email: user.email,
            role: userType,
            name: user.name || user.org_name
        };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            userType,
            orgName: user.org_name,
            adminId: userType === 'admin' ? user.id : undefined,
            student: userType === 'student' ? {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                middle_initial: user.middle_initial,
                suffix: user.suffix,
                department: user.department,
                program: user.program
            } : undefined
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});

module.exports = router;