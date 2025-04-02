const winston = require('winston');
const path = require('path');

// List of sensitive patterns to redact from logs
const sensitivePatterns = [
  // Discord bot token pattern
  /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g,
  // General token pattern
  /(token|api[_-]?key|auth[_-]?token|password|secret)[=:]["']?\S+["']?/gi,
  // Basic token pattern
  /(TOKEN|DISCORD_BOT_TOKEN|CLIENT_SECRET)=\S+/g,
];

// Format to redact sensitive information
const redactFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    // Go through each pattern and redact matches
    sensitivePatterns.forEach(pattern => {
      info.message = info.message.replace(pattern, '[REDACTED]');
    });
  }
  
  // Also check if error object contains sensitive info
  if (info.error && typeof info.error === 'object') {
    const errorString = JSON.stringify(info.error);
    let redactedErrorString = errorString;
    
    sensitivePatterns.forEach(pattern => {
      redactedErrorString = redactedErrorString.replace(pattern, '[REDACTED]');
    });
    
    if (redactedErrorString !== errorString) {
      info.error = JSON.parse(redactedErrorString);
    }
  }
  
  return info;
});

// Define custom log format
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    redactFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        redactFormat(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error'
    }),
    // File transport for all logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log')
    })
  ]
});

// Safer error logging method
logger.safeError = function(message, error) {
  // Convert error to string to safely redact sensitive information
  let errorMessage = error;
  
  if (error instanceof Error) {
    errorMessage = error.stack || error.message;
  } else if (typeof error === 'object') {
    try {
      errorMessage = JSON.stringify(error);
    } catch (e) {
      errorMessage = 'Unable to stringify error object';
    }
  }
  
  // Redact anything that looks like a token
  sensitivePatterns.forEach(pattern => {
    if (typeof errorMessage === 'string') {
      errorMessage = errorMessage.replace(pattern, '[REDACTED]');
    }
  });
  
  this.error(`${message}: ${errorMessage}`);
};

// Create a stream object for Morgan
const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = { logger, stream };
