const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticateToken = require('../middleware/authMiddleware'); // Protect routes
const { upload, convertToWebp } = require('../middleware/uploadMiddleware');

router.post(
    '/events',
    authenticateToken,
    upload.single('event_poster'),
    convertToWebp,
    eventController.createEvent
); // Create a new event
router.get('/events', authenticateToken, eventController.getEvents); // Get all events
router.post('/events/register', authenticateToken, eventController.registerParticipant); // Register a participant for an event
router.get('/participants/:student_id/events', authenticateToken, eventController.getEventsByParticipant); // Get events a participant registered in
router.get('/events/creator/:creator_id', authenticateToken, eventController.getEventsByCreator); // Get events by creator/org
router.patch('/events/:id/status', eventController.updateEventStatus); // Update event status
router.post('/events/attendance', authenticateToken, eventController.markAttendance); // Mark attendance for an event
router.get('/attendance-records', authenticateToken, eventController.getAllAttendanceRecords); // Get all attendance records
router.delete('/events/:id', eventController.deleteEvent); // Delete an event
router.get('/certificates', eventController.getCertificatesByStudent); // Get certificates by student
router.get('/events/admin/:admin_id', eventController.getEventsByAdmin); // Get events by admin
router.get('/events/organizations', eventController.getAllOrgEvents); // Get all events by organizations
router.get('/events/osws', eventController.getAllOswsEvents); // Route for all OSWS-created events
router.get('/:event_id/participants', eventController.getEventParticipants); // Get participants of an event
router.get('/events/:id', eventController.getEventById);
router.put('/events/:id', upload.single('event_poster'), convertToWebp, eventController.updateEvent);

module.exports = router;