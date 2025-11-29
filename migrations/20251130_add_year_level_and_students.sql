-- ============================================
-- Add `year_level` column to `students` and seed new students
-- Created: 2025-11-30
-- Description: Adds integer column `year_level` (1..4). Sets existing students to 4th Year
-- except Ridley O. Angeles (202310177) who is 3rd Year. Inserts provided student records.
-- ============================================

ALTER TABLE `students`
  ADD COLUMN `year_level` TINYINT NOT NULL DEFAULT 4 AFTER `program`;

-- Ensure existing rows have the default; then set Ridley to 3rd Year explicitly
UPDATE `students` SET `year_level` = 4 WHERE `year_level` IS NULL OR `year_level` <> `year_level`;
UPDATE `students` SET `year_level` = 3 WHERE `id` = '202310177';

-- Insert provided students. Use a reused password hash for test/dev accounts.
-- Adjust `department`/`program` as needed after import.

INSERT INTO `students` (`id`, `email`, `password_hash`, `first_name`, `last_name`, `middle_initial`, `suffix`, `department`, `program`, `created_at`, `year_level`)
VALUES
  ('202510967', '202510967@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Khmer Zheldon', 'Aquino', 'C', NULL, 'CCS', 'BSIT', NOW(), 1),
  ('202312246', '202312246@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Marina', 'Camaso', NULL, NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202310202', '202310202@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Franchesca Lei', 'Arcega', 'M', NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202310323', '202310323@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Kent Ann', 'Ecal', 'G', NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202310385', '202310385@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Justin', 'Del Rosario', 'O', NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202311378', '202311378@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Paulo', 'Cordova', NULL, NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202220002', '202220002@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Paul Jan', 'Dilag', 'V', NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202512631', '202512631@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Pretzel Marie', 'Briones', 'G', NULL, 'CCS', 'BSIT', NOW(), 1),
  ('202310230', '202310230@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Aaron Paul', 'Sario', 'H', NULL, 'CCS', 'BSIT', NOW(), 3),
  ('202411798', '202411798@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Aaron Kerbie', 'Malaon', 'M', NULL, 'CCS', 'BSIT', NOW(), 2),
  ('202411848', '202411848@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'John Lloyd', 'Landero', 'G', NULL, 'CCS', 'BSIT', NOW(), 2),
  ('202512657', '202512657@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'John Denver', 'Ellano', 'D', NULL, 'CCS', 'BSIT', NOW(), 1),
  ('202411974', '202411974@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Charles Andrei', 'De Leon', 'F', NULL, 'CCS', 'BSIT', NOW(), 2)
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `first_name` = VALUES(`first_name`),
  `last_name` = VALUES(`last_name`),
  `middle_initial` = VALUES(`middle_initial`),
  `department` = VALUES(`department`),
  `program` = VALUES(`program`),
  `year_level` = VALUES(`year_level`);
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `first_name` = VALUES(`first_name`),
  `last_name` = VALUES(`last_name`),
  `middle_initial` = VALUES(`middle_initial`),
  `department` = VALUES(`department`),
  `program` = VALUES(`program`),
  `year_level` = VALUES(`year_level`);
