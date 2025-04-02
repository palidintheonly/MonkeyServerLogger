// Main entry point for sharded bot
require('dotenv').config(); // Make sure dotenv is loaded here first
const { startSharding } = require('./utils/shardManager');
const { logger } = require('./utils/logger');

// Debug environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
if (!token) {
  logger.error('CRITICAL ERROR: No Discord bot token found in environment variables (checked DISCORD_BOT_TOKEN and TOKEN)!');
  process.exit(1);
}

// Log token length for debugging (safely)
const tokenLength = token.length;
const tokenFirstChars = token.substring(0, 5);
const tokenLastChars = token.substring(tokenLength - 5);
logger.info(`[SHARD MANAGER] Using token of length ${tokenLength}, starting with ${tokenFirstChars}... and ending with ...${tokenLastChars}`);

// Check client ID
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;
if (!clientId) {
  logger.error('CRITICAL ERROR: No Discord client ID found in environment variables (checked DISCORD_APPLICATION_ID and CLIENT_ID)!');
  process.exit(1);
}
logger.info(`[SHARD MANAGER] Using client ID: ${clientId}`);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start the bot with sharding
(async () => {
  try {
    logger.info('[SHARD MANAGER] Starting bot in sharding mode...');
    // Start sharding manager
    await startSharding();
  } catch (error) {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  }
})();