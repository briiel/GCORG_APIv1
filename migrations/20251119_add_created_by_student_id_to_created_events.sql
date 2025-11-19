-- Add created_by_student_id to created_events to record the member/officer who created the event
ALTER TABLE created_events
  ADD COLUMN created_by_student_id VARCHAR(20) NULL AFTER created_by_org_id;

-- Optional: create an index for lookups
CREATE INDEX idx_created_by_student_id ON created_events(created_by_student_id);
