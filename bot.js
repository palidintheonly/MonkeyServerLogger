/**
 * Discord Bot - Production Entry Point
 * 
 * This is the production entry point that loads the main bot file.
 * It contains basic error handling and restart logic for production use.
 */
require('dotenv').config();
const { logger } = require('./src/utils/logger');

// Set up global error handlers
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { error });
  console.error('Uncaught Exception:', error);
  
  // Shutdown gracefully rather than risk an inconsistent state
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Keep running but log the error
});

// Exit handler
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Bot is shutting down.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Bot is shutting down.');
  process.exit(0);
});

// Auto-restart function in case of fatal errors
function startBot() {
  try {
    logger.info('Starting bot...');
    
    // Import and run the main bot code
    require('./src/index');
    
    logger.info('Bot started successfully.');
  } catch (error) {
    logger.error(`Failed to start bot: ${error.message}`);
    console.error('Failed to start bot:', error);
    
    // Wait 5 seconds before restarting
    logger.info('Restarting in 5 seconds...');
    setTimeout(startBot, 5000);
  }
}

// Start the bot
startBot();