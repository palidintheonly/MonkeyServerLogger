const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(message, client) {
    // Ignore DMs and partial messages without content
    if (!message.guild || (message.partial && !message.content)) return;
    
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(message.guild.id);
      
      // Skip if logging is not set up or messages logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('MESSAGES')) {
        return;
      }
      
      // Skip if the channel is ignored
      if (guildSettings.isChannelIgnored(message.channel.id)) {
        return;
      }
      
      // Skip if message is from a bot and not an embed
      if (message.author?.bot && !message.embeds.length) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('MESSAGES');
      if (!logChannelId) return;
      
      const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Create message content (handling embeds if needed)
      let content = '';
      let embeds = [];
      
      if (message.content) {
        content = message.content.length > 1024 
          ? message.content.substring(0, 1021) + '...'
          : message.content;
      }
      
      // If the message had embeds, log them too
      if (message.embeds.length > 0) {
        const embedCount = message.embeds.length;
        content += content ? `\n\n*Message had ${embedCount} embed${embedCount !== 1 ? 's' : ''}*` : `*Message had ${embedCount} embed${embedCount !== 1 ? 's' : ''}*`;
        
        // Add the first embed to our log for reference
        if (message.embeds[0].data && Object.keys(message.embeds[0].data).length > 0) {
          try {
            // Create a copy of the first embed to include in our log
            const originalEmbed = EmbedBuilder.from(message.embeds[0]).setFooter({ text: 'Original message embed' });
            embeds.push(originalEmbed);
          } catch (err) {
            logger.error('Error cloning embed:', err);
          }
        }
      }
      
      // Handle attachments
      let attachmentsList = '';
      if (message.attachments.size > 0) {
        attachmentsList = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n');
      }
      
      // Create the log embed
      const logEmbed = createLogEmbed({
        category: 'MESSAGES',
        action: 'Message Deleted',
        description: `Message by ${message.author} was deleted in ${message.channel}.`,
        fields: [
          { name: 'Channel', value: `${message.channel} (${message.channel.id})`, inline: true },
          { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true }
        ],
        color: '#DD2E44' // Red color for deletion
      });
      
      // Add content field if there was content
      if (content) {
        logEmbed.addFields({ name: 'Content', value: content });
      }
      
      // Add attachments field if there were attachments
      if (attachmentsList) {
        logEmbed.addFields({ name: 'Attachments', value: attachmentsList.length > 1024 ? attachmentsList.substring(0, 1021) + '...' : attachmentsList });
      }
      
      // Collect all embeds to send (our log embed + original embed if available)
      const embedsToSend = [logEmbed, ...embeds];
      
      // Send log message
      await logChannel.send({ embeds: embedsToSend });
    } catch (error) {
      logger.error(`Error logging message deletion: ${error.message}`);
    }
  }
};
