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

// Function to determine shard count based on Discord's recommendations
const calculateShardCount = async () => {
  try {
    logger.info(`[SHARD MANAGER] Requesting recommended shard count from Discord...`);
    
    try {
      // Get recommended shard count from Discord's gateway endpoint
      const gatewayInfo = await rest.get(Routes.gatewayBot());
      const recommendedShards = gatewayInfo.shards || 1;
      
      logger.info(`[SHARD MANAGER] Discord recommends ${recommendedShards} shard(s)`);
      
      // For small to medium bots, using Discord's recommendation is best practice
      return recommendedShards;
    } catch (gatewayError) {
      logger.error('[SHARD MANAGER] Failed to get gateway bot info:', gatewayError);
      logger.warn('[SHARD MANAGER] Falling back to 1 shard due to API error');
      return 1; // Default to 1 shard if gateway info fails
    }
  } catch (error) {
    logger.error('[SHARD MANAGER] Error calculating shard count:', error);
    return 1; // Default to 1 shard if calculation fails
  }
};

// Create basic sharding manager with Discord.js defaults
const manager = new ShardingManager(path.join(__dirname, '../index.js'), {
  token: token,
  respawn: true,
  shardArgs: ['--shard']
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
      // Let Discord.js handle shard count automatically
      logger.info('Spawning shards with automatic configuration...');
      await manager.spawn();
      logger.info('All shards spawned successfully');
      return true;
    } catch (error) {
      logger.error('Failed to spawn shards:', error);
      logger.error('Error details:', error.message || 'Unknown error');
      return false;
    }
  }
};