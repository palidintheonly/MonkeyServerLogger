const winston = require('winston');
const path = require('path');
const { createEmbed } = require('./embedBuilder');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define custom log format
const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = ` | ${JSON.stringify(metadata)}`;
  }
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
});

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error'
    }),
    // File transport for all logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log')
    }),
    // Separate file for verbose logs
    new winston.transports.File({
      filename: path.join(logsDir, 'verbose.log'),
      level: 'debug'
    })
  ]
});

// Discord channel logging
let discordLogChannel = null;
let verboseLogChannel = null;
let discordClient = null;
let isVerboseEnabled = false;

/**
 * Initialize Discord logging
 * @param {Client} client Discord.js client
 */
function initDiscordLogging(client) {
  discordClient = client;
}

/**
 * Set the Discord channel for logging
 * @param {TextChannel} channel Discord text channel
 * @param {boolean} verbose Whether this is a verbose logging channel
 */
function setLogChannel(channel, verbose = false) {
  if (verbose) {
    verboseLogChannel = channel;
  } else {
    discordLogChannel = channel;
  }
}

/**
 * Enable or disable verbose logging
 * @param {boolean} enabled Whether to enable verbose logging
 */
function setVerboseLogging(enabled) {
  isVerboseEnabled = enabled;
  
  // Set the Winston log level
  logger.level = enabled ? 'debug' : 'info';
  
  if (enabled) {
    logger.debug('Verbose logging enabled');
  } else {
    logger.info('Verbose logging disabled');
  }
}

/**
 * Get the active Discord log channel
 * @returns {TextChannel|null} The Discord channel used for logging
 */
function getLogChannel(verbose = false) {
  return verbose ? verboseLogChannel : discordLogChannel;
}

/**
 * Log a message to Discord if a channel is configured
 * @param {string} level Log level 
 * @param {string} message Message to log
 * @param {Object} metadata Additional metadata
 */
async function logToDiscord(level, message, metadata = {}) {
  // Skip Discord logging if client is not initialized
  if (!discordClient || (!discordLogChannel && !verboseLogChannel)) {
    return;
  }
  
  // For verbose logs, only send to Discord if verbose logging is enabled
  if (level === 'debug' && !isVerboseEnabled) {
    return;
  }

  // Determine which channel to use
  const channel = level === 'debug' && verboseLogChannel ? verboseLogChannel : discordLogChannel;
  if (!channel) return;
  
  // Map log levels to colors and emoji
  const levelConfig = {
    error: { color: '#FF0000', emoji: '🚫' },
    warn: { color: '#FFA500', emoji: '⚠️' },
    info: { color: '#0096FF', emoji: 'ℹ️' },
    debug: { color: '#808080', emoji: '🔍' }
  };
  
  const config = levelConfig[level] || levelConfig.info;
  
  try {
    // Create embed for Discord
    const embed = createEmbed({
      title: `${config.emoji} ${level.toUpperCase()}`,
      description: message,
      color: config.color,
      fields: Object.keys(metadata).map(key => ({
        name: key,
        value: JSON.stringify(metadata[key], null, 2).substring(0, 1024) || 'null',
        inline: false
      })),
      timestamp: true,
      footer: { text: 'Bot Logging System' }
    });
    
    // Send to Discord channel
    await channel.send({ embeds: [embed] }).catch(err => {
      console.error(`Failed to send log to Discord: ${err.message}`);
    });
  } catch (error) {
    console.error(`Error sending log to Discord: ${error.message}`);
  }
}

// Wrap Winston's logging methods to also log to Discord
const enhancedLogger = {
  error: (message, metadata = {}) => {
    logger.error(message, metadata);
    logToDiscord('error', message, metadata);
  },
  warn: (message, metadata = {}) => {
    logger.warn(message, metadata);
    logToDiscord('warn', message, metadata);
  },
  info: (message, metadata = {}) => {
    logger.info(message, metadata);
    logToDiscord('info', message, metadata);
  },
  debug: (message, metadata = {}) => {
    logger.debug(message, metadata);
    logToDiscord('debug', message, metadata);
  },
  verbose: (message, metadata = {}) => {
    logger.debug(message, metadata); // Use debug level for verbose
    logToDiscord('debug', message, metadata);
  },
  log: (level, message, metadata = {}) => {
    logger.log(level, message, metadata);
    logToDiscord(level, message, metadata);
  },
  // Logger configuration functions
  setLogChannel,
  getLogChannel,
  initDiscordLogging,
  setVerboseLogging,
  isVerboseEnabled: () => isVerboseEnabled
};

// Create a stream object for Morgan
const stream = {
  write: (message) => {
    enhancedLogger.info(message.trim());
  }
};

module.exports = { logger: enhancedLogger, stream };