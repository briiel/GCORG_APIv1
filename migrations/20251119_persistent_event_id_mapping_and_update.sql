-- Persistent mapping migration for event_id fix
-- WARNING: Run only after backing up your database. Test on staging first.
-- This script:
-- 1) Adds a temporary auto-increment column `temp_pk` to `created_events` to uniquely identify rows.
-- 2) Creates a persistent mapping table `event_id_map` to record the mapping from `temp_pk` -> old_event_id -> new_event_id.
-- 3) Assigns new unique `event_id` values for rows where `event_id = 0`, records mapping, and sets AUTO_INCREMENT on `event_id`.
-- 4) DOES NOT attempt to guess how to update arbitrary referencing rows that already store event_id = 0; instead it lists such rows for manual inspection.

START TRANSACTION;

-- 1) Add temp_pk to uniquely identify rows. If column already exists, skip.
ALTER TABLE created_events
  ADD COLUMN IF NOT EXISTS temp_pk INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;

-- 2) Create persistent mapping table
CREATE TABLE IF NOT EXISTS event_id_map (
  temp_pk INT NOT NULL,
  old_event_id INT NOT NULL,
  new_event_id INT NOT NULL,
  mapped_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (temp_pk)
);

-- 3) Prepare a counter for new event ids
SET @cur_max := (SELECT IFNULL(MAX(event_id), 0) FROM created_events FOR UPDATE);

-- 4) For each created_events row with event_id = 0, assign a new event_id and record mapping
-- Order by created_at for deterministic assignment
-- We will update row-by-row using a user-defined variable join
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_rows_to_fix AS
SELECT temp_pk FROM created_events WHERE event_id = 0 ORDER BY created_at ASC;

-- Loop-like update via JOIN (set event_id to incremented values and insert mapping)
-- Note: This uses a variable to increment; it is executed in one statement to be deterministic
INSERT INTO event_id_map (temp_pk, old_event_id, new_event_id)
SELECT t.temp_pk, ce.event_id AS old_event_id, (@cur_max := @cur_max + 1) AS new_event_id
FROM tmp_rows_to_fix t
JOIN created_events ce ON ce.temp_pk = t.temp_pk;

-- Now apply the new_event_id values back to created_events
UPDATE created_events ce
JOIN event_id_map m ON ce.temp_pk = m.temp_pk
SET ce.event_id = m.new_event_id
WHERE ce.event_id = 0;

-- 5) Sanity check: any duplicate event_id?
SELECT event_id, COUNT(*) AS cnt FROM created_events GROUP BY event_id HAVING cnt > 1;

-- 6) Set event_id column NOT NULL and add primary key if none exists
ALTER TABLE created_events
  MODIFY COLUMN event_id INT NOT NULL;

-- If created_events already has a primary key on event_id this will fail; inspect and run appropriate command.
ALTER TABLE created_events
  ADD PRIMARY KEY (event_id);

-- 7) Set AUTO_INCREMENT starting point
SET @next_ai := (SELECT IFNULL(MAX(event_id), 0) + 1 FROM created_events);
SET @sql := CONCAT('ALTER TABLE created_events AUTO_INCREMENT = ', @next_ai);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 8) List any referencing rows that still have event_id = 0 for manual inspection
SELECT 'event_registrations' AS tbl, * FROM event_registrations WHERE event_id = 0 LIMIT 20;
SELECT 'attendance_records' AS tbl, * FROM attendance_records WHERE event_id = 0 LIMIT 20;
SELECT 'certificates' AS tbl, * FROM certificates WHERE event_id = 0 LIMIT 20;

COMMIT;

-- After verifying the mapping and referencing rows, you can DROP the temp_pk column and keep event_id_map for auditing.
-- To drop temp_pk (optional): ALTER TABLE created_events DROP COLUMN temp_pk;
