const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    // Ignore bot messages and DMs
    if (message.author.bot || !message.guild) return;
    
    // Check if we should log this message
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(message.guild.id);
      
      // Skip if logging is not set up or messages logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('MESSAGES')) {
        return;
      }
      
      // Skip if channel is ignored
      if (guildSettings.isChannelIgnored(message.channel.id)) {
        return;
      }
      
      // No need to log regular messages - we'll only log messages that are updated or deleted
    } catch (error) {
      logger.error(`Error in messageCreate event: ${error.message}`);
    }
  }
};
