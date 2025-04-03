/**
 * Discord Modmail Bot - Server-Based Sharding Manager
 * 
 * This script implements a custom sharding approach with one shard per Discord server.
 * Each shard is dedicated to a specific guild for maximum performance and reliability.
 */
require('dotenv').config();
const { ShardingManager, REST, Routes } = require('discord.js');
const path = require('path');
const { logger } = require('./src/utils/logger');
const fs = require('fs');

// The file to run in each shard
const shardFile = path.join(__dirname, 'bot.js');

// Create a REST API client to fetch guild information
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// Fetch all guilds the bot is connected to
async function getConnectedGuilds() {
  try {
    // Fetch guild information from Discord API
    const guilds = await rest.get(Routes.userGuilds());
    logger.info(`Bot is connected to ${guilds.length} Discord servers`);
    return guilds;
  } catch (error) {
    logger.error(`Failed to fetch connected guilds: ${error.message}`, { error });
    // Return a fallback set of guild IDs if we can't fetch them
    const fallbackGuilds = [];
    
    // Check if we have a stored guild list from previous runs
    try {
      if (fs.existsSync('./guild_shard_map.json')) {
        const storedMap = JSON.parse(fs.readFileSync('./guild_shard_map.json', 'utf8'));
        for (const guildId in storedMap) {
          fallbackGuilds.push({ id: guildId });
        }
        logger.info(`Using ${fallbackGuilds.length} guilds from stored mapping`);
        return fallbackGuilds;
      }
    } catch (readError) {
      logger.error(`Failed to read stored guild map: ${readError.message}`);
    }
    
    // If no stored data, use default fallback
    logger.warn('Using default fallback guild list for sharding');
    return [{ id: '1269949849810501643' }, { id: '1332763566154973344' }];
  }
}

// Set up the sharding infrastructure
async function setupShardManager() {
  // Get the list of guilds we're connected to
  const guilds = await getConnectedGuilds();
  
  // Create a mapping of guild IDs to shard IDs
  // Each guild gets its own dedicated shard
  const guildToShardMap = {};
  guilds.forEach((guild, index) => {
    guildToShardMap[guild.id] = index;
  });
  
  // Store the mapping to a file so shards can access it
  fs.writeFileSync('./guild_shard_map.json', JSON.stringify(guildToShardMap, null, 2));
  
  // Calculate how many shards we need (one per guild)
  const totalShards = guilds.length;
  logger.info(`Creating ${totalShards} shards (one per server)`);
  
  // Create the sharding manager with custom configuration
  const manager = new ShardingManager(shardFile, {
    // Set explicit number of shards based on guild count
    totalShards: totalShards,
    
    // Use the environment token for authentication
    token: process.env.DISCORD_BOT_TOKEN,
    
    // Pass shard map file path to the shards
    shardArgs: ['--sharded', '--shardMapFile=guild_shard_map.json'],
    
    // Use process mode in production, worker mode in development
    mode: process.env.NODE_ENV === 'production' ? 'process' : 'worker',
    
    // Automatically respawn crashed shards
    respawn: true,
    
    // Wait 5 seconds between shard spawns to prevent rate limits
    spawnTimeout: 5000
  });
  
  return { manager, totalShards, guildToShardMap };
}

// Register logging functions for shard events
function setupShardListeners(manager) {
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
}

// Start the sharding manager
async function startManager() {
  try {
    logger.info('Starting Discord bot with custom server-based sharding');
    
    // Setup the sharding manager with guild-specific configuration
    const { manager, totalShards, guildToShardMap } = await setupShardManager();
    
    // Register event listeners for the manager
    setupShardListeners(manager);
    
    // Register error handler for the manager
    manager.on('error', error => {
      logger.error(`Sharding manager encountered an error: ${error.message}`, { error });
    });
    
    // Spawn all the shards
    await manager.spawn();
    logger.info(`Successfully spawned ${totalShards} shards (one per server)`);
    
    // Log info about which guild is assigned to each shard
    for (const [guildId, shardId] of Object.entries(guildToShardMap)) {
      logger.info(`Guild ${guildId} assigned to shard ${shardId}`);
    }
    
    return { manager, totalShards, guildToShardMap };
  } catch (error) {
    logger.error(`Failed to start sharding manager: ${error.message}`, { error });
    process.exit(1);
  }
}

// Start the bot with sharding
let managerRef;
(async () => {
  try {
    const result = await startManager();
    managerRef = result.manager;
    logger.info('Server-based sharding is active and running');
  } catch (error) {
    logger.error(`Failed to start server-based sharding: ${error.message}`);
    process.exit(1);
  }
})();

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down sharding manager gracefully');
  if (managerRef) {
    managerRef.respawn = false; // Prevent respawning on exit
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down sharding manager gracefully');
  if (managerRef) {
    managerRef.respawn = false; // Prevent respawning on exit
  }
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