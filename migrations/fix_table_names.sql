-- ============================================
-- Fix Table Names Migration
-- Created: 2025-11-17
-- Description: Rename tables from PascalCase to snake_case for MySQL compatibility
-- ============================================

-- Check if old tables exist and rename them
-- This handles both fresh installs and existing databases

-- Rename OrganizationMembers to organization_members
DROP TABLE IF EXISTS `organization_members`;
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

-- Rename OrganizationRoleRequests to organization_role_requests
DROP TABLE IF EXISTS `organization_role_requests`;
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
-- Verification
-- ============================================
-- Run these to verify tables exist:
-- SHOW TABLES LIKE '%organization%';
-- DESCRIBE organization_members;
-- DESCRIBE organization_role_requests;
