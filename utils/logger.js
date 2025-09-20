const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Build a dated logs folder like logs/20-09-2025
const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const year = now.getFullYear();

// base logs dir
const baseLogsDir = path.join(__dirname, '../logs');
// folder name: 20-09-2025
const datedFolder = `${day}-${month}-${year}`;
const logsDir = path.join(baseLogsDir, datedFolder);

// Make sure directory exists
fs.mkdirSync(logsDir, { recursive: true });

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    }`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'spedocity-api' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Access logs
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Create a stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper methods
logger.infoLog = (message, meta = {}) => {
  logger.info(message, meta);
};

logger.errorLog = (message, error = null, meta = {}) => {
  if (error) {
    meta.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  logger.error(message, meta);
};

logger.accessLog = (req, res, responseTime = null) => {
  const meta = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    status: res.statusCode,
    responseTime: responseTime ? `${responseTime}ms` : null,
    userId: req.user ? req.user.id : 'anonymous',
  };

  if (res.statusCode < 400) {
    logger.info('HTTP Access', meta);
  } else if (res.statusCode < 500) {
    logger.warn('HTTP Client Error', meta);
  } else {
    logger.error('HTTP Server Error', meta);
  }
};

logger.dbLog = (query, parameters, executionTime, error = null) => {
  const meta = {
    query: query,
    parameters: parameters,
    executionTime: `${executionTime}ms`,
  };

  if (error) {
    meta.error = {
      message: error.message,
      code: error.code,
    };
    logger.error('Database Error', meta);
  } else {
    logger.debug('Database Query', meta);
  }
};

module.exports = logger;
