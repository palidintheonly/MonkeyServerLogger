const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { ChannelType } = require('discord.js');

module.exports = {
  name: 'channelDelete',
  once: false,
  async execute(channel, client) {
    // Skip if not in a guild
    if (!channel.guild) return;
    
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(channel.guild.id);
      
      // Skip if logging is not set up or channel logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('CHANNELS')) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('CHANNELS');
      if (!logChannelId) return;
      
      // If the deleted channel was the logging channel, find the main logging channel
      if (channel.id === logChannelId) {
        logChannelId = guildSettings.loggingChannelId;
        if (!logChannelId) return; // No fallback channel
      }
      
      const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Get channel type string
      let channelType = 'Unknown';
      switch (channel.type) {
        case ChannelType.GuildText:
          channelType = 'Text Channel';
          break;
        case ChannelType.GuildVoice:
          channelType = 'Voice Channel';
          break;
        case ChannelType.GuildCategory:
          channelType = 'Category';
          break;
        case ChannelType.GuildAnnouncement:
          channelType = 'Announcement Channel';
          break;
        case ChannelType.GuildStageVoice:
          channelType = 'Stage Channel';
          break;
        case ChannelType.GuildForum:
          channelType = 'Forum Channel';
          break;
        case ChannelType.PublicThread:
          channelType = 'Public Thread';
          break;
        case ChannelType.PrivateThread:
          channelType = 'Private Thread';
          break;
        default:
          channelType = `Other (${channel.type})`;
      }
      
      // Build fields array
      const fields = [
        { name: 'Channel Name', value: channel.name, inline: true },
        { name: 'Channel ID', value: channel.id, inline: true },
        { name: 'Channel Type', value: channelType, inline: true }
      ];
      
      // Add parent category if applicable
      if (channel.parent && channel.type !== ChannelType.GuildCategory) {
        fields.push({ name: 'Category', value: `${channel.parent.name} (${channel.parent.id})`, inline: true });
      }
      
      // Create the log embed
      const embed = createLogEmbed({
        category: 'CHANNELS',
        action: 'Channel Deleted',
        description: `A channel has been deleted: **${channel.name}**`,
        fields: fields,
        color: '#DD2E44' // Red color for deletion
      });
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
      
      // If this was a logging channel, update the database
      if (channel.id === guildSettings.loggingChannelId || 
          Object.values(guildSettings.categoryChannels).includes(channel.id)) {
        
        // Remove from category channels
        let categoryChannels = guildSettings.categoryChannels;
        for (const [category, channelId] of Object.entries(categoryChannels)) {
          if (channelId === channel.id) {
            delete categoryChannels[category];
          }
        }
        
        // Update main logging channel if needed
        if (channel.id === guildSettings.loggingChannelId) {
          await guildSettings.update({
            loggingChannelId: null,
            categoryChannels: categoryChannels
          });
          
          // Send a warning in the new log channel
          const warningEmbed = createLogEmbed({
            category: 'SERVER',
            action: 'Logging Configuration Warning',
            description: 'The main logging channel was deleted. Please use `/setup` to configure a new one.',
            color: '#FFCC00' // Yellow warning color
          });
          
          await logChannel.send({ embeds: [warningEmbed] });
        } else {
          await guildSettings.update({
            categoryChannels: categoryChannels
          });
        }
      }
    } catch (error) {
      logger.error(`Error logging channel deletion: ${error.message}`);
    }
  }
};
