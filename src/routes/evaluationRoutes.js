const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const authenticateToken = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Evaluation rate limiters
const submitLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10 }); // 10 submissions per 5 minutes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 }); // 60 requests per minute

// Evaluation routes — all endpoints require authentication
// Submit evaluation for an event (students only)
router.post('/events/:event_id/evaluations', authenticateToken, submitLimiter, evaluationController.submitEvaluation);

// --- Specific sub-paths MUST come before the generic GET /:event_id/evaluations ---
// Get evaluation status for current student and event
router.get('/events/:event_id/evaluations/status', authenticateToken, apiLimiter, evaluationController.getEvaluationStatus);

// Get student's submitted evaluation
router.get('/events/:event_id/evaluations/me', authenticateToken, apiLimiter, evaluationController.getMyEvaluation);

// Debug route: raw evaluation rows (admin/orgofficer only)
router.get('/events/:event_id/evaluations/raw', authenticateToken, apiLimiter, evaluationController.getRawEvaluations);

// Get all evaluations for an event (organizers/admins only) — most general, must be last
router.get('/events/:event_id/evaluations', authenticateToken, apiLimiter, evaluationController.getEventEvaluations);

module.exports = router;
