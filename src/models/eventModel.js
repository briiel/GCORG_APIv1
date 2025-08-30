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
            ar.attended_at
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
        WHERE ar.event_id = ?
    `;
    try {
        const [rows] = await db.query(query, [eventId]);
        return rows;
    } catch (error) {
        console.error('Error fetching attendance records by event:', error.stack);
        throw error;
    }
};
const db = require('../config/db');

const createEvent = async (eventData) => {
    const {
        title, description, location,
        start_date, start_time, end_date, end_time,
        event_poster, created_by_org_id, created_by_osws_id, status
    } = eventData;
    // Ensure dates are yyyy-MM-dd strings
    const normalizeDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        // Parse as local date if string is in ISO or similar format
        let dateObj;
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
            const [year, month, day] = d.split('T')[0].split('-').map(Number);
            dateObj = new Date(year, month - 1, day);
        } else {
            dateObj = new Date(d);
        }
        if (isNaN(dateObj.getTime())) return '';
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${dateObj.getFullYear()}-${month}-${day}`;
    };
    const startDateStr = normalizeDate(start_date);
    const endDateStr = normalizeDate(end_date);
    const query = `
        INSERT INTO created_events
        (title, description, location, start_date, start_time, end_date, end_time, event_poster, created_by_org_id, created_by_osws_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
        const [result] = await db.query(query, [
            title,
            description,
            location,
            startDateStr,
            start_time,
            endDateStr,
            end_time,
            event_poster,
            created_by_org_id && created_by_org_id !== 'undefined' && created_by_org_id !== '' ? created_by_org_id : null,
            created_by_osws_id && created_by_osws_id !== 'undefined' && created_by_osws_id !== '' ? created_by_osws_id : null,
            status || 'not yet started'
        ]);
        return result.insertId;
    } catch (error) {
        console.error('Error creating event:', error.stack);
        throw error;
    }
};

const getAllEvents = async () => {
    const query = `
        SELECT ce.*, org.department, org.org_name, osws.name AS osws_name
        FROM created_events ce
        LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
        WHERE ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('Error fetching all events:', error.stack);
        throw error;
    }
};

const getEventsByParticipant = async (student_id) => {
    const query = `
        SELECT ce.*, er.qr_code, 
               org.department, org.org_name,
               osws.name AS osws_name
        FROM created_events ce
        JOIN event_registrations er ON ce.event_id = er.event_id
        LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
        LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
        WHERE er.student_id = ? AND ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query, [student_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching participant events:', error.stack);
        throw error;
    }
};

const getEventsByCreator = async (creator_id) => {
    const query = `
        SELECT ce.*, org.department, org.org_name
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        WHERE ce.created_by_org_id = ? AND ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query, [creator_id]);
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
            ar.attended_at
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
    `;
    try {
        const [rows] = await db.query(query);
        return rows;
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
            ar.attended_at
        FROM attendance_records ar
        JOIN created_events ce ON ar.event_id = ce.event_id
        JOIN students s ON ar.student_id = s.id
        WHERE ce.created_by_org_id = ?
    `;
    try {
        const [rows] = await db.query(query, [orgId]);
        return rows;
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
                ar.attended_at
            FROM attendance_records ar
            JOIN created_events ce ON ar.event_id = ce.event_id
            JOIN students s ON ar.student_id = s.id
            WHERE ce.created_by_osws_id = ?
        `;
        try {
            const [rows] = await db.query(query, [adminId]);
            return rows;
        } catch (error) {
            console.error('Error fetching attendance records by OSWS admin:', error.stack);
            throw error;
        }
    };

// Soft delete: mark event as trashed
const deleteEvent = async (eventId, deletedBy) => {
    const query = `UPDATE created_events SET deleted_at = NOW(), deleted_by = ? WHERE event_id = ? AND deleted_at IS NULL`;
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
        SELECT ce.*, a.name AS admin_name
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id = ? AND ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query, [admin_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching events by admin:', error.stack);
        throw error;
    }
};

const getAllOrgEvents = async () => {
    const query = `
        SELECT ce.*, org.department, org.org_name
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        WHERE ce.created_by_org_id IS NOT NULL AND ce.deleted_at IS NULL
    `;
    try {
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('Error fetching org events:', error.stack);
        throw error;
    }
};

// Fetch all OSWS-created events
const getAllOswsEvents = async () => {
    const query = `
        SELECT ce.*, a.name AS admin_name
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id IS NOT NULL AND ce.deleted_at IS NULL
    `;
    const [rows] = await db.query(query);
    return rows;
};

const updateEvent = async (eventId, eventData) => {

    const {
        title,
        description,
        location,
        start_date,
        start_time,
        end_date,
        end_time,
        event_poster, // Optional: only update if provided
        status
    } = eventData;
    // Ensure dates are yyyy-MM-dd strings
    const normalizeDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '';
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${dateObj.getFullYear()}-${month}-${day}`;
    };
    const startDateStr = normalizeDate(start_date);
    const endDateStr = normalizeDate(end_date);

    let query = `
        UPDATE created_events
        SET title = ?, description = ?, location = ?, start_date = ?, start_time = ?, end_date = ?, end_time = ?, status = ?
    `;
    const params = [title, description, location, startDateStr, start_time, endDateStr, end_time, status];

    if (event_poster !== undefined) {
        if (event_poster === '') {
            query += `, event_poster = NULL`;
        } else {
            query += `, event_poster = ?`;
            params.push(event_poster);
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
  const [rows] = await db.query('SELECT * FROM created_events WHERE event_id = ?', [eventId]);
  return rows[0];
};

// Hard delete: remove event and dependent data
const hardDeleteEvent = async (eventId) => {
    const conn = await db.getConnection?.() || db; // supports pool or promise wrapper
    try {
        if (conn.beginTransaction) await conn.beginTransaction();

        // Delete attendance records referencing this event
        await conn.query('DELETE FROM attendance_records WHERE event_id = ?', [eventId]);

        // For backward-compat: if a legacy table `registration_details` exists, clean it up too.
        try {
            const [tbl] = await conn.query(
                "SELECT 1 AS exists_flag FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'registration_details'"
            );
            const hasRegistrationDetails = Array.isArray(tbl) && tbl.length > 0;
            if (hasRegistrationDetails) {
                await conn.query(
                    'DELETE rd FROM registration_details rd JOIN event_registrations er ON rd.registration_id = er.id WHERE er.event_id = ?',
                    [eventId]
                );
            }
        } catch (e) {
            // If information_schema is unavailable or any error occurs, skip optional cleanup silently.
        }

        // Delete registrations
        await conn.query('DELETE FROM event_registrations WHERE event_id = ?', [eventId]);
        // Delete certificates for this event
        await conn.query('DELETE FROM certificates WHERE event_id = ?', [eventId]);
        // Finally delete the event
        const [res] = await conn.query('DELETE FROM created_events WHERE event_id = ?', [eventId]);

        if (conn.commit) await conn.commit();
        return res.affectedRows > 0;
    } catch (error) {
        if (conn.rollback) await conn.rollback();
        console.error('Error hard-deleting event:', error.stack || error);
        throw error;
    } finally {
        if (conn.release) conn.release();
    }
};

// Trash listing and restore helpers
const getTrashedOrgEvents = async (orgId) => {
    const query = `
        SELECT ce.*, org.department, org.org_name
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        WHERE ce.created_by_org_id = ? AND ce.deleted_at IS NOT NULL
        ORDER BY ce.deleted_at DESC
    `;
    const [rows] = await db.query(query, [orgId]);
    return rows;
};

const getTrashedOswsEvents = async (adminId) => {
    const query = `
        SELECT ce.*, a.name AS admin_name
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id = ? AND ce.deleted_at IS NOT NULL
        ORDER BY ce.deleted_at DESC
    `;
    const [rows] = await db.query(query, [adminId]);
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
    // Stats: upcoming/ongoing/cancelled exclude trashed, concluded includes trashed
    getOrgDashboardStats: async (orgId) => {
        const nowQuery = 'NOW()';
        // Upcoming: start after now, not trashed
                const [up] = await db.query(
                        `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_org_id = ? AND deleted_at IS NULL
                             AND TIMESTAMP(start_date, start_time) > ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'concluded')`,
                        [orgId]
                );
                // Ongoing: now between start and end, not trashed, not concluded
                const [og] = await db.query(
                        `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_org_id = ? AND deleted_at IS NULL
                             AND TIMESTAMP(start_date, start_time) <= ${nowQuery}
                             AND TIMESTAMP(end_date, end_time) >= ${nowQuery}
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
                   OR TIMESTAMP(end_date, end_time) < ${nowQuery}
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
    getOswsDashboardStats: async () => {
        const nowQuery = 'NOW()';
                const [up] = await db.query(
                        `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
                             AND TIMESTAMP(start_date, start_time) > ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'concluded')`
                );
                const [og] = await db.query(
                        `SELECT COUNT(*) AS cnt FROM created_events
                         WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
                             AND TIMESTAMP(start_date, start_time) <= ${nowQuery}
                             AND TIMESTAMP(end_date, end_time) >= ${nowQuery}
                             AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'concluded')`
                );
        const [cc] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
             WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
               AND LOWER(COALESCE(status, '')) = 'cancelled'`
        );
        const [cm] = await db.query(
            `SELECT COUNT(*) AS cnt FROM created_events
             WHERE created_by_osws_id IS NOT NULL AND deleted_at IS NULL
               AND (
                   LOWER(COALESCE(status, '')) = 'concluded'
                   OR TIMESTAMP(end_date, end_time) < ${nowQuery}
               )`
        );
        return {
            upcoming: up[0]?.cnt || 0,
            ongoing: og[0]?.cnt || 0,
            cancelled: cc[0]?.cnt || 0,
            concluded: cm[0]?.cnt || 0,
        };
    },
    // Auto-start events whose start time has arrived
    /*
    // autoStartScheduledEvents: async () => {
    //     ...existing code...
    // },
    // autoCompleteFinishedEvents: async () => {
    //     ...existing code...
    // },
    // autoTrashConcludedEvents: async () => {
    //     ...existing code...
    // },
    */
    // Ensure reminders log table exists (idempotent)
    ensureEmailRemindersTable: async () => {
        const sql = `
            CREATE TABLE IF NOT EXISTS email_reminders (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                student_id VARCHAR(20) NOT NULL,
                reminder_key VARCHAR(64) NOT NULL,
                sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_reminder (event_id, student_id, reminder_key),
                KEY idx_event (event_id),
                KEY idx_student (student_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `;
        await db.query(sql);
    },
    // Fetch registrations whose event starts within leadMinutes from now and haven't received this reminder yet
    getUpcomingRegistrationsForReminder: async (leadMinutes) => {
        const reminderKey = `before_${parseInt(leadMinutes, 10)}m`;
        const query = `
            SELECT 
                er.event_id,
                er.student_id,
                s.email,
                s.first_name,
                s.last_name,
                er.qr_code,
                ce.title,
                ce.location,
                ce.start_date,
                ce.start_time,
                ce.end_date,
                ce.end_time
            FROM event_registrations er
            JOIN students s ON er.student_id = s.id
            JOIN created_events ce ON er.event_id = ce.event_id
            LEFT JOIN email_reminders r 
                ON r.event_id = er.event_id 
               AND r.student_id = er.student_id 
               AND r.reminder_key = ?
            WHERE ce.deleted_at IS NULL
              AND TIMESTAMP(ce.start_date, ce.start_time) > NOW()
              AND TIMESTAMP(ce.start_date, ce.start_time) <= (NOW() + INTERVAL ? MINUTE)
              AND r.id IS NULL
        `;
        const [rows] = await db.query(query, [reminderKey, parseInt(leadMinutes, 10)]);
        return rows;
    },
    markReminderSent: async ({ event_id, student_id, leadMinutes }) => {
        const reminderKey = `before_${parseInt(leadMinutes, 10)}m`;
        const sql = `INSERT IGNORE INTO email_reminders (event_id, student_id, reminder_key) VALUES (?, ?, ?)`;
        const [res] = await db.query(sql, [event_id, String(student_id), reminderKey]);
        return res.affectedRows > 0;
    }
};