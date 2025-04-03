/**
 * MonkeyBytes Discord Modmail Bot - Production Entry Point
 * Version 2.0.0 - The Royal Court
 * 
 * This is the production entry point that loads the main bot file.
 * It contains basic error handling and restart logic for production use.
 */
const fs = require('fs');
const path = require('path');
const { version, name, codename, company, slogan } = require('./src/version');

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
  console.log(`Starting ${name} v${version} (${codename})...`);
  console.log(`${company} presents: ${slogan}`);
  
  // Determine sharding mode and configuration
  const isSharded = process.argv.includes('--sharded');
  
  // Get the shard's dedicated guild from command line arguments
  let shardMapFile = null;
  for (const arg of process.argv) {
    if (arg.startsWith('--shardMapFile=')) {
      shardMapFile = arg.split('=')[1];
      break;
    }
  }
  
  // If we're running in server-based sharding mode
  if (isSharded && shardMapFile) {
    console.log(`[SHARD MODE] Running in custom server-based sharding mode`);
    
    try {
      // Load the guild-to-shard mapping
      const fs = require('fs');
      const guildShardMap = JSON.parse(fs.readFileSync(shardMapFile, 'utf8'));
      
      // Get the current shard ID from the environment
      const currentShardId = parseInt(process.env.SHARD_ID || '0');
      console.log(`[SHARD ${currentShardId}] Starting up...`);
      
      // Find all guilds assigned to this shard
      const assignedGuilds = Object.entries(guildShardMap)
        .filter(([_, shardId]) => shardId === currentShardId)
        .map(([guildId]) => guildId);
      
      if (assignedGuilds.length > 0) {
        // We should only have one guild per shard in this custom approach
        const assignedGuildId = assignedGuilds[0];
        console.log(`[SHARD ${currentShardId}] Dedicated to server: ${assignedGuildId}`);
        
        // Set this in the process environment for the bot to access later
        process.env.ASSIGNED_GUILD_ID = assignedGuildId;
        
        // Create a specialized log prefix for this shard
        process.env.LOG_PREFIX = `[SERVER ${assignedGuildId}]`;
      } else {
        console.warn(`[SHARD ${currentShardId}] No assigned guilds - this shard will be inactive`);
      }
      
      // Log overall shard info
      console.log(`[SHARD CONFIG] Total servers in mapping: ${Object.keys(guildShardMap).length}`);
      console.log(`[SHARD ${currentShardId}] Initialization complete`);
    } catch (error) {
      console.error(`[SHARD ERROR] Failed to load shard map: ${error.message}`);
      
      // Log the error details for debugging
      console.error(`[SHARD ERROR] Stack trace: ${error.stack}`);
      console.error(`[SHARD ERROR] Map file: ${shardMapFile}`);
      
      // Try to log the file contents or existence
      try {
        const fs = require('fs');
        if (fs.existsSync(shardMapFile)) {
          console.log(`[SHARD ERROR] Shard map file exists but cannot be parsed`);
          console.log(`[SHARD ERROR] File content: ${fs.readFileSync(shardMapFile, 'utf8')}`);
        } else {
          console.error(`[SHARD ERROR] Shard map file does not exist: ${shardMapFile}`);
        }
      } catch (fsError) {
        console.error(`[SHARD ERROR] Error checking shard map file: ${fsError.message}`);
      }
    }
  } else if (isSharded) {
    // Standard Discord.js sharding
    console.log(`[SHARD MODE] Running in standard Discord.js sharding mode`);
    const shardId = process.env.SHARD_ID || '0';
    const shardCount = process.env.SHARD_COUNT || '1';
    console.log(`[SHARD ${shardId}] Starting up (${shardId}/${shardCount - 1})...`);
  } else {
    console.log('Running in standalone mode (no sharding)');
  }
  
  try {
    // Load the main bot code
    const bot = require('./src/index.js');
    console.log(`${company} Bot v${version} loaded successfully`);
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