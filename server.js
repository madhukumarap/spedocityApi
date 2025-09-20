const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan'); // Add morgan for HTTP logging
const { initDatabase } = require('./config/db');
const requestLogger = require('./utils/requestLogger');
const logger = require('./utils/logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

logger.info('Application starting up', { environment: process.env.NODE_ENV });

app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// HTTP request logging with Morgan
app.use(morgan('combined', { stream: logger.stream }));

// Custom request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
initDatabase().then(() => {
  logger.info('Database initialization completed');
}).catch(err => {
  logger.error('Database initialization failed', err);
  process.exit(1);
});

// Import routes
const userAuthRoutes = require('./routes/userRoutes/userAuthRoute');

// Use routes
app.use(userAuthRoutes);

// Health check endpoint
app.get('/sepdocity/health', (req, res) => {
  logger.info('Health check requested');
  res.status(200).json({ 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res, next) => {
  logger.warn('Endpoint not found', { url: req.originalUrl, method: req.method });
  res.status(404).json({ message: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err, { url: req.originalUrl, method: req.method });
  res.status(500).json({ message: "Internal server error" });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  logger.error('Server error', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

