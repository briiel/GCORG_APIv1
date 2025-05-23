const db = require('../config/db');

const getAllAdmins = async () => {
    const [rows] = await db.query('SELECT id, email, name FROM osws_admins');
    return rows;
};

module.exports = { getAllAdmins };