const certificateRequestService = require('../services/certificateRequestService');
const notificationService = require('../services/notificationService');
const { handleErrorResponse, handleSuccessResponse } = require('../utils/errorHandler');
const db = require('../config/db');
const { generateCertificate } = require('../utils/certificateGenerator');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const { promises: fsPromises } = fs;
const path = require('path');
const os = require('os');

// Upload certificate to Cloudinary
const uploadCertificateToCloudinary = async (tempCertPath, eventId, studentId) => {
	const cloudinaryPublicId = `certificate_${eventId}_${studentId}`;
	return cloudinary.uploader.upload(tempCertPath, {
		resource_type: 'image',
		public_id: cloudinaryPublicId,
		folder: 'certificates',
		format: 'png',
		quality: 'auto:best',
		access_mode: 'public'
	});
};

// Helpers
const userIsOrgOfficer = (user) => {
	if (!user) return false;
	const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
	const normalizedRoles = userRoles.map(r => String(r).toLowerCase());
	return normalizedRoles.includes('orgofficer') || normalizedRoles.includes('organization') || normalizedRoles.includes('org_officer');
};

const getOrgIdFromUser = (user) => user?.organization?.org_id || user?.organization_id || user?.orgId;

// GET /api/certificates/requests - Get all certificate requests for an organization
exports.getCertificateRequests = async (req, res) => {
	try {
		const user = req.user;
		if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

		if (!userIsOrgOfficer(user)) return handleErrorResponse(res, 'Only organization officers can view certificate requests.', 403);

		const orgId = getOrgIdFromUser(user);
		if (!orgId) return handleErrorResponse(res, 'Organization ID not found.', 400);

		const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
		const per_page = req.query.per_page ? parseInt(req.query.per_page, 10) : undefined;
		const result = await certificateRequestService.getCertificateRequestsByOrg(orgId, { page, per_page });
		if (result && result.items && Array.isArray(result.items)) {
			return handleSuccessResponse(res, result);
		}
		return handleSuccessResponse(res, { items: Array.isArray(result) ? result : [] });
	} catch (error) {
		console.error('getCertificateRequests error:', error);
		return handleErrorResponse(res, error.message);
	}
};

// POST /api/certificates/requests/:id/approve - Approve certificate request and generate certificate
exports.approveCertificateRequest = async (req, res) => {
	let tempCertPath;
	try {
		const user = req.user;
		if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

		if (!userIsOrgOfficer(user)) return handleErrorResponse(res, 'Only organization officers can approve certificate requests.', 403);

		const requestId = req.params.id;
		const request = await certificateRequestService.getCertificateRequestById(requestId);
		if (!request) return handleErrorResponse(res, 'Certificate request not found.', 404);
		if (request.status !== 'pending') return handleErrorResponse(res, 'This request has already been processed.', 400);

		const orgId = getOrgIdFromUser(user);
		if (request.created_by_org_id !== orgId) return handleErrorResponse(res, 'You do not have permission to approve this request.', 403);

		// Fetch event and student
		const [eventRows] = await db.query(`SELECT event_id, title, location, room, start_date, end_date FROM created_events WHERE event_id = ? LIMIT 1`, [request.event_id]);
		const event = eventRows && eventRows[0];
		if (!event) return handleErrorResponse(res, 'Event not found for this request.', 404);

		const [studentRows] = await db.query(`SELECT id, first_name, middle_initial, last_name, suffix, COALESCE(year_level,4) AS year_level FROM students WHERE id = ? LIMIT 1`, [request.student_id]);
		const student = studentRows && studentRows[0];
		if (!student) return handleErrorResponse(res, 'Student not found for this request.', 404);

		// Build student name
		const studentName = [
			student.first_name,
			student.middle_initial ? `${student.middle_initial}.` : '',
			student.last_name,
			student.suffix || ''
		].filter(Boolean).join(' ').replace(/\s+/g, ' ');

		// Generate certificate to a temp file
		tempCertPath = path.join(os.tmpdir(), `cert_${event.event_id}_${student.id}_${Date.now()}.png`);
		await generateCertificate({
			studentName,
			eventTitle: event.title,
			eventStartDate: event.start_date,
			eventEndDate: event.end_date,
			eventLocation: event.room || event.location,
			certificatePath: tempCertPath
		});

		// Upload to Cloudinary
		const uploadResult = await uploadCertificateToCloudinary(tempCertPath, event.event_id, student.id);
		const secureUrl = uploadResult && uploadResult.secure_url;
		if (!secureUrl) throw new Error('Failed to upload certificate to storage.');

		// Update request status
		await certificateRequestService.updateCertificateRequestStatus(requestId, {
			status: 'approved',
			processed_by: user.id,
			certificate_url: secureUrl
		});

		// Send notification to student (best-effort)
		try {
			const msg = `Your certificate request for "${event.title}" has been approved. View it in your E-Certificates.`;
			await notificationService.createNotification({ user_id: request.student_id, event_id: request.event_id, message: msg, panel: 'student' });
		} catch (nerr) {
			console.warn('Notification create failed (approveCertificate):', nerr?.message || nerr);
		}

		return handleSuccessResponse(res, { message: 'Certificate request approved and certificate generated.', certificate_url: secureUrl });
	} catch (error) {
		console.error('approveCertificateRequest error:', error);
		return handleErrorResponse(res, error.message);
	} finally {
		// Ensure temp file is removed
		if (tempCertPath) {
			try {
				await fsPromises.unlink(tempCertPath);
			} catch (e) {
				// ignore missing file or unlink errors but log for debugging
				if (e && e.code !== 'ENOENT') console.warn('Failed to remove temp certificate file:', e.message || e);
			}
		}
	}
};

// POST /api/certificates/requests/:id/reject - Decline certificate request
exports.rejectCertificateRequest = async (req, res) => {
	try {
		const user = req.user;
		if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

		if (!userIsOrgOfficer(user)) return handleErrorResponse(res, 'Only organization officers can decline certificate requests.', 403);

		const requestId = req.params.id;
		const { rejection_reason } = req.body || {};

		const request = await certificateRequestService.getCertificateRequestById(requestId);
		if (!request) return handleErrorResponse(res, 'Certificate request not found.', 404);
		if (request.status !== 'pending') return handleErrorResponse(res, 'This request has already been processed.', 400);

		const orgId = getOrgIdFromUser(user);
		if (request.created_by_org_id !== orgId) return handleErrorResponse(res, 'You do not have permission to decline this request.', 403);

		await certificateRequestService.updateCertificateRequestStatus(requestId, {
			status: 'rejected',
			processed_by: user.id,
			rejection_reason: rejection_reason || 'No reason provided'
		});

		// Notify student (best-effort)
		try {
			const reasonText = rejection_reason ? ` Reason: ${rejection_reason}` : '';
			const msg = `Your certificate request for "${request.event_title}" was not approved.${reasonText}`;
			await notificationService.createNotification({ user_id: request.student_id, event_id: request.event_id, message: msg, panel: 'student' });
		} catch (nerr) {
			console.warn('Notification create failed (rejectCertificate):', nerr?.message || nerr);
		}

		return handleSuccessResponse(res, { message: 'Certificate request declined.' });
	} catch (error) {
		console.error('declineCertificateRequest error:', error);
		return handleErrorResponse(res, error.message);
	}
};

// PATCH /api/certificates/requests/:id/status - Update certificate request status (simplified)
exports.updateCertificateRequestStatus = async (req, res) => {
	try {
		const user = req.user;
		if (!user) return handleErrorResponse(res, 'Unauthorized', 401);

		if (!userIsOrgOfficer(user)) return handleErrorResponse(res, 'Only organization officers can update certificate request status.', 403);

		const requestId = req.params.id;
		const { status } = req.body || {};

		const allowedStatuses = ['pending', 'processing', 'sent'];
		if (!allowedStatuses.includes(status)) return handleErrorResponse(res, `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`, 400);

		const request = await certificateRequestService.getCertificateRequestById(requestId);
		if (!request) return handleErrorResponse(res, 'Certificate request not found.', 404);

		const orgId = getOrgIdFromUser(user);
		if (request.created_by_org_id !== orgId) return handleErrorResponse(res, 'You do not have permission to update this request.', 403);

		await certificateRequestService.updateCertificateRequestStatus(requestId, { status, processed_by: user.id });

		// Notify student (best-effort)
		try {
			let message = '';
			if (status === 'processing') message = `Your certificate request for "${request.event_title}" is now being processed.`;
			else if (status === 'sent') message = `Your certificate for "${request.event_title}" has been sent. Please check your email.`;
			else if (status === 'pending') message = `Your certificate request for "${request.event_title}" is pending review.`;

			if (message) await notificationService.createNotification({ user_id: request.student_id, event_id: request.event_id, message, panel: 'student' });
		} catch (nerr) {
			console.warn('Notification create failed (updateStatus):', nerr?.message || nerr);
		}

		return handleSuccessResponse(res, { message: `Certificate request status updated to ${status}.`, status });
	} catch (error) {
		console.error('updateCertificateRequestStatus error:', error);
		return handleErrorResponse(res, error.message);
	}
};
