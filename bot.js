/**
 * Discord Modmail Bot - Production Entry Point
 * 
 * This is the production entry point that loads the main bot file.
 * It contains basic error handling and restart logic for production use.
 */
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// File paths
const errorLogFile = path.join(logsDir, 'error.log');

// Configuration
const MAX_RESTARTS = 3;
const RESTART_DELAY = 10000; // 10 seconds
let restartCount = 0;
let lastRestartTime = 0;

function startBot() {
  console.log('Starting Discord Modmail Bot...');
  
  try {
    // Load the main bot code
    const bot = require('./src/index.js');
    console.log('Bot loaded successfully');
  } catch (error) {
    handleError(error);
  }
}

function handleError(error) {
  const now = Date.now();
  const timeSinceLastRestart = now - lastRestartTime;
  
  // Log the error
  console.error(`Bot crashed with error: ${error.message}`);
  console.error(error.stack);
  
  // Also log to file
  try {
    fs.appendFileSync(errorLogFile, `\n[${new Date().toISOString()}] Bot crashed with error: ${error.message}\n${error.stack}\n`);
  } catch (logError) {
    console.error(`Failed to write to error log: ${logError.message}`);
  }
  
  // Check if we should restart
  if (restartCount < MAX_RESTARTS) {
    // Reset restart count if it's been a while since last restart
    if (timeSinceLastRestart > 60000) { // 1 minute
      restartCount = 0;
    }
    
    restartCount++;
    lastRestartTime = now;
    
    console.log(`Restarting bot in ${RESTART_DELAY / 1000} seconds... (Attempt ${restartCount}/${MAX_RESTARTS})`);
    
    setTimeout(() => {
      // Clear require cache to reload modules
      Object.keys(require.cache).forEach(key => {
        if (key.includes('/src/')) {
          delete require.cache[key];
        }
      });
      
      startBot();
    }, RESTART_DELAY);
  } else {
    console.error(`Maximum restart attempts (${MAX_RESTARTS}) reached. Exiting.`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', handleError);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  handleError(new Error(`Unhandled promise rejection: ${reason}`));
});

// Start the bot
startBot();