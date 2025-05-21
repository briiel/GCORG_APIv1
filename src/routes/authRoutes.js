const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Register a new user (student or organization)
router.post('/register', async (req, res) => {
    const { email, password, userType, name, student_id, org_name, department } = req.body;

    if (!email || !password || !userType || 
        (userType === 'student' && (!name || !student_id)) ||
        (userType === 'organization' && !org_name)
    ) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email, password, userType, student_id, and name (for students) or org_name (for organizations) are required.' 
        });
    }

    try {
        let table, query, values;
        if (userType === 'student') {
            table = 'students';
            // Check if email or student_id already exists
            const [existing] = await db.query(`SELECT * FROM ${table} WHERE email = ? OR id = ?`, [email, student_id]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Email or Student ID already exists.' });
            }
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            // Insert using student_id as id
            query = `INSERT INTO ${table} (id, email, password_hash, name) VALUES (?, ?, ?, ?)`;
            values = [student_id, email, hashedPassword, name];
        } else if (userType === 'organization') {
            table = 'student_organizations';
            const [existing] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Email already exists.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `INSERT INTO ${table} (email, password_hash, org_name, department) VALUES (?, ?, ?, ?)`;
            values = [email, hashedPassword, org_name, department];
        } else {
            return res.status(400).json({ success: false, message: 'Invalid userType. Use "student" or "organization".' });
        }

        await db.query(query, values);

        res.status(201).json({ success: true, message: `${userType} registered successfully.` });
    } catch (error) {
        console.error('Error registering:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});

// Login an existing user (student or organization)
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
            role: userType
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ success: true, message: 'Login successful.', token, userType, orgName: user.org_name });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});

module.exports = router;