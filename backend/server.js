/**
 * SSC ASPM Backend Server
 *
 * Express server for ASPM Dashboard.
 * Provides 29 REST API endpoints with caching and auto-refresh.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');

// Services
const logger = require('./services/logger');
const sscClient = require('./services/ssc-client');
const cache = require('./services/cache-manager');
const Scheduler = require('./services/scheduler');

// Middleware
const requestLogger = require('./middleware/request-logger');
const errorHandler = require('./middleware/error-handler');

// Routes
const programRoutes = require('./routes/program');
const riskRoutes = require('./routes/risk');
const remediationRoutes = require('./routes/remediation');
const filterRoutes = require('./routes/filters');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware stack
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const sscStatus = await sscClient.testConnection();
    const cacheStats = cache.getStats();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ssc: sscStatus,
      cache: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate
      },
      scheduler: scheduler.getStatus()
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Cache status endpoint
app.get('/api/cache/status', (req, res) => {
  const stats = cache.getStats();
  res.json(stats);
});

// Register API routes
app.use('/api/program', programRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/remediation', remediationRoutes);
app.use('/api/filters', filterRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: `Endpoint not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Initialize scheduler
const scheduler = new Scheduler(parseInt(process.env.REFRESH_INTERVAL) || 900000);

// Register refresh functions (STUB - Phase 3 will implement actual refresh logic)
scheduler.register('refresh_program_kpis', async () => {
  logger.debug('Refreshing program KPIs (stub)');
  // Phase 3: Implement actual refresh
});

scheduler.register('refresh_risk_metrics', async () => {
  logger.debug('Refreshing risk metrics (stub)');
  // Phase 3: Implement actual refresh
});

scheduler.register('refresh_remediation_metrics', async () => {
  logger.debug('Refreshing remediation metrics (stub)');
  // Phase 3: Implement actual refresh
});

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');

    // Stop scheduler
    scheduler.stop();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, async () => {
  logger.info(`SSC ASPM Backend started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    sscUrl: process.env.SSC_URL
  });

  // Test SSC connection on startup
  try {
    const connectionStatus = await sscClient.testConnection();
    if (connectionStatus.connected) {
      logger.info('SSC connection successful');

      // Start scheduler after successful connection
      scheduler.start();
      logger.info('Background scheduler started');
    } else {
      logger.error('SSC connection failed - scheduler not started', {
        error: connectionStatus.error
      });
    }
  } catch (error) {
    logger.error('Failed to test SSC connection on startup', {
      error: error.message
    });
  }
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error', {
    error: error.message,
    code: error.code
  });

  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

module.exports = app;
