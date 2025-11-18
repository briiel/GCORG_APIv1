-- Safe migration to replace event_id = 0 rows with unique ids and update FK references
-- IMPORTANT: Backup your database before running this script.
-- This script is intended to be run once. Inspect and test on a staging copy first.

-- 0) PREPARATION: run on a non-production copy or after backup
-- 1) Create a mapping table to hold old_event_id -> new_event_id
START TRANSACTION;

CREATE TEMPORARY TABLE IF NOT EXISTS tmp_event_id_map (
  old_event_id INT NOT NULL,
  new_event_id INT NOT NULL
);

-- 2) Determine current max(event_id)
SET @max_id := (SELECT IFNULL(MAX(event_id), 0) FROM created_events FOR UPDATE);

-- 3) For rows with event_id = 0, assign new ids and save mapping
-- We order by created_at to give deterministic assignment
INSERT INTO tmp_event_id_map (old_event_id, new_event_id)
SELECT event_id AS old_event_id, (@max_id := @max_id + 1) AS new_event_id
FROM created_events
WHERE event_id = 0
ORDER BY created_at ASC;

-- 4) If there are no rows to fix, we can skip the remapping work
SET @rows_to_fix := (SELECT COUNT(*) FROM tmp_event_id_map);

-- 5) Update referencing tables using the mapping (only when mapping exists)
-- Note: list all tables that reference created_events.event_id and update them:
-- event_registrations.event_id, attendance_records.event_id, certificates.event_id, etc.

-- Helper: update a referencing table with mapping
-- For each mapping row, update the referencing table rows that point to old_event_id = 0

-- Perform updates only when needed
-- Update event_registrations
UPDATE event_registrations er
JOIN tmp_event_id_map m ON er.event_id = m.old_event_id
SET er.event_id = m.new_event_id
WHERE er.event_id = m.old_event_id;

-- Update attendance_records
UPDATE attendance_records ar
JOIN tmp_event_id_map m ON ar.event_id = m.old_event_id
SET ar.event_id = m.new_event_id
WHERE ar.event_id = m.old_event_id;

-- Update certificates (if exists)
UPDATE certificates c
JOIN tmp_event_id_map m ON c.event_id = m.old_event_id
SET c.event_id = m.new_event_id
WHERE c.event_id = m.old_event_id;

-- Update any other referencing tables you have (uncomment and edit as needed)
-- UPDATE some_other_table t
-- JOIN tmp_event_id_map m ON t.event_id = m.old_event_id
-- SET t.event_id = m.new_event_id
-- WHERE t.event_id = m.old_event_id;

-- 6) Update the created_events table rows to their new ids
UPDATE created_events ce
JOIN tmp_event_id_map m ON ce.event_id = m.old_event_id
SET ce.event_id = m.new_event_id
WHERE ce.event_id = m.old_event_id;

-- 7) Ensure there are no duplicate event_id values after the update
-- This should return 0
SELECT event_id, COUNT(*) AS cnt FROM created_events GROUP BY event_id HAVING cnt > 1;

-- 8) Make event_id NOT NULL PRIMARY KEY and set AUTO_INCREMENT
-- If a PRIMARY KEY already exists, you may need to drop it first. The following assumes there is no PK.

-- Check for existing primary key: user must inspect before running ALTER
-- ALTER TABLE created_events DROP PRIMARY KEY; -- uncomment if required and you understand consequences

ALTER TABLE created_events
  MODIFY COLUMN event_id INT NOT NULL;

ALTER TABLE created_events
  ADD PRIMARY KEY (event_id);

-- Set AUTO_INCREMENT starting point to max(event_id) + 1
SET @next := (SELECT IFNULL(MAX(event_id), 0) + 1 FROM created_events);
SET @s := CONCAT('ALTER TABLE created_events AUTO_INCREMENT = ', @next);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;

-- 9) Final checks (run after migration)
-- Verify no zeros remain
-- SELECT COUNT(*) FROM created_events WHERE event_id = 0;
-- Verify FK tables point to valid event_id values (example for event_registrations)
-- SELECT er.event_id FROM event_registrations er LEFT JOIN created_events ce ON er.event_id = ce.event_id WHERE ce.event_id IS NULL LIMIT 10;

-- If any such rows are found, they need to be inspected and fixed manually.

-- End of migration
