/**
 * Logger Utility
 * Centralized logging system using Winston
 */
const winston = require('winston');
const { format, transports } = winston;
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Custom format for file output
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.json()
);

// Main logger for general application logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'bot' },
  transports: [
    // Console transport
    new transports.Console({
      format: consoleFormat
    }),
    
    // Combined log file (info and above)
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info'
    }),
    
    // Error log file (error level only)
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    })
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new transports.File({ 
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Special logger for Discord interactions 
const interactionLogger = winston.createLogger({
  level: 'debug',
  format: fileFormat,
  defaultMeta: { service: 'interaction' },
  transports: [
    // Debug-level interaction log
    new transports.File({
      filename: path.join(logsDir, 'interaction-debug.log'),
      level: 'debug'
    })
  ]
});

// Add verbose transport only in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.File({
      filename: path.join(logsDir, 'verbose.log'),
      level: 'verbose'
    })
  );
}

// Logger for sensitive information
const secureLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  defaultMeta: { service: 'secure' },
  transports: [
    // Secure error log
    new transports.File({
      filename: path.join(logsDir, 'secure-error.log'),
      level: 'error'
    }),
    // Secure info log
    new transports.File({
      filename: path.join(logsDir, 'secure-info.log'),
      level: 'info'
    })
  ]
});

// Logger for when bot is offline
const offlineLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  defaultMeta: { service: 'offline' },
  transports: [
    new transports.File({
      filename: path.join(logsDir, 'offline-info.log'),
      level: 'info'
    })
  ]
});

module.exports = {
  logger,
  interactionLogger,
  secureLogger,
  offlineLogger
};