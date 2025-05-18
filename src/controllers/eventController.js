const eventService = require('../services/eventService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

exports.createEvent = async (req, res) => {
    try {
        const eventData = req.body;
        const newEvent = await eventService.createNewEvent(eventData);
        return handleSuccessResponse(res, newEvent, 201);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEvents = async (req, res) => {
    try {
        const events = await eventService.fetchAllEvents();
        return handleSuccessResponse(res, events);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};