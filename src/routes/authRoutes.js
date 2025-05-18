const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
    const { email, password, role = 'Participant' } = req.body; // Default role is 'Participant'

    try {
        // Check if the email already exists
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user into the database
        const query = 'INSERT INTO users (email, password, role) VALUES (?, ?, ?)';
        await db.query(query, [email, hashedPassword, role]);

        res.status(201).json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Login a user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            console.log('Email not found:', email); // Debugging
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const user = rows[0];
        console.log('User found:', user); // Debugging

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('Password comparison result:', isPasswordValid); // Debugging

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(200).json({ success: true, token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;