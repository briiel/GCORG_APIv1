-- ============================================
-- RBAC Implementation Migration
-- Created: 2025-11-16
-- Description: Implements Role-Based Access Control with individual user authentication
-- ============================================

-- First, create the Roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS `Roles` (
  `role_id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
INSERT INTO `Roles` (`role_id`, `role_name`, `description`) VALUES
(1, 'Student', 'Regular student user with access to student dashboard'),
(2, 'OrgOfficer', 'Organization officer with access to organization management'),
(3, 'OSWSAdmin', 'OSWS Administrator with full system access')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- ============================================
-- Table 1: organization_members
-- Links organization officers to their specific organizations and positions
-- Note: Role assignment is determined by table membership rather than UserRoles junction
-- ============================================
CREATE TABLE IF NOT EXISTS `organization_members` (
  `member_id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` VARCHAR(20) NOT NULL COMMENT 'Student ID from students table',
  `org_id` INT NOT NULL COMMENT 'Organization ID from student_organizations table',
  `position` VARCHAR(100) NOT NULL COMMENT 'e.g., President, Vice President, Secretary',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `term_start` DATE NULL COMMENT 'Start of officer term',
  `term_end` DATE NULL COMMENT 'End of officer term',
  `is_active` TINYINT(1) DEFAULT 1,
  `added_by_admin_id` INT NULL COMMENT 'Admin ID who added this member',
  
  -- Indexes for performance
  INDEX `idx_student_id` (`student_id`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_is_active` (`is_active`),
  
  -- Foreign keys
  CONSTRAINT `fk_orgmembers_student` 
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT `fk_orgmembers_org` 
    FOREIGN KEY (`org_id`) REFERENCES `student_organizations`(`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT `fk_orgmembers_addedby` 
    FOREIGN KEY (`added_by_admin_id`) REFERENCES `osws_admins`(`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- Table 2: organization_role_requests
-- Manages the "Request & Approve" workflow for role promotions
-- ============================================
CREATE TABLE IF NOT EXISTS `organization_role_requests` (
  `request_id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` VARCHAR(20) NOT NULL COMMENT 'Student requesting the role',
  `org_id` INT NOT NULL COMMENT 'Organization they want to join',
  `requested_position` VARCHAR(100) NOT NULL COMMENT 'Position they are requesting',
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `justification` TEXT NULL COMMENT 'Optional: Why they should be approved',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL,
  `reviewed_by_admin_id` INT NULL COMMENT 'Admin who reviewed this request',
  `review_notes` TEXT NULL COMMENT 'Admin notes on the decision',
  
  -- Indexes for performance
  INDEX `idx_student_id` (`student_id`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_requested_at` (`requested_at`),
  
  -- Foreign keys
  CONSTRAINT `fk_rolereq_student` 
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT `fk_rolereq_org` 
    FOREIGN KEY (`org_id`) REFERENCES `student_organizations`(`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT `fk_rolereq_reviewer` 
    FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `osws_admins`(`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- Create unified users view (for backward compatibility)
-- This view combines students, organizations, and admins
-- ============================================
CREATE OR REPLACE VIEW `users_unified` AS
SELECT 
  CONCAT('S_', s.id) AS user_key,
  s.id AS legacy_id,
  s.email,
  s.password_hash AS password,
  s.first_name,
  s.last_name,
  'student' AS user_type,
  1 AS is_active,
  s.created_at
FROM students s
UNION ALL
SELECT 
  CONCAT('O_', o.id) AS user_key,
  CAST(o.id AS CHAR) AS legacy_id,
  o.email,
  o.password_hash AS password,
  o.org_name AS first_name,
  '' AS last_name,
  'organization' AS user_type,
  1 AS is_active,
  NULL AS created_at
FROM student_organizations o
UNION ALL
SELECT 
  CONCAT('A_', a.id) AS user_key,
  CAST(a.id AS CHAR) AS legacy_id,
  a.email,
  a.password_hash AS password,
  a.name AS first_name,
  '' AS last_name,
  'admin' AS user_type,
  1 AS is_active,
  NULL AS created_at
FROM osws_admins a;

-- ============================================
-- Assign default "Student" role to all existing students
-- ============================================
-- Note: We'll handle role assignment in the application layer
-- since the existing schema doesn't have a unified users table

-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================
-- Uncomment to create sample admin user
/*
-- Ensure an admin user exists (adjust credentials as needed)
INSERT INTO `Users` (`email`, `password`, `first_name`, `last_name`, `user_type`) 
VALUES ('admin@gordoncollege.edu', '$2b$10$YourHashedPasswordHere', 'Admin', 'User', 'admin')
ON DUPLICATE KEY UPDATE `user_id` = `user_id`;

-- Grant OSWSAdmin role to the admin user
INSERT INTO `UserRoles` (`user_id`, `role_id`)
SELECT `user_id`, 3 FROM `Users` WHERE `email` = 'admin@gordoncollege.edu'
ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`);
*/

-- ============================================
-- Verification Queries
-- ============================================
-- Run these after migration to verify:
-- SELECT * FROM Roles;
-- SELECT u.email, r.role_name FROM Users u JOIN UserRoles ur ON u.user_id = ur.user_id JOIN Roles r ON ur.role_id = r.role_id;
-- SELECT * FROM OrganizationRoleRequests WHERE status = 'pending';
