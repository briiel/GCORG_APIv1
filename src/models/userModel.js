const db = require('../config/db');

// Fetch all users from both tables
const getAllUsers = async () => {
    const [students] = await db.query('SELECT id, email, first_name, last_name, middle_initial, suffix, department, program, COALESCE(year_level, 4) AS year_level, "student" as userType, NULL as org_name FROM students');
    const [organizations] = await db.query('SELECT id, email, org_name as name, "organization" as userType, department FROM student_organizations');
    return [...students, ...organizations];
};

// Fetch user by ID from both tables
const getUserById = async (id) => {
    const [student] = await db.query('SELECT id, email, first_name, last_name, middle_initial, suffix, department, program, COALESCE(year_level, 4) AS year_level, "student" as userType, NULL as org_name FROM students WHERE id = ?', [id]);
    if (student.length > 0) return student[0];
    const [organization] = await db.query('SELECT id, email, org_name as name, "organization" as userType, department FROM student_organizations WHERE id = ?', [id]);
    if (organization.length > 0) return organization[0];
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
    return members;
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

module.exports = { getAllUsers, getUserById, getOrganizationMembers, removeOrganizationMember };