'use strict'; // Enforce strict mode

const express = require('express');
const cors = require('cors');
const path = require('path');

// Create express app
const app = express();

// CORS configuration
const corsOptions = { origin: '*' };
app.use(cors(corsOptions));

// Body parser configuration
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route imports
const authRoutes = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');
const userRoutes = require('./routes/user.routes');
const teamRoutes = require('./routes/team.routes');
const channelRoutes = require('./routes/channel.routes');
const teamSettingRoutes = require('./routes/team-setting.routes');
const customFieldRoutes = require('./routes/custom-field.routes');
const settingRoutes = require('./routes/setting.routes');
const messageRoutes = require('./routes/message.routes');
const remiderRoutes = require('./routes/reminder.routes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/user', userRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/channel', channelRoutes);
app.use('/api/team-setting', teamSettingRoutes);
app.use('/api/custom-field', customFieldRoutes);
app.use('/api/setting', settingRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/reminder', remiderRoutes);

// Export app
module.exports = app;
