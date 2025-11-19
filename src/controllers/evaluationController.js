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
    
    if (!responses || typeof responses !== 'object') {
      return handleErrorResponse(res, 'Evaluation responses are required.', 400);
    }
    
    const result = await evaluationService.submitEvaluation({
      event_id,
      student_id: user.id,
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
    
    const status = await evaluationService.getEvaluationStatus(event_id, user.id);
    
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
    
    const evaluation = await evaluationService.getStudentEvaluation(event_id, user.id);
    
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
    
    return handleSuccessResponse(res, data);
  } catch (error) {
    return handleErrorResponse(res, error.message);
  }
};
