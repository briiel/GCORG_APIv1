-- Migration: add geo fields to attendance_records for location verification
ALTER TABLE `attendance_records`
  ADD COLUMN `reported_lat` DOUBLE DEFAULT NULL AFTER `scanned_by_student_id`,
  ADD COLUMN `reported_lon` DOUBLE DEFAULT NULL AFTER `reported_lat`,
  ADD COLUMN `reported_accuracy` FLOAT DEFAULT NULL AFTER `reported_lon`,
  ADD COLUMN `location_consent` TINYINT(1) DEFAULT 0 AFTER `reported_accuracy`,
  ADD COLUMN `reported_at` DATETIME DEFAULT NULL AFTER `location_consent`;

-- Optional indexes for geo audits
ALTER TABLE `attendance_records`
  ADD KEY `idx_reported_coords` (`reported_lat`, `reported_lon`);
