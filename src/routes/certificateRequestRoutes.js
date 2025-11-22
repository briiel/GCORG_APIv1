const express = require('express');
const router = express.Router();
const certificateRequestController = require('../controllers/certificateRequestController');
const authenticateToken = require('../middleware/authMiddleware');

// Get all certificate requests for an organization
router.get('/requests', authenticateToken, certificateRequestController.getCertificateRequests);

// Approve a certificate request
router.post('/requests/:id/approve', authenticateToken, certificateRequestController.approveCertificateRequest);

// Reject a certificate request
router.post('/requests/:id/reject', authenticateToken, certificateRequestController.rejectCertificateRequest);

// Update certificate request status (simplified - pending/processing/sent)
router.patch('/requests/:id/status', authenticateToken, certificateRequestController.updateCertificateRequestStatus);

module.exports = router;
