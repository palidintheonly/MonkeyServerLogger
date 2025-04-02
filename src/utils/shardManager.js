require('dotenv').config();
const { ShardingManager } = require('discord.js');
const { logger } = require('./logger');
const path = require('path');

// Create sharding manager with more resilient configuration
const manager = new ShardingManager(path.join(__dirname, '../index.js'), {
  token: process.env.TOKEN,
  totalShards: 'auto', // Auto-determine the number of shards based on guild count
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
      // Use retry mechanism with exponential backoff
      await retry(async () => {
        logger.info('Attempting to spawn shards...');
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