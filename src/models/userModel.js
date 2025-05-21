const db = require('../config/db');

// Fetch all users from both tables
const getAllUsers = async () => {
    const [students] = await db.query('SELECT id, email, name, "student" as userType, NULL as department FROM students');
    const [organizations] = await db.query('SELECT id, email, org_name as name, "organization" as userType, department FROM student_organizations');
    return [...students, ...organizations];
};

// Fetch user by ID from both tables
const getUserById = async (id) => {
    const [student] = await db.query('SELECT id, email, name, "student" as userType, NULL as department FROM students WHERE id = ?', [id]);
    if (student.length > 0) return student[0];
    const [organization] = await db.query('SELECT id, email, org_name as name, "organization" as userType, department FROM student_organizations WHERE id = ?', [id]);
    if (organization.length > 0) return organization[0];
    return null;
};

module.exports = { getAllUsers, getUserById };