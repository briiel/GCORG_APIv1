const eventModel = require('../models/eventModel');

const createNewEvent = async (eventData) => {
    try {
        const eventId = await eventModel.createEvent(eventData);
        return { id: eventId, ...eventData };
    } catch (error) {
        console.error('Error in event service:', error);
        throw error;
    }
};

const fetchAllEvents = async () => {
    try {
        const events = await eventModel.getAllEvents();
        return events;
    } catch (error) {
        console.error('Error fetching events in service:', error);
        throw error;
    }
};

const getEventsByParticipant = async (student_id) => {
    try {
        return await eventModel.getEventsByParticipant(student_id);
    } catch (error) {
        console.error('Error in event service:', error);
        throw error;
    }
};

const getEventsByCreator = async (creator_id) => {
    try {
        return await eventModel.getEventsByCreator(creator_id);
    } catch (error) {
        console.error('Error in event service:', error);
        throw error;
    }
};

const updateEventStatus = async (eventId, status) => {
    try {
        return await eventModel.updateEventStatus(eventId, status);
    } catch (error) {
        console.error('Error updating event status in service:', error);
        throw error;
    }
};

const getAllAttendanceRecords = async () => {
    try {
        return await eventModel.getAllAttendanceRecords();
    } catch (error) {
        console.error('Error fetching attendance records in service:', error);
        throw error;
    }
};

const getAttendanceRecordsByOrg = async (orgId) => {
    try {
        return await eventModel.getAttendanceRecordsByOrg(orgId);
    } catch (error) {
        console.error('Error fetching attendance records by org in service:', error);
        throw error;
    }
};

const deleteEvent = async (eventId) => {
    try {
        return await eventModel.deleteEvent(eventId);
    } catch (error) {
        console.error('Error deleting event in service:', error);
        throw error;
    }
};

module.exports = {
    createNewEvent,
    fetchAllEvents,
    getEventsByParticipant,
    getEventsByCreator,
    updateEventStatus,
    getAllAttendanceRecords,
    getAttendanceRecordsByOrg,
    deleteEvent,
};