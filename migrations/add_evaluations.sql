-- Migration: Add evaluation functionality
-- This enables the evaluation-before-certificate flow

-- 1. Create evaluations table to store participant feedback
CREATE TABLE IF NOT EXISTS `evaluations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `event_id` INT(11) NOT NULL,
  `student_id` VARCHAR(20) NOT NULL,
  `responses` JSON NOT NULL COMMENT 'Stores all evaluation responses in JSON format',
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_event_student_evaluation` (`event_id`, `student_id`),
  KEY `idx_event_id` (`event_id`),
  KEY `idx_student_id` (`student_id`),
  CONSTRAINT `fk_evaluations_event` FOREIGN KEY (`event_id`) REFERENCES `created_events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_evaluations_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Add evaluation tracking to attendance_records table
ALTER TABLE `attendance_records`
  ADD COLUMN `evaluation_submitted` TINYINT(1) DEFAULT 0 COMMENT 'Whether participant has submitted evaluation' AFTER `scanned_by_osws_id`,
  ADD COLUMN `evaluation_submitted_at` DATETIME DEFAULT NULL COMMENT 'When evaluation was submitted' AFTER `evaluation_submitted`;

-- 3. Create index for quick evaluation status lookups
ALTER TABLE `attendance_records`
  ADD KEY `idx_evaluation_status` (`event_id`, `student_id`, `evaluation_submitted`);
