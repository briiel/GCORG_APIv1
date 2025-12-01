# Certificate Request Timezone Fix

## Problem Summary
Certificate request timestamps were displaying incorrectly (off by ~8 hours) because the backend was misinterpreting the timezone of DATETIME values stored in the MySQL database.

## Root Cause
1. **Database Reality**: AlwaysData MySQL server uses CET timezone (UTC+1)
   - When `CURRENT_TIMESTAMP()` is called, it stores the current CET time
   - Example: 13:46 Manila time = 06:46 CET time

2. **Previous Backend Bug**: Code assumed all DATETIME values were Manila time (+08:00)
   - Read `06:46` from DB and interpreted it as "06:46 Manila time"
   - Converted to UTC: `06:46 - 08:00 = 22:46 previous day` ❌ WRONG
   - Should have been: `06:46 - 01:00 = 05:46 UTC` ✅

3. **Frontend Display**: Received wrong UTC time and displayed it incorrectly

## Files Changed

### Backend
1. **`src/models/certificateRequestModel.js`**
   - Added `SERVER_TZ_OFFSET` constant (separate from `EVENT_TZ_OFFSET`)
   - Now uses `SERVER_TZ_OFFSET` when parsing `requested_at` and `processed_at` from database
   - Uses `EVENT_TZ_OFFSET` when formatting display strings for the frontend
   - This correctly interprets DATETIME values based on the MySQL server's timezone

2. **`.env`**
   - Added `SERVER_TZ_OFFSET=+01:00` for AlwaysData (CET timezone)
   - Added `EVENT_TZ_OFFSET=+08:00` for Philippines event display
   - Added detailed comments explaining each setting

3. **`.env.example`**
   - Added documentation for both timezone offset settings
   - Explained the difference between SERVER_TZ_OFFSET and EVENT_TZ_OFFSET

## Deployment Steps

### For AlwaysData Production
1. Update your production `.env` file to include:
   ```env
   SERVER_TZ_OFFSET=+01:00
   EVENT_TZ_OFFSET=+08:00
   ```

2. Restart your Node.js application:
   ```bash
   # SSH into AlwaysData and restart
   cd ~/path/to/gcorg_apiv1
   pm2 restart all
   # or however you restart your Node app
   ```

3. Clear any frontend caches:
   - Users may need to hard refresh (Ctrl+F5) to see correct times

### For Local Development (XAMPP)
1. Check your local MySQL timezone:
   ```sql
   SELECT @@system_time_zone, @@global.time_zone, NOW(), UTC_TIMESTAMP();
   ```

2. Update your local `.env`:
   - If your system uses Philippines time: `SERVER_TZ_OFFSET=+08:00`
   - If your system uses UTC: `SERVER_TZ_OFFSET=+00:00`
   - Adjust based on your actual system timezone

3. Restart your API server:
   ```bash
   cd GCORG_APIv1
   npm run dev
   ```

## How It Works Now

### Storage (unchanged)
- MySQL stores DATETIME in server's local timezone (CET for AlwaysData)
- `requested_at DATETIME DEFAULT CURRENT_TIMESTAMP()` stores CET time

### Backend Processing (fixed)
1. Reads DATETIME string from database: `'2025-12-01 06:46:00'`
2. Interprets as SERVER timezone (CET +01:00): December 1, 2025 06:46 CET
3. Converts to UTC: December 1, 2025 05:46 UTC
4. Sends to frontend as ISO UTC: `'2025-12-01T05:46:00.000Z'`
5. Also provides event-local formatted strings in Manila time (+08:00):
   - `requested_at_local`: `'2025-12-01 13:46:00'`
   - `requested_at_local_iso`: `'2025-12-01T13:46:00+08:00'`

### Frontend Display (unchanged)
- Receives UTC ISO timestamp
- Browser converts to user's local timezone for display
- If user is in Philippines: shows as December 1, 2025 13:46

## Verification

After deployment, test by:
1. Creating a new certificate request
2. Note the current Manila time (e.g., 13:46)
3. Check the displayed "Requested" time in the certificate requests page
4. It should match the current Manila time (not be off by 7-8 hours)

## Important Notes

### DST (Daylight Saving Time)
- CET switches to CEST (UTC+2) during summer (late March to late October)
- If you notice a 1-hour offset during summer, update:
  ```env
  SERVER_TZ_OFFSET=+02:00  # During CEST (summer)
  ```
- Better long-term solution: use IANA timezone names and a library that handles DST

### Production vs Development
- **Production (AlwaysData)**: `SERVER_TZ_OFFSET=+01:00` (or +02:00 in summer)
- **Local (XAMPP)**: Depends on your system timezone (likely `+08:00` if in Philippines)

### Other Timestamp Fields
This fix only affects certificate requests. Other features (events, notifications, etc.) already use correct timezone handling via `notificationModel.js` and `eventController.js`.

## Related Files
- `src/utils/dbDate.js` - Date parsing utilities
- `src/models/notificationModel.js` - Uses same SERVER_TZ_OFFSET pattern
- Frontend: `src/app/utils/date-utils.ts` - Client-side date parsing
- Frontend: `src/app/certificate-requests/certificate-requests.component.ts` - Display logic

## Date: December 1, 2025
Fixed by: GitHub Copilot
Issue: Certificate request timestamps showing 6-8 hours off
