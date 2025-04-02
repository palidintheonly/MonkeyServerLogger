require('dotenv').config();
const { ShardingManager } = require('discord.js');
const { logger } = require('./logger');
const path = require('path');

// Create sharding manager
const manager = new ShardingManager(path.join(__dirname, '../index.js'), {
  token: process.env.TOKEN,
  totalShards: 'auto', // Auto-determine the number of shards based on guild count
  respawn: true, // Automatically respawn crashed shards
  shardArgs: ['--shard'],
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

module.exports = {
  manager,
  startSharding: async () => {
    try {
      logger.info('Starting sharding manager...');
      await manager.spawn();
      logger.info('All shards spawned successfully');
      return true;
    } catch (error) {
      logger.error('Error spawning shards:', error);
      return false;
    }
  }
};