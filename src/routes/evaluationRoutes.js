const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const authenticateToken = require('../middleware/authMiddleware');

/**
 * Evaluation Routes
 * All routes require authentication
 */

// Submit evaluation for an event (students only)
router.post('/events/:event_id/evaluations', authenticateToken, evaluationController.submitEvaluation);

// Get evaluation status for current student and event
router.get('/events/:event_id/evaluations/status', authenticateToken, evaluationController.getEvaluationStatus);

// Get student's submitted evaluation
router.get('/events/:event_id/evaluations/me', authenticateToken, evaluationController.getMyEvaluation);

// Get all evaluations for an event (organizers/admins only)
router.get('/events/:event_id/evaluations', authenticateToken, evaluationController.getEventEvaluations);

module.exports = router;
