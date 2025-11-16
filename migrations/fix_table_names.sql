-- ============================================
-- Fix Table Names Migration
-- Created: 2025-11-17
-- Description: Create RBAC tables with snake_case naming for MySQL compatibility
-- ============================================

-- Drop existing tables if they exist (in correct order to handle foreign keys)
DROP TABLE IF EXISTS `organization_role_requests`;
DROP TABLE IF EXISTS `organization_members`;

-- ============================================
-- Table 1: organization_members
-- ============================================
CREATE TABLE `organization_members` (
  `member_id` INT(11) NOT NULL AUTO_INCREMENT,
  `student_id` VARCHAR(20) NOT NULL COMMENT 'Student ID from students table',
  `org_id` INT(11) NOT NULL COMMENT 'Organization ID from student_organizations table',
  `position` VARCHAR(100) NOT NULL COMMENT 'e.g., President, Vice President, Secretary',
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `term_start` DATE DEFAULT NULL COMMENT 'Start of officer term',
  `term_end` DATE DEFAULT NULL COMMENT 'End of officer term',
  `is_active` TINYINT(1) DEFAULT 1,
  `added_by_admin_id` INT(11) DEFAULT NULL COMMENT 'Admin ID who added this member',
  PRIMARY KEY (`member_id`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_org_id` (`org_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `fk_orgmembers_addedby` (`added_by_admin_id`),
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
-- ============================================
CREATE TABLE `organization_role_requests` (
  `request_id` INT(11) NOT NULL AUTO_INCREMENT,
  `student_id` VARCHAR(20) NOT NULL COMMENT 'Student requesting the role',
  `org_id` INT(11) NOT NULL COMMENT 'Organization they want to join',
  `requested_position` VARCHAR(100) NOT NULL COMMENT 'Position they are requesting',
  `status` ENUM('pending','approved','rejected') DEFAULT 'pending',
  `justification` TEXT DEFAULT NULL COMMENT 'Optional: Why they should be approved',
  `requested_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `reviewed_by_admin_id` INT(11) DEFAULT NULL COMMENT 'Admin who reviewed this request',
  `review_notes` TEXT DEFAULT NULL COMMENT 'Admin notes on the decision',
  PRIMARY KEY (`request_id`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_org_id` (`org_id`),
  KEY `idx_status` (`status`),
  KEY `idx_requested_at` (`requested_at`),
  KEY `fk_rolereq_reviewer` (`reviewed_by_admin_id`),
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
-- Verification Queries
-- ============================================
-- Run these to verify tables exist and are properly structured:
-- SHOW TABLES LIKE '%organization%';
-- DESCRIBE organization_members;
-- DESCRIBE organization_role_requests;
-- SELECT * FROM organization_members;
-- SELECT * FROM organization_role_requests;
