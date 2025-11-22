const certificateRequestService = require('../services/certificateRequestService');
const notificationService = require('../services/notificationService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');
const db = require('../config/db');
const { generateCertificate } = require('../utils/certificateGenerator');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Upload certificate to Cloudinary
const uploadCertificateToCloudinary = async (tempCertPath, eventId, studentId) => {
	const cloudinaryPublicId = `certificate_${eventId}_${studentId}`;
	const uploadResult = await cloudinary.uploader.upload(tempCertPath, {
		resource_type: 'image',
		public_id: cloudinaryPublicId,
		folder: 'certificates',
		format: 'png',
		quality: 'auto:best',
		access_mode: 'public'
	});
	return uploadResult;
};

// GET /api/certificates/requests - Get all certificate requests for an organization
exports.getCertificateRequests = async (req, res) => {
	try {
		const user = req.user;
		if (!user) {
			return handleErrorResponse(res, 'Unauthorized', 401);
		}
		
		// Only organization officers can view certificate requests
		const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
		if (!userRoles.includes('orgofficer')) {
			return handleErrorResponse(res, 'Only organization officers can view certificate requests.', 403);
		}
		
		// Get organization ID from user
		const orgId = user.organization?.org_id || user.organization_id || user.orgId;
		if (!orgId) {
			return handleErrorResponse(res, 'Organization ID not found.', 400);
		}
		
		const requests = await certificateRequestService.getCertificateRequestsByOrg(orgId);
		return handleSuccessResponse(res, requests);
	} catch (error) {
		console.error('getCertificateRequests error:', error);
		return handleErrorResponse(res, error.message);
	}
};

// POST /api/certificates/requests/:id/approve - Approve certificate request and generate certificate
exports.approveCertificateRequest = async (req, res) => {
	try {
		const user = req.user;
		if (!user) {
			return handleErrorResponse(res, 'Unauthorized', 401);
		}
		
		const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
		if (!userRoles.includes('orgofficer')) {
			return handleErrorResponse(res, 'Only organization officers can approve certificate requests.', 403);
		}
		
		const requestId = req.params.id;
		const request = await certificateRequestService.getCertificateRequestById(requestId);
		
		if (!request) {
			return handleErrorResponse(res, 'Certificate request not found.', 404);
		}
		
		if (request.status !== 'pending') {
			return handleErrorResponse(res, 'This request has already been processed.', 400);
		}
		
		// Verify that the user belongs to the organization that created the event
		const orgId = user.organization?.org_id || user.organization_id || user.orgId;
		if (request.created_by_org_id !== orgId) {
			return handleErrorResponse(res, 'You do not have permission to approve this request.', 403);
		}
		
		// Fetch full event and student details for certificate generation
		const [eventRows] = await db.query(
			`SELECT event_id, title, location, start_date, end_date 
			 FROM created_events WHERE event_id = ? LIMIT 1`,
			[request.event_id]
		);
		const event = eventRows[0];
		
		const [studentRows] = await db.query(
			`SELECT id, first_name, middle_initial, last_name, suffix 
			 FROM students WHERE id = ? LIMIT 1`,
			[request.student_id]
		);
		const student = studentRows[0];
		
		// Build student name
		const studentName = [
			student.first_name,
			student.middle_initial ? `${student.middle_initial}.` : '',
			student.last_name,
			student.suffix || ''
		].filter(Boolean).join(' ').replace(/\s+/g, ' ');
		
		// Generate certificate
		const tempCertPath = path.join(os.tmpdir(), `cert_${event.event_id}_${student.id}_${Date.now()}.png`);
		
		await generateCertificate({
			studentName,
			eventTitle: event.title,
			eventStartDate: event.start_date,
			eventEndDate: event.end_date,
			eventLocation: event.location,
			certificatePath: tempCertPath
		});
		
		// Upload to Cloudinary
		const uploadResult = await uploadCertificateToCloudinary(tempCertPath, event.event_id, student.id);
		
		// Clean up temp file
		if (fs.existsSync(tempCertPath)) {
			fs.unlinkSync(tempCertPath);
		}
		
		// Update request status
		await certificateRequestService.updateCertificateRequestStatus(requestId, {
			status: 'approved',
			processed_by: user.id,
			certificate_url: uploadResult.secure_url
		});
		
		// Send notification to student
		try {
			await notificationService.createNotification({
				user_id: request.student_id,
				event_id: request.event_id,
				message: `✅ Your certificate request for "${event.title}" has been approved! View it in your E-Certificates.`
			});
		} catch (nerr) {
			console.warn('Notification create failed (approveCertificate):', nerr?.message || nerr);
		}
		
		return handleSuccessResponse(res, { 
			message: 'Certificate request approved and certificate generated.',
			certificate_url: uploadResult.secure_url
		});
	} catch (error) {
		console.error('approveCertificateRequest error:', error);
		return handleErrorResponse(res, error.message);
	}
};

// POST /api/certificates/requests/:id/reject - Reject certificate request
exports.rejectCertificateRequest = async (req, res) => {
	try {
		const user = req.user;
		if (!user) {
			return handleErrorResponse(res, 'Unauthorized', 401);
		}
		
		const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
		if (!userRoles.includes('orgofficer')) {
			return handleErrorResponse(res, 'Only organization officers can reject certificate requests.', 403);
		}
		
		const requestId = req.params.id;
		const { rejection_reason } = req.body;
		
		const request = await certificateRequestService.getCertificateRequestById(requestId);
		
		if (!request) {
			return handleErrorResponse(res, 'Certificate request not found.', 404);
		}
		
		if (request.status !== 'pending') {
			return handleErrorResponse(res, 'This request has already been processed.', 400);
		}
		
		// Verify that the user belongs to the organization that created the event
		const orgId = user.organization?.org_id || user.organization_id || user.orgId;
		if (request.created_by_org_id !== orgId) {
			return handleErrorResponse(res, 'You do not have permission to reject this request.', 403);
		}
		
		// Update request status
		await certificateRequestService.updateCertificateRequestStatus(requestId, {
			status: 'rejected',
			processed_by: user.id,
			rejection_reason: rejection_reason || 'No reason provided'
		});
		
		// Send notification to student
		try {
			const reasonText = rejection_reason ? ` Reason: ${rejection_reason}` : '';
			await notificationService.createNotification({
				user_id: request.student_id,
				event_id: request.event_id,
				message: `❌ Your certificate request for "${request.event_title}" was not approved.${reasonText}`
			});
		} catch (nerr) {
			console.warn('Notification create failed (rejectCertificate):', nerr?.message || nerr);
		}
		
		return handleSuccessResponse(res, { message: 'Certificate request rejected.' });
	} catch (error) {
		console.error('rejectCertificateRequest error:', error);
		return handleErrorResponse(res, error.message);
	}
};

// PATCH /api/certificates/requests/:id/status - Update certificate request status (simplified)
exports.updateCertificateRequestStatus = async (req, res) => {
	try {
		const user = req.user;
		if (!user) {
			return handleErrorResponse(res, 'Unauthorized', 401);
		}
		
		const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
		if (!userRoles.includes('orgofficer')) {
			return handleErrorResponse(res, 'Only organization officers can update certificate request status.', 403);
		}
		
		const requestId = req.params.id;
		const { status } = req.body;
		
		// Only allow updating to specific statuses
		const allowedStatuses = ['pending', 'processing', 'sent'];
		if (!allowedStatuses.includes(status)) {
			return handleErrorResponse(res, `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`, 400);
		}
		
		const request = await certificateRequestService.getCertificateRequestById(requestId);
		
		if (!request) {
			return handleErrorResponse(res, 'Certificate request not found.', 404);
		}
		
		// Verify that the user belongs to the organization that created the event
		const orgId = user.organization?.org_id || user.organization_id || user.orgId;
		if (request.created_by_org_id !== orgId) {
			return handleErrorResponse(res, 'You do not have permission to update this request.', 403);
		}
		
		// Update request status
		await certificateRequestService.updateCertificateRequestStatus(requestId, {
			status,
			processed_by: user.id
		});
		
		// Send notification to student based on status
		try {
			let message = '';
			if (status === 'processing') {
				message = `🔄 Your certificate request for "${request.event_title}" is now being processed.`;
			} else if (status === 'sent') {
				message = `✅ Your certificate for "${request.event_title}" has been sent! Check your email.`;
			} else if (status === 'pending') {
				message = `⏳ Your certificate request for "${request.event_title}" is pending review.`;
			}
			
			if (message) {
				await notificationService.createNotification({
					user_id: request.student_id,
					event_id: request.event_id,
					message
				});
			}
		} catch (nerr) {
			console.warn('Notification create failed (updateStatus):', nerr?.message || nerr);
		}
		
		return handleSuccessResponse(res, { 
			message: `Certificate request status updated to ${status}.`,
			status
		});
	} catch (error) {
		console.error('updateCertificateRequestStatus error:', error);
		return handleErrorResponse(res, error.message);
	}
};
