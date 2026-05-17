const db = require('../config/db');
const { decryptData } = require('../utils/encryption');
const { DEFAULT_HOME_VISIBILITY_DAYS } = require('./eventArchiveSettingsModel');

/** Home feed: include events with end_date >= CURDATE() − N days (per org / OSWS), or null end_date. */
const sqlHomeVisibilityIntervalAllEvents = () =>
    `GREATEST(0, LEAST(365, COALESCE(IF(ce.created_by_org_id IS NOT NULL, org.event_home_visibility_days, osws.event_home_visibility_days), ${Number(DEFAULT_HOME_VISIBILITY_DAYS)})))`;

const sqlHomeVisibilityIntervalOswsEvents = () =>
    `GREATEST(0, LEAST(365, COALESCE(a.event_home_visibility_days, ${Number(DEFAULT_HOME_VISIBILITY_DAYS)})))`;

// Safely decrypt a single encrypted field; returns original if not encrypted or decryption fails
const safeDecrypt = (value) => {
    if (value && typeof value === 'string' && value.split(':').length === 3) {
        try { return decryptData(value); } catch { return value; }
    }
    return value;
};

// Resolve the scanned_by display name: officer (decrypted) > OSWS admin > org name
const resolveScannedBy = (row) => {
    // Try officer (student) name first — fields are encrypted in DB
    if (row._officer_first_name !== undefined || row._officer_last_name !== undefined) {
        const fn = safeDecrypt(row._officer_first_name);
        const ln = safeDecrypt(row._officer_last_name);
        if (fn || ln) {
            const name = [fn, ln].filter(Boolean).join(' ');
            if (name.trim()) return name.trim();
        }
    }
    // Fallback: OSWS admin name or org name (already plaintext)
    return row._osws_name || row._org_name || null;
};

// Get attendance records for a specific event
const getAttendanceRecordsByEvent = async (eventId) => {
    const query = `
        SELECT 
            ar.event_id,
            ce.title AS event_title,
            ar.student_id,
            s.first_name,
            s.last_name,
            s.suffix,
            s.department,
            s.program,
            COALESCE(s.year_level, 4) AS year_level,
            ar.time_in,
            ar.time_out,
            COALESCE(ar.time_in, ar.attended_at) AS attended_at,
            officer.first_name AS _officer_first_name,
            officer.last_name AS _officer_last_name,
            osws.name AS _osws_name,
            org.org_name AS _org_name,
            om.position AS scanned_by_position
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
        LEFT JOIN students officer ON ar.scanned_by_student_id = officer.id
        LEFT JOIN student_organizations org ON ar.scanned_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ar.scanned_by_osws_id = osws.id
        LEFT JOIN organization_members om ON ar.scanned_by_student_id = om.student_id AND om.is_active = TRUE
        WHERE ar.event_id = ?
    `;
    try {
        const [rows] = await db.query(query, [eventId]);
        return rows.map(row => {
            const scanned_by = resolveScannedBy(row);
            const { _officer_first_name, _officer_last_name, _osws_name, _org_name, ...rest } = row;
            return { ...rest, scanned_by };
        });
    } catch (error) {
        console.error('Error fetching attendance records by event:', error.stack);
        throw error;
    }
};

const createEvent = async (eventData) => {
    const {
        title, description, location,
        room,
        start_date, start_time, end_date, end_time,
        event_poster, created_by_org_id, created_by_osws_id, status,
        is_paid,
        registration_fee,
        event_latitude, event_longitude,
        locations
    } = eventData;
    const normalizeIsPaid = (v) => {
        if (v === undefined || v === null || v === '') return 0;
        if (typeof v === 'number') return v ? 1 : 0;
        if (typeof v === 'boolean') return v ? 1 : 0;
        const s = String(v).toLowerCase();
        return (s === '1' || s === 'true' || s === 'paid' || s === 'yes') ? 1 : 0;
    };
    const normalizeFee = (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n < 0 ? 0 : Number(n.toFixed(2));
    };
    // Ensure dates are yyyy-MM-dd strings
    const normalizeDate = (d) => {
        if (!d) return '';

        // If already in correct format, return as-is
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

        // Parse the date string/object to extract components
        let dateObj;
        if (typeof d === 'string') {
            // Extract date part if it contains time (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss)
            const datePart = d.split('T')[0].split(' ')[0];
            const match = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (match) {
                // Construct date using local timezone to avoid UTC conversion issues
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
                const day = parseInt(match[3], 10);
                dateObj = new Date(year, month, day);
            } else {
                // Fallback to Date constructor for other formats
                dateObj = new Date(d);
            }
        } else {
            dateObj = new Date(d);
        }

        // Validate the date
        if (isNaN(dateObj.getTime())) return '';

        // Format as YYYY-MM-DD using local timezone
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const startDateStr = normalizeDate(start_date);
    const endDateStr = normalizeDate(end_date);
    // Normalize locations (accept array/object/string). Store JSON string or NULL.
    const normalizedLocationsJson = normalizeLocationsInput(locations);

    const query = `
            INSERT INTO created_events
            (title, description, location, room, event_latitude, event_longitude, start_date, start_time, end_date, end_time, event_poster, is_paid, registration_fee, created_by_org_id, created_by_osws_id, created_by_student_id, status, locations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    try {
        // If primary coordinates weren't provided explicitly, derive from first location entry
        let primaryLat = (event_latitude !== undefined && event_latitude !== null && event_latitude !== '') ? Number(event_latitude) : null;
        let primaryLon = (event_longitude !== undefined && event_longitude !== null && event_longitude !== '') ? Number(event_longitude) : null;
        let primaryLocationLabel = location;
        if ((primaryLat === null || primaryLon === null) && normalizedLocationsJson) {
            try {
                const parsed = JSON.parse(normalizedLocationsJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const first = parsed[0];
                    if (!primaryLocationLabel && (first.name || first.location)) primaryLocationLabel = first.name || first.location;
                    if ((primaryLat === null || primaryLat === undefined) && first.latitude !== undefined) primaryLat = first.latitude;
                    if ((primaryLon === null || primaryLon === undefined) && first.longitude !== undefined) primaryLon = first.longitude;
                }
            } catch (_) { /* ignore */ }
        }

        const [result] = await db.query(query, [
            title,
            description,
            primaryLocationLabel || location,
            room || null,
            primaryLat !== undefined && primaryLat !== null && primaryLat !== '' ? Number(primaryLat) : null,
            primaryLon !== undefined && primaryLon !== null && primaryLon !== '' ? Number(primaryLon) : null,
            startDateStr,
            start_time,
            endDateStr,
            end_time,
            event_poster,
            normalizeIsPaid(is_paid),
            normalizeIsPaid(is_paid) ? normalizeFee(registration_fee) : 0,
            created_by_org_id && created_by_org_id !== 'undefined' && created_by_org_id !== '' ? created_by_org_id : null,
            created_by_osws_id && created_by_osws_id !== 'undefined' && created_by_osws_id !== '' ? created_by_osws_id : null,
            // created_by_student_id may be provided by controller to capture the officer/member who created the event
            (eventData.created_by_student_id && eventData.created_by_student_id !== 'undefined' && eventData.created_by_student_id !== '') ? eventData.created_by_student_id : null,
            status || 'not yet started',
            normalizedLocationsJson
        ]);
        // If table isn't configured with AUTO_INCREMENT (older schema), result.insertId may be 0.
        // Fall back to obtaining the highest event_id after insert if insertId is falsy.
        let lastId = (result && result.insertId && result.insertId > 0) ? result.insertId : null;

        // Fallback: fetch the max event_id value which should correspond to the inserted row
        const [rows] = await db.query('SELECT MAX(event_id) AS last_id FROM created_events');
        lastId = (rows && rows[0] && rows[0].last_id != null) ? Number(rows[0].last_id) : null;
        if (!lastId) console.error('[createEvent] insertId was 0/null and MAX fallback also failed.');
        
        const finalId = lastId || ((rows && rows[0] && rows[0].last_id != null) ? Number(rows[0].last_id) : null);
        
        return finalId;
    } catch (error) {
        console.error('Error creating event:', error.stack);
        throw error;
    }
};

const getAllEvents = async (page = undefined, per_page = undefined) => {
    const homeInt = sqlHomeVisibilityIntervalAllEvents();
    const baseSql = `
            SELECT ce.*, org.department, org.org_name, org.email AS org_email,
                   osws.name AS osws_name, osws.email AS osws_email,
                   CONCAT(s_creator.first_name, ' ', IFNULL(s_creator.last_name, '')) AS created_by_name
            FROM created_events ce
            LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
            LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
            LEFT JOIN students s_creator ON ce.created_by_student_id = s_creator.id
            WHERE ce.deleted_at IS NULL AND (ce.end_date IS NULL OR ce.end_date >= DATE_SUB(CURDATE(), INTERVAL ${homeInt} DAY))
        `;
    const countSql = `
            SELECT COUNT(*) AS cnt FROM created_events ce
            LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
            LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
            WHERE ce.deleted_at IS NULL AND (ce.end_date IS NULL OR ce.end_date >= DATE_SUB(CURDATE(), INTERVAL ${homeInt} DAY))
        `;
    try {
        if (page && per_page) {
            const p = Math.max(1, parseInt(page, 10));
            const pp = Math.max(1, Math.min(200, parseInt(per_page, 10)));
            const [[countRow]] = await db.query(countSql);
            const total = Number(countRow?.cnt || 0);
            const offset = (p - 1) * pp;
            const pagedSql = baseSql + ' ORDER BY ce.created_at DESC LIMIT ? OFFSET ?';
            const [rows] = await db.query(pagedSql, [pp, offset]);
            if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
            return { items: rows, total, page: p, per_page: pp, total_pages: Math.ceil(total / pp) };
        }
        const [rows] = await db.query(baseSql + ' ORDER BY ce.created_at DESC');
        if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
        return rows;
    } catch (error) {
        console.error('Error fetching all events:', error.stack);
        throw error;
    }
};

const getEventsByParticipant = async (student_id) => {
    const query = `
        SELECT ce.*, er.qr_code, er.status AS registration_status, er.registered_at,
               org.department, org.org_name, org.email AS org_email,
               osws.name AS osws_name, osws.email AS osws_email,
               CONCAT(s_creator.first_name, ' ', IFNULL(s_creator.last_name, '')) AS created_by_name
        FROM created_events ce
        JOIN event_registrations er ON ce.event_id = er.event_id
        LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
        LEFT JOIN students s_creator ON ce.created_by_student_id = s_creator.id
        WHERE er.student_id = ?
        ORDER BY er.id DESC
    `;
    try {
        const [rows] = await db.query(query, [student_id]);
        if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
        return rows;
    } catch (error) {
        console.error('Error fetching participant events:', error.stack);
        throw error;
    }
};

const getEventsByCreator = async (creator_id) => {
    const query = `
        SELECT ce.*, org.department, org.org_name, org.email AS org_email,
               CONCAT(s_creator.first_name, ' ', IFNULL(s_creator.last_name, '')) AS created_by_name
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        LEFT JOIN students s_creator ON ce.created_by_student_id = s_creator.id
        WHERE ce.created_by_org_id = ? AND ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query, [creator_id]);
        if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
        return rows;
    } catch (error) {
        console.error('Error fetching events by creator:', error.stack);
        throw error;
    }
};

const updateEventStatus = async (eventId, status) => {
    const query = `UPDATE created_events SET status = ? WHERE event_id = ?`;
    try {
        const [result] = await db.query(query, [status, eventId]);
        return result;
    } catch (error) {
        console.error('Error updating event status:', error.stack);
        throw error;
    }
};

const getAllAttendanceRecords = async () => {
    const query = `
        SELECT 
            ar.event_id,
            ce.title AS event_title,
            ar.student_id,
            s.first_name,
            s.last_name,
            s.suffix,
            s.department,
            s.program,
            COALESCE(s.year_level, 4) AS year_level,
            ar.time_in,
            ar.time_out,
            COALESCE(ar.time_in, ar.attended_at) AS attended_at,
            officer.first_name AS _officer_first_name,
            officer.last_name AS _officer_last_name,
            osws.name AS _osws_name,
            org.org_name AS _org_name,
            om.position AS scanned_by_position
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
        LEFT JOIN students officer ON ar.scanned_by_student_id = officer.id
        LEFT JOIN student_organizations org ON ar.scanned_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ar.scanned_by_osws_id = osws.id
        LEFT JOIN organization_members om ON ar.scanned_by_student_id = om.student_id AND om.is_active = TRUE
    `;
    try {
        const [rows] = await db.query(query);
        return rows.map(row => {
            const scanned_by = resolveScannedBy(row);
            const { _officer_first_name, _officer_last_name, _osws_name, _org_name, ...rest } = row;
            return { ...rest, scanned_by };
        });
    } catch (error) {
        console.error('Error fetching attendance records:', error.stack);
        throw error;
    }
};

const getAttendanceRecordsByOrg = async (orgId) => {
    const query = `
        SELECT 
            ar.event_id,
            ce.title AS event_title,
            ar.student_id,
            s.first_name,
            s.last_name,
            s.suffix,
            s.department,
            s.program,
            COALESCE(s.year_level, 4) AS year_level,
            ar.time_in,
            ar.time_out,
            COALESCE(ar.time_in, ar.attended_at) AS attended_at,
            officer.first_name AS _officer_first_name,
            officer.last_name AS _officer_last_name,
            osws.name AS _osws_name,
            org.org_name AS _org_name,
            om.position AS scanned_by_position
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
        LEFT JOIN students officer ON ar.scanned_by_student_id = officer.id
        LEFT JOIN student_organizations org ON ar.scanned_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ar.scanned_by_osws_id = osws.id
        LEFT JOIN organization_members om ON ar.scanned_by_student_id = om.student_id AND om.is_active = TRUE
        WHERE ce.created_by_org_id = ?
    `;
    try {
        const [rows] = await db.query(query, [orgId]);
        return rows.map(row => {
            const scanned_by = resolveScannedBy(row);
            const { _officer_first_name, _officer_last_name, _osws_name, _org_name, ...rest } = row;
            return { ...rest, scanned_by };
        });
    } catch (error) {
        console.error('Error fetching attendance records by org:', error.stack);
        throw error;
    }
};

// Attendance records for OSWS admin (events created by OSWS admin)
const getAttendanceRecordsByOsws = async (adminId) => {
    const query = `
        SELECT 
            ar.event_id,
            ce.title AS event_title,
            ar.student_id,
            s.first_name,
            s.last_name,
            s.suffix,
            s.department,
            s.program,
            ar.time_in,
            ar.time_out,
            COALESCE(ar.time_in, ar.attended_at) AS attended_at,
            officer.first_name AS _officer_first_name,
            officer.last_name AS _officer_last_name,
            osws.name AS _osws_name,
            org.org_name AS _org_name,
            om.position AS scanned_by_position
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
        LEFT JOIN students officer ON ar.scanned_by_student_id = officer.id
        LEFT JOIN student_organizations org ON ar.scanned_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ar.scanned_by_osws_id = osws.id
        LEFT JOIN organization_members om ON ar.scanned_by_student_id = om.student_id AND om.is_active = TRUE
        WHERE ce.created_by_osws_id = ?
    `;
    try {
        const [rows] = await db.query(query, [adminId]);
        return rows.map(row => {
            const scanned_by = resolveScannedBy(row);
            const { _officer_first_name, _officer_last_name, _osws_name, _org_name, ...rest } = row;
            return { ...rest, scanned_by };
        });
    } catch (error) {
        console.error('Error fetching attendance records by OSWS admin:', error.stack);
        throw error;
    }
};

// Attendance records for a specific student (events they attended)
const getAttendanceRecordsByStudent = async (studentId) => {
    const query = `
        SELECT 
            ar.event_id,
            ce.title AS event_title,
            ce.start_date,
            ce.end_date,
            ce.start_time,
            ce.end_time,
            COALESCE(ce.room, ce.location) AS location,
            ce.status,
            ce.event_poster,
            ce.created_by_org_id,
            ce.created_by_osws_id,
            org.org_name,
            org.department,
            osws.name AS osws_name,
            COALESCE(ar.time_in, ar.attended_at) AS attended_at,
            ar.time_in,
            ar.time_out,
            officer.first_name AS _officer_first_name,
            officer.last_name AS _officer_last_name,
            osws_scanner.name AS _osws_name,
            org_scanner.org_name AS _org_name,
            om.position AS scanned_by_position
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
        LEFT JOIN students officer ON ar.scanned_by_student_id = officer.id
        LEFT JOIN student_organizations org_scanner ON ar.scanned_by_org_id = org_scanner.id
        LEFT JOIN osws_admins osws_scanner ON ar.scanned_by_osws_id = osws_scanner.id
        LEFT JOIN organization_members om ON ar.scanned_by_student_id = om.student_id AND om.is_active = TRUE
        WHERE ar.student_id = ?
        ORDER BY COALESCE(ar.time_in, ar.attended_at) DESC
    `;
    try {
        const [rows] = await db.query(query, [studentId]);
        return rows.map(row => {
            const scanned_by_name = resolveScannedBy(row);
            const { _officer_first_name, _officer_last_name, _osws_name, _org_name, ...rest } = row;
            return { ...rest, scanned_by_name };
        });
    } catch (error) {
        console.error('Error fetching attendance records by student:', error.stack);
        throw error;
    }
};

// Soft delete: mark event as trashed
const deleteEvent = async (eventId, deletedBy) => {
    const query = `UPDATE created_events SET deleted_at = UTC_TIMESTAMP(), deleted_by = ? WHERE event_id = ? AND deleted_at IS NULL`;
    try {
        const [result] = await db.query(query, [deletedBy || null, eventId]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error soft-deleting event:', error.stack);
        throw error;
    }
};

const getEventsByAdmin = async (admin_id) => {
    const query = `
        SELECT ce.*, a.name AS admin_name, a.email AS osws_email
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id = ? AND ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query, [admin_id]);
        if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
        return rows;
    } catch (error) {
        console.error('Error fetching events by admin:', error.stack);
        throw error;
    }
};

const getAllOrgEvents = async (page = undefined, per_page = undefined) => {
    const baseSql = `
        SELECT ce.*, org.department, org.org_name, org.email AS org_email
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        WHERE ce.created_by_org_id IS NOT NULL AND ce.deleted_at IS NULL
    `;
    try {
        if (page && per_page) {
            const p = Math.max(1, parseInt(page, 10));
            const pp = Math.max(1, Math.min(200, parseInt(per_page, 10)));
            const [[countRow]] = await db.query('SELECT COUNT(*) AS cnt FROM created_events WHERE created_by_org_id IS NOT NULL AND deleted_at IS NULL');
            const total = Number(countRow?.cnt || 0);
            const offset = (p - 1) * pp;
            const pagedSql = baseSql + ' ORDER BY ce.created_at DESC LIMIT ? OFFSET ?';
            const [rows] = await db.query(pagedSql, [pp, offset]);
            if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
            return { items: rows, total, page: p, per_page: pp, total_pages: Math.ceil(total / pp) };
        }
        const [rows] = await db.query(baseSql + ' ORDER BY ce.created_at DESC');
        if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
        return rows;
    } catch (error) {
        console.error('Error fetching org events:', error.stack);
        throw error;
    }
};

// Fetch all OSWS-created events
const getAllOswsEvents = async (page = undefined, per_page = undefined) => {
    const homeInt = sqlHomeVisibilityIntervalOswsEvents();
    const baseSql = `
        SELECT ce.*, a.name AS admin_name, a.email AS osws_email
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id IS NOT NULL AND ce.deleted_at IS NULL AND (ce.end_date IS NULL OR ce.end_date >= DATE_SUB(CURDATE(), INTERVAL ${homeInt} DAY))
    `;
    const countSql = `
        SELECT COUNT(*) AS cnt FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id IS NOT NULL AND ce.deleted_at IS NULL AND (ce.end_date IS NULL OR ce.end_date >= DATE_SUB(CURDATE(), INTERVAL ${homeInt} DAY))
    `;
    try {
        if (page && per_page) {
            const p = Math.max(1, parseInt(page, 10));
            const pp = Math.max(1, Math.min(200, parseInt(per_page, 10)));
            const [[countRow]] = await db.query(countSql);
            const total = Number(countRow?.cnt || 0);
            const offset = (p - 1) * pp;
            const pagedSql = baseSql + ' ORDER BY ce.created_at DESC LIMIT ? OFFSET ?';
            const [rows] = await db.query(pagedSql, [pp, offset]);
            if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
            return { items: rows, total, page: p, per_page: pp, total_pages: Math.ceil(total / pp) };
        }
        const [rows] = await db.query(baseSql + ' ORDER BY ce.created_at DESC');
        if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
        return rows;
    } catch (error) {
        console.error('Error fetching osws events:', error.stack);
        throw error;
    }
};

const updateEvent = async (eventId, eventData) => {

    const {
        title,
        description,
        location,
        room,
        start_date,
        start_time,
        end_date,
        end_time,
        event_poster, // Optional: only update if provided
        status,
        is_paid,
        registration_fee,
        event_latitude,
        event_longitude,
        locations
    } = eventData;

    // Ensure dates are yyyy-MM-dd strings only when provided
    const normalizeDate = (d) => {
        if (d === undefined) return null; // signal to keep existing
        if (!d) return ''; // allow clearing when explicitly empty/falsey

        // If already in correct format, return as-is
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

        // Parse the date string/object to extract components
        let dateObj;
        if (typeof d === 'string') {
            // Extract date part if it contains time (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss)
            const datePart = d.split('T')[0].split(' ')[0];
            const match = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (match) {
                // Construct date using local timezone to avoid UTC conversion issues
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
                const day = parseInt(match[3], 10);
                dateObj = new Date(year, month, day);
            } else {
                // Fallback to Date constructor for other formats
                dateObj = new Date(d);
            }
        } else {
            dateObj = new Date(d);
        }

        // Validate the date
        if (isNaN(dateObj.getTime())) return '';

        // Format as YYYY-MM-DD using local timezone
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const startDateVal = normalizeDate(start_date);
    const endDateVal = normalizeDate(end_date);

    // Use COALESCE so undefined (mapped to NULL) preserves existing
    let query = `
        UPDATE created_events
        SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            location = COALESCE(?, location),
            room = COALESCE(?, room),
            start_date = COALESCE(?, start_date),
            start_time = COALESCE(?, start_time),
            end_date = COALESCE(?, end_date),
            end_time = COALESCE(?, end_time),
            status = COALESCE(?, status)
    `;

    const params = [
        title ?? null,
        description ?? null,
        location ?? null,
        room ?? null,
        startDateVal,
        start_time ?? null,
        endDateVal,
        end_time ?? null,
        status ?? null,
    ];

    // Special handling for event_poster
    if (event_poster !== undefined) {
        if (event_poster === '') {
            query += `, event_poster = NULL`;
        } else {
            query += `, event_poster = ?`;
            params.push(event_poster);
        }
    }

    // Optional update for is_paid
    if (is_paid !== undefined) {
        const normalizeIsPaid = (v) => {
            if (v === undefined || v === null || v === '') return null; // keep existing
            if (typeof v === 'number') return v ? 1 : 0;
            if (typeof v === 'boolean') return v ? 1 : 0;
            const s = String(v).toLowerCase();
            return (s === '1' || s === 'true' || s === 'paid' || s === 'yes') ? 1 : 0;
        };
        query += `, is_paid = COALESCE(?, is_paid)`;
        params.push(normalizeIsPaid(is_paid));
    }

    // Optional update for registration_fee
    if (registration_fee !== undefined) {
        const normalizeFee = (v) => {
            if (v === null || v === '') return null; // keep if not provided
            const n = parseFloat(v);
            return isNaN(n) || n < 0 ? 0 : Number(n.toFixed(2));
        };
        query += `, registration_fee = COALESCE(?, registration_fee)`;
        params.push(normalizeFee(registration_fee));
    }

    // Optional update for event coordinates
    if (event_latitude !== undefined || event_longitude !== undefined) {
        // Use COALESCE so null can clear existing values
        query += `, event_latitude = COALESCE(?, event_latitude), event_longitude = COALESCE(?, event_longitude)`;
        params.push(event_latitude !== undefined && event_latitude !== '' ? Number(event_latitude) : null);
        params.push(event_longitude !== undefined && event_longitude !== '' ? Number(event_longitude) : null);
    }

    /** null = no child-table sync; 'clear' = delete all rows; array = replace rows */
    let locationsSync = null;
    // Optional update for locations: accept array/object/json string
    if (locations !== undefined) {
        const normalizedLocationsJson = normalizeLocationsInput(locations);
        const locationsExplicitClear = normalizedLocationsJson === null &&
            (locations === null || locations === '' || (Array.isArray(locations) && locations.length === 0));
        if (locationsExplicitClear) {
            query += `, locations = NULL`;
            locationsSync = 'clear';
        } else if (normalizedLocationsJson) {
            query += `, locations = COALESCE(?, locations)`;
            params.push(normalizedLocationsJson);
            // If primary coords are not provided but locations include a first coord, allow updating coordinates
            try {
                const parsed = normalizedLocationsJson ? JSON.parse(normalizedLocationsJson) : null;
                if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                    locationsSync = parsed;
                    const first = parsed[0];
                    if ((event_latitude === undefined || event_latitude === null || event_latitude === '') && first.latitude !== undefined) {
                        query += `, event_latitude = COALESCE(?, event_latitude)`;
                        params.push(first.latitude);
                    }
                    if ((event_longitude === undefined || event_longitude === null || event_longitude === '') && first.longitude !== undefined) {
                        query += `, event_longitude = COALESCE(?, event_longitude)`;
                        params.push(first.longitude);
                    }
                }
            } catch (_) { /* ignore */ }
        }
    }

    query += ` WHERE event_id = ?`;
    params.push(eventId);

    try {
        const [result] = await db.query(query, params);
        return result;
    } catch (error) {
        console.error('Error updating event:', error.stack);
        throw error;
    }
};

const getEventById = async (eventId) => {
    const sql = `
        SELECT ce.*, org.department, org.org_name, org.email AS org_email,
               osws.name AS osws_name, osws.email AS osws_email,
               CONCAT(s_creator.first_name, ' ', IFNULL(s_creator.last_name, '')) AS created_by_name
        FROM created_events ce
        LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
        LEFT JOIN students s_creator ON ce.created_by_student_id = s_creator.id
        WHERE ce.event_id = ?
        LIMIT 1
    `;
    const [rows] = await db.query(sql, [eventId]);
    const row = rows[0];
    if (!row) return null;
    const hydrated = await hydrateLocationsForRows([row]);
    return hydrated[0] || null;
};

// Hard delete: remove event and dependent data (REVISED to Soft-Permanent Delete)
const hardDeleteEvent = async (eventId) => {
    try {
        // Instead of manually deleting attendance_records, evaluations, certificates, etc
        // we execute a "Soft-Permanent" delete. The record stays in MySQL indefinitely to preserve
        // student history and certificates, but disappears from the Organizer's panels forever.
        const [res] = await db.query(
            'UPDATE created_events SET permanently_deleted_at = UTC_TIMESTAMP() WHERE event_id = ? AND permanently_deleted_at IS NULL',
            [eventId]
        );
        return res.affectedRows > 0;
    } catch (error) {
        console.error('Error hard-deleting event:', error.stack || error);
        throw error;
    }
};

// Trash listing and restore helpers
const getTrashedOrgEvents = async (orgId) => {
    const query = `
        SELECT ce.*, org.department, org.org_name
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        WHERE ce.created_by_org_id = ? AND ce.deleted_at IS NOT NULL AND ce.permanently_deleted_at IS NULL
        ORDER BY ce.deleted_at DESC
    `;
    const [rows] = await db.query(query, [orgId]);
    if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
    return rows;
};

const getTrashedOswsEvents = async (adminId) => {
    const query = `
        SELECT ce.*, a.name AS admin_name
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id = ? AND ce.deleted_at IS NOT NULL AND ce.permanently_deleted_at IS NULL
        ORDER BY ce.deleted_at DESC
    `;
    const [rows] = await db.query(query, [adminId]);
    if (Array.isArray(rows)) await hydrateLocationsForRows(rows);
    return rows;
};

const restoreEvent = async (eventId) => {
    const query = `UPDATE created_events SET deleted_at = NULL, deleted_by = NULL WHERE event_id = ?`;
    const [result] = await db.query(query, [eventId]);
    return result.affectedRows > 0;
};

module.exports = {
    createEvent,
    getAllEvents,
    getEventsByParticipant,
    getEventsByCreator,
    updateEventStatus,
    getAllAttendanceRecords,
    getAttendanceRecordsByStudent,
    getAttendanceRecordsByOrg,
    getAttendanceRecordsByOsws,
    getAttendanceRecordsByEvent,
    deleteEvent,
    getEventsByAdmin,
    getAllOrgEvents,
    getAllOswsEvents,
    updateEvent,
    getEventById,
    getTrashedOrgEvents,
    getTrashedOswsEvents,
    restoreEvent,
    hardDeleteEvent,
    // Auto update event statuses based on current time
    autoUpdateEventStatuses: async () => {
        try {
            // Run all three updates in a single transaction for better performance
            await db.query('START TRANSACTION');

            // Timezone handling:
            // - Stored event date/time values are assumed to be in the organization's local timezone
            //   (default is Philippines Time, +08:00). The DB server's NOW() may be in UTC or
            //   another timezone in production which caused incorrect comparisons.
            // - Use CONVERT_TZ to convert the stored timestamp from the event timezone to UTC
            //   and compare against `UTC_TIMESTAMP()` which is timezone-independent.
            // - Allow overriding the event timezone offset via `EVENT_TZ_OFFSET` env var,
            //   e.g. '+08:00' or '-05:00'. Named timezones require MySQL tz tables to be loaded
            //   and are therefore not used by default.
            const eventTzOffset = process.env.EVENT_TZ_OFFSET || '+08:00';

            const startTimeExpr = `CONVERT_TZ(TIMESTAMP(start_date, start_time), '${eventTzOffset}', '+00:00')`;
            const endTimeExpr = `CONVERT_TZ(TIMESTAMP(end_date, end_time), '${eventTzOffset}', '+00:00')`;
            const nowExpr = 'UTC_TIMESTAMP()';

            // 1) Set to 'ongoing' when now between start and end, not cancelled/trashed
            const [ongoingRes] = await db.query(
                `UPDATE created_events
                                 SET status = 'ongoing'
                                 WHERE deleted_at IS NULL
                                     AND ${startTimeExpr} <= ${nowExpr}
                                     AND ${endTimeExpr} >= ${nowExpr}
                                     AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','ongoing')`
            );

            // 2) Set to 'concluded' when past end, not cancelled/trashed/already concluded
            const [concludedRes] = await db.query(
                `UPDATE created_events
                                 SET status = 'concluded'
                                 WHERE deleted_at IS NULL
                                     AND ${endTimeExpr} < ${nowExpr}
                                     AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','concluded')`
            );

            // 3) Normalize future events to 'not yet started' (unless cancelled)
            const [notYetRes] = await db.query(
                `UPDATE created_events
                                 SET status = 'not yet started'
                                 WHERE deleted_at IS NULL
                                     AND ${startTimeExpr} > ${nowExpr}
                                     AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','not yet started')`
            );

            // 4) Org officers may opt in: concluded org-owned events move to archive automatically
            const [autoTrashOrgRes] = await db.query(
                `UPDATE created_events ce
                 INNER JOIN student_organizations so ON ce.created_by_org_id = so.id
                 SET ce.deleted_at = UTC_TIMESTAMP(), ce.deleted_by = NULL
                 WHERE ce.deleted_at IS NULL
                   AND LOWER(COALESCE(ce.status, '')) = 'concluded'
                   AND ce.created_by_org_id IS NOT NULL
                   AND COALESCE(so.event_auto_trash_on_conclude, 0) = 1`
            );

            // 5) OSWS admins may opt in: concluded OSWS-owned events (no org owner) move to archive automatically
            const [autoTrashOswsRes] = await db.query(
                `UPDATE created_events ce
                 INNER JOIN osws_admins oa ON ce.created_by_osws_id = oa.id
                 SET ce.deleted_at = UTC_TIMESTAMP(), ce.deleted_by = NULL
                 WHERE ce.deleted_at IS NULL
                   AND LOWER(COALESCE(ce.status, '')) = 'concluded'
                   AND ce.created_by_osws_id IS NOT NULL
                   AND ce.created_by_org_id IS NULL
                   AND COALESCE(oa.event_auto_trash_on_conclude, 0) = 1`
            );

            await db.query('COMMIT');

            return {
                toOngoing: ongoingRes?.affectedRows || 0,
                toConcluded: concludedRes?.affectedRows || 0,
                toNotYetStarted: notYetRes?.affectedRows || 0,
                autoTrashedOrgEvents: autoTrashOrgRes?.affectedRows || 0,
                autoTrashedOswsEvents: autoTrashOswsRes?.affectedRows || 0
            };
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    },
    // Ensure schema has is_paid column
    ensureIsPaidColumn: async () => {
        try {
            const [rows] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'created_events' AND COLUMN_NAME = 'is_paid'`
            );
            if (!Array.isArray(rows) || rows.length === 0) {
                await db.query(`ALTER TABLE created_events ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 0 AFTER event_poster`);
                try {
                    await db.query(`UPDATE created_events SET is_paid = 0 WHERE is_paid IS NULL`);
                } catch (_) { /* no-op */ }
            }
        } catch (e) {
            console.warn('[DB] ensureIsPaidColumn check failed:', e.message || e);
        }
    },
    // Ensure schema has registration_fee column
    ensureRegistrationFeeColumn: async () => {
        try {
            const [rows] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'created_events' AND COLUMN_NAME = 'registration_fee'`
            );
            if (!Array.isArray(rows) || rows.length === 0) {
                await db.query(`ALTER TABLE created_events ADD COLUMN registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER is_paid`);
                try { await db.query(`UPDATE created_events SET registration_fee = 0 WHERE registration_fee IS NULL`); } catch (_) { }
            }
        } catch (e) {
            console.warn('[DB] ensureRegistrationFeeColumn check failed:', e.message || e);
        }
    },
    // Ensure created_events has a JSON `locations` column to store multiple locations
    ensureLocationsColumn: async () => {
        try {
            const [rows] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'created_events' AND COLUMN_NAME = 'locations'`
            );
            if (!Array.isArray(rows) || rows.length === 0) {
                try {
                    await db.query(`ALTER TABLE created_events ADD COLUMN locations JSON NULL AFTER event_longitude`);
                } catch (e) {
                    // Fallback for MySQL versions without JSON support
                    await db.query(`ALTER TABLE created_events ADD COLUMN locations TEXT NULL AFTER event_longitude`);
                }
            }
        } catch (e) {
            console.warn('[DB] ensureLocationsColumn check failed:', e.message || e);
        }
    },
    // Ensure event_registrations has status and approval metadata
    ensureRegistrationStatusColumns: async () => {
        try {
            // status column
            const [scol] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_registrations' AND COLUMN_NAME = 'status'`
            );
            if (!Array.isArray(scol) || scol.length === 0) {
                await db.query(`ALTER TABLE event_registrations ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved' AFTER qr_code`);
            }
            // approved_at
            const [acol] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_registrations' AND COLUMN_NAME = 'approved_at'`
            );
            if (!Array.isArray(acol) || acol.length === 0) {
                await db.query(`ALTER TABLE event_registrations ADD COLUMN approved_at DATETIME NULL AFTER status`);
            }
            // approved_by_org_id
            const [aborg] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_registrations' AND COLUMN_NAME = 'approved_by_org_id'`
            );
            if (!Array.isArray(aborg) || aborg.length === 0) {
                await db.query(`ALTER TABLE event_registrations ADD COLUMN approved_by_org_id INT NULL AFTER approved_at`);
            }
            // approved_by_osws_id
            const [abosws] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_registrations' AND COLUMN_NAME = 'approved_by_osws_id'`
            );
            if (!Array.isArray(abosws) || abosws.length === 0) {
                await db.query(`ALTER TABLE event_registrations ADD COLUMN approved_by_osws_id INT NULL AFTER approved_by_org_id`);
            }
        } catch (e) {
            console.warn('[DB] ensureRegistrationStatusColumns check failed:', e.message || e);
        }
    },
    // Stats: upcoming/ongoing/cancelled exclude trashed, concluded includes trashed
    getOrgDashboardStats: async (orgId) => {
        const nowQuery = 'UTC_TIMESTAMP()';
        // Upcoming: start after now, not trashed
        const [up] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_org_id = ? AND deleted_at IS NULL
                    AND CONVERT_TZ(TIMESTAMP(start_date, start_time), '${process.env.EVENT_TZ_OFFSET || '+08:00'}', '+00:00') > ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'concluded')`,
            [orgId]
        );
        // Ongoing: now between start and end, not trashed, not concluded
        const [og] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_org_id = ? AND deleted_at IS NULL
                    AND CONVERT_TZ(TIMESTAMP(start_date, start_time), '${process.env.EVENT_TZ_OFFSET || '+08:00'}', '+00:00') <= ${nowQuery}
                    AND CONVERT_TZ(TIMESTAMP(end_date, end_time), '${process.env.EVENT_TZ_OFFSET || '+08:00'}', '+00:00') >= ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'concluded')`,
            [orgId]
        );
        // Cancelled: not trashed
        const [cc] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
             WHERE created_by_org_id = ? AND deleted_at IS NULL
               AND LOWER(COALESCE(status, '')) = 'cancelled'`,
            [orgId]
        );
        // Concluded: exclude trashed (deleted_at IS NULL)
        const [cm] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
             WHERE created_by_org_id = ? AND deleted_at IS NULL
               AND (
                   LOWER(COALESCE(status, '')) = 'concluded'
                   OR CONVERT_TZ(TIMESTAMP(end_date, end_time), '${process.env.EVENT_TZ_OFFSET || '+08:00'}', '+00:00') < ${nowQuery}
               )`,
            [orgId]
        );
        return {
            upcoming: up[0]?.cnt || 0,
            ongoing: og[0]?.cnt || 0,
            cancelled: cc[0]?.cnt || 0,
            concluded: cm[0]?.cnt || 0,
        };
    },
    // Aggregated chart datasets for OSWS dashboard
    // filter: 'weekly' (last 12 weeks), 'monthly' (current year), 'yearly' (last 5 years)
    // NOTE: Use TIMESTAMP(...) and UTC_TIMESTAMP() for comparisons to avoid
    // relying on CONVERT_TZ / EVENT_TZ_OFFSET. This keeps chart counts
    // consistent with `getOswsDashboardStats` which also uses UTC comparisons.
    getOswsDashboardCharts: async (filter) => {
        const nowExpr = 'UTC_TIMESTAMP()';
        const startExpr = `TIMESTAMP(start_date, COALESCE(start_time, '00:00:00'))`;
        let timeWhere = '';
        if (filter === 'weekly') {
            // last 12 weeks
            timeWhere = `AND ${startExpr} >= (${nowExpr} - INTERVAL 12 WEEK)`;
        } else if (filter === 'monthly') {
            // current year
            timeWhere = `AND YEAR(${startExpr}) = YEAR(${nowExpr})`;
        } else if (filter === 'yearly') {
            // last 5 years
            timeWhere = `AND ${startExpr} >= (${nowExpr} - INTERVAL 5 YEAR)`;
        }

        // Events by department (organization-created events only)
        const [deptRows] = await db.query(
            `SELECT COALESCE(org.department, 'Unknown') AS department, COUNT(*) AS cnt
                 FROM created_events ce
                 LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
                 WHERE ce.created_by_org_id IS NOT NULL
                   AND ce.deleted_at IS NULL
                   ${timeWhere}
                 GROUP BY department
                 ORDER BY cnt DESC
                 LIMIT 50`
        );

        // Activities per organization (organization-created events only)
        const [orgRows] = await db.query(
            `SELECT COALESCE(org.org_name, CONCAT('Org ', ce.created_by_org_id)) AS org_name, COUNT(*) AS cnt
                 FROM created_events ce
                 LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
                 WHERE ce.created_by_org_id IS NOT NULL
                   AND ce.deleted_at IS NULL
                   ${timeWhere}
                 GROUP BY org_name
                 ORDER BY cnt DESC
                 LIMIT 100`
        );

        return {
            events_by_department: deptRows.map(r => ({ department: r.department || 'Unknown', count: r.cnt || 0 })),
            activities_by_organization: orgRows.map(r => ({ org_name: r.org_name || 'Unknown', count: r.cnt || 0 }))
        };
    },
    getOswsDashboardStats: async () => {
        // Use UTC_TIMESTAMP() for comparisons but convert stored event local timestamps
        // to UTC using the configured EVENT_TZ_OFFSET so counts reflect the event
        // organizer's local timezone (e.g. '+08:00'). This prevents flip-flopping
        // when the DB server timezone differs from event local time.
        const nowQuery = 'UTC_TIMESTAMP()';
        const eventTzOffset = process.env.EVENT_TZ_OFFSET || '+08:00';
        const startExpr = `CONVERT_TZ(TIMESTAMP(start_date, COALESCE(start_time, '00:00:00')), '${eventTzOffset}', '+00:00')`;
        const endExpr = `CONVERT_TZ(TIMESTAMP(end_date, COALESCE(end_time, '23:59:59')), '${eventTzOffset}', '+00:00')`;

        // Upcoming: start after now, exclude trashed
        const [up] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
                             AND ${startExpr} > ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','concluded')`
        );

        // Ongoing: now between start and end, exclude trashed
        const [og] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
                             AND ${startExpr} <= ${nowQuery}
                             AND ${endExpr} >= ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled','concluded')`
        );

        // Cancelled: exclude trashed
        const [cc] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
                             AND LOWER(COALESCE(status, '')) = 'cancelled'`
        );

        // Concluded: include trashed or not (server-side rule: concluded includes trashed)
        const [cm] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_osws_id IS NOT NULL
                             AND (
                                     LOWER(COALESCE(status, '')) = 'concluded'
                                     OR ${endExpr} < ${nowQuery}
                             )`
        );

        return {
            upcoming: up[0]?.cnt || 0,
            ongoing: og[0]?.cnt || 0,
            cancelled: cc[0]?.cnt || 0,
            concluded: cm[0]?.cnt || 0,
        };
    },
    // New: ensure attendance supports time-in/out and OSWS scanner id
    ensureAttendanceColumns: async () => {
        try {
            const [ti] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'time_in'`
            );
            if (!Array.isArray(ti) || ti.length === 0) {
                await db.query(`ALTER TABLE attendance_records ADD COLUMN time_in DATETIME NULL AFTER student_id`);
            }
            const [to] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'time_out'`
            );
            if (!Array.isArray(to) || to.length === 0) {
                await db.query(`ALTER TABLE attendance_records ADD COLUMN time_out DATETIME NULL AFTER time_in`);
            }
            const [sb] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'scanned_by_osws_id'`
            );
            if (!Array.isArray(sb) || sb.length === 0) {
                await db.query(`ALTER TABLE attendance_records ADD COLUMN scanned_by_osws_id INT(11) NULL AFTER scanned_by_org_id`);
            }
            const [sbs] = await db.query(
                `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_records' AND COLUMN_NAME = 'scanned_by_student_id'`
            );
            if (!Array.isArray(sbs) || sbs.length === 0) {
                await db.query(`ALTER TABLE attendance_records ADD COLUMN scanned_by_student_id VARCHAR(20) NULL AFTER scanned_by_osws_id`);
            }
            // Backfill time_in from attended_at
            try {
                await db.query(`UPDATE attendance_records SET time_in = attended_at WHERE time_in IS NULL AND attended_at IS NOT NULL`);
            } catch (_) { }
        } catch (e) {
            console.warn('[DB] ensureAttendanceColumns check failed:', e.message || e);
        }
    }
};

// Normalize incoming `locations` payload to a JSON string suitable for storing in
// a JSON column. Accepts arrays, objects, or JSON strings. Returns `null` when
// no usable locations were provided.
const normalizeLocationsInput = (locations) => {
    if (locations === undefined || locations === null) return null;
    try {
        let arr = locations;
        if (typeof arr === 'string') {
            const trimmed = arr.trim();
            if (!trimmed) return null;
            // Try parse JSON first
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try { arr = JSON.parse(trimmed); } catch (_) { arr = trimmed; }
            } else {
                // Treat as single-name string
                arr = [{ name: trimmed }];
            }
        }
        if (!Array.isArray(arr)) {
            if (typeof arr === 'object') arr = [arr];
            else return null;
        }

        const normalized = arr.map(item => {
            if (typeof item === 'string') return { name: item };
            if (!item) return null;
            const name = item.name || item.location || item.display_name || '';
            const room = item.room || item.room_name || null;
            const latitude = item.latitude ?? item.lat ?? item.event_latitude ?? null;
            const longitude = item.longitude ?? item.lon ?? item.event_longitude ?? null;
            return {
                name: typeof name === 'string' ? name : String(name || ''),
                room: room || null,
                latitude: (latitude !== undefined && latitude !== null && latitude !== '') ? Number(latitude) : null,
                longitude: (longitude !== undefined && longitude !== null && longitude !== '') ? Number(longitude) : null
            };
        }).filter(Boolean);

        if (normalized.length === 0) return null;
        return JSON.stringify(normalized);
    } catch (e) {
        return null;
    }
};

// Ensure the `locations` field in a returned row is parsed to an array when
// possible and provide fallbacks for the legacy `location`/coordinate fields.
const hydrateLocationsForRows = async (rows) => {
    if (!rows || rows.length === 0) return rows;
    
    for (const row of rows) {
        let parsedLocations = [];
        if (row.locations && typeof row.locations === 'string') {
            try {
                parsedLocations = JSON.parse(row.locations);
            } catch (e) {
                // ignore
            }
        } else if (Array.isArray(row.locations)) {
            parsedLocations = row.locations;
        }

        row.locations = parsedLocations || [];
        
        // Legacy population: if no primary location string but we have location objects, infer it
        if ((!row.location || row.location === '') && row.locations.length > 0) {
            const first = row.locations[0];
            if (!row.location && (first.name || first.location)) row.location = first.name || first.location;
            if ((row.event_latitude === null || row.event_latitude === undefined) && first.latitude !== undefined) row.event_latitude = first.latitude;
            if ((row.event_longitude === null || row.event_longitude === undefined) && first.longitude !== undefined) row.event_longitude = first.longitude;
        }
    }
    return rows;
};