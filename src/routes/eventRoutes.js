const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authenticateToken = require('../middleware/authMiddleware'); // Protect routes

router.post('/events', authenticateToken, eventController.createEvent); // Create a new event
router.get('/events', authenticateToken, eventController.getEvents); // Get all events

module.exports = router;