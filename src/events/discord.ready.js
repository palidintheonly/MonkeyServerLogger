/**
 * Discord.js Ready Event
 * MonkeyBytes - The Royal Court
 */
const { Events, ActivityType, REST, Routes } = require('discord.js');
const { logger } = require('../utils/logger');
const { commands: cmdConfig, bot } = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,  // This event will only fire once
  
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    
    // Get sharding information from client
    const shardInfo = client.shardInfo || { mode: 'standalone' };
    logger.info(`Bot running in ${shardInfo.mode} mode`);
    
    // Set up rotating status messages
    setupRotatingStatus(client);
    
    // Handle based on sharding mode
    if (shardInfo.mode === 'server-based') {
      // One guild per shard - special handling
      const assignedGuildId = shardInfo.targetGuildId;
      if (!assignedGuildId) {
        logger.warn('Server-based sharding enabled but no target guild ID assigned');
        return;
      }
      
      // Check if we can access the assigned guild
      const assignedGuild = client.guilds.cache.get(assignedGuildId);
      
      if (assignedGuild) {
        logger.info(`SERVER-DEDICATED SHARD ${shardInfo.shardId} active for: ${assignedGuild.name} (${assignedGuildId})`);
        
        // Log guild statistics
        const memberCount = assignedGuild.memberCount || 'unknown';
        const channelCount = assignedGuild.channels.cache.size;
        const roles = assignedGuild.roles.cache.size;
        const emojis = assignedGuild.emojis?.cache.size || 0;
        
        logger.info(`Guild stats: ${memberCount} members | ${channelCount} channels | ${roles} roles | ${emojis} emojis`);
        
        // Check for modmail settings in this guild
        try {
          const guildSettings = await client.db.Guild.findOne({ where: { guildId: assignedGuildId } });
          
          if (guildSettings) {
            const modmailEnabled = guildSettings.modmailEnabled && guildSettings.settings?.modmail?.enabled;
            logger.info(`Modmail enabled for guild: ${modmailEnabled ? 'YES' : 'NO'}`);
            
            if (modmailEnabled) {
              const modmailCategory = guildSettings.settings?.modmail?.categoryId || 'not set';
              const modmailLogChannel = guildSettings.settings?.modmail?.logChannelId || 'not set';
              logger.info(`Modmail config: category=${modmailCategory}, logChannel=${modmailLogChannel}`);
            }
          } else {
            logger.info(`No settings found for guild ${assignedGuildId} - will create defaults on first use`);
          }
        } catch (error) {
          logger.error(`Error checking modmail settings: ${error.message}`);
        }
        
        // Register commands only for this guild
        await registerCommandsForGuild(client, assignedGuildId);
        
      } else {
        // Guild not found in cache - this is a serious issue for server-based sharding
        logger.warn(`⚠️ TARGET GUILD NOT FOUND: Guild ID ${assignedGuildId} assigned to this shard is not in the cache`);
        logger.warn(`This shard (${shardInfo.shardId}) may not have permission to access the assigned guild`);
        logger.info(`Currently connected to ${client.guilds.cache.size} guilds instead`);
        
        // Log the guilds we do have access to
        if (client.guilds.cache.size > 0) {
          logger.info('Connected guild(s):');
          client.guilds.cache.forEach(guild => {
            logger.info(`- ${guild.name} (${guild.id})`);
          });
          
          // Register commands for these guilds as a fallback
          await registerCommandsForAllGuilds(client);
        } else {
          logger.warn('This shard is not connected to ANY guilds - no commands will be registered');
        }
      }
      
    } else if (shardInfo.mode === 'standard') {
      // Standard Discord.js sharding
      logger.info(`STANDARD SHARD ${shardInfo.shardId}/${shardInfo.totalShards - 1} connected to ${client.guilds.cache.size} guilds`);
      
      if (client.guilds.cache.size > 0) {
        // Log the largest guilds for this shard
        const topGuilds = [...client.guilds.cache.values()]
          .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
          .slice(0, 5);
        
        logger.info('Largest guilds on this shard:');
        topGuilds.forEach(guild => {
          logger.info(`- ${guild.name} (${guild.id}): ${guild.memberCount || 'unknown'} members`);
        });
      }
      
      // Register commands for all guilds on this shard
      await registerCommandsForAllGuilds(client);
      
    } else {
      // Standalone mode (no sharding)
      logger.info(`Connected to ${client.guilds.cache.size} guilds with ${client.channels.cache.size} channels`);
      
      // Register slash commands for all connected guilds
      await registerCommandsForAllGuilds(client);
    }
    
    // Set up any scheduled tasks
    setupScheduledTasks(client);
  }
};

/**
 * Set up rotating status messages to explain how to use the bot
 * @param {Client} client - Discord client
 */
function setupRotatingStatus(client) {
  // Basic status messages
  let statusMessages = [
    { text: 'DM me for modmail support', type: ActivityType.Playing },
    { text: '/help for commands', type: ActivityType.Listening },
    { text: 'Contact server staff via DM', type: ActivityType.Watching },
    { text: `${bot.company} - ${bot.slogan}`, type: ActivityType.Playing },
    { text: `Version ${bot.version}`, type: ActivityType.Competing }
  ];
  
  // Add shard-specific messages if we're running in a sharded mode
  if (client.shardInfo && client.shardInfo.mode !== 'standalone') {
    // Standard sharding status
    if (client.shardInfo.mode === 'standard') {
      statusMessages.push({
        text: `Shard ${client.shardInfo.shardId}/${client.shardInfo.totalShards - 1}`,
        type: ActivityType.Competing
      });
    }
    
    // Server-based sharding status
    if (client.shardInfo.mode === 'server-based' && client.shardInfo.targetGuildId) {
      const guild = client.guilds.cache.get(client.shardInfo.targetGuildId);
      if (guild) {
        statusMessages.push({
          text: `Dedicated to ${guild.name}`,
          type: ActivityType.Watching
        });
      }
    }
  }
  
  let currentIndex = 0;
  
  // Set initial status
  updateStatus();
  
  // Set interval to rotate status every 15 seconds
  setInterval(updateStatus, 15000);
  
  // Function to update the bot's status
  function updateStatus() {
    const status = statusMessages[currentIndex];
    
    client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: status.text,
          type: status.type
        }
      ]
    });
    
    // Log status change in debug mode
    logger.debug(`Status updated to: ${status.text} (${ActivityType[status.type]})`);
    
    // Move to next status, loop back to beginning if at the end
    currentIndex = (currentIndex + 1) % statusMessages.length;
  }
  
  logger.info('Rotating status messages enabled (15-second interval)');
}

/**
 * Register commands for all connected guilds at startup
 * @param {Client} client - Discord client
 */
async function registerCommandsForAllGuilds(client) {
  try {
    // Skip if no commands are loaded
    if (!client.commands || client.commands.size === 0) {
      logger.warn('No commands found to register');
      return;
    }
    
    // Get command data from all loaded commands
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    logger.info(`Preparing to register ${commands.length} commands to all connected guilds`);
    
    // Create REST instance
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    
    // Get all guilds the bot is connected to
    const guilds = client.guilds.cache;
    logger.info(`Bot is connected to ${guilds.size} guilds, registering commands...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Register commands to each guild
    for (const [guildId, guild] of guilds) {
      try {
        // Check if we have permission to create commands in this guild
        const member = await guild.members.fetch(client.user.id).catch(() => null);
        if (!member || !member.permissions.has('ManageGuild')) {
          logger.warn(`Skipping command registration for guild ${guild.name} (${guildId}): Missing permissions`);
          continue;
        }
        
        logger.info(`Registering ${commands.length} commands to guild ${guild.name} (${guildId})...`);
        
        // Update guild commands
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, guildId),
          { body: commands }
        );
        
        logger.info(`Successfully registered commands to guild ${guild.name} (${guildId})`);
        successCount++;
      } catch (error) {
        logger.error(`Failed to register commands for guild ${guildId}: ${error.message}`);
        errorCount++;
      }
    }
    
    logger.info(`Command registration completed. Success: ${successCount}, Failed: ${errorCount}`);
  } catch (error) {
    logger.error(`Error in command registration: ${error.message}`);
  }
}

/**
 * Register commands for a specific guild
 * @param {Client} client - Discord client
 * @param {string} guildId - ID of the guild to register commands for
 */
async function registerCommandsForGuild(client, guildId) {
  try {
    // Skip if no commands are loaded
    if (!client.commands || client.commands.size === 0) {
      logger.warn(`No commands found to register for guild ${guildId}`);
      return;
    }
    
    // Get the guild object
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.warn(`Cannot register commands: Guild ${guildId} not found in client cache`);
      return;
    }
    
    // Get command data from all loaded commands
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    logger.info(`Preparing to register ${commands.length} commands to guild ${guild.name} (${guildId})`);
    
    // Create REST instance
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    
    // Check if we have permission to create commands in this guild
    const member = await guild.members.fetch(client.user.id).catch(() => null);
    if (!member || !member.permissions.has('ManageGuild')) {
      logger.warn(`Skipping command registration for guild ${guild.name} (${guildId}): Missing permissions`);
      return;
    }
    
    // Update guild commands
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guildId),
      { body: commands }
    );
    
    logger.info(`Successfully registered ${commands.length} commands to guild ${guild.name} (${guildId})`);
    return true;
  } catch (error) {
    logger.error(`Failed to register commands for guild ${guildId}: ${error.message}`);
    return false;
  }
}

/**
 * Set up scheduled tasks
 * @param {Client} client - Discord client
 */
function setupScheduledTasks(client) {
  // Check for inactive modmail threads daily
  setInterval(async () => {
    try {
      if (client.db && client.db.ModmailThread) {
        // Find threads inactive for 72 hours (3 days)
        const inactiveThreads = await client.db.ModmailThread.findInactiveThreads(72);
        
        for (const thread of inactiveThreads) {
          try {
            // Close the thread due to inactivity
            await thread.closeThread('SYSTEM', 'Automatically closed due to inactivity');
            
            // Try to get the channel to send a closing message
            const guild = client.guilds.cache.get(thread.guildId);
            if (!guild) continue;
            
            const channel = await guild.channels.fetch(thread.id).catch(() => null);
            if (channel) {
              await channel.send({
                content: '📭 This modmail thread has been automatically closed due to 72 hours of inactivity.'
              });
            }
            
            logger.info(`Automatically closed inactive modmail thread ${thread.id} in guild ${thread.guildId}`);
          } catch (threadError) {
            logger.error(`Error auto-closing thread ${thread.id}: ${threadError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking inactive modmail threads: ${error.message}`);
    }
  }, 86400000); // Every 24 hours
}