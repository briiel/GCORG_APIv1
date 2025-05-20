const db = require('../config/db');

const createEvent = async (eventData) => {
    const { title, description, location, event_date, event_time, event_poster, created_by_org_id, status } = eventData;
    const query = `
        INSERT INTO created_events (title, description, location, event_date, event_time, event_poster, created_by_org_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
        const [result] = await db.query(query, [title, description, location, event_date, event_time, event_poster, created_by_org_id, status || 'not yet started']);
        return result.insertId; // Return the ID of the newly created event
    } catch (error) {
        console.error('Error creating event:', error.stack);
        throw error;
    }
};

const getAllEvents = async () => {
    try {
        const [rows] = await db.query('SELECT * FROM created_events');
        return rows;
    } catch (error) {
        console.error('Error fetching events:', error.stack);
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
        SELECT * FROM created_events WHERE created_by_org_id = ?
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

module.exports = { 
    createEvent, 
    getAllEvents, 
    getEventsByParticipant, 
    getEventsByCreator,
    updateEventStatus 
};