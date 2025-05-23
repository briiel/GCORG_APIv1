const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes'); // Import event routes
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/event', eventRoutes); // Add event routes
app.use('/api/notifications', notificationRoutes);
app.use('/api', adminRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Page not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));