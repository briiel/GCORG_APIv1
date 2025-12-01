# Migration Instructions - Privacy Policy Acceptance

## Quick Setup

### Step 1: Run Database Migration

Navigate to the API directory and run the migration:

```bash
cd GCORG_APIv1

# Option 1: Using MySQL command line
mysql -u root -p mysql_gcorganize_db_alwaysdata_net < migrations/20251201_add_privacy_policy_acceptance.sql

# Option 2: Using phpMyAdmin
# - Open phpMyAdmin
# - Select your database (mysql_gcorganize_db_alwaysdata_net)
# - Go to SQL tab
# - Copy and paste the contents of migrations/20251201_add_privacy_policy_acceptance.sql
# - Click Go
```

### Step 2: Verify Migration

Check that the columns were added successfully:

```sql
DESCRIBE students;
```

You should see two new columns:
- `privacy_policy_accepted` TINYINT(1) DEFAULT 0
- `privacy_policy_accepted_at` DATETIME DEFAULT NULL

### Step 3: Restart Backend Server

```bash
cd GCORG_APIv1
npm start
```

Or if using nodemon:
```bash
npm run dev
```

### Step 4: Test Frontend

1. Clear browser localStorage to test fresh user experience:
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Clear Local Storage
   
2. Login as a student

3. Navigate to "Scan QR"

4. Click "Start Scanner"

5. Privacy notice modal should appear

6. Test both buttons:
   - "Close" should cancel and not start scanner
   - "Accept and Continue" should record acceptance and proceed

## Verification

### Check Database Entry

```sql
SELECT id, first_name, last_name, 
       privacy_policy_accepted, 
       privacy_policy_accepted_at 
FROM students 
WHERE id = 'YOUR_STUDENT_ID';
```

After accepting, you should see:
- `privacy_policy_accepted` = 1
- `privacy_policy_accepted_at` = timestamp of acceptance

### Check API Endpoint

Test the endpoint directly:

```bash
curl -X POST http://localhost:3000/api/auth/accept-privacy-policy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Privacy policy acceptance recorded successfully."
}
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
ALTER TABLE `students`
  DROP COLUMN `privacy_policy_accepted_at`,
  DROP COLUMN `privacy_policy_accepted`;
```

## Notes

- The privacy acceptance is required only once per student
- Once accepted, the modal will not appear again (tracked in localStorage and database)
- The location consent modal (existing feature) will still appear after privacy acceptance
- Admins and organization officers do not need to accept privacy policy (scanner is for their use, not their attendance)
