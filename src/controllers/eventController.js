// Event Controller — CRUD, attendance, QR scanning, certificates, and dashboard stats

const eventService = require('../services/eventService');
const { registerParticipant } = require('../services/registrationService');
const certificateRequestService = require('../services/certificateRequestService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');
const db = require('../config/db');
const { generateCertificate, generateCertificatePreview } = require('../utils/certificateGenerator');
const { parseMysqlLocalStringToDate, parseMysqlUtcStringToDate } = require('../utils/dbDate');
const EVENT_TZ_OFFSET = process.env.EVENT_TZ_OFFSET || '+08:00';
const notificationService = require('../services/notificationService');
const { v2: cloudinary } = require('cloudinary');
const { upload, convertToWebpAndUpload } = require('../middleware/uploadMiddleware');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Shared helper — computes the time-based auto status for an event row.
// Returns 'not yet started' | 'ongoing' | 'concluded' | null (null = no change / cancelled).
const computeAutoStatus = (ev) => {
    const statusStr = (ev.status || '').toString().toLowerCase();
    if (statusStr === 'cancelled') return null; // never auto-override cancelled
    const sd = ev.start_date ? parseMysqlLocalStringToDate(`${ev.start_date} ${ev.start_time || '00:00:00'}`, EVENT_TZ_OFFSET) : null;
    const ed = ev.end_date ? parseMysqlLocalStringToDate(`${ev.end_date} ${ev.end_time || '23:59:59'}`, EVENT_TZ_OFFSET) : null;
    if (!sd) return null;
    const start = sd;
    const now = new Date();
    const end = ed && !isNaN(ed.getTime()) ? ed : parseMysqlLocalStringToDate(`${ev.start_date} ${ev.end_time || '23:59:59'}`, EVENT_TZ_OFFSET);
    if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime())) return null;
    if (now < start) return 'not yet started';
    if (now >= start && now <= end) return 'ongoing';
    if (now > end) return 'concluded';
    return null;
};

// Soft-delete multiple events
exports.trashMultipleEvents = async (req, res) => {
    try {
        const user = req.user;
        const { eventIds } = req.body;
        if (!Array.isArray(eventIds) || eventIds.length === 0) {
            return handleErrorResponse(res, 'eventIds (array) required', 400);
        }
        const result = await eventService.trashMultipleEvents(eventIds, user);
        if (result?.code === 403) {
            return handleErrorResponse(res, result.message, 403);
        }

        const hasUnauthorized = Array.isArray(result?.unauthorized) && result.unauthorized.length > 0;
        const hasSkipped = Array.isArray(result?.skipped) && result.skipped.length > 0;

        const message = hasUnauthorized || hasSkipped
            ? 'Events partially moved to trash'
            : 'Events moved to trash';

        return handleSuccessResponse(res, {
            message,
            result
        });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};
// Get attendance records for a specific event
exports.getAttendanceRecordsByEvent = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return handleErrorResponse(res, 'Unauthorized', 401);
        }
        const eventId = req.params.eventId;
        if (!eventId) {
            return handleErrorResponse(res, 'Event ID is required', 400);
        }
        const records = await eventService.getAttendanceRecordsByEvent(eventId);
        return handleSuccessResponse(res, { items: records });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

cloudinary.config({
    secure: true
});

const uploadCertificateToCloudinary = async (tempCertPath, eventId, studentId) => {
    const cloudinaryPublicId = `certificate_${eventId}_${studentId}`;

    const uploadResult = await cloudinary.uploader.upload(tempCertPath, {
        resource_type: 'image',
        public_id: cloudinaryPublicId,
        folder: 'certificates',
        format: 'png',
        quality: 'auto:best',
        access_mode: 'public'
    });

    return uploadResult;
};

exports.createEvent = async (req, res) => {
    try {
        const eventData = req.body;
        if (req.file) {
            eventData.event_poster = req.file.cloudinaryUrl;
            eventData.event_poster_public_id = req.file.cloudinaryPublicId;
        }
        eventData.status = eventData.status || 'not yet started';

        // Set created_by_student_id only for students/officers — OSWS admins are not in the students table
        try {
            const user = req.user;
            if (user) {
                const roles = user.roles || [];
                const isOswsAdmin = roles.includes('oswsadmin');
                eventData.created_by_student_id = isOswsAdmin ? null : (user.studentId || user.legacyId || null);
            }
        } catch (ignore) { }

        // Normalize is_paid and registration_fee values
        if (eventData.is_paid !== undefined) {
            const v = eventData.is_paid;
            const s = typeof v === 'string' ? v.toLowerCase() : v;
            eventData.is_paid = (s === true || s === 1 || s === '1' || s === 'true' || s === 'paid' || s === 'yes') ? 1 : 0;
        }
        if (eventData.registration_fee !== undefined) {
            const n = parseFloat(eventData.registration_fee);
            eventData.registration_fee = isNaN(n) || n < 0 ? 0 : Number(n.toFixed(2));
        }

        // Service returns numeric id or { id, ...eventData }
        const created = await eventService.createNewEvent(eventData);
        const newEventId = (created && typeof created === 'object' && 'id' in created)
            ? created.id
            : created;

        return handleSuccessResponse(res, { eventId: newEventId }, 201);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEvents = async (req, res) => {
    try {
        const page = (req.body?.page || req.query.page) ? parseInt(req.body?.page || req.query.page, 10) : undefined;
        const per_page = (req.body?.per_page || req.query.per_page) ? parseInt(req.body?.per_page || req.query.per_page, 10) : undefined;
        let eventsResult = await eventService.fetchAllEvents({ page, per_page });
        let events = eventsResult && eventsResult.items ? eventsResult.items : eventsResult;

        events = events.map(event => {
            const auto_status = computeAutoStatus(event);
            const curr = (event.status || '').toString().toLowerCase();
            const auto_mismatch = !!(auto_status && auto_status !== curr);
            return {
                ...event,
                auto_status,
                auto_mismatch,
                event_poster: event.event_poster?.startsWith('http')
                    ? event.event_poster
                    : null,
                department: event.department
            };
        });

        if (eventsResult && eventsResult.items) {
            return handleSuccessResponse(res, { items: events, total: eventsResult.total, page: eventsResult.page, per_page: eventsResult.per_page, total_pages: eventsResult.total_pages });
        }

        return handleSuccessResponse(res, { items: events });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.registerParticipant = [
    upload.single('proof_of_payment'),
    convertToWebpAndUpload,

    async (req, res) => {
        try {
            const {
                event_id,
                student_id: bodyStudentId
            } = req.body;

            // Prefer body student_id, fall back to authenticated user
            const student_id = bodyStudentId || req.user?.studentId || req.user?.student_id || req.user?.id || req.user?.userId;
            if (!student_id) {
                return handleErrorResponse(res, 'student_id is required', 400);
            }

            // Require proof of payment for paid events
            try {
                const ev = await eventService.getEventById(event_id);
                const isPaid = !!(ev && (ev.is_paid === 1 || ev.is_paid === true));
                if (isPaid && !req.file) {
                    return handleErrorResponse(res, 'Proof of payment is required for paid events.', 400);
                }
            } catch (e) { }

            // Get proof of payment URL from uploaded file
            const proof_of_payment = req.file ? req.file.cloudinaryUrl : null;
            const proof_of_payment_public_id = req.file ? req.file.cloudinaryPublicId : null;

            const result = await registerParticipant({
                event_id,
                student_id,
                proof_of_payment,
                proof_of_payment_public_id
            });

            return handleSuccessResponse(res, result, 201);
        } catch (error) {
            if (error.message === 'You have already registered for this event.') {
                return handleErrorResponse(res, error.message, 409);
            }
            console.error('Registration error:', error && error.message ? error.message : error);
            return handleErrorResponse(res, error.message);
        }
    }
];

exports.getEventsByParticipant = async (req, res) => {
    try {
        const { student_id } = req.params;
        const events = await eventService.getEventsByParticipant(student_id);

        const eventsWithQrUrl = events.map(event => ({
            ...event,
            qr_code: event.qr_code?.startsWith('http') ? event.qr_code : null,
            registration_status: event.registration_status || 'approved'
        }));

        return handleSuccessResponse(res, { items: eventsWithQrUrl });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Get attended events for a student — students can only view their own history
exports.getAttendedEventsByStudent = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;
        if (!student_id) return handleErrorResponse(res, 'student_id is required', 400);

        const roles = user?.roles || [];
        const isStudent = roles.includes('student');
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');

        if (isStudent && !isOrgOfficer && !isAdmin && String(user.studentId) !== String(student_id)) {
            return handleErrorResponse(res, 'Forbidden: You can only view your own attendance history', 403);
        }

        const events = await eventService.getAttendanceRecordsByStudent(student_id);

        // Normalize relative poster URLs
        const host = req.protocol + '://' + req.get('host');
        const data = events.map(ev => ({
            ...ev,
            event_poster: ev.event_poster && ev.event_poster.startsWith('http')
                ? ev.event_poster
                : (ev.event_poster ? `${host}/${String(ev.event_poster).replace(/\\/g, '/')}` : null)
        }));
        return handleSuccessResponse(res, { items: data });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventsByCreator = async (req, res) => {
    try {
        const { creator_id } = req.params;
        const events = await eventService.getEventsByCreator(creator_id);
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => {
            const poster = event.event_poster;
            const normalizedPoster = poster
                ? (poster.startsWith('http')
                    ? poster
                    : `${host}/${poster.replace(/\\/g, '/')}`)
                : null;
            const auto_status = computeAutoStatus(event);
            const curr = (event.status || '').toString().toLowerCase();
            const auto_mismatch = !!(auto_status && auto_status !== curr);
            return {
                ...event,
                event_poster: normalizedPoster,
                department: event.department,
                auto_status,
                auto_mismatch
            };
        });
        return handleSuccessResponse(res, { items: eventsWithPosterUrl });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.updateEventStatus = async (req, res) => {
    try {

        const { id } = req.params;
        let { status } = req.body;
        const user = req.user;

        if (!status) {
            return handleErrorResponse(res, 'Status is required', 400);
        }

        // Normalize status to lowercase and trimmed
        status = status.toString().trim().toLowerCase();

        // Load event details
        const ev = await eventService.getEventById(id);
        if (!ev || ev.deleted_at) return handleErrorResponse(res, 'Event not found', 404);
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');
        const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
        const adminId = isAdmin ? user.legacyId : null;

        if (isOrgOfficer && ev.created_by_org_id !== orgId) return handleErrorResponse(res, 'Forbidden', 403);

        // Compute current auto status — 'cancelled' is never auto-overridden
        const autoStatus = computeAutoStatus(ev);

        // Only allow 'cancelled' or syncing to the computed auto-status when it hasn't been applied yet
        const desired = status;
        const current = (ev.status || '').toString().toLowerCase();
        const desiredLower = desired.toString().toLowerCase();
        const allowed = desiredLower === 'cancelled' || (autoStatus && desiredLower === autoStatus && desiredLower !== current);
        if (!allowed) {
            return handleErrorResponse(res, 'Manual status change not allowed. Only permitted when automatic status did not update (or to cancel).', 403);
        }

        await eventService.updateEventStatus(id, status);

        if (status === 'concluded') {
            // Certificates are auto-generated only for OSWS-created events
            const event = await eventService.getEventById(id);
            const isOswsCreated = event && event.created_by_osws_id;
            if (!isOswsCreated) {
                return handleSuccessResponse(res, { message: 'Event concluded (certificates are only released for OSWS-created events).' });
            }
            const [attendees] = await db.query(
                `SELECT ar.student_id,
                        CONCAT(
                            s.first_name,
                            IF(s.middle_initial IS NOT NULL AND s.middle_initial != '', CONCAT(' ', s.middle_initial, '.'), ''),
                            ' ',
                            s.last_name,
                            IF(s.suffix IS NOT NULL AND s.suffix != '', CONCAT(' ', s.suffix), '')
                        ) AS student_name,
                        s.email,
                        ce.title AS event_title,
                       COALESCE(ce.room, ce.location) AS event_location,
                       ce.start_date,
                       ce.end_date
                 FROM attendance_records ar
                 JOIN students s ON ar.student_id = s.id
                 JOIN created_events ce ON ar.event_id = ce.event_id
                 WHERE ar.event_id = ?`,
                [id]
            );

            // Generate and upload certificates for each attendee
            for (const attendee of attendees) {
                try {
                    const tempDir = os.tmpdir();
                    const certFilename = `certificate_${id}_${attendee.student_id}.png`;
                    const tempCertPath = path.join(tempDir, certFilename);

                    await generateCertificate({
                        studentName: attendee.student_name,
                        eventTitle: attendee.event_title,
                        eventLocation: attendee.event_location,
                        eventStartDate: attendee.start_date,
                        eventEndDate: attendee.end_date,
                        certificatePath: tempCertPath
                    });

                    const uploadResult = await uploadCertificateToCloudinary(tempCertPath, id, attendee.student_id);

                    await db.query(
                        `INSERT INTO certificates (student_id, event_id, certificate_url, certificate_public_id)
                         VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                         certificate_url = VALUES(certificate_url),
                         certificate_public_id = VALUES(certificate_public_id)`,
                        [attendee.student_id, id, uploadResult.secure_url, uploadResult.public_id]
                    );

                    // Clean up temp file
                    try {
                        if (fs.existsSync(tempCertPath)) fs.unlinkSync(tempCertPath);
                    } catch (cleanupError) {
                        console.warn(`Failed to cleanup temp file: ${tempCertPath}`, cleanupError);
                    }

                } catch (certError) {
                    console.error(`Failed to generate/upload certificate for student ${attendee.student_id}:`, certError);
                }
            }
        }

        return handleSuccessResponse(res, { message: 'Event status updated successfully' });
    } catch (error) {
        console.error('Error updating event status:', error);
        return handleErrorResponse(res, error.message);
    }
};

exports.markAttendance = async (req, res) => {
    try {
        let { registration_id, event_id, student_id, mode } = req.body;
        // Location fields expected from frontend for server-side enforcement
        const user_lat = req.body.user_lat !== undefined ? parseFloat(req.body.user_lat) : null;
        const user_lon = req.body.user_lon !== undefined ? parseFloat(req.body.user_lon) : null;
        const user_accuracy = req.body.user_accuracy !== undefined ? parseFloat(req.body.user_accuracy) : null;
        const location_consent = req.body.location_consent === true || req.body.location_consent === 'true' || req.body.location_consent === 1 || req.body.location_consent === '1';

        // Geofence radius and accuracy threshold (configurable via env)
        const GEOFENCE_METERS = process.env.GEOFENCE_METERS ? Number(process.env.GEOFENCE_METERS) : 200;
        const ACCURACY_THRESHOLD_METERS = process.env.ACCURACY_THRESHOLD_METERS ? Number(process.env.ACCURACY_THRESHOLD_METERS) : 100;
        const user = req.user;

        if (!student_id || !user) {
            return handleErrorResponse(res, 'Missing required fields', 400);
        }

        // Enforce location consent and presence of coordinates
        if (!location_consent) {
            return handleErrorResponse(res, 'Location consent required to record attendance.', 400);
        }
        if (user_lat === null || user_lon === null || Number.isNaN(user_lat) || Number.isNaN(user_lon)) {
            return handleErrorResponse(res, 'Location coordinates required', 400);
        }
        // Enforce accuracy threshold
        if (user_accuracy !== null && !Number.isNaN(user_accuracy) && user_accuracy > ACCURACY_THRESHOLD_METERS) {
            return handleErrorResponse(res, `Location accuracy too low (${Math.round(user_accuracy)} m). Use a GPS-capable device.`, 400);
        }

        // Haversine formula for distance between two GPS coordinates
        const toRad = v => (v * Math.PI) / 180;
        const haversineMeters = (aLat, aLon, bLat, bLon) => {
            const R = 6371000;
            const dLat = toRad(bLat - aLat);
            const dLon = toRad(bLon - aLon);
            const lat1 = toRad(aLat);
            const lat2 = toRad(bLat);
            const sinDlat = Math.sin(dLat / 2);
            const sinDlon = Math.sin(dLon / 2);
            const aa = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
            const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
            return R * c;
        };

        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');

        // Only org officers and OSWS admins can mark attendance
        if (!isOrgOfficer && !isAdmin) {
            return handleErrorResponse(res, 'Forbidden: Only organization officers and admins can mark attendance', 403);
        }

        const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
        const adminId = isAdmin ? user.legacyId : null;

        // Resolve registration/event pairing when one or both IDs are missing
        if (!registration_id && !event_id) {
            let query;
            let params;
            if (isOrgOfficer) {
                query = `SELECT er.id AS registration_id, er.event_id
                         FROM event_registrations er
                         JOIN created_events ce ON er.event_id = ce.event_id
                         WHERE er.student_id = ? AND ce.created_by_org_id = ?
                         ORDER BY 
                             CASE 
                                 WHEN (
                                     (ce.start_date < CURDATE() OR (ce.start_date = CURDATE() AND ce.start_time <= CURTIME()))
                                     AND (ce.end_date > CURDATE() OR (ce.end_date = CURDATE() AND ce.end_time >= CURTIME()))
                                 ) THEN 0
                                 WHEN (ce.start_date > CURDATE() OR (ce.start_date = CURDATE() AND ce.start_time > CURTIME())) THEN 1
                                 ELSE 2
                             END ASC,
                             ce.start_date DESC, ce.start_time DESC
                         LIMIT 1`;
                params = [student_id, orgId];
            } else {
                // isAdmin (OSWS)
                query = `SELECT er.id AS registration_id, er.event_id
                         FROM event_registrations er
                         JOIN created_events ce ON er.event_id = ce.event_id
                         WHERE er.student_id = ? AND ce.created_by_osws_id = ?
                         ORDER BY 
                             CASE 
                                 WHEN (
                                     (ce.start_date < CURDATE() OR (ce.start_date = CURDATE() AND ce.start_time <= CURTIME()))
                                     AND (ce.end_date > CURDATE() OR (ce.end_date = CURDATE() AND ce.end_time >= CURTIME()))
                                 ) THEN 0
                                 WHEN (ce.start_date > CURDATE() OR (ce.start_date = CURDATE() AND ce.start_time > CURTIME())) THEN 1
                                 ELSE 2
                             END ASC,
                             ce.start_date DESC, ce.start_time DESC
                         LIMIT 1`;
                params = [student_id, adminId];
            }

            const [rows] = await db.query(query, params);
            if (!rows.length) {
                return handleErrorResponse(res, 'No matching registration found for this student under your organization. Please specify event.', 404);
            }
            registration_id = rows[0].registration_id;
            event_id = rows[0].event_id;
        } else if (event_id && !registration_id) {
            // Find the registration for this student and event
            const [rows] = await db.query(
                'SELECT id AS registration_id FROM event_registrations WHERE event_id = ? AND student_id = ? LIMIT 1',
                [event_id, student_id]
            );
            if (!rows.length) {
                return handleErrorResponse(res, 'Student is not registered for this event.', 404);
            }
            registration_id = rows[0].registration_id;
        } else if (registration_id && !event_id) {
            // Fetch event_id from the registration and validate student linkage
            const [rows] = await db.query(
                'SELECT event_id, student_id FROM event_registrations WHERE id = ? LIMIT 1',
                [registration_id]
            );
            if (!rows.length) {
                return handleErrorResponse(res, 'Registration not found', 404);
            }
            if (String(rows[0].student_id) !== String(student_id)) {
                return handleErrorResponse(res, 'Registration does not belong to this student.', 403);
            }
            event_id = rows[0].event_id;
        }

        // Scope check: ensure the specified/derived event belongs to the scanner, and is currently ongoing
        const [evRows] = await db.query(
            `SELECT 
                                created_by_org_id, 
                                created_by_osws_id,
                                status,
                                deleted_at,
                                event_latitude, event_longitude,
                                is_paid,
                                (
                                    (
                                        (start_date < CURDATE() OR (start_date = CURDATE() AND start_time <= CURTIME()))
                                        AND (end_date > CURDATE() OR (end_date = CURDATE() AND end_time >= CURTIME()))
                                    )
                                ) AS is_ongoing
                         FROM created_events WHERE event_id = ? LIMIT 1`,
            [event_id]
        );
        if (!evRows.length) {
            return handleErrorResponse(res, 'Event not found', 404);
        }
        const ev = evRows[0];
        if (isOrgOfficer && ev.created_by_org_id !== orgId) {
            return handleErrorResponse(res, 'You are not authorized to record attendance for this event.', 403);
        }
        if (isAdmin && ev.created_by_osws_id !== adminId) {
            return handleErrorResponse(res, 'You are not authorized to record attendance for this event.', 403);
        }
        if (ev.deleted_at) {
            return handleErrorResponse(res, 'Event not found', 404);
        }
        // Enforce: attendance is only valid while event status is 'ongoing'
        const statusStr = (ev.status || '').toString().toLowerCase();
        if (statusStr !== 'ongoing') {
            return handleErrorResponse(res, 'Attendance can only be recorded while the event is ongoing.', 400);
        }

        // Determine target coordinates for geofence enforcement
        let targetLat = null;
        let targetLon = null;
        try {
            if (ev.event_latitude !== undefined && ev.event_latitude !== null && ev.event_longitude !== undefined && ev.event_longitude !== null) {
                targetLat = Number(ev.event_latitude);
                targetLon = Number(ev.event_longitude);
            }
        } catch (e) {
            targetLat = null; targetLon = null;
        }

        // Optional environment-configured fallback center (leave unset to disallow fallback)
        const envLat = process.env.DEFAULT_GEOCENTER_LAT !== undefined ? Number(process.env.DEFAULT_GEOCENTER_LAT) : null;
        const envLon = process.env.DEFAULT_GEOCENTER_LON !== undefined ? Number(process.env.DEFAULT_GEOCENTER_LON) : null;

        if ((targetLat === null || targetLon === null) && (envLat !== null && envLon !== null && !Number.isNaN(envLat) && !Number.isNaN(envLon))) {
            targetLat = envLat;
            targetLon = envLon;
            console.info('[geofence] using env fallback geocenter');
        }

        if (targetLat === null || targetLon === null) {
            // No coordinates to validate against. Fail explicitly so callers know to provide event coords.
            return handleErrorResponse(res, 'Event location coordinates not available for geofence validation. Please provide event_latitude/event_longitude.', 400);
        }

        const dist = haversineMeters(user_lat, user_lon, targetLat, targetLon);
        if (dist > GEOFENCE_METERS) {
            return handleErrorResponse(res, `User is outside allowed area (${Math.round(dist)} m).`, 403);
        }

        // Verify registration exists and belongs to provided values
        const [reg] = await db.query(
            'SELECT * FROM event_registrations WHERE id = ? AND event_id = ? AND student_id = ?',
            [registration_id, event_id, student_id]
        );
        if (reg.length === 0) {
            return handleErrorResponse(res, 'Registration not found', 404);
        }
        // Enforce approval for paid events: only approved registrations can attend
        const isPaidEvent = !!(ev?.is_paid);
        if (isPaidEvent) {
            const status = (reg[0].status || 'approved').toString().toLowerCase();
            if (status !== 'approved') {
                return handleErrorResponse(res, 'Registration is not approved for this paid event.', 403);
            }
        }

        // Normalize requested mode (optional): 'time_in' | 'time_out'
        const desired = typeof mode === 'string' ? mode.toString().trim().toLowerCase() : '';

        // Fetch existing record for this student+event
        const [existing] = await db.query(
            'SELECT id, time_in, time_out FROM attendance_records WHERE event_id = ? AND student_id = ? LIMIT 1',
            [event_id, student_id]
        );

        // Resolve who is scanning — prefer student ID for org officers (shows officer name, not org name)
        const officerStudentId = isOrgOfficer ? (user.studentId || user.legacyId || user.id || null) : null;
        let scannedByStudentId = officerStudentId;
        let resolvedOrgId = orgId || (isOrgOfficer ? (ev.created_by_org_id || null) : null);
        let scannedByOrgId = (isOrgOfficer && !scannedByStudentId) ? resolvedOrgId : null;
        const scannedByOswsId = isAdmin ? adminId : null;

        // Fallback for stale JWTs missing org/student claims — look up from DB
        if (isOrgOfficer && scannedByStudentId === null && scannedByOrgId === null && scannedByOswsId === null) {
            try {
                const lookupId = user.legacyId || user.id || user.userId;
                if (lookupId) {
                    const [memberRows] = await db.query(
                        `SELECT om.student_id, om.org_id FROM organizationmembers om
                         WHERE (om.student_id = ? OR om.org_id IN (
                             SELECT org_id FROM organizationmembers WHERE student_id = ?
                         ))
                         AND om.is_active = TRUE LIMIT 1`,
                        [lookupId, lookupId]
                    );
                    if (memberRows.length > 0) {
                        scannedByStudentId = memberRows[0].student_id || null;
                        if (!scannedByStudentId) {
                            scannedByOrgId = memberRows[0].org_id || null;
                        }
                    }
                }
            } catch (dbLookupErr) {
                console.warn('[scanner-fallback] DB lookup failed:', dbLookupErr?.message);
            }
        }

        // Time-in/out DB write helpers
        const doTimeInInsert = async () => {
            await db.query(
                `INSERT INTO attendance_records (event_id, student_id, attended_at, time_in, scanned_by_org_id, scanned_by_osws_id, scanned_by_student_id, reported_lat, reported_lon, reported_accuracy, location_consent, reported_at)
                 VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
                [event_id, student_id, scannedByOrgId, scannedByOswsId, scannedByStudentId, user_lat, user_lon, user_accuracy, location_consent ? 1 : 0]
            );
        };
        const doTimeInUpdate = async (id) => {
            await db.query(
                `UPDATE attendance_records 
                 SET time_in = COALESCE(time_in, UTC_TIMESTAMP()), attended_at = COALESCE(attended_at, UTC_TIMESTAMP()),
                     scanned_by_org_id = COALESCE(scanned_by_org_id, ?),
                     scanned_by_osws_id = COALESCE(scanned_by_osws_id, ?),
                     scanned_by_student_id = COALESCE(scanned_by_student_id, ?),
                     reported_lat = ?, reported_lon = ?, reported_accuracy = ?, location_consent = ?, reported_at = UTC_TIMESTAMP()
                 WHERE id = ?`,
                [scannedByOrgId, scannedByOswsId, scannedByStudentId, user_lat, user_lon, user_accuracy, location_consent ? 1 : 0, id]
            );
        };
        const doTimeOutUpdate = async (id) => {
            // Skip updating scanned_by_* if null — already written at time-in
            const hasScanner = scannedByOrgId !== null || scannedByOswsId !== null || scannedByStudentId !== null;
            if (hasScanner) {
                await db.query(
                    `UPDATE attendance_records 
                     SET time_out = UTC_TIMESTAMP(),
                         scanned_by_org_id = COALESCE(scanned_by_org_id, ?),
                         scanned_by_osws_id = COALESCE(scanned_by_osws_id, ?),
                         scanned_by_student_id = COALESCE(scanned_by_student_id, ?),
                         reported_lat = ?, reported_lon = ?, reported_accuracy = ?, location_consent = ?, reported_at = UTC_TIMESTAMP()
                     WHERE id = ?`,
                    [scannedByOrgId, scannedByOswsId, scannedByStudentId, user_lat, user_lon, user_accuracy, location_consent ? 1 : 0, id]
                );
            } else {
                await db.query(
                    `UPDATE attendance_records 
                     SET time_out = UTC_TIMESTAMP(),
                         reported_lat = ?, reported_lon = ?, reported_accuracy = ?, location_consent = ?, reported_at = UTC_TIMESTAMP()
                     WHERE id = ?`,
                    [user_lat, user_lon, user_accuracy, location_consent ? 1 : 0, id]
                );
            }
        };

        // Handle explicit mode or auto mode (first scan = time-in, second = time-out)
        if (desired === 'time_in') {
            if (!existing.length) {
                await doTimeInInsert();
                return handleSuccessResponse(res, { message: 'Time-in recorded' });
            }
            const rec = existing[0];
            if (rec.time_in && !rec.time_out) {
                return handleErrorResponse(res, 'Already timed in.', 409);
            }
            if (rec.time_in && rec.time_out) {
                return handleErrorResponse(res, 'Attendance already recorded', 409);
            }
            await doTimeInUpdate(rec.id);
            return handleSuccessResponse(res, { message: 'Time-in recorded' });
        }
        if (desired === 'time_out') {
            if (!existing.length) {
                return handleErrorResponse(res, 'Cannot time-out: no time-in found for this attendee.', 409);
            }
            const rec = existing[0];
            if (!rec.time_in) {
                return handleErrorResponse(res, 'Cannot time-out: no time-in found for this attendee.', 409);
            }
            if (rec.time_out) {
                return handleErrorResponse(res, 'Already timed out.', 409);
            }
            await doTimeOutUpdate(rec.id);
            return handleSuccessResponse(res, { message: 'Time-out recorded' });
        }

        // Auto mode: first scan = time-in, second = time-out
        if (!existing.length) {
            await doTimeInInsert();
            return handleSuccessResponse(res, { message: 'Time-in recorded' });
        }
        const rec = existing[0];
        if (rec.time_in && !rec.time_out) {
            await doTimeOutUpdate(rec.id);
            return handleSuccessResponse(res, { message: 'Time-out recorded' });
        }
        return handleErrorResponse(res, 'Attendance already recorded', 409);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAllAttendanceRecords = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return handleErrorResponse(res, 'Unauthorized', 401);
        }

        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');
        const isStudent = roles.includes('student');

        let records;
        if (isOrgOfficer) {
            const orgId = user.organization ? user.organization.org_id : null;
            if (!orgId) return handleErrorResponse(res, 'Organization not found', 400);
            records = await eventService.getAttendanceRecordsByOrg(orgId);
        } else if (isAdmin) {
            const adminId = user.legacyId;
            records = await eventService.getAttendanceRecordsByOsws(adminId);
        } else if (isStudent && !isOrgOfficer && !isAdmin) {
            return handleErrorResponse(res, 'Forbidden', 403);
        } else {
            records = [];
        }

        return handleSuccessResponse(res, { items: records });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Lightweight: returns total attendee count for all events created by a given org/admin
exports.getAttendeeCountByCreator = async (req, res) => {
    try {
        const { creatorId } = req.params;
        if (!creatorId) return handleErrorResponse(res, 'creatorId required', 400);

        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');

        let count = 0;

        if (isOrgOfficer) {
            // Count attendees for events created by this org
            const [rows] = await db.query(
                `SELECT COUNT(ar.id) AS cnt
                 FROM attendance_records ar
                 JOIN created_events ce ON ar.event_id = ce.event_id
                 WHERE ce.created_by_org_id = ? AND ar.deleted_at IS NULL AND ce.deleted_at IS NULL`,
                [creatorId]
            );
            count = Number(rows?.[0]?.cnt || 0);
        } else if (isAdmin) {
            // Count attendees for events created by this OSWS admin
            const [rows] = await db.query(
                `SELECT COUNT(ar.id) AS cnt
                 FROM attendance_records ar
                 JOIN created_events ce ON ar.event_id = ce.event_id
                 WHERE ce.created_by_osws_id = ? AND ar.deleted_at IS NULL AND ce.deleted_at IS NULL`,
                [creatorId]
            );
            count = Number(rows?.[0]?.cnt || 0);
        } else {
            return handleErrorResponse(res, 'Forbidden', 403);
        }

        return handleSuccessResponse(res, { count });
    } catch (error) {
        console.error('getAttendeeCountByCreator error:', error);
        return handleErrorResponse(res, error.message);
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        const ok = await eventService.deleteEvent(id, userId);
        if (!ok) return handleErrorResponse(res, 'Event not found or already deleted', 404);
        return handleSuccessResponse(res, { message: 'Event moved to trash' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getTrashedEvents = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        let rows = [];

        if (user.roles && user.roles.includes('orgofficer')) {
            const orgId = user.organization?.org_id || user.legacyId;
            rows = await eventService.getTrashedOrgEvents(orgId);
        } else if (user.roles && user.roles.includes('oswsadmin')) {
            rows = await eventService.getTrashedOswsEvents(user.legacyId);
        } else {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        return handleSuccessResponse(res, { items: rows });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.restoreEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const ok = await eventService.restoreEvent(id);
        if (!ok) return handleErrorResponse(res, 'Event not found', 404);
        return handleSuccessResponse(res, { message: 'Event restored' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Permanently delete a trashed event (owner only)
exports.permanentDeleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

        const result = await eventService.permanentDeleteEvent({ eventId: id, user });
        if (!result?.deleted) {
            const code = result?.code || 404;
            return handleErrorResponse(res, result?.message || 'Event not found or not in trash', code);
        }
        return handleSuccessResponse(res, { message: 'Event permanently deleted' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Dashboard stats for the org officer's organization
exports.getOrgDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

        const roles = user.roles || [];
        if (!roles.includes('orgofficer')) return handleErrorResponse(res, 'Forbidden', 403);

        const orgId = user.organization?.org_id;
        if (!orgId) return handleErrorResponse(res, 'Organization ID not found', 400);

        const stats = await eventService.getOrgDashboardStats(orgId);
        return handleSuccessResponse(res, stats);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Dashboard stats for OSWS admin across all OSWS-created events
exports.getOswsDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

        const roles = user.roles || [];
        if (!roles.includes('oswsadmin')) return handleErrorResponse(res, 'Forbidden', 403);

        const stats = await eventService.getOswsDashboardStats();
        return handleSuccessResponse(res, stats);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Chart datasets for OSWS dashboard — supports weekly/monthly/yearly filter
exports.getOswsDashboardCharts = async (req, res) => {
    try {
        const filter = String(req.body?.filter || req.query.filter || 'monthly').toLowerCase();
        const allowed = ['weekly', 'monthly', 'yearly'];
        const f = allowed.includes(filter) ? filter : 'monthly';
        const data = await eventService.getOswsDashboardCharts(f);
        return handleSuccessResponse(res, data);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getCertificatesByStudent = async (req, res) => {
    try {
        const { student_id } = req.query;
        if (!student_id) return handleErrorResponse(res, 'student_id required', 400);

        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Authentication required', 401);
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        const isStudent = userRoles.includes('student');
        const isOrgOfficer = userRoles.includes('orgofficer');
        const isAdmin = userRoles.includes('oswsadmin');

        if (isStudent) {
            const studentIdFromToken = user.studentId || user.id || user.legacyId || null;
            if (String(studentIdFromToken) !== String(student_id)) {
                return handleErrorResponse(res, 'Forbidden', 403);
            }
        } else if (!isOrgOfficer && !isAdmin) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }

        // Get attended events with evaluation status and latest certificate request
        const [attendedEvents] = await db.query(
            `SELECT ar.event_id,
                    ce.title AS event_title,
                    ce.start_date,
                    ce.end_date,
                    ce.start_time,
                    ce.end_time,
                    ce.status AS event_status,
                    ce.created_by_osws_id,
                    ar.evaluation_submitted,
                    ar.evaluation_submitted_at,
                    c.id as cert_id,
                    c.certificate_url,
                    c.certificate_public_id,
                    c.generated_at,
                    -- Latest certificate request fields (if any)
                    cr.status AS request_status,
                    cr.requested_at AS request_requested_at,
                    cr.processed_at AS request_processed_at,
                    cr.rejection_reason AS request_rejection_reason,
                    cr.certificate_url AS request_certificate_url,
                    s.first_name,
                    s.last_name,
                    s.middle_initial,
                    s.suffix,
                    s.department,
                    s.program
             FROM attendance_records ar
             JOIN created_events ce ON ar.event_id = ce.event_id
             JOIN students s ON ar.student_id = s.id
             LEFT JOIN certificates c ON c.event_id = ar.event_id AND c.student_id = ar.student_id
             LEFT JOIN (
                 SELECT cr_inner.* FROM certificate_requests cr_inner
                 JOIN (
                     SELECT event_id, student_id, MAX(requested_at) AS max_req_at
                     FROM certificate_requests
                     WHERE student_id = ?
                     GROUP BY event_id, student_id
                 ) latest ON latest.event_id = cr_inner.event_id AND latest.student_id = cr_inner.student_id AND latest.max_req_at = cr_inner.requested_at
             ) cr ON cr.event_id = ar.event_id AND cr.student_id = ar.student_id
             WHERE ar.student_id = ? AND ar.deleted_at IS NULL AND ce.deleted_at IS NULL
             ORDER BY ce.end_date DESC, ce.start_date DESC`,
            [student_id, student_id]
        );

        // Map events — certificate download requires evaluation completion
        const data = attendedEvents.map(event => {
            const isOswsEvent = !!event.created_by_osws_id;
            const hasEvaluated = event.evaluation_submitted === 1;
            const hasCertificate = !!event.certificate_url;

            return {
                event_id: event.event_id,
                event_title: event.event_title,
                start_date: event.start_date,
                end_date: event.end_date,
                start_time: event.start_time,
                end_time: event.end_time,
                first_name: event.first_name,
                last_name: event.last_name,
                middle_initial: event.middle_initial,
                suffix: event.suffix,
                department: event.department,
                program: event.program,
                id: event.cert_id,
                certificate_url: event.certificate_url,
                certificate_public_id: event.certificate_public_id,
                generated_at: event.generated_at,
                request_status: event.request_status || null,
                request_requested_at: event.request_requested_at || null,
                request_processed_at: event.request_processed_at || null,
                request_rejection_reason: event.request_rejection_reason || null,
                request_certificate_url: event.request_certificate_url || null,
                evaluation_required: true,
                evaluation_submitted: hasEvaluated,
                evaluation_submitted_at: event.evaluation_submitted_at,
                event_concluded: (event.event_status || '').toLowerCase() === 'concluded',
                can_download_certificate: hasEvaluated && hasCertificate,
                is_osws_event: isOswsEvent
            };
        });

        return handleSuccessResponse(res, { items: data });
    } catch (err) {
        return handleErrorResponse(res, err.message);
    }
};

exports.getEventsByAdmin = async (req, res) => {
    try {
        const { admin_id } = req.params;
        const events = await eventService.getEventsByAdmin(admin_id);
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => {
            const poster = event.event_poster;
            const normalizedPoster = poster
                ? (poster.startsWith('http')
                    ? poster
                    : `${host}/${poster.replace(/\\/g, '/')}`)
                : null;
            const auto_status = computeAutoStatus(event);
            const curr = (event.status || '').toString().toLowerCase();
            const auto_mismatch = !!(auto_status && auto_status !== curr);
            return {
                ...event,
                event_poster: normalizedPoster,
                department: event.department,
                auto_status,
                auto_mismatch
            };
        });
        return handleSuccessResponse(res, { items: eventsWithPosterUrl });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAllOrgEvents = async (req, res) => {
    try {
        const events = await eventService.getAllOrgEvents();
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => {
            const poster = event.event_poster;
            const normalizedPoster = poster
                ? (poster.startsWith('http')
                    ? poster
                    : `${host}/${poster.replace(/\\/g, '/')}`)
                : null;
            const auto_status = computeAutoStatus(event);
            const curr = (event.status || '').toString().toLowerCase();
            const auto_mismatch = !!(auto_status && auto_status !== curr);
            return {
                ...event,
                event_poster: normalizedPoster,
                department: event.department,
                auto_status,
                auto_mismatch
            };
        });
        return handleSuccessResponse(res, { items: eventsWithPosterUrl });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAllOswsEvents = async (req, res) => {
    try {
        const events = await eventService.getAllOswsEvents();
        const host = req.protocol + '://' + req.get('host');
        const eventsWithPosterUrl = events.map(event => {
            const poster = event.event_poster;
            const normalizedPoster = poster
                ? (poster.startsWith('http')
                    ? poster
                    : `${host}/${poster.replace(/\\/g, '/')}`)
                : null;
            const auto_status = computeAutoStatus(event);
            const curr = (event.status || '').toString().toLowerCase();
            const auto_mismatch = !!(auto_status && auto_status !== curr);
            return {
                ...event,
                event_poster: normalizedPoster,
                department: event.department,
                auto_status,
                auto_mismatch
            };
        });
        return handleSuccessResponse(res, { items: eventsWithPosterUrl });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventParticipants = async (req, res) => {
    try {
        const { event_id } = req.params;
        const [rows] = await db.query(
            `SELECT 
                 er.id AS registration_id,
                 er.student_id,
                 er.proof_of_payment,
                 er.status,
                 s.first_name, 
                 s.last_name, 
                 s.suffix, 
                 s.department, 
                 s.program
             FROM event_registrations er
             JOIN students s ON er.student_id = s.id
             WHERE er.event_id = ?
             ORDER BY FIELD(er.status, 'pending','approved','rejected'), er.id DESC`,
            [event_id]
        );

        // Normalize proof_of_payment to absolute URL
        const host = req.protocol + '://' + req.get('host');
        const data = rows.map(r => ({
            ...r,
            proof_of_payment: r.proof_of_payment
                ? (r.proof_of_payment.startsWith('http')
                    ? r.proof_of_payment
                    : `${host}/${String(r.proof_of_payment).replace(/\\/g, '/')}`)
                : null
        }));

        return handleSuccessResponse(res, { items: data });
    } catch (error) {
        console.error('getEventParticipants error:', error);
        return handleErrorResponse(res, error.message);
    }
};

// Approve a pending event registration
exports.approveRegistration = async (req, res) => {
    try {
        const user = req.user;
        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');

        if (!user || (!isOrgOfficer && !isAdmin)) {
            return handleErrorResponse(res, 'Forbidden: Only organization officers and admins can approve registrations', 403);
        }

        const { registration_id } = req.params;
        if (!registration_id) return handleErrorResponse(res, 'registration_id required', 400);

        const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
        const adminId = isAdmin ? user.legacyId : null;

        const [rows] = await db.query(
            `SELECT er.*, ce.created_by_org_id, ce.created_by_osws_id, ce.title
             FROM event_registrations er
             JOIN created_events ce ON er.event_id = ce.event_id
             WHERE er.id = ? LIMIT 1`,
            [registration_id]
        );
        if (!rows.length) return handleErrorResponse(res, 'Registration not found', 404);
        const rec = rows[0];

        // Check ownership
        if (isOrgOfficer && rec.created_by_org_id !== orgId) {
            return handleErrorResponse(res, 'Forbidden: You can only approve registrations for your organization events', 403);
        }
        if (isAdmin && rec.created_by_osws_id !== adminId) {
            return handleErrorResponse(res, 'Forbidden: You can only approve registrations for your OSWS events', 403);
        }

        if ((rec.status || '').toLowerCase() === 'approved') {
            return handleSuccessResponse(res, { message: 'Already approved' });
        }
        await db.query(
            `UPDATE event_registrations SET status = 'approved', approved_at = UTC_TIMESTAMP(),
             approved_by_org_id = ?, approved_by_osws_id = ?
             WHERE id = ?`,
            [isOrgOfficer ? orgId : null, isAdmin ? adminId : null, registration_id]
        );
        // Notify student of approval
        try {
            await notificationService.createNotification({ user_id: String(rec.student_id), event_id: rec.event_id, type: require('../services/notificationTypes').REGISTRATION_APPROVED, templateVars: { title: rec.title }, panel: 'student' });
        } catch (_) { }
        return handleSuccessResponse(res, { message: 'Registration approved' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Decline a pending event registration
exports.rejectRegistration = async (req, res) => {
    try {
        const user = req.user;
        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');

        if (!user || (!isOrgOfficer && !isAdmin)) {
            return handleErrorResponse(res, 'Forbidden: Only organization officers and admins can decline registrations', 403);
        }

        const { registration_id } = req.params;
        if (!registration_id) return handleErrorResponse(res, 'registration_id required', 400);

        const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
        const adminId = isAdmin ? user.legacyId : null;

        const [rows] = await db.query(
            `SELECT er.*, ce.created_by_org_id, ce.created_by_osws_id, ce.title
             FROM event_registrations er
             JOIN created_events ce ON er.event_id = ce.event_id
             WHERE er.id = ? LIMIT 1`,
            [registration_id]
        );
        if (!rows.length) return handleErrorResponse(res, 'Registration not found', 404);
        const rec = rows[0];

        // Check ownership
        if (isOrgOfficer && rec.created_by_org_id !== orgId) {
            return handleErrorResponse(res, 'Forbidden: You can only decline registrations for your organization events', 403);
        }
        if (isAdmin && rec.created_by_osws_id !== adminId) {
            return handleErrorResponse(res, 'Forbidden: You can only decline registrations for your OSWS events', 403);
        }
        await db.query(`UPDATE event_registrations SET status = 'rejected' WHERE id = ?`, [registration_id]);
        try {
            await notificationService.createNotification({ user_id: String(rec.student_id), event_id: rec.event_id, type: require('../services/notificationTypes').REGISTRATION_REJECTED, templateVars: { title: rec.title }, panel: 'student' });
        } catch (_) { }
        return handleSuccessResponse(res, { message: 'Registration declined' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAttendanceRecords = async (req, res) => {
    try {
        const user = req.user;
        const roles = user?.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');
        if (!isOrgOfficer && !isAdmin) {
            return handleErrorResponse(res, 'Forbidden: Only organization officers and admins can view attendance records', 403);
        }
        const [rows] = await db.query(
            `SELECT 
         ar.event_id,
         ce.title AS event_title,
         ar.student_id,
         s.first_name,
         s.last_name,
         s.suffix,
         s.department,
         s.program
       FROM attendance_records ar
       JOIN created_events ce ON ar.event_id = ce.event_id
       JOIN students s ON ar.student_id = s.id`
        );
        return handleSuccessResponse(res, { items: rows });
    } catch (error) {
        console.error('getAttendanceRecords error:', error);
        return handleErrorResponse(res, error.message);
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const eventData = req.body;
        if (req.file) {
            eventData.event_poster = req.file.cloudinaryUrl || req.file.path;
            if (req.file.cloudinaryPublicId) eventData.event_poster_public_id = req.file.cloudinaryPublicId;
        }
        // Support data URL / base64 image in JSON body (no multipart)
        if (!req.file && eventData && typeof eventData.event_poster === 'string') {
            const val = eventData.event_poster.trim();
            const looksLikeDataUrl = val.startsWith('data:image/');
            const looksLikeBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(val.replace(/^data:[^;]+;base64,/, ''));
            if (looksLikeDataUrl || (val.length > 100 && looksLikeBase64)) {
                try {
                    const uploadResult = await cloudinary.uploader.upload(val, {
                        folder: 'event-posters',
                        resource_type: 'image',
                        quality: 'auto',
                        fetch_format: 'auto'
                    });
                    if (uploadResult && uploadResult.secure_url) {
                        eventData.event_poster = uploadResult.secure_url;
                        eventData.event_poster_public_id = uploadResult.public_id;
                    }
                } catch (e) {
                    console.warn('Failed to upload event_poster from data URL/body:', e?.message || e);
                }
            }
        }
        if (eventData.is_paid !== undefined) {
            const v = eventData.is_paid;
            const s = typeof v === 'string' ? v.toLowerCase() : v;
            eventData.is_paid = (s === true || s === 1 || s === '1' || s === 'true' || s === 'paid' || s === 'yes') ? 1 : 0;
        }
        if (eventData.registration_fee !== undefined) {
            const n = parseFloat(eventData.registration_fee);
            eventData.registration_fee = isNaN(n) || n < 0 ? 0 : Number(n.toFixed(2));
        }

        // Prevent manual status changes via PUT — only 'cancelled' is allowed
        if (eventData.status !== undefined && eventData.status !== null && String(eventData.status).trim() !== '') {
            const desired = String(eventData.status).trim().toLowerCase();
            if (desired !== 'cancelled') {
                return handleErrorResponse(res, 'Only manual change allowed is setting status to "cancelled".', 403);
            }
            const ev = await eventService.getEventById(id);
            if (!ev || ev.deleted_at) return handleErrorResponse(res, 'Event not found', 404);
            const user = req.user;
            if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

            const roles = user.roles || [];
            const isOrgOfficer = roles.includes('orgofficer');
            const isAdmin = roles.includes('oswsadmin');
            const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
            const adminId = isAdmin ? user.legacyId : null;

            if (isOrgOfficer && ev.created_by_org_id !== orgId) return handleErrorResponse(res, 'Forbidden', 403);
            if (isAdmin && ev.created_by_osws_id !== adminId) return handleErrorResponse(res, 'Forbidden', 403);
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
            return handleErrorResponse(res, 'Event not found', 404);
        }
        return handleSuccessResponse(res, event);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Create a certificate request for a concluded org event (requires evaluation first)
exports.requestCertificate = async (req, res) => {
    try {
        const user = req.user;
        const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
        if (!user || !userRoles.includes('student')) {
            return handleErrorResponse(res, 'Only students can request certificates.', 403);
        }
        const eventId = req.params.id;
        if (!eventId) return handleErrorResponse(res, 'Event ID is required', 400);

        const studentId = user.studentId || user.id;

        // Fetch event and organizer details
        const [rows] = await db.query(
            `SELECT ce.event_id, ce.title, COALESCE(ce.room, ce.location) AS location, ce.start_date, ce.end_date,
                    ce.created_by_org_id, ce.created_by_osws_id,
                    org.org_name, org.email AS org_email,
                    osws.name AS osws_name, osws.email AS osws_email
             FROM created_events ce
             LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
             LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
             WHERE ce.event_id = ? LIMIT 1`,
            [eventId]
        );
        if (!rows.length) return handleErrorResponse(res, 'Event not found', 404);
        const ev = rows[0];
        if (ev.created_by_osws_id) {
            return handleErrorResponse(res, 'Certificates are auto-generated for OSWS events.', 400);
        }

        // Evaluation must be submitted before requesting a certificate
        const [evalCheck] = await db.query(
            `SELECT evaluation_submitted FROM attendance_records 
             WHERE event_id = ? AND student_id = ? LIMIT 1`,
            [eventId, studentId]
        );
        if (!evalCheck.length || evalCheck[0].evaluation_submitted !== 1) {
            return handleErrorResponse(res, 'Please complete the evaluation form before requesting a certificate.', 400);
        }

        const toOrgId = ev.created_by_org_id ? String(ev.created_by_org_id) : null;
        const toOswsId = ev.created_by_osws_id ? String(ev.created_by_osws_id) : null;
        if (!toOrgId && !toOswsId) return handleErrorResponse(res, 'Organizer account not available for this event.', 400);

        const hasPendingRequest = await certificateRequestService.hasPendingOrApprovedRequest(eventId, studentId);
        if (hasPendingRequest) {
            return handleErrorResponse(res, 'You already have a pending or approved certificate request for this event.', 400);
        }

        // Rate limit: max 2 requests per 48 hours per student+event
        const studentIdStr = String(studentId);
        const [cntRows] = await db.query(
            `SELECT COUNT(*) AS cnt FROM certificate_requests
             WHERE event_id = ? AND student_id = ? AND requested_at >= (UTC_TIMESTAMP() - INTERVAL 48 HOUR)`,
            [eventId, studentIdStr]
        );
        const recentCount = Number(cntRows?.[0]?.cnt || 0);
        if (recentCount >= 2) {
            const [firstRows] = await db.query(
                `SELECT MIN(requested_at) AS first_in_window FROM certificate_requests
                 WHERE event_id = ? AND student_id = ? AND requested_at >= (UTC_TIMESTAMP() - INTERVAL 48 HOUR)`,
                [eventId, studentIdStr]
            );
            const firstDateStr = firstRows?.[0]?.first_in_window;
            let retryMsg = 'You can request up to 2 times every 48 hours. Please try again later.';
            if (firstDateStr) {
                const firstDate = new Date(firstDateStr);
                const now = new Date();
                const msElapsed = now.getTime() - firstDate.getTime();
                const msLeft = (48 * 60 * 60 * 1000) - Math.max(0, msElapsed);
                if (msLeft > 0) {
                    const hours = Math.floor(msLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
                    retryMsg = `Limit reached (2 per 48 hours). Try again in ${hours}h ${minutes}m.`;
                }
            }
            return handleErrorResponse(res, retryMsg, 429);
        }

        const [srows] = await db.query(
            `SELECT id, email, first_name, last_name, middle_initial, suffix, department, program
             FROM students WHERE id = ? LIMIT 1`,
            [studentId]
        );
        const st = srows[0] || {};
        const studentName = [st.first_name, st.middle_initial ? `${st.middle_initial}.` : '', st.last_name, st.suffix || '']
            .filter(Boolean).join(' ').replace(/\s+/g, ' ');

        await certificateRequestService.createCertificateRequest({
            event_id: eventId,
            student_id: studentId
        });

        // Notify organizer panel (user_id is null — org/admin IDs are not student IDs)
        try {
            const nt = require('../services/notificationTypes');
            const payload = { type: nt.CERTIFICATE_REQUEST, templateVars: { studentName, title: ev.title }, event_id: ev.event_id };
            if (toOrgId) {
                await notificationService.createNotification({ user_id: null, panel: 'organization', org_id: toOrgId, ...payload });
            } else {
                await notificationService.createNotification({ user_id: null, panel: 'admin', ...payload });
            }
        } catch (nerr) {
            console.warn('Notification create failed (requestCertificate):', nerr?.message || nerr);
        }

        return handleSuccessResponse(res, { message: 'Certificate request submitted successfully.' });
    } catch (error) {
        console.error('requestCertificate error:', error);
        return handleErrorResponse(res, error.message);
    }
};

// ─── POST /event/fetch dispatcher ───────────────────────────────────────────
// Reads req.body.resource and delegates to the correct handler.
// All parameters (IDs, filters) travel in the request body — nothing is
// exposed in the URL path.
exports.fetchDispatch = async (req, res) => {
    const resource = req.params?.resource || req.body?.resource;
    if (!resource) return res.status(400).json({ success: false, message: 'resource is required' });

    // Shim: map body params into req.params / req.query so existing handlers work unchanged
    switch (resource) {
        case 'all_events':
            return exports.getEvents(req, res);

        case 'events_by_participant':
            req.params = { ...req.params, student_id: req.body.student_id };
            return exports.getEventsByParticipant(req, res);

        case 'attended_events':
            req.params = { ...req.params, student_id: req.body.student_id };
            return exports.getAttendedEventsByStudent(req, res);

        case 'events_by_creator':
            req.params = { ...req.params, creator_id: req.body.creator_id };
            return exports.getEventsByCreator(req, res);

        case 'all_attendance':
            return exports.getAllAttendanceRecords(req, res);

        case 'attendance_count_by_creator':
            req.params = { ...req.params, creatorId: req.body.creator_id };
            return exports.getAttendeeCountByCreator(req, res);

        case 'attendance_by_event':
            req.params = { ...req.params, eventId: req.body.event_id };
            return exports.getAttendanceRecordsByEvent(req, res);

        case 'trashed_events':
            return exports.getTrashedEvents(req, res);

        case 'events_by_admin':
            req.params = { ...req.params, admin_id: req.body.admin_id };
            return exports.getEventsByAdmin(req, res);

        case 'org_events':
            return exports.getAllOrgEvents(req, res);

        case 'osws_events':
            return exports.getAllOswsEvents(req, res);

        case 'event_participants':
            req.params = { ...req.params, event_id: req.body.event_id };
            return exports.getEventParticipants(req, res);

        case 'event_by_id':
            req.params = { ...req.params, id: req.body.event_id };
            return exports.getEventById(req, res);

        case 'certificates':
            req.query = { ...req.query, student_id: req.body.student_id };
            return exports.getCertificatesByStudent(req, res);

        case 'org_stats':
            return exports.getOrgDashboardStats(req, res);

        case 'osws_stats':
            return exports.getOswsDashboardStats(req, res);

        case 'osws_charts':
            return exports.getOswsDashboardCharts(req, res);

        // Evaluation resources — delegated to evaluationController
        case 'eval_status':
        case 'eval_mine':
        case 'eval_all': {
            const evalController = require('./evaluationController');
            req.params = { ...req.params, event_id: req.body.event_id };
            if (resource === 'eval_status') return evalController.getEvaluationStatus(req, res);
            if (resource === 'eval_mine')   return evalController.getMyEvaluation(req, res);
            if (resource === 'eval_all')    return evalController.getEventEvaluations(req, res);
            break;
        }

        default:
            return res.status(400).json({ success: false, message: `Unknown resource: ${resource}` });
    }
};