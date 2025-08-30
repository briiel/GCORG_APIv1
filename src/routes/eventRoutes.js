const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticateToken = require('../middleware/authMiddleware'); // Protect routes
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
router.get('/events/creator/:creator_id', authenticateToken, eventController.getEventsByCreator); // Get events by creator/org
router.patch('/events/:id/status', authenticateToken, eventController.updateEventStatus); // Update event status
router.post('/events/attendance', authenticateToken, eventController.markAttendance); // Mark attendance for an event
router.get('/attendance-records', authenticateToken, eventController.getAllAttendanceRecords); // Get all attendance records
router.get('/attendance-records/event/:eventId', authenticateToken, eventController.getAttendanceRecordsByEvent); // Get attendance records for a specific event
router.delete('/events/:id', authenticateToken, eventController.deleteEvent); // Soft-delete an event
router.get('/events/trash', authenticateToken, eventController.getTrashedEvents); // List trashed events for current user
router.post('/events/:id/restore', authenticateToken, eventController.restoreEvent); // Restore trashed event
router.delete('/events/:id/permanent', authenticateToken, eventController.permanentDeleteEvent); // Permanently delete a trashed event
router.get('/certificates', eventController.getCertificatesByStudent); // Get certificates by student
router.get('/events/admin/:admin_id', eventController.getEventsByAdmin); // Get events by admin
router.get('/events/organizations', eventController.getAllOrgEvents); // Get all events by organizations
router.get('/events/osws', eventController.getAllOswsEvents); // Route for all OSWS-created events
router.get('/:event_id/participants', eventController.getEventParticipants); // Get participants of an event
router.get('/events/:id', eventController.getEventById);
router.put('/events/:id', upload.single('event_poster'), convertToWebpAndUpload, eventController.updateEvent);

// Dashboard stats endpoints
router.get('/stats/organization', authenticateToken, eventController.getOrgDashboardStats);
router.get('/stats/osws', authenticateToken, eventController.getOswsDashboardStats);

module.exports = router;