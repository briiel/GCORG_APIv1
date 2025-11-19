const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticateToken = require('../middleware/authMiddleware'); // Protect routes
const { checkRole } = require('../middleware/checkRole');
const { upload, convertToWebpAndUpload } = require('../middleware/uploadMiddleware');

router.post(
    '/events',
    authenticateToken,
    upload.single('event_poster'),
    convertToWebpAndUpload,
    eventController.createEvent
); // Create a new event
router.get('/events', authenticateToken, eventController.getEvents); // Get all events
router.post('/events/register', authenticateToken, eventController.registerParticipant); // Register a participant for an event
router.get('/participants/:student_id/events', authenticateToken, eventController.getEventsByParticipant); // Get events a participant registered in
router.get('/students/:student_id/attended', authenticateToken, eventController.getAttendedEventsByStudent); // Get events a student attended (history)
router.get('/events/creator/:creator_id', authenticateToken, eventController.getEventsByCreator); // Get events by creator/org
router.patch('/events/:id/status', authenticateToken, eventController.updateEventStatus); // Update event status
router.post('/events/attendance', authenticateToken, eventController.markAttendance); // Mark attendance for an event
router.get('/attendance-records', authenticateToken, eventController.getAllAttendanceRecords); // Get all attendance records
router.get('/attendance-records/event/:eventId', authenticateToken, eventController.getAttendanceRecordsByEvent); // Get attendance records for a specific event
router.delete('/events/:id', authenticateToken, eventController.deleteEvent); // Soft-delete an event
// Bulk trash (soft-delete) multiple events
router.post('/events/trash-multiple', authenticateToken, eventController.trashMultipleEvents); // Trash multiple events
router.get('/events/trash', authenticateToken, eventController.getTrashedEvents); // List trashed events for current user
router.post('/events/:id/restore', authenticateToken, eventController.restoreEvent); // Restore trashed event
router.delete('/events/:id/permanent', authenticateToken, eventController.permanentDeleteEvent); // Permanently delete a trashed event
router.get('/certificates', authenticateToken, eventController.getCertificatesByStudent); // Get certificates by student (requires auth)
router.get('/events/admin/:admin_id', authenticateToken, checkRole(['OSWSAdmin']), eventController.getEventsByAdmin); // Get events by admin (OSWSAdmin only)
router.get('/events/organizations', eventController.getAllOrgEvents); // Get all events by organizations (public)
router.get('/events/osws', eventController.getAllOswsEvents); // Route for all OSWS-created events (public)
router.get('/:event_id/participants', authenticateToken, eventController.getEventParticipants); // Get participants of an event (requires auth)
// Registration approval endpoints
router.post('/registrations/:registration_id/approve', authenticateToken, eventController.approveRegistration);
router.post('/registrations/:registration_id/reject', authenticateToken, eventController.rejectRegistration);
router.get('/events/:id', eventController.getEventById);
router.put('/events/:id', authenticateToken, upload.single('event_poster'), convertToWebpAndUpload, eventController.updateEvent);
router.post('/events/:id/request-certificate', authenticateToken, eventController.requestCertificate);
router.post('/events/:id/request-certificate', authenticateToken, eventController.requestCertificate);

// Dashboard stats endpoints
router.get('/stats/organization', authenticateToken, eventController.getOrgDashboardStats);
router.get('/stats/osws', authenticateToken, eventController.getOswsDashboardStats);

module.exports = router;