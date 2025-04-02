require('dotenv').config();
const { ShardingManager, Routes } = require('discord.js');
const { logger } = require('./logger');
const path = require('path');
const { REST } = require('@discordjs/rest');

// Validate token
if (!process.env.TOKEN) {
  logger.error('Discord bot TOKEN is missing! Please add it to your environment variables.');
  process.exit(1);
}

// Initialize REST API with token 
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Custom function to calculate number of shards based on guild count
const calculateShardCount = async () => {
  try {
    // Get recommended shard count from Discord
    const { shards: recommendedShards } = await rest.get(Routes.gatewayBot());
    
    // Get application information (includes guild count)
    const appInfo = await rest.get(Routes.oauth2CurrentApplication());
    const guildCount = appInfo.approximate_guild_count || 1;
    
    // Use 1 shard per guild as recommended by Discord
    const customShards = guildCount;
    
    logger.info(`Discord recommended ${recommendedShards} shards for ${guildCount} guilds`);
    logger.info(`Using 1:1 ratio: ${customShards} shards (1 shard per guild)`);
    
    return customShards;
  } catch (error) {
    logger.error('Error calculating custom shard count:', error);
    logger.error(error);
    return 1; // Default to 1 shard if calculation fails
  }
};

// Create sharding manager with custom shard count (1 shard per guild)
const manager = new ShardingManager(path.join(__dirname, '../index.js'), {
  token: process.env.TOKEN,
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