// Main entry point for sharded bot
const { startSharding } = require('./utils/shardManager');
const { logger } = require('./utils/logger');

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
    // Start sharding manager
    await startSharding();
  } catch (error) {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  }
})();