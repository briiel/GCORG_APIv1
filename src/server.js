require('dotenv').config();
const { validateEnvironment } = require('./config/env-validator');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminRoutes = require('./routes/adminRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const roleRequestRoutes = require('./routes/roleRequestRoutes');
const certificateRequestRoutes = require('./routes/certificateRequestRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const path = require('path');
const fs = require('fs');

const eventService = require('./services/eventService');
const autoCleanupService = require('./services/autoCleanupService');
const rateLimit = require('./middleware/rateLimit');
const { secureResponseMiddleware, securityHeadersMiddleware } = require('./middleware/secureResponse');
const { decryptRequestBody, encryptResponseBody } = require('./middleware/transportEncryption');

validateEnvironment();

const app = express();

// Trust proxy so req.ip reflects client IP behind Render/Heroku
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));
app.use(securityHeadersMiddleware);
app.use(secureResponseMiddleware);
app.use(compression());

// Global rate limiter — 200 requests/minute per IP
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200
});
app.use('/api', globalLimiter);

// CORS and body parsing
app.use(cors());
app.use(express.json({
    limit: '10mb',
    skip: (req) => req.is('multipart/form-data') // Skip for multipart; handled by multer
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Transport-layer payload encryption: decryptRequestBody unwraps encrypted requests; encryptResponseBody wraps all JSON responses
app.use(decryptRequestBody);
app.use(encryptResponseBody);

// Health check endpoints
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'GC Organize API is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Cron webhook — triggered externally to auto-update event statuses
app.post('/api/cron/run-status-updates', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const secret = authHeader && authHeader.split(' ')[1];

    if (secret !== process.env.CRON_JOB_SECRET) {
        console.warn('[AutoStatus] Unauthorized cron attempt.');
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const result = await eventService.autoUpdateEventStatuses();
        const total = (result.toOngoing || 0) + (result.toConcluded || 0) + (result.toNotYetStarted || 0);
        res.status(200).json({ success: true, updates: total });
    } catch (err) {
        console.error('[AutoStatus] Webhook error:', err.message || err);
        res.status(500).json({ success: false, message: 'Cron job failed' });
    }
});

// API routes
app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/event', eventRoutes);
app.use('/api', adminRoutes);
app.use('/api', metricsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', evaluationRoutes);
app.use('/api', roleRequestRoutes);
app.use('/api/certificates', certificateRequestRoutes);
app.use('/api', archiveRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve the built Angular client if co-deployed in the same process
try {
    const clientDist = path.join(__dirname, '..', 'GC_ORGanize', 'gc_organize', 'dist', 'gc_organize');
    if (fs.existsSync(clientDist)) {
        app.use(express.static(clientDist));

        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
            if (req.method !== 'GET') return next();
            if (path.extname(req.path)) return next(); // Skip non-HTML file requests
            const accept = req.headers.accept || '';
            if (!accept.includes('text/html')) return next();
            return res.sendFile(path.join(clientDist, 'index.html'));
        });
    }
} catch (e) {
    console.warn('Client static serving skipped:', e.message);
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Page not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    const { logError } = require('./utils/error-logger');

    logError(err, req);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let errors = err.errors || null;

    // Multer file upload error
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 400;
        message = 'File size too large. Maximum size is 5MB.';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Database errors
    if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'A record with this information already exists';
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        statusCode = 400;
        message = 'Invalid reference to related data';
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        statusCode = 503;
        message = 'Database connection failed. Please try again later.';
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message || 'Validation failed';
        errors = err.errors || null;
    }

    const response = {
        success: false,
        message: process.env.NODE_ENV === 'production' && statusCode >= 500
            ? 'Internal server error'
            : message
    };

    if (errors) response.errors = errors;
    if (process.env.NODE_ENV !== 'production' && err.stack) response.stack = err.stack;

    res.status(statusCode).json(response);
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
    // Ensure required DB schema columns exist before serving traffic
    try {
        const eventModel = require('./models/eventModel');
        if (eventModel.ensureIsPaidColumn) await eventModel.ensureIsPaidColumn();
        if (eventModel.ensureRegistrationFeeColumn) await eventModel.ensureRegistrationFeeColumn();
        if (eventModel.ensureRegistrationStatusColumns) await eventModel.ensureRegistrationStatusColumns();
        if (eventModel.ensureAttendanceColumns) await eventModel.ensureAttendanceColumns();
    } catch (e) {
        console.warn('Schema ensure failed:', e.message);
    }

    // Warm up canvas fonts used by the certificate generator
    try {
        process.env.USE_REMOTE_FONTS = process.env.USE_REMOTE_FONTS ?? 'true';
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(10, 10);
        const ctx = canvas.getContext('2d');
        ctx.font = "10px Lora";
        ctx.fillText('.', 1, 9);
        ctx.font = "10px 'Great Vibes'";
        ctx.fillText('.', 1, 9);
    } catch (e) {
        console.warn('Font warm-up skipped or failed:', e.message);
    }

    // In non-production: poll event statuses every minute via an in-process timer
    if (process.env.NODE_ENV !== 'production') {
        try {
            const runAutoStatus = async () => {
                try {
                    await eventService.autoUpdateEventStatuses();
                } catch (err) {
                    console.error('[AutoStatus] Error:', err.message || err);
                }
            };
            runAutoStatus();
            setInterval(runAutoStatus, 60 * 1000);
        } catch (e) {
            console.warn('Auto-status scheduler not started:', e.message);
        }
    }

    // Start auto-cleanup for archived items (30-day retention)
    try {
        autoCleanupService.startAutoCleanup();
        console.log('[Auto-Cleanup] Service initialized successfully');
    } catch (e) {
        console.warn('[Auto-Cleanup] Service failed to start:', e.message);
    }

    console.log(`Server listening on port ${PORT}`);
});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} already in use. Please free the port or set PORT env var.`);
        process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
    const { logError } = require('./utils/error-logger');
    console.error('[WARN] Unhandled Promise Rejection detected!');
    logError(new Error(`Unhandled Rejection: ${reason}`));

    if (process.env.NODE_ENV === 'production') {
        console.error('Shutting down server due to unhandled rejection...');
        server.close(() => { process.exit(1); });
    }
});

// Uncaught exception — always exit
process.on('uncaughtException', (err) => {
    const { logError } = require('./utils/error-logger');
    console.error('[WARN] Uncaught Exception detected!');
    logError(err);
    console.error('Shutting down server due to uncaught exception...');
    process.exit(1);
});
