-- Migration: add metadata (JSON), priority and read_at to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSON NULL,
  ADD COLUMN IF NOT EXISTS priority TINYINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS read_at DATETIME NULL;

-- Note: avoid procedural DO/BEGIN/END blocks in migration SQL for MySQL/MariaDB
-- The ALTER above is idempotent (uses IF NOT EXISTS) where supported; if your
-- server doesn't support JSON, the `ensureSchema()` function in the model will
-- attempt a TEXT fallback at runtime. Run this migration against your DB to add
-- the columns, or rely on the runtime `ensureSchema()` to add them on demand.
