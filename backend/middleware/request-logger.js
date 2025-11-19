/**
 * Request Logger Middleware
 *
 * Logs incoming requests and response times.
 */

const logger = require('../services/logger');
const { v4: uuidv4 } = require('crypto');

function requestLogger(req, res, next) {
  // Generate request ID
  req.id = generateRequestId();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });

  // Track response time
  const startTime = Date.now();

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    const duration = Date.now() - startTime;

    logger.info('Response sent', {
      requestId: req.id,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      cacheHit: body.cacheHit || false,
      stale: body.stale || false
    });

    return originalJson(body);
  };

  next();
}

/**
 * Generate unique request ID
 * @returns {string} - Request ID
 */
function generateRequestId() {
  // Simple request ID using timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = requestLogger;
