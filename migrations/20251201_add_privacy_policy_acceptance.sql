-- Migration: Add privacy policy acceptance tracking to students table
-- This tracks when users accept the data privacy policy when using the scanner

ALTER TABLE `students`
  ADD COLUMN `privacy_policy_accepted` TINYINT(1) DEFAULT 0 AFTER `year_level`,
  ADD COLUMN `privacy_policy_accepted_at` DATETIME DEFAULT NULL AFTER `privacy_policy_accepted`;

-- Update existing students to NULL timestamp (not yet accepted)
-- Note: Default 0 for privacy_policy_accepted means they need to accept on first use
