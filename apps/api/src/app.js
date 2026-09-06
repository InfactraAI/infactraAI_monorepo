const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./modules/auth/auth.routes');
const companyRoutes = require('./modules/company/company.routes');
const onedriveRoutes = require('./modules/onedrive/onedrive.routes');
const tallyRoutes = require('./modules/tally/tally.routes');
const googleRoutes = require('./modules/google/google.routes');
const orgRoutes = require('./modules/org/org.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/company', companyRoutes);
app.use('/onedrive', onedriveRoutes);
app.use('/tally', tallyRoutes);
app.use('/google', googleRoutes);
app.use('/org', orgRoutes);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
