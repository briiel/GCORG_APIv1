const types = require('./notificationTypes');

// Templates are the single source of truth for default messages, panels and channels.
// Messages use simple {{var}} placeholders which will be replaced by templateVars.
const templates = {
    [types.REGISTRATION_APPROVED]: {
        panel: 'student',
        defaultMessage: 'Your registration for "{{title}}" has been approved. Your QR code is ready for check-in.',
        channels: ['inapp', 'email']
    },
    [types.REGISTRATION_SUBMITTED]: {
        panel: 'student',
        defaultMessage: 'Registration submitted for "{{title}}" and is pending approval. You will be notified once it\'s processed.',
        channels: ['inapp']
    },
    [types.REGISTRATION_RECEIVED]: {
        panel: 'student',
        defaultMessage: 'Registration successful for "{{title}}". Your QR code is ready for check-in.',
        channels: ['inapp']
    },
    [types.CERTIFICATE_REQUEST]: {
        panel: 'organization',
        defaultMessage: 'New certificate request from {{studentName}} for "{{title}}"',
        channels: ['inapp', 'email']
    },
    [types.CERTIFICATE_APPROVED]: {
        panel: 'student',
        defaultMessage: 'Your certificate request for "{{title}}" has been approved. View it in your E-Certificates.',
        channels: ['inapp', 'email']
    },
    [types.CERTIFICATE_REJECTED]: {
        panel: 'student',
        defaultMessage: 'Your certificate request for "{{title}}" was not approved.{{reason}}',
        channels: ['inapp']
    },
    [types.CERTIFICATE_PROCESSING]: {
        panel: 'student',
        defaultMessage: 'Your certificate request for "{{title}}" is now being processed.',
        channels: ['inapp']
    },
    [types.CERTIFICATE_SENT]: {
        panel: 'student',
        defaultMessage: 'Your certificate for "{{title}}" has been sent. Please check your email.',
        channels: ['inapp', 'email']
    },
    [types.CERTIFICATE_PENDING]: {
        panel: 'student',
        defaultMessage: 'Your certificate request for "{{title}}" is pending review.',
        channels: ['inapp']
    },
    [types.REGISTRATION_REJECTED]: {
        panel: 'student',
        defaultMessage: 'Your registration for "{{title}}" was not approved. Please contact the organizer if you have questions.',
        channels: ['inapp']
    },
    [types.ROLE_REQUEST]: {
        panel: 'admin',
        defaultMessage: 'New role request submitted by {{studentName}} for {{orgName}}',
        channels: ['inapp', 'email']
    },
    [types.TEST]: {
        panel: 'student',
        defaultMessage: 'Dummy notification created at {{iso}}',
        channels: ['inapp']
    }
};

function render(templateStr = '', vars = {}) {
    return templateStr.replace(/{{\s*([\w\.]+)\s*}}/g, (_, key) => {
        return (vars && typeof vars === 'object' && (key in vars)) ? String(vars[key]) : '';
    });
}

module.exports = { templates, render };
