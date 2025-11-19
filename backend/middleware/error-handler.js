/**
 * Error Handler Middleware
 *
 * Global error handler with stale cache fallback.
 * Catches all errors and returns standardized responses.
 */

const logger = require('../services/logger');
const cache = require('../services/cache-manager');

async function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Request error', {
    requestId: req.id,
    path: req.path,
    error: err.message,
    type: err.type || 'UNKNOWN',
    stack: err.stack
  });

  // Try to serve stale cache if available
  const cacheKey = cache.generateKey(req.path.replace('/api/', ''), req.query);
  const staleData = cache.get(cacheKey, { ignoreExpiry: true });

  if (staleData) {
    logger.warn('Serving stale cache due to error', {
      requestId: req.id,
      cacheKey,
      age: Date.now() - staleData.timestamp
    });

    return res.status(200).json({
      data: staleData.data,
      stale: true,
      error: err.message,
      lastUpdated: new Date(staleData.timestamp).toISOString(),
      cacheHit: true
    });
  }

  // No cache available - return error response
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: true,
    message: err.message,
    type: err.type || 'INTERNAL_ERROR',
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.id
  });
}

module.exports = errorHandler;
