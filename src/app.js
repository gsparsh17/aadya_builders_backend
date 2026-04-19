const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import custom modules
const errorHandler = require('./middlewares/errorHandler');

// ✅ FIX: use destructuring (IMPORTANT)
const { globalLimiter } = require('./middlewares/rateLimiter');

// Define API prefix
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Logger setup
let logger;
try {
  logger = require('./utils/logger');
} catch (e) {
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    http: console.log,
    debug: console.debug,
  };
}

const app = express();

// ================= SECURITY =================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// ================= CORS =================
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ].filter(Boolean),
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// ================= PERFORMANCE =================
app.use(compression());

// ================= BODY PARSER =================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================= SANITIZATION =================
app.use(mongoSanitize());

// ================= LOGGING =================
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/health' || req.url === '/favicon.ico',
    })
  );
}

// ================= RATE LIMIT =================
app.use(API_PREFIX, globalLimiter);

// ================= HEALTH =================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ================= ROOT =================
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '99acres Backend API',
    version: '1.0.0',
    docs: `${API_PREFIX}/test`,
  });
});

// ================= TEST =================
app.get(`${API_PREFIX}/test`, (req, res) => {
  res.json({
    success: true,
    message: 'API is running!',
    timestamp: new Date().toISOString(),
  });
});

// ================= ROUTES =================
const routeModules = [
  { path: `${API_PREFIX}/auth`, module: './modules/auth/auth.routes', name: 'Auth' },
  { path: `${API_PREFIX}/users`, module: './modules/users/user.routes', name: 'Users' },
  { path: `${API_PREFIX}/properties`, module: './modules/properties/property.routes', name: 'Properties' },
  { path: `${API_PREFIX}/search`, module: './modules/search/search.routes', name: 'Search' },
  { path: `${API_PREFIX}/leads`, module: './modules/leads/lead.routes', name: 'Leads' },
  { path: `${API_PREFIX}/payments`, module: './modules/payments/payment.routes', name: 'Payments' },
  { path: `${API_PREFIX}/insights`, module: './modules/insights/insights.routes', name: 'Insights' },
  { path: `${API_PREFIX}/content`, module: './modules/content/content.routes', name: 'Content' },
  { path: `${API_PREFIX}/admin`, module: './modules/admin/admin.routes', name: 'Admin' },
];

// ✅ SAFE LOADER (FIXED)
routeModules.forEach(({ path, module, name }) => {
  try {
    const routeModule = require(module);

    // 🔍 DEBUG CHECK
    if (typeof routeModule !== 'function') {
      throw new Error(`Invalid route export. Expected function but got ${typeof routeModule}`);
    }

    app.use(path, routeModule);
    logger.info(`✅ ${name} routes loaded at ${path}`);
  } catch (e) {
    logger.warn(`⚠️ ${name} routes not available: ${e.message}`);

    // ✅ fallback route (prevents crash)
    app.use(path, (req, res) => {
      res.status(503).json({
        success: false,
        error: {
          code: 'MODULE_NOT_AVAILABLE',
          message: `${name} module is not available`,
        },
      });
    });
  }
});

// ================= 404 =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// ================= ERROR HANDLER =================
app.use(errorHandler);

module.exports = app;