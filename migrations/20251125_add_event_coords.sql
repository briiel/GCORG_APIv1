-- Add event coordinates to created_events for geofence enforcement
ALTER TABLE created_events
  ADD COLUMN event_latitude DECIMAL(10,7) NULL AFTER location,
  ADD COLUMN event_longitude DECIMAL(10,7) NULL AFTER event_latitude;

-- Optional index to speed up location-based queries
CREATE INDEX IF NOT EXISTS idx_created_events_lat_lon ON created_events(event_latitude, event_longitude);
