const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'channelUpdate',
  once: false,
  async execute(oldChannel, newChannel, client) {
    // Skip if not in a guild
    if (!newChannel.guild) return;
    
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(newChannel.guild.id);
      
      // Skip if logging is not set up or channel logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('CHANNELS')) {
        return;
      }
      
      // Skip if the channel is ignored
      if (guildSettings.isChannelIgnored(newChannel.id)) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('CHANNELS');
      if (!logChannelId) return;
      
      const logChannel = await newChannel.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Skip if logging channel is the updated channel to prevent loops
      if (logChannel.id === newChannel.id) return;
      
      // Track changes
      const changes = [];
      
      // Name change
      if (oldChannel.name !== newChannel.name) {
        changes.push({
          name: 'Name',
          value: `\`${oldChannel.name}\` → \`${newChannel.name}\``,
          inline: true
        });
      }
      
      // Topic change (for text channels)
      if (oldChannel.topic !== newChannel.topic && 
          [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(newChannel.type)) {
        changes.push({
          name: 'Topic',
          value: `**Old**: ${oldChannel.topic || '*None*'}\n**New**: ${newChannel.topic || '*None*'}`,
          inline: false
        });
      }
      
      // NSFW setting change
      if (oldChannel.nsfw !== newChannel.nsfw && 
          [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(newChannel.type)) {
        changes.push({
          name: 'NSFW',
          value: `\`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``,
          inline: true
        });
      }
      
      // Rate limit change (slowmode)
      if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser && 
          [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread].includes(newChannel.type)) {
        const oldSlowmode = oldChannel.rateLimitPerUser === 0 ? 'Off' : `${oldChannel.rateLimitPerUser} seconds`;
        const newSlowmode = newChannel.rateLimitPerUser === 0 ? 'Off' : `${newChannel.rateLimitPerUser} seconds`;
        
        changes.push({
          name: 'Slowmode',
          value: `\`${oldSlowmode}\` → \`${newSlowmode}\``,
          inline: true
        });
      }
      
      // Bitrate change (voice channels)
      if (oldChannel.bitrate !== newChannel.bitrate && 
          [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(newChannel.type)) {
        changes.push({
          name: 'Bitrate',
          value: `\`${oldChannel.bitrate / 1000}kbps\` → \`${newChannel.bitrate / 1000}kbps\``,
          inline: true
        });
      }
      
      // User limit change (voice channels)
      if (oldChannel.userLimit !== newChannel.userLimit && 
          [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(newChannel.type)) {
        const oldLimit = oldChannel.userLimit === 0 ? 'Unlimited' : oldChannel.userLimit.toString();
        const newLimit = newChannel.userLimit === 0 ? 'Unlimited' : newChannel.userLimit.toString();
        
        changes.push({
          name: 'User Limit',
          value: `\`${oldLimit}\` → \`${newLimit}\``,
          inline: true
        });
      }
      
      // Parent category change
      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent ? `\`${oldChannel.parent.name}\`` : '`None`';
        const newParent = newChannel.parent ? `\`${newChannel.parent.name}\`` : '`None`';
        
        changes.push({
          name: 'Category',
          value: `${oldParent} → ${newParent}`,
          inline: true
        });
      }
      
      // If there are no tracked changes, we can exit
      if (changes.length === 0) return;
      
      // Create the log embed
      const embed = createLogEmbed({
        category: 'CHANNELS',
        action: 'Channel Updated',
        description: `The channel ${newChannel} has been updated.`,
        fields: [
          { name: 'Channel ID', value: newChannel.id, inline: true },
          ...changes
        ],
        color: '#3498DB' // Blue color for updates
      });
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging channel update: ${error.message}`);
    }
  }
};
