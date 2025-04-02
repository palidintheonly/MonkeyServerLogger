const { ActivityType, version: discordJsVersion } = require('discord.js');
const { logger } = require('../../utils/logger');
const { logger: enhancedLogger } = require('../../utils/enhanced-logger');
const config = require('../../config');
const { models } = require('../../database/db');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    const serverCount = client.guilds.cache.size;
    
    // Add console.log to help with debugging
    console.log('READY EVENT TRIGGERED - BOT IS ONLINE!');
    
    // Set bot activity with enhanced logging info
    client.user.setPresence({
      activities: [{ 
        name: `with Enhanced Verbose Logging | /help`, 
        type: ActivityType.Playing 
      }],
      status: 'online'
    });
    
    // Log shard information
    const shardInfo = client.shard 
      ? `[Shard ${client.shard.ids.join('/')}] ` 
      : '';
    
    // Log detailed bot information
    logger.info('==================================================');
    logger.info(`${shardInfo}Bot Ready! Connection successful!`);
    logger.info(`Logged in as: ${client.user.tag} (ID: ${client.user.id})`);
    
    // Direct console output for visibility
    console.log(`Bot is now online as ${client.user.tag}!`);
    logger.info(`Currently serving ${serverCount} servers`);
    logger.info(`Discord API Version: v${client.options.rest.version}`);
    logger.info(`Discord.js Version: v${discordJsVersion}`);
    logger.info(`Node.js Version: ${process.version}`);
    logger.info(`Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
    logger.info(`Uptime: ${Math.round(process.uptime())} seconds`);
    
    // Log information about the bot's permissions and intents
    const intents = Object.keys(client.options.intents).join(', ');
    logger.info(`Registered Intents: ${intents}`);
    
    // Log total stats if this is shard 0 or not sharded
    if (!client.shard || client.shard.ids.includes(0)) {
      // Log helpful information
      logger.info(`Invite Link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
      logger.info('==================================================');
      logger.info('Monkey Bytes - The Royal Court is now online!');
      
      // Get server stats from all shards if sharded
      if (client.shard) {
        try {
          const serverCounts = await client.shard.fetchClientValues('guilds.cache.size');
          const totalServers = serverCounts.reduce((acc, count) => acc + count, 0);
          logger.info(`Total servers across all shards: ${totalServers}`);
          
          // Get shard status
          const shardPings = await client.shard.broadcastEval(c => c.ws.ping);
          logger.info('Shard Status:');
          shardPings.forEach((ping, shardId) => {
            logger.info(`Shard ${shardId}: ${ping}ms`);
          });
        } catch (error) {
          logger.error('Error fetching shard statistics:', error);
        }
      }
    }
    
    // Log connected guilds for diagnostic purposes
    const connectedGuilds = client.guilds.cache.map(guild => 
      `${guild.name} (${guild.id}) - ${guild.memberCount} members`
    );
    
    if (connectedGuilds.length > 0) {
      logger.info('Connected to the following guilds:');
      connectedGuilds.forEach(guild => logger.info(`- ${guild}`));
    } else {
      logger.warn('Not connected to any guilds yet!');
    }
    logger.info('==================================================');
    
    // Initialize enhanced logging system
    enhancedLogger.initDiscordLogging(client);
    
    // Set up the enhanced logging for each guild
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        // Check if models and Guild model are available
        if (!models || !models.Guild) {
          logger.warn(`Database models not available yet for guild ${guild.name}, skipping enhanced logging setup`);
          continue;
        }
        
        // Load guild settings from database - properly access model
        const Guild = models.Guild;
        const guildSettings = await Guild.findOrCreate({
          where: { guildId },
          defaults: { guildId }
        }).then(([guild]) => guild);
        
        // Skip if setup not completed
        if (!guildSettings.setupCompleted) {
          logger.info(`Skipping logging setup for ${guild.name} (setup not completed)`);
          continue;
        }
        
        // Set up regular logging channel if available
        if (guildSettings.loggingChannelId) {
          try {
            const logChannel = await guild.channels.fetch(guildSettings.loggingChannelId);
            if (logChannel) {
              enhancedLogger.setLogChannel(logChannel, false);
              logger.info(`Regular logging initialized for ${guild.name}`);
            }
          } catch (error) {
            logger.error(`Error setting up regular logging channel for ${guild.name}: ${error.message}`);
          }
        }
        
        // Set up verbose logging if enabled
        const verboseEnabled = guildSettings.verboseLoggingEnabled === true;
        if (verboseEnabled && guildSettings.verboseLoggingChannelId) {
          try {
            const verboseChannel = await guild.channels.fetch(guildSettings.verboseLoggingChannelId);
            if (verboseChannel) {
              enhancedLogger.setLogChannel(verboseChannel, true);
              enhancedLogger.setVerboseLogging(true);
              logger.info(`Verbose logging initialized for ${guild.name}`);
              
              // Log test messages
              enhancedLogger.debug(`Verbose logging test for ${guild.name}`, { 
                guild: guild.name, 
                time: new Date().toISOString(),
                test: true
              });
            }
          } catch (error) {
            logger.error(`Error setting up verbose logging channel for ${guild.name}: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error initializing logging for guild ${guildId}: ${error.message}`);
      }
    }
    
    logger.info('Logging system initialization complete');
    
    // Log animated loading indicators initialization
    logger.info('Animated loading indicators initialized for interactive commands');
    logger.info('Bot is fully operational with enhanced user experience features!');
  }
};
