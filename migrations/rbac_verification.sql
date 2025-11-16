-- ============================================
-- RBAC Verification Queries
-- Run these to verify your RBAC implementation is working correctly
-- ============================================

-- 1. Check if all required tables exist
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM 
    information_schema.TABLES 
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('Users', 'Roles', 'UserRoles', 'OrganizationMembers', 'OrganizationRoleRequests')
ORDER BY 
    TABLE_NAME;

-- Expected: 5 rows showing all RBAC tables

-- ============================================

-- 2. Verify roles exist
SELECT 
    role_id,
    role_name,
    description
FROM 
    Roles
ORDER BY 
    role_id;

-- Expected: 3 rows (Student, OrgOfficer, OSWSAdmin)

-- ============================================

-- 3. Check user role assignments
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    r.role_name,
    ur.assigned_at
FROM 
    Users u
    JOIN UserRoles ur ON u.user_id = ur.user_id
    JOIN Roles r ON ur.role_id = r.role_id
ORDER BY 
    u.user_id, r.role_id;

-- Expected: List of users with their roles

-- ============================================

-- 4. Find users with multiple roles
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    GROUP_CONCAT(r.role_name ORDER BY r.role_id) AS roles,
    COUNT(*) AS role_count
FROM 
    Users u
    JOIN UserRoles ur ON u.user_id = ur.user_id
    JOIN Roles r ON ur.role_id = r.role_id
GROUP BY 
    u.user_id
HAVING 
    COUNT(*) > 1
ORDER BY 
    role_count DESC;

-- Expected: Users who have both Student and OrgOfficer roles

-- ============================================

-- 5. Check organization officers
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    o.org_name,
    om.position,
    om.is_active,
    om.joined_at
FROM 
    OrganizationMembers om
    JOIN Users u ON om.user_id = u.user_id
    JOIN Organizations o ON om.org_id = o.org_id
WHERE 
    om.is_active = TRUE
ORDER BY 
    o.org_name, om.position;

-- Expected: List of active organization officers

-- ============================================

-- 6. View pending role requests
SELECT 
    orr.request_id,
    u.first_name,
    u.last_name,
    u.email,
    o.org_name,
    orr.requested_position,
    orr.status,
    orr.requested_at
FROM 
    OrganizationRoleRequests orr
    JOIN Users u ON orr.user_id = u.user_id
    JOIN Organizations o ON orr.org_id = o.org_id
WHERE 
    orr.status = 'pending'
ORDER BY 
    orr.requested_at ASC;

-- Expected: List of pending role requests (may be empty)

-- ============================================

-- 7. View all role requests (with reviewer info)
SELECT 
    orr.request_id,
    u.first_name AS requester_first,
    u.last_name AS requester_last,
    u.email AS requester_email,
    o.org_name,
    orr.requested_position,
    orr.status,
    orr.requested_at,
    orr.reviewed_at,
    reviewer.first_name AS reviewer_first,
    reviewer.last_name AS reviewer_last,
    orr.review_notes
FROM 
    OrganizationRoleRequests orr
    JOIN Users u ON orr.user_id = u.user_id
    JOIN Organizations o ON orr.org_id = o.org_id
    LEFT JOIN Users reviewer ON orr.reviewed_by_user_id = reviewer.user_id
ORDER BY 
    orr.requested_at DESC
LIMIT 20;

-- Expected: Recent role requests with approval/rejection info

-- ============================================

-- 8. Check for users without roles (should be none)
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active
FROM 
    Users u
    LEFT JOIN UserRoles ur ON u.user_id = ur.user_id
WHERE 
    ur.user_role_id IS NULL
    AND u.is_active = TRUE;

-- Expected: Empty result (all active users should have at least Student role)

-- ============================================

-- 9. Find admins
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    r.role_name
FROM 
    Users u
    JOIN UserRoles ur ON u.user_id = ur.user_id
    JOIN Roles r ON ur.role_id = r.role_id
WHERE 
    r.role_name = 'OSWSAdmin';

-- Expected: List of OSWS Administrators

-- ============================================

-- 10. Request approval statistics
SELECT 
    status,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM OrganizationRoleRequests), 2) AS percentage
FROM 
    OrganizationRoleRequests
GROUP BY 
    status
ORDER BY 
    count DESC;

-- Expected: Breakdown of pending, approved, rejected requests

-- ============================================

-- 11. Most popular organizations for role requests
SELECT 
    o.org_name,
    o.department,
    COUNT(orr.request_id) AS total_requests,
    SUM(CASE WHEN orr.status = 'pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN orr.status = 'approved' THEN 1 ELSE 0 END) AS approved,
    SUM(CASE WHEN orr.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
FROM 
    Organizations o
    LEFT JOIN OrganizationRoleRequests orr ON o.org_id = orr.org_id
GROUP BY 
    o.org_id
HAVING 
    total_requests > 0
ORDER BY 
    total_requests DESC
LIMIT 10;

-- Expected: Organizations with the most role requests

-- ============================================

-- 12. Verify foreign key relationships
SELECT 
    TABLE_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM 
    information_schema.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('UserRoles', 'OrganizationMembers', 'OrganizationRoleRequests')
    AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY 
    TABLE_NAME, CONSTRAINT_NAME;

-- Expected: List of foreign key relationships

-- ============================================

-- CLEANUP QUERIES (USE WITH CAUTION!)
-- ============================================

-- Delete all pending requests (USE CAREFULLY!)
-- DELETE FROM OrganizationRoleRequests WHERE status = 'pending';

-- Remove a user's officer role (USE CAREFULLY!)
-- DELETE FROM UserRoles WHERE user_id = ? AND role_id = (SELECT role_id FROM Roles WHERE role_name = 'OrgOfficer');
-- DELETE FROM OrganizationMembers WHERE user_id = ?;

-- Reset a user to Student role only (USE CAREFULLY!)
-- DELETE FROM UserRoles WHERE user_id = ?;
-- INSERT INTO UserRoles (user_id, role_id) VALUES (?, (SELECT role_id FROM Roles WHERE role_name = 'Student'));

-- ============================================
-- END OF VERIFICATION QUERIES
-- ============================================
