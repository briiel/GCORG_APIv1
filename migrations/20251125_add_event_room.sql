-- Migration: add 'room' column to created_events
-- Adds a nullable room field to store the event room name/number

ALTER TABLE created_events
  ADD COLUMN IF NOT EXISTS room VARCHAR(255) NULL AFTER location;

-- Optional: no-op update to ensure existing rows set to NULL where missing
UPDATE created_events SET room = NULL WHERE room = '';
