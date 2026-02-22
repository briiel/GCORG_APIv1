const db = require('../config/db');
const { decryptData } = require('../utils/encryption');

/**
 * Safely decrypt a single field — returns original value if not encrypted or decryption fails
 */
function safeDecryptField(value) {
    if (value && typeof value === 'string' && value.includes(':') && value.split(':').length === 3) {
        try {
            return decryptData(value);
        } catch (err) {
            // Return original if decryption fails (legacy unencrypted data)
            return value;
        }
    }
    return value;
}

/**
 * Decrypt all sensitive PII fields in a user object
 * Handles both newly-encrypted rows and legacy plaintext rows gracefully
 */
function decryptUserFields(user) {
    if (!user) return null;

    try {
        // Decrypt all PII fields (email, names, department, program)
        const piiFields = ['email', 'first_name', 'last_name', 'middle_initial', 'suffix', 'department', 'program'];
        for (const field of piiFields) {
            if (user[field] !== null && user[field] !== undefined) {
                user[field] = safeDecryptField(user[field]);
            }
        }
    } catch (error) {
        console.error('Error decrypting user fields:', error);
    }

    return user;
}

/**
 * Decrypt sensitive fields in array of users
 */
function decryptUserArray(users) {
    return users.map(user => decryptUserFields(user));
}

// Fetch all users from both tables (legacy - returns full array)
const getAllUsers = async () => {
    const [students] = await db.query('SELECT id, email, first_name, last_name, middle_initial, suffix, department, program, COALESCE(year_level, 4) AS year_level, "student" as userType, NULL as org_name FROM students');
    const [organizations] = await db.query('SELECT id, email, org_name as name, "organization" as userType, department FROM student_organizations');

    // Decrypt sensitive fields
    const decryptedStudents = decryptUserArray(students);
    const decryptedOrgs = decryptUserArray(organizations);

    return [...decryptedStudents, ...decryptedOrgs];
};

// New: Paginated users across students + organizations using UNION ALL
const getAllUsersPaginated = async (page = 1, per_page = 20) => {
    const p = Math.max(1, parseInt(page || 1, 10));
    const pp = Math.max(1, Math.min(100, parseInt(per_page || 20, 10)));
    const offset = (p - 1) * pp;

    // Use UNION ALL to combine both tables into one selectable dataset
    // Note: students table has no deleted_at column, so no filter needed there.
    // student_organizations does have deleted_at, so filter soft-deleted orgs out.
    const countSql = `SELECT COUNT(*) AS cnt FROM (SELECT id FROM students UNION ALL SELECT id FROM student_organizations WHERE deleted_at IS NULL) AS u`;
    const dataSql = `
        SELECT * FROM (
            SELECT id, email, first_name, last_name, middle_initial, suffix, department, program, COALESCE(year_level, 4) AS year_level, 'student' as userType, NULL as org_name, NULL as name FROM students
            UNION ALL
            SELECT id, email, NULL AS first_name, NULL AS last_name, NULL AS middle_initial, NULL AS suffix, department, NULL AS program, NULL AS year_level, 'organization' as userType, org_name as name FROM student_organizations WHERE deleted_at IS NULL
        ) AS u
        ORDER BY COALESCE(u.last_name, u.name) ASC
        LIMIT ? OFFSET ?
    `;

    const [[countRows]] = await db.query(countSql);
    const total = Number(countRows?.cnt || 0);
    const [rows] = await db.query(dataSql, [pp, offset]);

    // Decrypt sensitive fields
    const decryptedRows = decryptUserArray(rows);

    return { items: decryptedRows, total, page: p, per_page: pp, total_pages: Math.ceil(total / pp) };
};

// Fetch user by ID from both tables
const getUserById = async (id) => {
    const [student] = await db.query('SELECT id, email, first_name, last_name, middle_initial, suffix, department, program, COALESCE(year_level, 4) AS year_level, "student" as userType, NULL as org_name FROM students WHERE id = ?', [id]);
    if (student.length > 0) return decryptUserFields(student[0]);

    const [organization] = await db.query('SELECT id, email, org_name as name, "organization" as userType, department FROM student_organizations WHERE id = ?', [id]);
    if (organization.length > 0) return decryptUserFields(organization[0]);

    return null;
};

// Fetch organization members (exclude deleted/archived)
const getOrganizationMembers = async (orgId) => {
    const [members] = await db.query(
        `SELECT 
            om.member_id,
            om.student_id,
            om.position,
            om.joined_at,
            om.is_active,
            s.first_name,
            s.last_name,
            s.middle_initial,
            s.suffix,
            s.email,
            s.department,
            s.program,
            COALESCE(s.year_level, 4) AS year_level
        FROM organizationmembers om
        JOIN students s ON om.student_id = s.id
        WHERE om.org_id = ? AND om.is_active = TRUE AND om.deleted_at IS NULL
        ORDER BY om.joined_at DESC`,
        [orgId]
    );

    // Decrypt sensitive fields
    return decryptUserArray(members);
};

// New: paginated organization members
const getOrganizationMembersPaginated = async (orgId, page = 1, per_page = 20) => {
    const p = Math.max(1, parseInt(page || 1, 10));
    const pp = Math.max(1, Math.min(100, parseInt(per_page || 20, 10)));
    const offset = (p - 1) * pp;

    const countSql = `SELECT COUNT(*) AS cnt FROM organizationmembers WHERE org_id = ? AND is_active = TRUE AND deleted_at IS NULL`;
    const dataSql = `
        SELECT 
            om.member_id,
            om.student_id,
            om.position,
            om.joined_at,
            om.is_active,
            s.first_name,
            s.last_name,
            s.middle_initial,
            s.suffix,
            s.email,
            s.department,
            s.program,
            COALESCE(s.year_level, 4) AS year_level
        FROM organizationmembers om
        JOIN students s ON om.student_id = s.id
        WHERE om.org_id = ? AND om.is_active = TRUE AND om.deleted_at IS NULL
        ORDER BY om.joined_at DESC
        LIMIT ? OFFSET ?`;

    const [[countRows]] = await db.query(countSql, [orgId]);
    const total = Number(countRows?.cnt || 0);
    const [rows] = await db.query(dataSql, [orgId, pp, offset]);

    // Decrypt sensitive fields
    const decryptedRows = decryptUserArray(rows);

    return { items: decryptedRows, total, page: p, per_page: pp, total_pages: Math.ceil(total / pp) };
};

// Remove organization member (soft delete - moves to archive/trash)
const removeOrganizationMember = async (orgId, memberId) => {
    await db.query(
        `UPDATE organizationmembers 
         SET is_active = FALSE, deleted_at = UTC_TIMESTAMP()
         WHERE member_id = ? AND org_id = ?`,
        [memberId, orgId]
    );
};

module.exports = { getAllUsers, getAllUsersPaginated, getUserById, getOrganizationMembers, getOrganizationMembersPaginated, removeOrganizationMember };