/**
 * Guild Create Event
 * 
 * This event is triggered when the bot joins a new guild (server)
 * It automatically registers commands to that guild.
 */
const { logger } = require('../../utils/logger');
const guildCommandManager = require('../../utils/guildCommandManager');
const { models } = require('../../database/db');

module.exports = {
  name: 'guildCreate',
  once: false,
  
  /**
   * Execute method - handle when the bot joins a new guild
   * @param {Guild} guild - The guild object from Discord.js
   * @param {Client} client - The Discord.js client instance
   */
  async execute(guild, client) {
    logger.info(`Bot joined new guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
    
    try {
      // Register commands to the new guild
      try {
        logger.info(`Registering commands to new guild: ${guild.name} (${guild.id})`);
        const result = await guildCommandManager.registerCommandsForGuild(guild.id);
        logger.info(`Successfully registered ${result.length} commands to guild ${guild.name}`);
      } catch (error) {
        logger.error(`Failed to register commands to new guild ${guild.name}: ${error.message}`);
      }

      // Initialize guild settings in the database
      try {
        // Check if guild already exists in database
        const existingGuild = await models.Guild.findOne({
          where: { guildId: guild.id }
        });

        if (!existingGuild) {
          // Create new guild settings
          await models.Guild.create({
            guildId: guild.id,
            setupCompleted: false,
            setupProgress: 0,
            enabledCategories: JSON.stringify(['messages', 'members', 'moderation']),
            setupData: JSON.stringify({})
          });
          logger.info(`Created new guild settings for ${guild.name} (${guild.id})`);
        } else {
          logger.info(`Guild ${guild.name} (${guild.id}) already exists in database`);
        }
      } catch (dbError) {
        logger.error(`Database error when adding new guild ${guild.name}: ${dbError.message}`);
      }
      
      // Try to send welcome message to the default channel or first available channel
      try {
        // Find the system channel or first text channel we can send messages in
        const systemChannel = guild.systemChannel;
        let targetChannel = systemChannel;
        
        if (!targetChannel || !targetChannel.permissionsFor(client.user).has('SendMessages')) {
          // Find the first channel we can send to
          targetChannel = guild.channels.cache
            .filter(channel => 
              channel.type === 0 && // 0 is a TEXT channel
              channel.permissionsFor(client.user).has('SendMessages')
            )
            .sort((a, b) => a.position - b.position)
            .first();
        }
        
        if (targetChannel) {
          await targetChannel.send({
            embeds: [{
              title: "Thanks for adding me!",
              description: "I'm a logging and moderation bot that can help you monitor server activities. Use `/setup wizard` to get started or `/help` for more information.",
              color: 0x5865F2,
              footer: {
                text: "Type /help for a list of commands"
              }
            }]
          });
          logger.info(`Sent welcome message to guild ${guild.name} in channel #${targetChannel.name}`);
        } else {
          logger.warn(`Could not find a channel to send welcome message in guild ${guild.name}`);
        }
      } catch (messageError) {
        logger.error(`Failed to send welcome message to guild ${guild.name}: ${messageError.message}`);
      }
    } catch (error) {
      logger.error(`Error handling guildCreate event for ${guild.name} (${guild.id}): ${error.message}`);
    }
  }
};