// Canonical notification types used across the system
module.exports = Object.freeze({
    REGISTRATION_APPROVED: 'registration_approved',
    REGISTRATION_SUBMITTED: 'registration_submitted',
    REGISTRATION_RECEIVED: 'registration_received',
    REGISTRATION_CONFIRMED: 'registration_confirmed',
    REGISTRATION_REJECTED: 'registration_rejected',
    CERTIFICATE_REQUEST: 'certificate_request',
    CERTIFICATE_APPROVED: 'certificate_request_approved',
    CERTIFICATE_REJECTED: 'certificate_request_rejected',
    CERTIFICATE_STATUS: 'certificate_request_status',
    CERTIFICATE_PROCESSING: 'certificate_processing',
    CERTIFICATE_SENT: 'certificate_sent',
    CERTIFICATE_PENDING: 'certificate_pending',
    ROLE_REQUEST: 'role_request',
    TEST: 'test'
});
