const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'messageUpdate',
  once: false,
  async execute(oldMessage, newMessage, client) {
    // Ignore DMs and messages with same content (embed updates etc.)
    if (!newMessage.guild || oldMessage.content === newMessage.content) return;
    
    // Ignore partial messages without content
    if ((oldMessage.partial && !oldMessage.content) || (newMessage.partial && !newMessage.content)) return;
    
    // Ignore bot messages (unless they have embeds)
    if (newMessage.author?.bot && !newMessage.embeds.length) return;
    
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(newMessage.guild.id);
      
      // Skip if logging is not set up or messages logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('MESSAGES')) {
        return;
      }
      
      // Skip if the channel is ignored
      if (guildSettings.isChannelIgnored(newMessage.channel.id)) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('MESSAGES');
      if (!logChannelId) return;
      
      const logChannel = await newMessage.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Prepare old and new content
      let oldContent = oldMessage.content || '*No content*';
      let newContent = newMessage.content || '*No content*';
      
      // Truncate if too long
      if (oldContent.length > 1024) {
        oldContent = oldContent.substring(0, 1021) + '...';
      }
      
      if (newContent.length > 1024) {
        newContent = newContent.substring(0, 1021) + '...';
      }
      
      // Create the log embed
      const embed = createLogEmbed({
        category: 'MESSAGES',
        action: 'Message Edited',
        description: `Message by ${newMessage.author} was edited in ${newMessage.channel}.`,
        fields: [
          { name: 'Channel', value: `${newMessage.channel} (${newMessage.channel.id})`, inline: true },
          { name: 'Author', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
          { name: 'Message ID', value: newMessage.id, inline: true },
          { name: 'Before', value: oldContent },
          { name: 'After', value: newContent }
        ],
        color: '#3498DB' // Blue color for updates
      });
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging message update: ${error.message}`);
    }
  }
};
