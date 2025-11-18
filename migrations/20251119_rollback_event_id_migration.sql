-- Rollback migration for event_id mapping
-- This script attempts to revert the event_id values for rows updated by
-- `20251119_persistent_event_id_mapping_and_update.sql` using the `event_id_map` table.
-- WARNING: Only safe if no conflicting changes were made after the migration.

START TRANSACTION;

-- Verify mapping table exists
SELECT COUNT(*) AS map_count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_id_map';

-- Revert event_id values for rows listed in event_id_map
UPDATE created_events ce
JOIN event_id_map m ON ce.temp_pk = m.temp_pk
SET ce.event_id = m.old_event_id
WHERE ce.event_id = m.new_event_id;

-- Optional: restore AUTO_INCREMENT start to a safe value (set to MAX(event_id)+1)
SET @next_ai := (SELECT IFNULL(MAX(event_id), 0) + 1 FROM created_events);
SET @sql := CONCAT('ALTER TABLE created_events AUTO_INCREMENT = ', @next_ai);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

COMMIT;

-- After verifying, you may drop `event_id_map` if desired (but keep it for auditing):
-- DROP TABLE IF EXISTS event_id_map;
