const eventService = require('../services/eventService');
const { registerParticipant } = require('../services/registrationService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

exports.createEvent = async (req, res) => {
    try {
        const eventData = req.body;
        if (req.file) {
            eventData.event_poster = req.file.path;
        }
        // Default status if not provided
        eventData.status = eventData.status || 'not yet started';
        const newEvent = await eventService.createNewEvent(eventData);
        return handleSuccessResponse(res, newEvent, 201);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEvents = async (req, res) => {
    try {
        let events = await eventService.fetchAllEvents();
        const now = new Date();
        events = events.map(event => {
            const eventDate = new Date(event.event_date + 'T' + event.event_time);
            if (event.status === 'cancelled') return event;
            if (eventDate > now) event.status = 'not yet started';
            else if (eventDate.toDateString() === now.toDateString()) event.status = 'ongoing';
            else if (eventDate < now) event.status = 'completed';
            return event;
        });
        // Map event_poster to a full URL if it exists
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => ({
            ...event,
            event_poster: event.event_poster
                ? `${host}/${event.event_poster.replace(/\\/g, '/')}`
                : null
        }));
        return handleSuccessResponse(res, eventsWithPosterUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.registerParticipant = async (req, res) => {
    try {
        const {
            event_id,
            student_id,
            proof_of_payment,
            first_name,
            last_name,
            suffix,
            domain_email,
            department,
            program
        } = req.body;

        const result = await registerParticipant({
            event_id,
            student_id,
            proof_of_payment,
            first_name,
            last_name,
            suffix,
            domain_email,
            department,
            program
        });

        return handleSuccessResponse(res, result, 201);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventsByParticipant = async (req, res) => {
    try {
        const { student_id } = req.params;
        const events = await eventService.getEventsByParticipant(student_id);

        // Add full QR code URL
        const host = req.protocol + '://' + req.get('host');
        const eventsWithQrUrl = events.map(event => ({
            ...event,
            qr_code: event.qr_code
                ? `${host}/uploads/qrcodes/${event.qr_code}`
                : null
        }));

        return handleSuccessResponse(res, eventsWithQrUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventsByCreator = async (req, res) => {
    try {
        const { creator_id } = req.params;
        const events = await eventService.getEventsByCreator(creator_id);
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => ({
            ...event,
            event_poster: event.event_poster
                ? `${host}/${event.event_poster.replace(/\\/g, '/')}`
                : null
        }));
        return handleSuccessResponse(res, eventsWithPosterUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.updateEventStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            return handleErrorResponse(res, 'Status is required', 400);
        }
        await eventService.updateEventStatus(id, status);
        return handleSuccessResponse(res, { message: 'Event status updated successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};