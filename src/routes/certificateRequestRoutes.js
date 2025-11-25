const express = require('express');
const router = express.Router();
const certificateRequestController = require('../controllers/certificateRequestController');
const authenticateToken = require('../middleware/authMiddleware');

// Basic param/body validators
const validateIdParam = (req, res, next) => {
	const id = req.params.id;
	if (!id || isNaN(Number(id))) return res.status(400).json({ success: false, message: 'Invalid or missing id parameter.' });
	next();
};

const validateStatusBody = (req, res, next) => {
	const { status } = req.body || {};
	const allowedStatuses = ['pending', 'processing', 'sent'];
	if (!status || !allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
	next();
};

// Get all certificate requests for an organization
router.get('/requests', authenticateToken, certificateRequestController.getCertificateRequests);

// Approve a certificate request
router.post('/requests/:id/approve', authenticateToken, validateIdParam, certificateRequestController.approveCertificateRequest);

// Reject a certificate request
router.post('/requests/:id/reject', authenticateToken, validateIdParam, certificateRequestController.rejectCertificateRequest);

// Update certificate request status (simplified - pending/processing/sent)
router.patch('/requests/:id/status', authenticateToken, validateIdParam, validateStatusBody, certificateRequestController.updateCertificateRequestStatus);

module.exports = router;
