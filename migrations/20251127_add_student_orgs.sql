-- Migration: Add three student organizations for CCS
-- Date: 2025-11-27

INSERT INTO `student_organizations` (`email`, `org_name`, `department`, `password_hash`)
VALUES
  ('ccs.studentcouncil@gordoncollege.edu.ph', 'GCCCS Student Council', 'CCS', '$2b$10$Ji6j3elC8CpAwa/JFioBnOnF5faYcelyOAnSpEYxCIYzmqOcAywsW'),
  ('gcccs.specs@gordoncollege.edu.ph', 'GCCCS SPECS', 'CCS', '$2b$10$Ji6j3elC8CpAwa/JFioBnOnF5faYcelyOAnSpEYxCIYzmqOcAywsW'),
  ('gcccs.images@gordoncollege.edu.ph', 'GCCCS IMAGES', 'CCS', '$2b$10$Ji6j3elC8CpAwa/JFioBnOnF5faYcelyOAnSpEYxCIYzmqOcAywsW');

-- Note: The `password_hash` value above is a placeholder (reused hash from existing data).
-- If you need unique passwords for these org accounts, update the hashes to bcrypt values.
