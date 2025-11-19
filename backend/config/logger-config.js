/**
 * Logger Configuration
 *
 * Winston logger settings with daily file rotation.
 */

module.exports = {
  // Log level (error, warn, info, debug)
  level: process.env.LOG_LEVEL || 'info',

  // Directory for log files
  dir: process.env.LOG_DIR || './logs',

  // Log rotation settings
  maxFiles: '30d',      // Keep logs for 30 days
  maxSize: '100m',      // Max 100MB per file
  datePattern: 'YYYY-MM-DD',

  // Log format
  format: 'json',       // JSON format for structured logging

  // Console output (only in development)
  console: process.env.NODE_ENV !== 'production'
};
