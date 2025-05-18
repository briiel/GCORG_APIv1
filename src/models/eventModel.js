const db = require('../config/db');

const createEvent = async (eventData) => {
    const { title, description, location, event_date, event_time, event_poster } = eventData;
    const query = `
        INSERT INTO created_events (title, description, location, event_date, event_time, event_poster)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    try {
        const [result] = await db.query(query, [title, description, location, event_date, event_time, event_poster]);
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

module.exports = { createEvent, getAllEvents };