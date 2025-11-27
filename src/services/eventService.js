// Trash (soft-delete) multiple events
const trashMultipleEvents = async (eventIds, deletedBy) => {
    if (!Array.isArray(eventIds) || eventIds.length === 0) return 0;
    // You may want to add permission checks here
    let trashed = 0;
    for (const id of eventIds) {
        try {
            const ok = await eventModel.deleteEvent(id, deletedBy);
            if (ok) trashed++;
        } catch (e) {
            // Optionally log error for each failed event
        }
    }
    return trashed;
};
// Get attendance records for a specific event
const getAttendanceRecordsByEvent = async (eventId) => {
    return await eventModel.getAttendanceRecordsByEvent(eventId);
};

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

const getAttendanceRecordsByStudent = async (studentId) => {
    try {
        return await eventModel.getAttendanceRecordsByStudent(studentId);
    } catch (error) {
        console.error('Error fetching attendance records by student in service:', error);
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

const getAttendanceRecordsByOsws = async (adminId) => {
    try {
        return await eventModel.getAttendanceRecordsByOsws(adminId);
    } catch (error) {
        console.error('Error fetching attendance records by OSWS in service:', error);
        throw error;
    }
};

const deleteEvent = async (eventId, deletedBy) => {
    try {
        return await eventModel.deleteEvent(eventId, deletedBy);
    } catch (error) {
        console.error('Error deleting event in service:', error);
        throw error;
    }
};

const getEventsByAdmin = async (admin_id) => {
    try {
        return await eventModel.getEventsByAdmin(admin_id);
    } catch (error) {
        console.error('Error in event service:', error);
        throw error;
    }
};

const getAllOrgEvents = async () => {
    return await eventModel.getAllOrgEvents();
};

const getAllOswsEvents = async () => {
    return await eventModel.getAllOswsEvents();
};

const updateEvent = async (eventId, eventData) => {
    try {
        return await eventModel.updateEvent(eventId, eventData);
    } catch (error) {
        console.error('Error updating event in service:', error);
        throw error;
    }
};

const getEventById = async (eventId) => {
  return await eventModel.getEventById(eventId);
};

// Aggregate stats for organization dashboard:
// - upcoming/ongoing/cancelled exclude trashed
// - concluded includes both non-trashed and trashed events for the org
const getOrgDashboardStats = async (orgId) => {
    return await eventModel.getOrgDashboardStats(orgId);
};

// Aggregate stats for OSWS dashboard (OSWS-created events only)
// - upcoming/ongoing/cancelled exclude trashed
// - concluded includes both non-trashed and trashed events
const getOswsDashboardStats = async () => {
    return await eventModel.getOswsDashboardStats();
};

// Provide aggregated chart datasets for OSWS dashboard
const getOswsDashboardCharts = async (filter) => {
    try {
        return await eventModel.getOswsDashboardCharts(filter);
    } catch (err) {
        console.error('Error fetching OSWS dashboard charts in service:', err);
        throw err;
    }
};

module.exports = {
    createNewEvent,
    fetchAllEvents,
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
    getOrgDashboardStats,
    getOswsDashboardStats,
    getOswsDashboardCharts,
    getTrashedOrgEvents: eventModel.getTrashedOrgEvents,
    getTrashedOswsEvents: eventModel.getTrashedOswsEvents,
    restoreEvent: eventModel.restoreEvent,
    autoUpdateEventStatuses: eventModel.autoUpdateEventStatuses,
    // autoStartScheduledEvents: eventModel.autoStartScheduledEvents,
    // autoCompleteFinishedEvents: eventModel.autoCompleteFinishedEvents,
    // autoTrashConcludedEvents: eventModel.autoTrashConcludedEvents, // fully commented out
    // Email reminder functionality removed
    permanentDeleteEvent: async ({ eventId, user }) => {
        // Fetch event and check ownership and trashed state
        const ev = await eventModel.getEventById(eventId);
        if (!ev) return { deleted: false, code: 404, message: 'Event not found' };
        if (!ev.deleted_at) return { deleted: false, code: 400, message: 'Event is not in trash' };
        // Allow org officers (orgofficer) and OSWS admins (oswsadmin) to manage their own events
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        const orgId = user.organization ? user.organization.org_id : null;
        const adminId = user.legacyId || null;
        
        if (userRoles.includes('orgofficer') && ev.created_by_org_id !== orgId) {
            return { deleted: false, code: 403, message: 'Forbidden' };
        }
        if (userRoles.includes('oswsadmin') && ev.created_by_osws_id !== adminId) {
            return { deleted: false, code: 403, message: 'Forbidden' };
        }
        const ok = await eventModel.hardDeleteEvent(eventId);
        return { deleted: ok };
    },
    trashMultipleEvents
};