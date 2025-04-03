/**
 * Discord.js Ready Event
 */
const { Events, ActivityType, REST, Routes } = require('discord.js');
const { logger } = require('../utils/logger');
const { commands: cmdConfig } = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,  // This event will only fire once
  
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    
    // Set bot presence/activity
    client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: '/help',
          type: ActivityType.Listening
        }
      ]
    });
    
    // Log some stats
    logger.info(`Connected to ${client.guilds.cache.size} guilds with ${client.channels.cache.size} channels`);
    
    // Force reload slash commands for all connected guilds
    await registerCommandsForAllGuilds(client);
    
    // Set up any scheduled tasks
    setupScheduledTasks(client);
  }
};

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