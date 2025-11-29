-- ============================================
-- Insert test student: Ridley O. Angeles
-- Created: 2025-11-28
-- Description: Adds student with id 202310177 for testing/development
-- ============================================

INSERT INTO `students` (`id`, `email`, `password_hash`, `first_name`, `last_name`, `middle_initial`, `suffix`, `department`, `program`, `created_at`)
VALUES
  ('202310177', '202310177@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Ridley', 'Angeles', 'O', NULL, 'CCS', 'BSIT', NOW())
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `first_name` = VALUES(`first_name`),
  `last_name` = VALUES(`last_name`),
  `middle_initial` = VALUES(`middle_initial`),
  `department` = VALUES(`department`),
  `program` = VALUES(`program`);
