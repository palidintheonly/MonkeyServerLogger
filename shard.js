/**
 * Discord Modmail Bot - Sharding Manager
 * 
 * This script manages the bot's sharding process, allowing it to scale
 * across multiple processes as the bot joins more Discord servers.
 * Discord requires sharding once a bot reaches 2500+ servers.
 */
require('dotenv').config();
const { ShardingManager } = require('discord.js');
const path = require('path');
const { logger } = require('./src/utils/logger');

// The file to run in each shard
const shardFile = path.join(__dirname, 'bot.js');

// Create the sharding manager
const manager = new ShardingManager(shardFile, {
  // Auto spawn shards based on recommended amount from Discord
  totalShards: 'auto',
  
  // Use the environment token for authentication
  token: process.env.DISCORD_BOT_TOKEN,
  
  // Optional: Share spawn arguments with shards
  shardArgs: ['--sharded'],
  
  // Pass the respected environment mode
  mode: process.env.NODE_ENV === 'production' ? 'process' : 'worker',
  
  // Respawn crashed shards automatically
  respawn: true,
  
  // Wait 5 seconds between shard spawns to prevent rate limits
  spawnTimeout: 5000
});

// Logging for shard creation
manager.on('shardCreate', shard => {
  logger.info(`Launched shard ${shard.id + 1}/${manager.totalShards}`);
  
  // Setup error handling for this shard
  shard.on('error', error => {
    logger.error(`Shard ${shard.id} encountered an error: ${error.message}`, { error });
  });
  
  shard.on('death', () => {
    logger.warn(`Shard ${shard.id} died unexpectedly, will attempt to respawn`);
  });
  
  shard.on('disconnect', () => {
    logger.warn(`Shard ${shard.id} disconnected, will attempt to reconnect`);
  });
  
  shard.on('reconnecting', () => {
    logger.info(`Shard ${shard.id} reconnecting to Discord`);
  });
});

// Handle manager errors
manager.on('error', error => {
  logger.error(`Sharding manager encountered an error: ${error.message}`, { error });
});

// Start the sharding manager
async function startManager() {
  try {
    logger.info('Starting Discord bot with sharding enabled');
    await manager.spawn();
    logger.info(`Successfully spawned ${manager.totalShards} shards`);
  } catch (error) {
    logger.error(`Failed to start sharding manager: ${error.message}`, { error });
    process.exit(1);
  }
}

// Start the bot with sharding
startManager();

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down sharding manager gracefully');
  manager.respawn = false; // Prevent respawning on exit
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down sharding manager gracefully');
  manager.respawn = false; // Prevent respawning on exit
  process.exit(0);
});

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  logger.error(`Sharding manager uncaught exception: ${error.message}`, { error });
  
  // In production, we might want to restart the manager after an uncaught exception
  if (process.env.NODE_ENV === 'production') {
    logger.info('Attempting to restart sharding manager due to uncaught exception');
    process.exit(1); // Exit with error code, let process manager restart
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Sharding manager unhandled promise rejection at: ${promise}, reason: ${reason}`);
});