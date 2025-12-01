-- Add privacy acceptance columns to `osws_admins` (mirror of students table)

ALTER TABLE `osws_admins`
  ADD COLUMN `privacy_policy_accepted` TINYINT(1) DEFAULT 0,
  ADD COLUMN `privacy_policy_accepted_at` DATETIME DEFAULT NULL;
  ADD COLUMN IF NOT EXISTS `privacy_policy_accepted_at` DATETIME DEFAULT NULL;
-- to accept the policy the first time they use the scanner or admin features.
