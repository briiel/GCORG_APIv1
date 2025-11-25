-- Migration: add `panel` column and index to `notifications` table
-- Run this against your GCORG database if the `notifications` table lacks the `panel` column.
-- Migration: add `panel` column and index to `notifications` table
-- Run this against your GCORG database if the `notifications` table lacks the `panel` column.

-- Add optional columns if missing (MySQL 8+ supports IF NOT EXISTS;
-- these statements will be harmless on newer servers).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS panel VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS org_id VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL;

-- Conditionally add the composite index `idx_panel_org` only when it does not exist.
-- We use INFORMATION_SCHEMA to detect the index and run ALTER TABLE via a
-- prepared statement when necessary. This avoids the duplicate-key error.

SET @idx_count := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notifications'
    AND INDEX_NAME = 'idx_panel_org'
);

SET @sql_stmt := IF(@idx_count = 0,
  'ALTER TABLE notifications ADD INDEX idx_panel_org (panel, org_id);',
  'SELECT "idx_panel_org already exists" AS msg;'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- End migration
