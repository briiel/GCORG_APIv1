const db = require('../config/db');

const createEvent = async (eventData) => {
    const {
        title, description, location,
        start_date, start_time, end_date, end_time,
        event_poster, created_by_org_id, created_by_osws_id, status
    } = eventData;
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
            start_date,
            start_time,
            end_date,
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
        SELECT ce.*, org.department, org.org_name
        FROM created_events ce
        LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
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
        SELECT ce.*, er.qr_code
        FROM created_events ce
        JOIN event_registrations er ON ce.event_id = er.event_id
        WHERE er.student_id = ?
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
        SELECT ce.*, org.department
        FROM created_events ce
        JOIN student_organizations org ON ce.created_by_org_id = org.id
        WHERE ce.created_by_org_id = ?
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

const deleteEvent = async (eventId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Delete attendance records linked to this event
        await conn.query('DELETE FROM attendance_records WHERE event_id = ?', [eventId]);

        // Delete event registrations
        await conn.query('DELETE FROM event_registrations WHERE event_id = ?', [eventId]);
        // Delete certificates if you have them
        await conn.query('DELETE FROM certificates WHERE event_id = ?', [eventId]);
        // Finally, delete the event
        await conn.query('DELETE FROM created_events WHERE event_id = ?', [eventId]);

        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        console.error('Error deleting event:', error.stack);
        throw error;
    } finally {
        conn.release();
    }
};

const getEventsByAdmin = async (admin_id) => {
    const query = `
        SELECT ce.*, a.name AS admin_name
        FROM created_events ce
        JOIN osws_admins a ON ce.created_by_osws_id = a.id
        WHERE ce.created_by_osws_id = ?
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
        WHERE ce.created_by_org_id IS NOT NULL
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
        WHERE ce.created_by_osws_id IS NOT NULL
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
        event_poster // Optional: only update if provided
    } = eventData;

    let query = `
        UPDATE created_events
        SET title = ?, description = ?, location = ?, start_date = ?, start_time = ?, end_date = ?, end_time = ?
    `;
    const params = [title, description, location, start_date, start_time, end_date, end_time];

    if (event_poster) {
        query += `, event_poster = ?`;
        params.push(event_poster);
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

module.exports = { 
    createEvent, 
    getAllEvents, 
    getEventsByParticipant, 
    getEventsByCreator,
    updateEventStatus,
    getAllAttendanceRecords,
    getAttendanceRecordsByOrg,
    deleteEvent,
    getEventsByAdmin,
    getAllOrgEvents,
    getAllOswsEvents,
    updateEvent,
    getEventById
};