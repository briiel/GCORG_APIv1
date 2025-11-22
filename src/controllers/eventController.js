// Trash (soft-delete) multiple events
exports.trashMultipleEvents = async (req, res) => {
    try {
        const user = req.user;
        const { eventIds } = req.body;
        if (!Array.isArray(eventIds) || eventIds.length === 0) {
            return handleErrorResponse(res, 'eventIds (array) required', 400);
        }
        const result = await eventService.trashMultipleEvents(eventIds, user?.id);
        return handleSuccessResponse(res, { message: 'Events moved to trash', result });
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
        return handleSuccessResponse(res, records);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};
const eventService = require('../services/eventService');
const { registerParticipant } = require('../services/registrationService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');
const db = require('../config/db');
const { generateCertificate, generateCertificatePreview } = require('../utils/certificateGenerator');
const notificationService = require('../services/notificationService');
const { v2: cloudinary } = require('cloudinary');
const { upload, convertToWebpAndUpload } = require('../middleware/uploadMiddleware');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

        // Record which student/officer created the event (if authenticated user present)
        try {
            const user = req.user;
            if (user) {
                // Prefer studentId/legacyId/id for the canonical student identifier
                eventData.created_by_student_id = user.studentId || user.legacyId || user.id || null;
            }
        } catch (ignore) {}

        // Normalize is_paid from frontend ("paid"/"free" or boolean)
        if (eventData.is_paid !== undefined) {
            const v = eventData.is_paid;
            const s = typeof v === 'string' ? v.toLowerCase() : v;
            eventData.is_paid = (s === true || s === 1 || s === '1' || s === 'true' || s === 'paid' || s === 'yes') ? 1 : 0;
        }
        // Normalize registration_fee
        if (eventData.registration_fee !== undefined) {
            const n = parseFloat(eventData.registration_fee);
            eventData.registration_fee = isNaN(n) || n < 0 ? 0 : Number(n.toFixed(2));
        }

        // Service returns either a numeric id or an object { id, ...eventData }
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
        let events = await eventService.fetchAllEvents();
        const now = new Date();

        const computeAutoStatus = (ev) => {
            const statusStr = (ev.status || '').toString().toLowerCase();
            if (statusStr === 'cancelled') return null; // never auto-override cancelled
            const sd = ev.start_date ? new Date(`${ev.start_date}T${ev.start_time || '00:00:00'}`) : null;
            const ed = ev.end_date ? new Date(`${ev.end_date}T${ev.end_time || '23:59:59'}`) : null;
            if (!sd) return null;
            const start = sd;
            const end = ed && !isNaN(ed.getTime()) ? ed : new Date(`${ev.start_date}T${ev.end_time || '23:59:59'}`);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
            if (now < start) return 'not yet started';
            if (now >= start && now <= end) return 'ongoing';
            if (now > end) return 'concluded';
            return null;
        };

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

        return handleSuccessResponse(res, events);
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

            // Prefer explicit student_id from the request body, but fall back to authenticated user's student id
            const student_id = bodyStudentId || req.user?.studentId || req.user?.student_id || req.user?.id || req.user?.userId;
            if (!student_id) {
                return handleErrorResponse(res, 'student_id is required', 400);
            }

            // If event is marked as paid, require proof_of_payment
            try {
                const ev = await eventService.getEventById(event_id);
                const isPaid = !!(ev && (ev.is_paid === 1 || ev.is_paid === true));
                if (isPaid && !req.file) {
                    return handleErrorResponse(res, 'Proof of payment is required for paid events.', 400);
                }
            } catch (e) {
                // If lookup fails, continue; registration may fail later on foreign key
            }

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
                return res.status(409).json({ success: false, message: error.message });
            }
            // Log the error concisely and return a generic error response
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

        return handleSuccessResponse(res, eventsWithQrUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Get attended events (history) for a student
exports.getAttendedEventsByStudent = async (req, res) => {
    try {
        const user = req.user;
        // Allow students to fetch only their own history; org/admin can fetch any student
        const { student_id } = req.params;
        if (!student_id) return handleErrorResponse(res, 'student_id is required', 400);
        
        const roles = user?.roles || [];
        const isStudent = roles.includes('student');
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');
        
        // Students without officer/admin role can only fetch their own history
        if (isStudent && !isOrgOfficer && !isAdmin && String(user.studentId) !== String(student_id)) {
            return handleErrorResponse(res, 'Forbidden: You can only view your own attendance history', 403);
        }

        const events = await eventService.getAttendanceRecordsByStudent(student_id);

        // Normalize poster URLs when relative
        const host = req.protocol + '://' + req.get('host');
        const data = events.map(ev => ({
            ...ev,
            event_poster: ev.event_poster && ev.event_poster.startsWith('http')
                ? ev.event_poster
                : (ev.event_poster ? `${host}/${String(ev.event_poster).replace(/\\/g, '/')}` : null)
        }));
        return handleSuccessResponse(res, data);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getEventsByCreator = async (req, res) => {
    try {
        const { creator_id } = req.params;
        const events = await eventService.getEventsByCreator(creator_id);
        const host = req.protocol + '://' + req.get('host');
        const now = new Date();
        const computeAutoStatus = (ev) => {
            const statusStr = (ev.status || '').toString().toLowerCase();
            if (statusStr === 'cancelled') return null;
            const sd = ev.start_date ? new Date(`${ev.start_date}T${ev.start_time || '00:00:00'}`) : null;
            const ed = ev.end_date ? new Date(`${ev.end_date}T${ev.end_time || '23:59:59'}`) : null;
            if (!sd) return null;
            const start = sd;
            const end = ed && !isNaN(ed.getTime()) ? ed : new Date(`${ev.start_date}T${ev.end_time || '23:59:59'}`);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
            if (now < start) return 'not yet started';
            if (now >= start && now <= end) return 'ongoing';
            if (now > end) return 'concluded';
            return null;
        };
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
                department: event.department, // Now included from the join
                auto_status,
                auto_mismatch
            };
        });
        return handleSuccessResponse(res, eventsWithPosterUrl);
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
        if (isAdmin && ev.created_by_osws_id !== adminId) return handleErrorResponse(res, 'Forbidden', 403);

        // Compute auto status (as of now); never auto-override 'cancelled'
        const now = new Date();
        const computeAutoStatus = (e) => {
            const statusStr = (e.status || '').toString().toLowerCase();
            if (statusStr === 'cancelled') return null;
            const sd = e.start_date ? new Date(`${e.start_date}T${e.start_time || '00:00:00'}`) : null;
            const ed = e.end_date ? new Date(`${e.end_date}T${e.end_time || '23:59:59'}`) : null;
            if (!sd) return null;
            const start = sd;
            const end = ed && !isNaN(ed.getTime()) ? ed : new Date(`${e.start_date}T${e.end_time || '23:59:59'}`);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
            if (now < start) return 'not yet started';
            if (now >= start && now <= end) return 'ongoing';
            if (now > end) return 'concluded';
            return null;
        };
        const autoStatus = computeAutoStatus(ev);

        // Manual status change rules:
        // - Always allow setting to 'cancelled'.
        // - Otherwise, allow only if desired equals computed auto status AND current stored differs (i.e., auto didn't update).
        const desired = status;
        const current = (ev.status || '').toString().toLowerCase();
        const desiredLower = desired.toString().toLowerCase();
        const allowed = desiredLower === 'cancelled' || (autoStatus && desiredLower === autoStatus && desiredLower !== current);
        if (!allowed) {
            return handleErrorResponse(res, 'Manual status change not allowed. Only permitted when automatic status did not update (or to cancel).', 403);
        }

        await eventService.updateEventStatus(id, status);

    if (status === 'concluded') {
            // Only release certificates for events created by OSWS
            const event = await eventService.getEventById(id);
            const isOswsCreated = event && event.created_by_osws_id; // truthy when created by OSWS
            if (!isOswsCreated) {
                // Auto-trash concluded events regardless of creator per requirement
                /*
                try {
                    await eventService.deleteEvent(id, null);
                } catch (e) {
                    console.warn('Auto-trash on completion (non-OSWS) failed or already trashed:', e?.message || e);
                }
                return handleSuccessResponse(res, { message: 'Event concluded and moved to trash (certificates are only released for OSWS-created events).' });
                */
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
                       ce.location AS event_location,
                       ce.start_date,
                       ce.end_date
                 FROM attendance_records ar
                 JOIN students s ON ar.student_id = s.id
                 JOIN created_events ce ON ar.event_id = ce.event_id
                 WHERE ar.event_id = ?`,
                [id]
            );

            // Process certificates for each attendee
            for (const attendee of attendees) {
                try {
                    // Create temporary file in system temp directory
                    const tempDir = os.tmpdir();
                    const certFilename = `certificate_${id}_${attendee.student_id}.png`;
                    const tempCertPath = path.join(tempDir, certFilename);

                    // Generate certificate to temporary file
                    await generateCertificate({
                        studentName: attendee.student_name,
                        eventTitle: attendee.event_title,
                        eventLocation: attendee.event_location,
                        eventStartDate: attendee.start_date,
                        eventEndDate: attendee.end_date,
                        certificatePath: tempCertPath
                    });

                    // Upload certificate to Cloudinary with corrected settings
                    const uploadResult = await uploadCertificateToCloudinary(tempCertPath, id, attendee.student_id);

                    // Save Cloudinary URL and public_id in database
                    await db.query(
                        `INSERT INTO certificates (student_id, event_id, certificate_url, certificate_public_id)
                         VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                         certificate_url = VALUES(certificate_url),
                         certificate_public_id = VALUES(certificate_public_id)`,
                        [attendee.student_id, id, uploadResult.secure_url, uploadResult.public_id]
                    );

                    // Clean up temporary file
                    try {
                        if (fs.existsSync(tempCertPath)) {
                            fs.unlinkSync(tempCertPath);
                        }
                    } catch (cleanupError) {
                        console.warn(`Failed to cleanup temp file: ${tempCertPath}`, cleanupError);
                    }

                } catch (certError) {
                    console.error(`Failed to generate/upload certificate for student ${attendee.student_id}:`, certError);
                    // Continue processing other certificates even if one fails
                }
            }

            // Auto-trash disabled - events will remain visible after completion
            // try {
            //     await eventService.deleteEvent(id, null);
            // } catch (e) {
            //     console.warn('Auto-trash on completion failed or already trashed:', e?.message || e);
            // }
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

        // Server-side geofence configuration for Gordon College (single campus)
        const GORDON_COLLEGE = { lat: 14.84, lon: 120.282 }; // approximate; update with verified coords if available
        const GEOFENCE_METERS = process.env.GEOFENCE_METERS ? Number(process.env.GEOFENCE_METERS) : 200; // default 200m
        const ACCURACY_THRESHOLD_METERS = process.env.ACCURACY_THRESHOLD_METERS ? Number(process.env.ACCURACY_THRESHOLD_METERS) : 100; // reject coarse fixes
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

        // Haversine distance
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

        const dist = haversineMeters(user_lat, user_lon, GORDON_COLLEGE.lat, GORDON_COLLEGE.lon);
        if (dist > GEOFENCE_METERS) {
            return handleErrorResponse(res, `User is outside allowed area (${Math.round(dist)} m).`, 403);
        }

        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');
        
        // Only organization officers and OSWS admins are allowed to scan
        if (!isOrgOfficer && !isAdmin) {
            return handleErrorResponse(res, 'Forbidden: Only organization officers and admins can mark attendance', 403);
        }

        // Get IDs based on role
        const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
        const adminId = isAdmin ? user.legacyId : null;

    // Note: Department-based restrictions intentionally not enforced. Cross-department registrations are allowed.

    // Determine registration/event pairing when one or both are missing.
        // 1) If both registration_id and event_id are missing, infer the most relevant within scanner scope.
        // 2) If event_id is provided but registration_id is missing, find the student's registration for that event.
        // 3) If registration_id is provided but event_id is missing, fetch its event and validate student.
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
                // Keep existing message to avoid frontend changes
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

    // Verify registration exists and belongs to provided values
        const [reg] = await db.query(
            'SELECT * FROM event_registrations WHERE id = ? AND event_id = ? AND student_id = ?',
            [registration_id, event_id, student_id]
        );
        if (reg.length === 0) {
            return handleErrorResponse(res, 'Registration not found', 404);
        }
        // Enforce approval for paid events: only approved registrations can attend
        const [evPaidRows] = await db.query('SELECT is_paid FROM created_events WHERE event_id = ? LIMIT 1', [event_id]);
        const isPaidEvent = !!(evPaidRows?.[0]?.is_paid);
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

        const scannedByOrgId = isOrgOfficer ? orgId : null;
        const scannedByOswsId = isAdmin ? adminId : null;
        const scannedByStudentId = isOrgOfficer ? user.studentId : null;

        // Helper writers
        const doTimeInInsert = async () => {
            await db.query(
                `INSERT INTO attendance_records (event_id, student_id, attended_at, time_in, scanned_by_org_id, scanned_by_osws_id, scanned_by_student_id, reported_lat, reported_lon, reported_accuracy, location_consent, reported_at)
                 VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [event_id, student_id, scannedByOrgId, scannedByOswsId, scannedByStudentId, user_lat, user_lon, user_accuracy, location_consent ? 1 : 0]
            );
        };
        const doTimeInUpdate = async (id) => {
            await db.query(
                `UPDATE attendance_records 
                 SET time_in = COALESCE(time_in, NOW()), attended_at = COALESCE(attended_at, NOW()),
                     scanned_by_org_id = COALESCE(scanned_by_org_id, ?),
                     scanned_by_osws_id = COALESCE(scanned_by_osws_id, ?),
                     scanned_by_student_id = COALESCE(scanned_by_student_id, ?),
                     reported_lat = ?, reported_lon = ?, reported_accuracy = ?, location_consent = ?, reported_at = NOW()
                 WHERE id = ?`,
                [scannedByOrgId, scannedByOswsId, scannedByStudentId, user_lat, user_lon, user_accuracy, location_consent ? 1 : 0, id]
            );
        };
        const doTimeOutUpdate = async (id) => {
            await db.query(
                `UPDATE attendance_records 
                 SET time_out = NOW(),
                     scanned_by_org_id = COALESCE(scanned_by_org_id, ?),
                     scanned_by_osws_id = COALESCE(scanned_by_osws_id, ?),
                     scanned_by_student_id = COALESCE(scanned_by_student_id, ?),
                     reported_lat = ?, reported_lon = ?, reported_accuracy = ?, location_consent = ?, reported_at = NOW()
                 WHERE id = ?`,
                [scannedByOrgId, scannedByOswsId, scannedByStudentId, user_lat, user_lon, user_accuracy, location_consent ? 1 : 0, id]
            );
        };

        // If explicit mode requested
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
            // No time_in yet on existing row (edge case) -> set it
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

        // Auto mode (legacy behavior): first scan -> time-in; second -> time-out
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
            // Students without officer/admin role should not access all attendance records
            return handleErrorResponse(res, 'Forbidden', 403);
        } else {
            // default fallback: return none
            records = [];
        }

        return handleSuccessResponse(res, records);
    } catch (error) {
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
        
        // Check roles array instead of userType for RBAC compatibility
        if (user.roles && user.roles.includes('orgofficer')) {
            // For OrgOfficers (including students with approved org officer role)
            // Use organization.org_id for students, or legacyId for legacy org accounts
            const orgId = user.organization?.org_id || user.legacyId;
            rows = await eventService.getTrashedOrgEvents(orgId);
        } else if (user.roles && user.roles.includes('oswsadmin')) {
            rows = await eventService.getTrashedOswsEvents(user.legacyId);
        } else {
            return handleErrorResponse(res, 'Forbidden', 403);
        }
        return handleSuccessResponse(res, rows);
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

// Permanently delete a trashed event (hard delete). Only allowed for the owner (org or OSWS) based on token.
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

// Dashboard stats for organizations: include concluded even if trashed; others exclude trashed
exports.getOrgDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);
        
        // RBAC: Check if user has OrgOfficer role
        const roles = user.roles || [];
        if (!roles.includes('orgofficer')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }

        // Use organization ID from JWT
        const orgId = user.organization?.org_id;
        if (!orgId) return handleErrorResponse(res, 'Organization ID not found', 400);

        const stats = await eventService.getOrgDashboardStats(orgId);
        return handleSuccessResponse(res, stats);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Dashboard stats for OSWS admin: counts across all OSWS-created events; include concluded even if trashed
exports.getOswsDashboardStats = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Unauthorized', 401);
        
        // RBAC: Check if user has OSWSAdmin role
        const roles = user.roles || [];
        if (!roles.includes('oswsadmin')) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }

        const stats = await eventService.getOswsDashboardStats();
        return handleSuccessResponse(res, stats);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getCertificatesByStudent = async (req, res) => {
    try {
        const { student_id } = req.query;
        if (!student_id) return res.status(400).json({ success: false, message: 'student_id required' });

        // Authorization: only the student themselves, an OrgOfficer for that student's org, or an OSWS admin may view certificates
        const user = req.user;
        if (!user) return handleErrorResponse(res, 'Authentication required', 401);
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        const isStudent = userRoles.includes('student');
        const isOrgOfficer = userRoles.includes('orgofficer');
        const isAdmin = userRoles.includes('oswsadmin');

        if (isStudent) {
            // students can only request their own certificates
            const studentIdFromToken = user.studentId || user.id || user.legacyId || null;
            if (String(studentIdFromToken) !== String(student_id)) {
                return handleErrorResponse(res, 'Forbidden', 403);
            }
        } else if (!isOrgOfficer && !isAdmin) {
            return handleErrorResponse(res, 'Forbidden', 403);
        }

        // Get all attended events with evaluation status
        const [attendedEvents] = await db.query(
            `SELECT ar.event_id, ce.title AS event_title, ce.start_date, ce.end_date, ce.start_time, ce.end_time,
                    ce.created_by_osws_id,
                    ar.evaluation_submitted, ar.evaluation_submitted_at,
                    c.id as cert_id, c.certificate_url, c.certificate_public_id, c.generated_at,
                    s.first_name, s.last_name, s.middle_initial, s.suffix, s.department, s.program
             FROM attendance_records ar
             JOIN created_events ce ON ar.event_id = ce.event_id
             JOIN students s ON ar.student_id = s.id
             LEFT JOIN certificates c ON c.event_id = ar.event_id AND c.student_id = ar.student_id
             WHERE ar.student_id = ? AND ar.deleted_at IS NULL AND ce.deleted_at IS NULL
             ORDER BY ce.end_date DESC, ce.start_date DESC`,
            [student_id]
        );

        // Build response with evaluation gate logic
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
                // Certificate availability
                id: event.cert_id,
                certificate_url: event.certificate_url,
                certificate_public_id: event.certificate_public_id,
                generated_at: event.generated_at,
                // Evaluation gate
                evaluation_required: true, // All events now require evaluation
                evaluation_submitted: hasEvaluated,
                evaluation_submitted_at: event.evaluation_submitted_at,
                can_download_certificate: hasEvaluated && hasCertificate,
                is_osws_event: isOswsEvent
            };
        });

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEventsByAdmin = async (req, res) => {
    try {
        const { admin_id } = req.params;
        const events = await eventService.getEventsByAdmin(admin_id);
        const host = req.protocol + '://' + req.get('host');
        const now = new Date();
        const computeAutoStatus = (ev) => {
            const statusStr = (ev.status || '').toString().toLowerCase();
            if (statusStr === 'cancelled') return null;
            const sd = ev.start_date ? new Date(`${ev.start_date}T${ev.start_time || '00:00:00'}`) : null;
            const ed = ev.end_date ? new Date(`${ev.end_date}T${ev.end_time || '23:59:59'}`) : null;
            if (!sd) return null;
            const start = sd;
            const end = ed && !isNaN(ed.getTime()) ? ed : new Date(`${ev.start_date}T${ev.end_time || '23:59:59'}`);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
            if (now < start) return 'not yet started';
            if (now >= start && now <= end) return 'ongoing';
            if (now > end) return 'concluded';
            return null;
        };
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
        return handleSuccessResponse(res, eventsWithPosterUrl);
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

exports.getAllOrgEvents = async (req, res) => {
    try {
        const events = await eventService.getAllOrgEvents();
        const host = req.protocol + '://' + req.get('host');
        const now = new Date();
        const computeAutoStatus = (ev) => {
            const statusStr = (ev.status || '').toString().toLowerCase();
            if (statusStr === 'cancelled') return null;
            const sd = ev.start_date ? new Date(`${ev.start_date}T${ev.start_time || '00:00:00'}`) : null;
            const ed = ev.end_date ? new Date(`${ev.end_date}T${ev.end_time || '23:59:59'}`) : null;
            if (!sd) return null;
            const start = sd;
            const end = ed && !isNaN(ed.getTime()) ? ed : new Date(`${ev.start_date}T${ev.end_time || '23:59:59'}`);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
            if (now < start) return 'not yet started';
            if (now >= start && now <= end) return 'ongoing';
            if (now > end) return 'concluded';
            return null;
        };
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
        return res.status(200).json({ success: true, data: eventsWithPosterUrl });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllOswsEvents = async (req, res) => {
    try {
        const events = await eventService.getAllOswsEvents();
        const host = req.protocol + '://' + req.get('host');
        const now = new Date();
        const computeAutoStatus = (ev) => {
            const statusStr = (ev.status || '').toString().toLowerCase();
            if (statusStr === 'cancelled') return null;
            const sd = ev.start_date ? new Date(`${ev.start_date}T${ev.start_time || '00:00:00'}`) : null;
            const ed = ev.end_date ? new Date(`${ev.end_date}T${ev.end_time || '23:59:59'}`) : null;
            if (!sd) return null;
            const start = sd;
            const end = ed && !isNaN(ed.getTime()) ? ed : new Date(`${ev.start_date}T${ev.end_time || '23:59:59'}`);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
            if (now < start) return 'not yet started';
            if (now >= start && now <= end) return 'ongoing';
            if (now > end) return 'concluded';
            return null;
        };
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

        // Normalize proof_of_payment to absolute URL if needed
        const host = req.protocol + '://' + req.get('host');
        const data = rows.map(r => ({
            ...r,
            proof_of_payment: r.proof_of_payment
                ? (r.proof_of_payment.startsWith('http')
                    ? r.proof_of_payment
                    : `${host}/${String(r.proof_of_payment).replace(/\\/g, '/')}`)
                : null
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('getEventParticipants error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Approve a pending registration
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

        // Get org_id for OrgOfficer
        const orgId = isOrgOfficer && user.organization ? user.organization.org_id : null;
        const adminId = isAdmin ? user.legacyId : null;

        // Load registration and event ownership
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
            `UPDATE event_registrations SET status = 'approved', approved_at = NOW(),
             approved_by_org_id = ?, approved_by_osws_id = ?
             WHERE id = ?`,
            [isOrgOfficer ? orgId : null, isAdmin ? adminId : null, registration_id]
        );
        // Notify student
        try {
            await notificationService.createNotification({
                user_id: String(rec.student_id),
                event_id: rec.event_id,
                message: `Your registration for "${rec.title}" has been approved.`
            });
        } catch (_) {}
        return handleSuccessResponse(res, { message: 'Registration approved' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
    }
};

// Reject a pending registration
exports.rejectRegistration = async (req, res) => {
    try {
        const user = req.user;
        const roles = user.roles || [];
        const isOrgOfficer = roles.includes('orgofficer');
        const isAdmin = roles.includes('oswsadmin');
        
        if (!user || (!isOrgOfficer && !isAdmin)) {
            return handleErrorResponse(res, 'Forbidden: Only organization officers and admins can reject registrations', 403);
        }
        
        const { registration_id } = req.params;
        if (!registration_id) return handleErrorResponse(res, 'registration_id required', 400);

        // Get org_id for OrgOfficer
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
            return handleErrorResponse(res, 'Forbidden: You can only reject registrations for your organization events', 403);
        }
        if (isAdmin && rec.created_by_osws_id !== adminId) {
            return handleErrorResponse(res, 'Forbidden: You can only reject registrations for your OSWS events', 403);
        }
        await db.query(`UPDATE event_registrations SET status = 'rejected' WHERE id = ?`, [registration_id]);
        try {
            await notificationService.createNotification({
                user_id: String(rec.student_id),
                event_id: rec.event_id,
                message: `Your registration for "${rec.title}" has been rejected.`
            });
        } catch (_) {}
        return handleSuccessResponse(res, { message: 'Registration rejected' });
    } catch (error) {
        return handleErrorResponse(res, error.message);
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
            // Keep consistency with createEvent: use Cloudinary URL when available
            eventData.event_poster = req.file.cloudinaryUrl || req.file.path;
            if (req.file.cloudinaryPublicId) {
                eventData.event_poster_public_id = req.file.cloudinaryPublicId;
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

        // Guard: prevent manual status change through PUT unless setting to 'cancelled'
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
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/event/events/:id/request-certificate
// Creates a notification to the event organizer (org or OSWS) from the authenticated student requesting an e‑certificate
exports.requestCertificate = async (req, res) => {
    try {
        const user = req.user;
        const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
        if (!user || !userRoles.includes('student')) {
            return handleErrorResponse(res, 'Only students can request certificates.', 403);
        }
        const eventId = req.params.id;
        if (!eventId) return handleErrorResponse(res, 'Event ID is required', 400);

        // Fetch event and organizer contact
        const [rows] = await db.query(
            `SELECT ce.event_id, ce.title, ce.location, ce.start_date, ce.end_date,
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
        // Server-side safety: block OSWS-created (auto-generated) certificates
        if (ev.created_by_osws_id) {
            return handleErrorResponse(res, 'Certificates are auto-generated for OSWS events.', 400);
        }
        
        // NEW: Require evaluation before certificate request for organization events
        const [evalCheck] = await db.query(
            `SELECT evaluation_submitted FROM attendance_records 
             WHERE event_id = ? AND student_id = ? LIMIT 1`,
            [eventId, user.id]
        );
        if (!evalCheck.length || evalCheck[0].evaluation_submitted !== 1) {
            return handleErrorResponse(res, 'Please complete the evaluation form before requesting a certificate.', 400);
        }
        
    const toOrgId = ev.created_by_org_id ? String(ev.created_by_org_id) : null;
    const toOswsId = ev.created_by_osws_id ? String(ev.created_by_osws_id) : null;
    if (!toOrgId && !toOswsId) return handleErrorResponse(res, 'Organizer account not available for this event.', 400);

        // Ensure log table exists (idempotent)
        await db.query(`
            CREATE TABLE IF NOT EXISTS certificate_request_logs (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                student_id VARCHAR(20) NOT NULL,
                requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_event_student_time (event_id, student_id, requested_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Enforce: max 2 requests per 48 hours per (student,event)
        const studentIdStr = String(user.id);
        const [cntRows] = await db.query(
            `SELECT COUNT(*) AS cnt FROM certificate_request_logs
             WHERE event_id = ? AND student_id = ? AND requested_at >= (NOW() - INTERVAL 48 HOUR)`,
            [eventId, studentIdStr]
        );
        const recentCount = Number(cntRows?.[0]?.cnt || 0);
        if (recentCount >= 2) {
            const [firstRows] = await db.query(
                `SELECT MIN(requested_at) AS first_in_window FROM certificate_request_logs
                 WHERE event_id = ? AND student_id = ? AND requested_at >= (NOW() - INTERVAL 48 HOUR)`,
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

        // Fetch student info
        const [srows] = await db.query(
            `SELECT id, email, first_name, last_name, middle_initial, suffix, department, program
             FROM students WHERE id = ? LIMIT 1`,
            [user.id]
        );
        const st = srows[0] || {};
        const studentName = [st.first_name, st.middle_initial ? `${st.middle_initial}.` : '', st.last_name, st.suffix || '']
            .filter(Boolean).join(' ').replace(/\s+/g, ' ');

    const subject = `E-Certificate Request: ${ev.title}`;

        // Format dates without timezone or time
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const normalizeDate = (value) => {
            if (!value) return null;
            if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
            if (typeof value === 'string') {
                const v = value.trim();
                // YYYY-MM-DD
                const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                if (m) {
                    const y = parseInt(m[1], 10);
                    const mo = parseInt(m[2], 10) - 1;
                    const d = parseInt(m[3], 10);
                    const dt = new Date(y, mo, d);
                    return isNaN(dt.getTime()) ? null : dt;
                }
                // Fallback: Date parse
                const d = new Date(v);
                return isNaN(d.getTime()) ? null : d;
            }
            if (typeof value === 'number') {
                const d = new Date(value);
                return isNaN(d.getTime()) ? null : d;
            }
            return null;
        };
        const formatDateHuman = (value) => {
            const d = normalizeDate(value);
            if (!d) return '';
            return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        };
        const startPretty = formatDateHuman(ev.start_date);
        const endPretty = formatDateHuman(ev.end_date || ev.start_date);
        const eventDatesLine = startPretty
            ? `Event ${startPretty === endPretty ? 'Date' : 'Dates'}: ${startPretty}${startPretty !== endPretty ? ` to ${endPretty}` : ''}`
            : undefined;

        const lines = [
            `Hello ${ev.org_name || ev.osws_name || 'Organizer'},`,
            '',
            `I attended the event "${ev.title}" and would like to request my e-certificate.`,
            `Student: ${studentName} (ID: ${st.id})`,
            `Email: ${st.email}`,
            eventDatesLine,
            ev.location ? `Location: ${ev.location}` : undefined,
            '',
            'Thank you.'
        ].filter(Boolean);
        const text = lines.join('\n');

        // Create notification to organizer account; OSWS-admin events already blocked earlier
        try {
            await notificationService.createNotification({
                user_id: toOrgId || toOswsId,
                event_id: ev.event_id,
                message: `[${subject}]\n${text}`.slice(0, 480) // keep within 500 chars
            });
        } catch (nerr) {
            console.warn('Notification create failed (requestCertificate):', nerr?.message || nerr);
        }
        // Log successful request
        await db.query(
            'INSERT INTO certificate_request_logs (event_id, student_id) VALUES (?, ?)',
            [eventId, studentIdStr]
        );
        return handleSuccessResponse(res, { message: 'Certificate request submitted.' });
    } catch (error) {
        console.error('requestCertificate error:', error);
        return handleErrorResponse(res, error.message);
    }
};