const logger = require('./logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request start
  logger.info('Request started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
  });
  
  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.accessLog(req, res, duration);
  });
  
  next();
};

module.exports = requestLogger;