/**
 * Background Scheduler
 *
 * Auto-refresh cache at configurable intervals.
 * Tolerates errors to avoid crashes when SSC API is unavailable.
 */

const logger = require('./logger');

class Scheduler {
  constructor(refreshInterval = 900000) { // 15 minutes default
    this.refreshInterval = refreshInterval;
    this.intervalId = null;
    this.refreshFunctions = [];
    this.lastRefreshTime = null;
    this.isRunning = false;
    this.refreshInProgress = false;

    logger.info('Scheduler initialized', {
      refreshInterval: this.refreshInterval
    });
  }

  /**
   * Register a refresh function
   * @param {string} name - Function name for logging
   * @param {Function} fn - Async function to execute
   */
  register(name, fn) {
    this.refreshFunctions.push({ name, fn });
    logger.debug('Registered refresh function', { name });
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler', {
      refreshInterval: this.refreshInterval,
      functionsRegistered: this.refreshFunctions.length
    });

    // Run initial refresh
    this.forceRefresh();

    // Schedule periodic refresh
    this.intervalId = setInterval(() => {
      this.forceRefresh();
    }, this.refreshInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Scheduler not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Force immediate refresh
   * @returns {Promise<object>} - Refresh results
   */
  async forceRefresh() {
    if (this.refreshInProgress) {
      logger.warn('Refresh already in progress, skipping');
      return { skipped: true };
    }

    this.refreshInProgress = true;
    const startTime = Date.now();

    logger.info('Starting cache refresh', {
      functionsToRun: this.refreshFunctions.length
    });

    const results = {
      success: [],
      failed: [],
      duration: 0
    };

    for (const { name, fn } of this.refreshFunctions) {
      try {
        logger.debug('Running refresh function', { name });
        await fn();
        results.success.push(name);
        logger.debug('Refresh function completed', { name });
      } catch (error) {
        results.failed.push({ name, error: error.message });
        logger.error('Refresh function failed', {
          name,
          error: error.message,
          stack: error.stack
        });
      }
    }

    const duration = Date.now() - startTime;
    results.duration = duration;
    this.lastRefreshTime = new Date();
    this.refreshInProgress = false;

    logger.info('Cache refresh complete', {
      success: results.success.length,
      failed: results.failed.length,
      duration: `${duration}ms`
    });

    return results;
  }

  /**
   * Get scheduler status
   * @returns {object} - Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      refreshInProgress: this.refreshInProgress,
      lastRefreshTime: this.lastRefreshTime ? this.lastRefreshTime.toISOString() : null,
      refreshInterval: this.refreshInterval,
      registeredFunctions: this.refreshFunctions.length
    };
  }

  /**
   * Get last refresh time
   * @returns {Date|null} - Last refresh timestamp
   */
  getLastRefreshTime() {
    return this.lastRefreshTime;
  }
}

// Export class (not singleton - will be instantiated in server.js)
module.exports = Scheduler;
