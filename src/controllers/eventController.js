const eventService = require('../services/eventService');
const { registerParticipant } = require('../services/registrationService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');
const db = require('../config/db'); 
const { generateCertificate, generateCertificatePreview } = require('../utils/certificateGenerator');
const path = require('path');
const fs = require('fs');
const { uploadPdfToCloudinary } = require('../utils/cloudinaryHelper');

exports.createEvent = async (req, res) => {
    try {
        const eventData = req.body;
        if (req.file) {
            eventData.event_poster = req.file.path; // Cloudinary URL
        }
        eventData.status = eventData.status || 'not yet started';

        // Debug: log the eventData
        console.log('Event Data Received:', eventData);

        // Create the event
        const newEventId = await eventService.createNewEvent(eventData);

        return handleSuccessResponse(res, { eventId: newEventId }, 201);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEvents = async (req, res) => {
    try {
        let events = await eventService.fetchAllEvents();
        const now = new Date();
        events = events.map(event => {
            // Combine start_date and start_time for comparison
            const eventStart = new Date(`${event.start_date}T${event.start_time}`);
            const eventEnd = new Date(`${event.end_date}T${event.end_time}`);
            if (event.status === 'cancelled') return event;
            if (eventStart > now) event.status = 'not yet started';
            else if (eventStart <= now && eventEnd >= now) event.status = 'ongoing';
            else if (eventEnd < now) event.status = 'completed';
            return event;
        });
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => ({
            ...event,
            event_poster: event.event_poster || null,
            department: event.department
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
            proof_of_payment
            // Remove: first_name, last_name, suffix, domain_email, department, program
        } = req.body;

        const result = await registerParticipant({
            event_id,
            student_id,
            proof_of_payment
            // Remove: first_name, last_name, suffix, domain_email, department, program
        });

        return handleSuccessResponse(res, result, 201);
    } catch (error) {
        if (error.message === 'You have already registered for this event.') {
            return res.status(409).json({ success: false, message: error.message });
        }
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
                ? (event.qr_code.startsWith('http') ? event.qr_code : `${host}/uploads/qrcodes/${event.qr_code}`)
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
                : null,
            department: event.department // Now included from the join
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

        if (status === 'completed') {
            const [attendees] = await db.query(
                `SELECT ar.student_id, 
                       CONCAT(s.first_name, ' ', s.last_name, IF(s.suffix IS NOT NULL AND s.suffix != '', CONCAT(' ', s.suffix), '')) AS student_name, 
                       s.email, 
                       ce.title AS event_title,
                       ce.start_date,
                       ce.end_date
                 FROM attendance_records ar
                 JOIN students s ON ar.student_id = s.id
                 JOIN created_events ce ON ar.event_id = ce.event_id
                 WHERE ar.event_id = ?`,
                [id]
            );

            const certDir = path.join(__dirname, '../../uploads/certificates');
            if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

            for (const attendee of attendees) {
                const certFilename = `certificate_${id}_${attendee.student_id}`;
                const certPath = path.join(certDir, certFilename + '.pdf');

                await generateCertificate({
                    studentName: attendee.student_name,
                    eventTitle: attendee.event_title,
                    eventStartDate: attendee.start_date,
                    eventEndDate: attendee.end_date,
                    certificatePath: certPath
                });

                // Upload to Cloudinary
                const certUrl = await uploadPdfToCloudinary(certPath, certFilename);

                await db.query(
                    `INSERT INTO certificates (student_id, event_id, certificate_url)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE certificate_url = VALUES(certificate_url)`,
                    [attendee.student_id, id, certUrl]
                );
            }
        }

        return handleSuccessResponse(res, { message: 'Event status updated successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.markAttendance = async (req, res) => {
    try {
        const { registration_id, event_id, student_id } = req.body;
        const scanned_by_org_id = req.user && req.user.id;

        if (!registration_id || !event_id || !student_id || !scanned_by_org_id) {
            return handleErrorResponse(res, 'Missing required fields', 400);
        }

        // Verify registration exists
        const [reg] = await db.query(
            'SELECT * FROM event_registrations WHERE id = ? AND event_id = ? AND student_id = ?',
            [registration_id, event_id, student_id]
        );
        if (reg.length === 0) {
            return handleErrorResponse(res, 'Registration not found', 404);
        }

        // Check if already attended
        const [existing] = await db.query(
            'SELECT * FROM attendance_records WHERE event_id = ? AND student_id = ?',
            [event_id, student_id]
        );
        if (existing.length > 0) {
            return handleErrorResponse(res, 'Attendance already recorded', 409);
        }

        // Insert attendance record
        await db.query(
            'INSERT INTO attendance_records (event_id, student_id, attended_at, scanned_by_org_id) VALUES (?, ?, NOW(), ?)',
            [event_id, student_id, scanned_by_org_id]
        );

        return handleSuccessResponse(res, { message: 'Attendance recorded' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAllAttendanceRecords = async (req, res) => {
    try {
        const orgId = req.user && req.user.id;
        if (!orgId) {
            return handleErrorResponse(res, 'Unauthorized', 401);
        }
        const records = await eventService.getAttendanceRecordsByOrg(orgId);
        return handleSuccessResponse(res, records);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        await eventService.deleteEvent(id);
        return handleSuccessResponse(res, { message: 'Event deleted successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getCertificatesByStudent = async (req, res) => {
    try {
        const { student_id } = req.query;
        if (!student_id) return res.status(400).json({ success: false, message: 'student_id required' });

        const [certs] = await db.query(
            `SELECT c.*, ce.title AS event_title, ce.start_date, ce.end_date, ce.start_time, ce.end_time, s.first_name, s.last_name, s.middle_initial, s.suffix, s.department, s.program
             FROM certificates c
             JOIN created_events ce ON c.event_id = ce.event_id
             JOIN students s ON c.student_id = s.id
             WHERE c.student_id = ?`,
            [student_id]
        );
        res.json({ success: true, data: certs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEventsByAdmin = async (req, res) => {
    try {
        const { admin_id } = req.params;
        const events = await eventService.getEventsByAdmin(admin_id);
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => ({
            ...event,
            event_poster: event.event_poster
                ? `${host}/${event.event_poster.replace(/\\/g, '/')}`
                : null,
            department: event.department
        }));
        return handleSuccessResponse(res, eventsWithPosterUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAllOrgEvents = async (req, res) => {
    try {
        const events = await eventService.getAllOrgEvents();
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => ({
            ...event,
            event_poster: event.event_poster
                ? `${host}/${event.event_poster.replace(/\\/g, '/')}`
                : null,
            department: event.department
        }));
        return res.status(200).json({ success: true, data: eventsWithPosterUrl });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllOswsEvents = async (req, res) => {
    try {
        const events = await eventService.getAllOswsEvents();
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => ({
            ...event,
            event_poster: event.event_poster
                ? `${host}/${event.event_poster.replace(/\\/g, '/')}`
                : null,
            department: event.department
        }));
        return handleSuccessResponse(res, eventsWithPosterUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventParticipants = async (req, res) => {
  try {
    const { event_id } = req.params;
    const [rows] = await db.query(
      `SELECT 
         er.student_id, 
         s.first_name, 
         s.last_name, 
         s.suffix, 
         s.department, 
         s.program
       FROM event_registrations er
       JOIN students s ON er.student_id = s.id
       WHERE er.event_id = ?`,
      [event_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getEventParticipants error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAttendanceRecords = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         ar.event_id,
         e.title AS event_title,
         ar.student_id,
         s.first_name,
         s.last_name,
         s.suffix,
         s.department,
         s.program
       FROM attendance_records ar
       JOIN events e ON ar.event_id = e.event_id
       JOIN students s ON ar.student_id = s.id`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getAttendanceRecords error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const eventData = req.body;
        if (req.file) {
            eventData.event_poster = req.file.path; // Cloudinary URL
        }
        await eventService.updateEvent(id, eventData);
        return handleSuccessResponse(res, { message: 'Event updated successfully' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventById = async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};