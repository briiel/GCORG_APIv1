const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Register a new user (student or organization)
router.post('/register', async (req, res) => {
    const { email, password, userType, name } = req.body;

    if (!email || !password || !userType || (userType === 'student' && !name)) {
        return res.status(400).json({ success: false, message: 'Email, password, userType, and name (for students) are required.' });
    }

    try {
        let table, query, values;
        if (userType === 'student') {
            table = 'students';
            query = `INSERT INTO ${table} (email, password_hash, name) VALUES (?, ?, ?)`;
        } else if (userType === 'organization') {
            table = 'student_organizations';
            query = `INSERT INTO ${table} (email, password_hash) VALUES (?, ?)`;
        } else {
            return res.status(400).json({ success: false, message: 'Invalid userType. Use "student" or "organization".' });
        }

        // Check if email already exists in the selected table
        const [existing] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Prepare values for insertion
        values = userType === 'student'
            ? [email, hashedPassword, name]
            : [email, hashedPassword];

        await db.query(query, values);

        res.status(201).json({ success: true, message: `${userType} registered successfully.` });
    } catch (error) {
        console.error('Error registering:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});

// Login an existing user (student or organization)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        // Try students table first
        let [rows] = await db.query('SELECT * FROM students WHERE email = ?', [email]);
        let userType = null;
        if (rows.length > 0) {
            userType = 'student';
        } else {
            // Try organizations table
            [rows] = await db.query('SELECT * FROM student_organizations WHERE email = ?', [email]);
            if (rows.length > 0) {
                userType = 'organization';
            }
        }

        if (!userType) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const payload = {
            id: user.id,
            email: user.email,
            role: userType // 'student' or 'organization'
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ success: true, message: 'Login successful.', token, userType });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});

module.exports = router;