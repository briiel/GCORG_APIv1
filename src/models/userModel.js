const db = require('../config/db');

const getAllUsers = async () => {
    try {
        const [rows] = await db.query('SELECT * FROM users');
        console.log('Query result:', rows); // Debugging
        return rows;
    } catch (error) {
        console.error('Error fetching users:', error.stack);
        return null;
    }
};

const getUserById = async (id) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0];
    } catch (error) {
        console.error('Error fetching user by ID:', error.stack);
        return null;
    }
};

module.exports = { getAllUsers, getUserById };