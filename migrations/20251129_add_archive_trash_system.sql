-- ============================================
-- Archive/Trash System Migration
-- Created: 2025-11-29
-- Description: Adds soft-delete functionality with 30-day retention period for users and members
-- ============================================

-- Add deleted_at and deleted_by columns to osws_admins table
ALTER TABLE `osws_admins`
ADD COLUMN `deleted_at` DATETIME DEFAULT NULL COMMENT 'Soft delete timestamp',
ADD COLUMN `deleted_by` INT DEFAULT NULL COMMENT 'Admin ID who deleted this record',
ADD INDEX `idx_osws_admins_deleted_at` (`deleted_at`);

-- Add deleted_at and deleted_by columns to student_organizations table
ALTER TABLE `student_organizations`
ADD COLUMN `deleted_at` DATETIME DEFAULT NULL COMMENT 'Soft delete timestamp',
ADD COLUMN `deleted_by` INT DEFAULT NULL COMMENT 'Admin ID who deleted this record',
ADD INDEX `idx_student_organizations_deleted_at` (`deleted_at`);

-- Add deleted_at and deleted_by columns to organization_members table (if exists)
ALTER TABLE `organization_members`
ADD COLUMN `deleted_at` DATETIME DEFAULT NULL COMMENT 'Soft delete timestamp',
ADD COLUMN `deleted_by` INT DEFAULT NULL COMMENT 'Admin/Officer ID who deleted this record',
ADD INDEX `idx_organization_members_deleted_at` (`deleted_at`);

-- Note: The is_active field in organization_members already provides soft-delete functionality
-- but we're adding deleted_at for consistency and to track exact deletion time for the 30-day retention

-- ============================================
-- Verification Queries
-- ============================================
-- Run these after migration to verify:
-- SELECT * FROM osws_admins WHERE deleted_at IS NOT NULL;
-- SELECT * FROM student_organizations WHERE deleted_at IS NOT NULL;
-- SELECT * FROM organization_members WHERE deleted_at IS NOT NULL;

-- To get items eligible for permanent deletion (older than 30 days):
-- SELECT * FROM osws_admins WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY);
-- SELECT * FROM student_organizations WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY);
-- SELECT * FROM organization_members WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY);
