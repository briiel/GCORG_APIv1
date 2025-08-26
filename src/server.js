const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminRoutes = require('./routes/adminRoutes');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/event', eventRoutes);
app.use('/api', adminRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Page not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Optional font warm-up: pre-register Google Fonts and resolve via a tiny render
    try {
        process.env.USE_REMOTE_FONTS = process.env.USE_REMOTE_FONTS ?? 'true';
        const { createCanvas } = require('canvas');
        const { generateCertificate } = require('./utils/certificateGenerator');
        // Trigger font registration
        const canvas = createCanvas(10, 10);
        const ctx = canvas.getContext('2d');
        ctx.font = "10px Lora";
        ctx.fillText('.', 1, 9);
        ctx.font = "10px 'Great Vibes'";
        ctx.fillText('.', 1, 9);
        // No file output; just ensure fonts are loaded. If needed, catch will log.
    } catch (e) {
        console.warn('Font warm-up skipped or failed:', e.message);
    }
});