-- Migration: assign unique IDs to rows with event_id = 0 and make event_id AUTO_INCREMENT primary key
-- Run this once against the database (make a backup first).

-- 1) Compute current max event_id
SET @max_id := (SELECT IFNULL(MAX(event_id), 0) FROM created_events);

-- 2) Assign new unique IDs for rows that currently have event_id = 0
UPDATE created_events
SET event_id = (@max_id := @max_id + 1)
WHERE event_id = 0
ORDER BY created_at ASC;

-- 3) Ensure event_id is unique and not null, then make it PRIMARY KEY and AUTO_INCREMENT
-- Note: This will fail if there are duplicate event_id values. Make sure to inspect results before running in production.
ALTER TABLE created_events
  MODIFY COLUMN event_id INT NOT NULL;

-- Add primary key if not present
ALTER TABLE created_events
  ADD PRIMARY KEY (event_id);

-- Set AUTO_INCREMENT starting value higher than current max
SET @next := (SELECT MAX(event_id) + 1 FROM created_events);
ALTER TABLE created_events AUTO_INCREMENT = @next;
