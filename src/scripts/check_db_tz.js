const mysql = require('mysql2');
const db = require('../config/db');

(async () => {
    try {
        console.log('Running DB timezone checks...');

        // 1) Basic DB clock and session/global timezone
        const [tzRows] = await db.query("SELECT NOW() AS db_now, @@session.time_zone AS session_tz, @@global.time_zone AS global_tz");
        console.log('Server NOW and timezones:', tzRows[0]);

        // 2) Show driver-side timezone option (informational)
        console.log('Node process EVENT_TZ_OFFSET, DB_TIME_ZONE/DB_TIMEZONE, DB_SET_SESSION_TZ: ', {
            EVENT_TZ_OFFSET: process.env.EVENT_TZ_OFFSET || null,
            DB_TIME_ZONE: process.env.DB_TIME_ZONE || process.env.DB_TIMEZONE || null,
            DB_SET_SESSION_TZ: process.env.DB_SET_SESSION_TZ || 'false'
        });

        const eventTz = process.env.EVENT_TZ_OFFSET || '+08:00';

        // 3) Test CONVERT_TZ behaviour with a fixed sample timestamp
        const sampleDate = '2025-11-27';
        const sampleTime = '08:00:00';
        const [convRows] = await db.query(
            `SELECT TIMESTAMP(?, ?) AS sample_ts, CONVERT_TZ(TIMESTAMP(?, ?), ?, '+00:00') AS converted_utc`,
            [sampleDate, sampleTime, sampleDate, sampleTime, eventTz]
        );
        console.log('Sample conversion result:', convRows[0]);

        // 4) Show a real event row (if one exists) and how it converts
        try {
            const [sampleEvent] = await db.query(
                `SELECT event_id, start_date, start_time,
                        TIMESTAMP(start_date, start_time) AS stored_start,
                        CONVERT_TZ(TIMESTAMP(start_date, start_time), ?, '+00:00') AS converted_start_utc
                 FROM created_events
                 WHERE start_date IS NOT NULL AND start_time IS NOT NULL
                 LIMIT 1`,
                [eventTz]
            );
            if (sampleEvent.length > 0) {
                console.log('Sample event timestamps:', sampleEvent[0]);
            } else {
                console.log('No sample event found in `created_events` to show conversion.');
            }
        } catch (e) {
            console.warn('Could not fetch sample event (table may not exist):', e.message || e);
        }

        // Close politely if the pool exposes end()
        if (typeof db.end === 'function') {
            await db.end();
        }
        process.exit(0);
    } catch (err) {
        console.error('DB timezone check failed:', err && (err.stack || err.message || err));
        if (typeof db.end === 'function') {
            try { await db.end(); } catch(_) {}
        }
        process.exit(2);
    }
})();
