const certificateRequestModel = require('../models/certificateRequestModel');

const createCertificateRequest = async (data) => {
	return certificateRequestModel.createCertificateRequest(data);
};

const getCertificateRequestsByOrg = async (org_id, opts = {}) => {
	const page = opts.page;
	const per_page = opts.per_page || opts.perPage;
	return certificateRequestModel.getCertificateRequestsByOrg(org_id, page, per_page);
};

const getCertificateRequestById = async (request_id) => {
	return certificateRequestModel.getCertificateRequestById(request_id);
};

const updateCertificateRequestStatus = async (request_id, data) => {
	return certificateRequestModel.updateCertificateRequestStatus(request_id, data);
};

const hasPendingOrApprovedRequest = async (event_id, student_id) => {
	return certificateRequestModel.hasPendingOrApprovedRequest(event_id, student_id);
};

module.exports = {
	createCertificateRequest,
	getCertificateRequestsByOrg,
	getCertificateRequestById,
	updateCertificateRequestStatus,
	hasPendingOrApprovedRequest
};
