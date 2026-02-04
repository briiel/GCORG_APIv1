const db = require('../config/db');
const { decryptData } = require('../utils/encryption');

/**
 * Decrypt sensitive fields in admin object
 */
function decryptAdminFields(admin) {
    if (!admin) return null;

    try {
        // Decrypt email if it appears to be encrypted (format: iv:authTag:data)
        if (admin.email && typeof admin.email === 'string' && admin.email.includes(':')) {
            const parts = admin.email.split(':');
            if (parts.length === 3) {
                try {
                    admin.email = decryptData(admin.email);
                } catch (err) {
                    console.error('Failed to decrypt admin email, using as-is:', err.message);
                }
            }
        }
    } catch (error) {
        console.error('Error decrypting admin fields:', error);
    }

    return admin;
}

/**
 * Decrypt sensitive fields in array of admins
 */
function decryptAdminArray(admins) {
    return admins.map(admin => decryptAdminFields(admin));
}

const getAllAdmins = async () => {
    const [rows] = await db.query('SELECT id, email, name FROM osws_admins');
    return decryptAdminArray(rows);
};

module.exports = { getAllAdmins };