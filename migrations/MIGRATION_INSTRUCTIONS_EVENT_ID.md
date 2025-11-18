# Event ID Migration — Run & Verification Instructions

WARNING: Back up your database before running any migration. Test on a staging copy first.

Overview
1. We need to fix rows in `created_events` that currently have `event_id = 0`.
2. The repository includes two migration approaches:
   - `20251119_safe_event_id_migration.sql` — a straightforward assignment and schema change (temporary mapping).
   - `20251119_persistent_event_id_mapping_and_update.sql` — safer approach that creates a persistent `event_id_map` and a `temp_pk` to uniquely identify rows before changing `event_id`.
3. A rollback script `20251119_rollback_event_id_migration.sql` is provided to revert changes using `event_id_map`.

Pre-run checklist
- Make a complete DB dump and verify it can be restored.
- Put the API into maintenance mode (stop writes) while running migration.

Commands (example using Bash on Windows subsystem or Git Bash)

1) Backup the DB
```bash
mysqldump -h $DB_HOST -u $DB_USER -p $DB_NAME > gcorganizedb_backup_$(date +%F_%T).sql
```

2) Inspect migration files locally. You can preview them:
```bash
sed -n '1,200p' c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/20251119_persistent_event_id_mapping_and_update.sql
```

3) Run the persistent mapping migration (recommended)
```bash
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < "c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/20251119_persistent_event_id_mapping_and_update.sql"
```

4) Check results
```sql
-- No zeros remain
SELECT COUNT(*) AS zeros FROM created_events WHERE event_id = 0;

-- Check duplicate event_id
SELECT event_id, COUNT(*) AS cnt FROM created_events GROUP BY event_id HAVING cnt > 1;

-- Inspect mapping table
SELECT COUNT(*) FROM event_id_map;
SELECT * FROM event_id_map LIMIT 50;

-- Inspect referencing tables for event_id = 0 (these should be empty or require manual mapping)
SELECT * FROM event_registrations WHERE event_id = 0 LIMIT 20;
SELECT * FROM attendance_records WHERE event_id = 0 LIMIT 20;
SELECT * FROM certificates WHERE event_id = 0 LIMIT 20;
```

5) If everything looks good, restart the API server and test the frontend.

Rollback (if needed)
1) Stop writes to the DB.
2) Run the rollback script (only if mapping exists and no conflicting changes were made):
```bash
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < "c:/xampp/htdocs/capstone/GCORG_APIv1/migrations/20251119_rollback_event_id_migration.sql"
```

Notes & Caveats
- If other tables reference `event_id = 0` and you cannot determine which new event they refer to, manual intervention is required. The migration will list such rows for inspection.
- The persistent mapping approach creates `event_id_map` and a `temp_pk` on `created_events`. You can drop `temp_pk` after verifying if you want; keep `event_id_map` for auditing.
- If your DB already had a PRIMARY KEY on `created_events.event_id`, some ALTER statements may need adjusting. Inspect `SHOW CREATE TABLE created_events;` before running.

Need help running these steps? I can:
- Generate a one-line command adjusted for your environment variables
- Run additional SQL to detect rows in referencing tables that point to `event_id = 0` and attempt to match them by other columns
- Produce a custom rollback plan tailored to your schema and production constraints
