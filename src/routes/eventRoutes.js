const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticateToken = require('../middleware/authMiddleware'); // Protect routes
const upload = require('../middleware/uploadMiddleware');

router.post('/events', authenticateToken, upload.single('event_poster'), eventController.createEvent); // Create a new event
router.get('/events', authenticateToken, eventController.getEvents); // Get all events
router.post('/events/register', authenticateToken, eventController.registerParticipant); // Register a participant for an event
router.get('/participants/:student_id/events', authenticateToken, eventController.getEventsByParticipant); // Get events a participant registered in
router.get('/events/creator/:creator_id', authenticateToken, eventController.getEventsByCreator); // Get events by creator/org
router.patch('/events/:id/status', eventController.updateEventStatus); // Update event status
router.post('/events/attendance', authenticateToken, eventController.markAttendance); // Mark attendance for an event

module.exports = router;