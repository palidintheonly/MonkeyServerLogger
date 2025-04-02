require('dotenv').config();
const { ShardingManager, Routes } = require('discord.js');
const { logger } = require('./logger');
const path = require('path');
const { REST } = require('@discordjs/rest');

// Validate token
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
if (!token) {
  logger.error('No Discord bot token found in environment variables (checked DISCORD_BOT_TOKEN and TOKEN)!');
  process.exit(1);
}

// Log token length for debugging (safely)
const tokenLength = token.length;
const tokenFirstChars = token.substring(0, 5);
const tokenLastChars = token.substring(tokenLength - 5);
logger.info(`Using token of length ${tokenLength}, starting with ${tokenFirstChars}... and ending with ...${tokenLastChars}`);
// Initialize REST API with token 
const rest = new REST({ version: '10' }).setToken(token);

// Custom function to calculate number of shards based on guild count
const calculateShardCount = async () => {
  try {
    logger.info(`[SHARD MANAGER] Calculating shard count using token: ${token.substring(0, 5)}...`);
    
    // Try using a more direct approach
    try {
      logger.info('[SHARD MANAGER] Attempting to get gateway bot info...');
      // Get recommended shard count from Discord
      const { shards: recommendedShards } = await rest.get(Routes.gatewayBot());
      
      logger.info(`[SHARD MANAGER] Successfully retrieved gateway bot info: ${recommendedShards} recommended shards`);
      
      // Get application information (includes guild count)
      const appInfo = await rest.get(Routes.oauth2CurrentApplication());
      const guildCount = appInfo.approximate_guild_count || 1;
      
      // Use 1 shard per guild as recommended by Discord
      const customShards = guildCount;
      
      logger.info(`[SHARD MANAGER] Discord recommended ${recommendedShards} shards for ${guildCount} guilds`);
      logger.info(`[SHARD MANAGER] Using 1:1 ratio: ${customShards} shards (1 shard per guild)`);
      
      return customShards;
    } catch (gatewayError) {
      logger.error('[SHARD MANAGER] Failed to get gateway bot info:', gatewayError);
      logger.warn('[SHARD MANAGER] Falling back to 1 shard due to API error');
      return 1; // Default to 1 shard if gateway info fails
    }
  } catch (error) {
    logger.error('[SHARD MANAGER] Error calculating custom shard count:', error);
    return 1; // Default to 1 shard if calculation fails
  }
};

// Create sharding manager with custom shard count (1 shard per guild)
const manager = new ShardingManager(path.join(__dirname, '../index.js'), {
  token: token, // Use the token we validated above
  respawn: true, // Automatically respawn crashed shards
  shardArgs: ['--shard'],
  spawnTimeout: 120000, // Increase timeout to 2 minutes (from default 30s)
  respawnDelay: 10000, // Wait 10 seconds before respawning a shard
});

// Shard events
manager.on('shardCreate', shard => {
  logger.info(`Launched shard ${shard.id}`);
  
  // Log shard errors
  shard.on('error', error => {
    logger.error(`Shard ${shard.id} error:`, error);
  });
  
  // Log shard disconnections
  shard.on('disconnect', () => {
    logger.warn(`Shard ${shard.id} disconnected`);
  });
  
  // Log shard reconnections
  shard.on('reconnecting', () => {
    logger.info(`Shard ${shard.id} reconnecting...`);
  });
  
  // Log shard ready events
  shard.on('ready', () => {
    logger.info(`Shard ${shard.id} ready`);
  });
});

// Handle manager errors
manager.on('shardError', (error, shardId) => {
  logger.error(`Shard ${shardId} error:`, error);
});

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the specified time
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise} - Promise that resolves with the function result or rejects after all retries
 */
const retry = async (fn, maxRetries = 5, initialDelay = 5000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = initialDelay * Math.pow(2, attempt);
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

module.exports = {
  manager,
  startSharding: async () => {
    logger.info('Starting sharding manager...');
    
    try {
      // Calculate custom shard count
      const customShardCount = await calculateShardCount();
      logger.info(`Setting shard count to ${customShardCount} (1 shard per guild)`);
      
      // Override totalShards setting with our custom calculation
      manager.totalShards = customShardCount;
      
      // Use retry mechanism with exponential backoff
      await retry(async () => {
        logger.info(`Attempting to spawn ${customShardCount} shards...`);
        await manager.spawn();
        logger.info('All shards spawned successfully');
      }, 3, 10000); // Max 3 retries, starting with 10 second delay
      
      return true;
    } catch (error) {
      logger.error('All retry attempts to spawn shards failed:', error);
      logger.error('Error details:', error.message || 'Unknown error');
      return false;
    }
  }
};