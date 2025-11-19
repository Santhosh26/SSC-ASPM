/**
 * Logger Service
 *
 * Winston-based logger with daily file rotation.
 * Provides structured logging for the SSC ASPM backend.
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const loggerConfig = require('../config/logger-config');

// Ensure logs directory exists
const logDir = path.resolve(process.cwd(), loggerConfig.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Configure transports
const transports = [];

// File transport for all logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: loggerConfig.datePattern,
    maxFiles: loggerConfig.maxFiles,
    maxSize: loggerConfig.maxSize,
    format: logFormat,
    level: 'info'
  })
);

// File transport for errors only
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: loggerConfig.datePattern,
    maxFiles: loggerConfig.maxFiles,
    maxSize: loggerConfig.maxSize,
    format: logFormat,
    level: 'error'
  })
);

// Console transport (development only)
if (loggerConfig.console) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: loggerConfig.level
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: loggerConfig.level,
  format: logFormat,
  transports,
  exitOnError: false
});

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {object} meta - Additional metadata
 */
logger.logError = function(message, meta = {}) {
  logger.error(message, meta);
};

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {object} meta - Additional metadata
 */
logger.logWarn = function(message, meta = {}) {
  logger.warn(message, meta);
};

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {object} meta - Additional metadata
 */
logger.logInfo = function(message, meta = {}) {
  logger.info(message, meta);
};

/**
 * Log a debug message
 * @param {string} message - Debug message
 * @param {object} meta - Additional metadata
 */
logger.logDebug = function(message, meta = {}) {
  logger.debug(message, meta);
};

// Log startup
logger.info('Logger initialized', {
  level: loggerConfig.level,
  logDir,
  console: loggerConfig.console
});

module.exports = logger;
