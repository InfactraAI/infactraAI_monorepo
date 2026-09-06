const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./modules/auth/auth.routes');
const companyRoutes = require('./modules/company/company.routes');
const onedriveRoutes = require('./modules/onedrive/onedrive.routes');
const tallyRoutes = require('./modules/tally/tally.routes');
const googleRoutes = require('./modules/google/google.routes');
const orgRoutes = require('./modules/org/org.routes');
const errorHandler = require('./middleware/errorHandler');
const limits = require('./middleware/rateLimit');

const app = express();

// Number of proxy hops in front of this process (prod: caddy → nginx = 2).
// Rate limiting keys on client IP, and a blanket `true` would let anyone spoof
// X-Forwarded-For and evade the limits entirely.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

app.use(helmet({
  // The Google Picker injects scripts and an iframe from apis.google.com;
  // a default CSP/COEP blocks both. Everything else helmet sets still applies.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(limits.general);

// Credential endpoints get a much tighter budget than the rest of the API.
app.use('/auth', limits.auth, authRoutes);
app.use('/company', companyRoutes);
app.use('/onedrive', onedriveRoutes);
app.use('/tally', tallyRoutes);
app.use('/google', googleRoutes);
app.use('/org', limits.invites, orgRoutes);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
