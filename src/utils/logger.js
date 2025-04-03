/**
 * Logger Utility
 * Centralized logging system using Winston
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get log level from environment or use default
const logLevel = process.env.LOG_LEVEL || 'info';

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
  })
);

// Create Winston logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    
    // Write all logs to a combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    
    // Write error logs to a separate error log file
    new winston.transports.File({
      level: 'error',
      filename: path.join(logsDir, 'error.log'),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
    
    // Write additional stream for verbose logs (debug)
    new winston.transports.File({
      level: 'verbose',
      filename: path.join(logsDir, 'verbose.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 2,
    }),
    
    // Write interaction debug logs to a separate file
    new winston.transports.File({
      level: 'debug',
      filename: path.join(logsDir, 'interaction-debug.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 1,
    })
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  // Handle uncaught promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

// Create sensitive info logger (for non-error info logs related to security)
const secureLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    // Write to secure-info.log
    new winston.transports.File({
      filename: path.join(logsDir, 'secure-info.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 2,
    }),
    
    // Write errors to secure-error.log
    new winston.transports.File({
      level: 'error',
      filename: path.join(logsDir, 'secure-error.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 2,
    })
  ]
});

// Create offline logger for events that happen when bot is offline
const offlineLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'offline-info.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 2
    })
  ]
});

// Add debug log to console in development mode
if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
  logger.level = 'debug';
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
    level: 'debug'
  }));
}

module.exports = {
  logger,
  secureLogger,
  offlineLogger
};