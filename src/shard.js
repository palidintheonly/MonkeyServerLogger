// Main entry point for the bot
require('dotenv').config();
const { ShardingManager } = require('discord.js');
const path = require('path');
const { logger } = require('./utils/logger');

// Get the token from environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
if (!token) {
  logger.error('CRITICAL ERROR: No Discord bot token found in environment variables!');
  process.exit(1);
}

// Log token length for debugging (safely)
const tokenLength = token.length;
const tokenFirstChars = token.substring(0, 5);
const tokenLastChars = token.substring(tokenLength - 5);
logger.info(`Using token of length ${tokenLength}, starting with ${tokenFirstChars}... and ending with ...${tokenLastChars}`);

// Create a simple ShardingManager
const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: token,
  totalShards: 'auto'
});

// Log when a shard is created
manager.on('shardCreate', shard => {
  logger.info(`Launched shard ${shard.id}`);
  
  // Add event listeners to shard
  shard.on('ready', () => {
    logger.info(`Shard ${shard.id} ready`);
  });
  
  shard.on('disconnect', () => {
    logger.warn(`Shard ${shard.id} disconnected`);
  });
  
  shard.on('reconnecting', () => {
    logger.info(`Shard ${shard.id} reconnecting`);
  });
  
  shard.on('error', error => {
    logger.error(`Shard ${shard.id} error:`, error);
  });
});

// Handle process termination
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

// Spawn manager
(async () => {
  try {
    logger.info('Starting bot...');
    await manager.spawn();
    logger.info('All shards spawned successfully');
  } catch (error) {
    logger.error('Failed to spawn shards:', error);
    process.exit(1);
  }
})();