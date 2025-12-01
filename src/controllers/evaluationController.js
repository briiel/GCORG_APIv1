const evaluationService = require('../services/evaluationService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');

/**
 * Evaluation Controller
 * Handles HTTP requests for event evaluations
 */

// Submit evaluation for an event
exports.submitEvaluation = async (req, res) => {
  try {
    const user = req.user;
    const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
    if (!user || !userRoles.includes('student')) {
      return handleErrorResponse(res, 'Only students can submit evaluations.', 403);
    }
    
    const { event_id } = req.params;
    const { responses } = req.body;
    // Use explicit student identifier when available (tokens may carry legacy id or studentId)
    const studentId = user.studentId || user.id;
    
    if (!responses || typeof responses !== 'object') {
      return handleErrorResponse(res, 'Evaluation responses are required.', 400);
    }
    
    const result = await evaluationService.submitEvaluation({
      event_id,
      student_id: studentId,
      responses
    });
    
    return handleSuccessResponse(res, result, 201);
  } catch (error) {
    return handleErrorResponse(res, error.message);
  }
};

// Get evaluation status for a student and event
exports.getEvaluationStatus = async (req, res) => {
  try {
    const user = req.user;
    const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
    if (!user || !userRoles.includes('student')) {
      return handleErrorResponse(res, 'Unauthorized', 403);
    }
    
    const { event_id } = req.params;
    const studentId = user.studentId || user.id;

    const status = await evaluationService.getEvaluationStatus(event_id, studentId);
    
    return handleSuccessResponse(res, status);
  } catch (error) {
    return handleErrorResponse(res, error.message);
  }
};

// Get student's submitted evaluation
exports.getMyEvaluation = async (req, res) => {
  try {
    const user = req.user;
    const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
    if (!user || !userRoles.includes('student')) {
      return handleErrorResponse(res, 'Unauthorized', 403);
    }
    
    const { event_id } = req.params;
    const studentId = user.studentId || user.id;

    const evaluation = await evaluationService.getStudentEvaluation(event_id, studentId);
    
    return handleSuccessResponse(res, evaluation);
  } catch (error) {
    return handleErrorResponse(res, error.message);
  }
};

// Get all evaluations for an event (organizers/admins only)
exports.getEventEvaluations = async (req, res) => {
  try {
    const user = req.user;
    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    if (!user || (!userRoles.includes('orgofficer') && !userRoles.includes('oswsadmin'))) {
      return handleErrorResponse(res, 'Forbidden', 403);
    }
    
    const { event_id } = req.params;
    
    const data = await evaluationService.getEventEvaluations(event_id, user);

    return handleSuccessResponse(res, { items: Array.isArray(data) ? data : [] });
  } catch (error) {
    return handleErrorResponse(res, error.message);
  }
};

// Admin debug: return raw evaluation rows (no joins) for easier inspection
exports.getRawEvaluations = async (req, res) => {
  try {
    const user = req.user;
    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    if (!user || (!userRoles.includes('orgofficer') && !userRoles.includes('oswsadmin'))) {
      return handleErrorResponse(res, 'Forbidden', 403);
    }

    const { event_id } = req.params;
    const data = await evaluationService.getRawEvaluations(event_id);
    return handleSuccessResponse(res, { items: Array.isArray(data) ? data : [] });
  } catch (error) {
    return handleErrorResponse(res, error.message);
  }
};
