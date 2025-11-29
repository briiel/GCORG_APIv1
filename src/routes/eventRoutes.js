const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticateToken = require('../middleware/authMiddleware'); // Protect routes
const { checkRole } = require('../middleware/checkRole');
const { upload, convertToWebpAndUpload } = require('../middleware/uploadMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Different rate limiters for different operation types
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 requests per minute (attendance, registrations)
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 requests per minute (general reads)
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 }); // 20 requests per minute (uploads/creates)

router.post(
    '/events',
    authenticateToken,
    uploadLimiter,
    upload.single('event_poster'),
    convertToWebpAndUpload,
    eventController.createEvent
); // Create a new event
router.get('/events', authenticateToken, apiLimiter, eventController.getEvents); // Get all events
router.post('/events/register', authenticateToken, strictLimiter, eventController.registerParticipant); // Register a participant for an event
router.get('/participants/:student_id/events', authenticateToken, apiLimiter, eventController.getEventsByParticipant); // Get events a participant registered in
router.get('/students/:student_id/attended', authenticateToken, apiLimiter, eventController.getAttendedEventsByStudent); // Get events a student attended (history)
router.get('/events/creator/:creator_id', authenticateToken, apiLimiter, eventController.getEventsByCreator); // Get events by creator/org
router.patch('/events/:id/status', authenticateToken, strictLimiter, eventController.updateEventStatus); // Update event status
router.post('/events/attendance', authenticateToken, strictLimiter, eventController.markAttendance); // Mark attendance for an event
router.get('/attendance-records', authenticateToken, apiLimiter, eventController.getAllAttendanceRecords); // Get all attendance records
router.get('/attendance-records/event/:eventId', authenticateToken, apiLimiter, eventController.getAttendanceRecordsByEvent); // Get attendance records for a specific event
router.delete('/events/:id', authenticateToken, strictLimiter, eventController.deleteEvent); // Soft-delete an event
// Bulk trash (soft-delete) multiple events
router.post('/events/trash-multiple', authenticateToken, strictLimiter, eventController.trashMultipleEvents); // Trash multiple events
router.get('/events/trash', authenticateToken, apiLimiter, eventController.getTrashedEvents); // List trashed events for current user
router.post('/events/:id/restore', authenticateToken, strictLimiter, eventController.restoreEvent); // Restore trashed event
router.delete('/events/:id/permanent', authenticateToken, strictLimiter, eventController.permanentDeleteEvent); // Permanently delete a trashed event
router.get('/certificates', authenticateToken, apiLimiter, eventController.getCertificatesByStudent); // Get certificates by student (requires auth)
router.get('/events/admin/:admin_id', authenticateToken, checkRole(['OSWSAdmin']), apiLimiter, eventController.getEventsByAdmin); // Get events by admin (OSWSAdmin only)
router.get('/events/organizations', apiLimiter, eventController.getAllOrgEvents); // Get all events by organizations (public)
router.get('/events/osws', apiLimiter, eventController.getAllOswsEvents); // Route for all OSWS-created events (public)
router.get('/:event_id/participants', authenticateToken, apiLimiter, eventController.getEventParticipants); // Get participants of an event (requires auth)
// Registration approval endpoints
router.post('/registrations/:registration_id/approve', authenticateToken, strictLimiter, eventController.approveRegistration);
router.post('/registrations/:registration_id/reject', authenticateToken, strictLimiter, eventController.rejectRegistration);
router.get('/events/:id', apiLimiter, eventController.getEventById);
router.put('/events/:id', authenticateToken, uploadLimiter, upload.single('event_poster'), convertToWebpAndUpload, eventController.updateEvent);
router.post('/events/:id/request-certificate', authenticateToken, strictLimiter, eventController.requestCertificate);
router.post('/events/:id/request-certificate', authenticateToken, strictLimiter, eventController.requestCertificate);

// Dashboard stats endpoints
router.get('/stats/organization', authenticateToken, apiLimiter, eventController.getOrgDashboardStats);
router.get('/stats/osws', authenticateToken, apiLimiter, eventController.getOswsDashboardStats);
// Charts/aggregation for OSWS dashboard (events by department, activities per org)
router.get('/stats/osws/charts', authenticateToken, apiLimiter, eventController.getOswsDashboardCharts);

module.exports = router;