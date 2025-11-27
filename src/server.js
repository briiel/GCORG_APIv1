require('dotenv').config();
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
const path = require('path');
const fs = require('fs');

const eventService = require('./services/eventService');

const app = express();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false // Disable if causing issues with Cloudinary
}));

// Compression middleware for performance
app.use(compression());

// CORS configuration
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for Render and monitoring services
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

app.post('/api/cron/run-status-updates', async (req, res) => {
    // 1. Get the secret from the request headers
    const authHeader = req.headers['authorization'];
    const secret = authHeader && authHeader.split(' ')[1]; // "Bearer <secret>"

    // 2. Check if the secret is valid
    if (secret !== process.env.CRON_JOB_SECRET) {
        console.warn('[AutoStatus] Unauthorized cron attempt.');
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 3. If valid, run the job
    try {
        
        const result = await eventService.autoUpdateEventStatuses();
        const total = (result.toOngoing || 0) + (result.toConcluded || 0) + (result.toNotYetStarted || 0);

        
        
        // 4. Send a success response
        res.status(200).json({ success: true, updates: total });

    } catch (err) {
        console.error('[AutoStatus] Webhook error:', err.message || err);
        res.status(500).json({ success: false, message: 'Cron job failed' });
    }
});

app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/event', eventRoutes);
app.use('/api', adminRoutes);
app.use('/api', metricsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', evaluationRoutes);
app.use('/api', roleRequestRoutes);
app.use('/api/certificates', certificateRequestRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// If a built frontend exists in the workspace, serve it (optional).
// This helps when the API and frontend are deployed together under the same host.
// We avoid returning index.html for missing static assets (like .js files)
// by only rewriting requests without an extension and when the client accepts HTML.
try {
    const clientDist = path.join(__dirname, '..', 'GC_ORGanize', 'gc_organize', 'dist', 'gc_organize');
    if (fs.existsSync(clientDist)) {
        app.use(express.static(clientDist));

        app.get('*', (req, res, next) => {
            // Skip API and uploads routes
            if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
            // Only handle GET navigation requests
            if (req.method !== 'GET') return next();
            // If the request looks like a file (has an extension), don't rewrite
            const ext = path.extname(req.path);
            if (ext) return next();
            // Only rewrite when the client expects HTML (browser navigation)
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
    console.error('Global error handler:', err);
    
    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
            success: false, 
            message: 'File size too large. Maximum size is 5MB.' 
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
            success: false, 
            message: 'Token expired' 
        });
    }
    
    // Default error response
    res.status(err.status || 500).json({ 
        success: false, 
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
    // Ensure DB has latest columns
    try {
        const eventModel = require('./models/eventModel');
        if (eventModel.ensureIsPaidColumn) {
            await eventModel.ensureIsPaidColumn();
        }
        if (eventModel.ensureRegistrationFeeColumn) {
            await eventModel.ensureRegistrationFeeColumn();
        }
        if (eventModel.ensureRegistrationStatusColumns) {
            await eventModel.ensureRegistrationStatusColumns();
        }
        if (eventModel.ensureAttendanceColumns) {
            await eventModel.ensureAttendanceColumns();
        }
    } catch (e) {
        console.warn('Schema ensure failed:', e.message);
    }

    // Optional font warm-up: pre-register Google Fonts and resolve via a tiny render
    try {
        process.env.USE_REMOTE_FONTS = process.env.USE_REMOTE_FONTS ?? 'true';
        const { createCanvas } = require('canvas');
        const { generateCertificate } = require('./utils/certificateGenerator');
        const canvas = createCanvas(10, 10);
        const ctx = canvas.getContext('2d');
        ctx.font = "10px Lora";
        ctx.fillText('.', 1, 9);
        ctx.font = "10px 'Great Vibes'";
        ctx.fillText('.', 1, 9);
    } catch (e) {
        console.warn('Font warm-up skipped or failed:', e.message);
    }

    // Background task: auto-update event statuses based on schedule
    if (process.env.NODE_ENV !== 'production') {
        try {
            const runAutoStatus = async () => {
                try {
                    const res = await eventService.autoUpdateEventStatuses();
                    const total = (res.toOngoing || 0) + (res.toConcluded || 0) + (res.toNotYetStarted || 0);
                    if (total > 0) {
                        // logged inside service
                    }
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