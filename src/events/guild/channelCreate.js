const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { ChannelType } = require('discord.js');

module.exports = {
  name: 'channelCreate',
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
      
      const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel || logChannel.id === channel.id) return; // Don't log if the log channel itself was created
      
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
        action: 'Channel Created',
        description: `A new channel has been created: ${channel}`,
        fields: fields,
        color: '#77B255' // Green color for creation
      });
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging channel creation: ${error.message}`);
    }
  }
};
