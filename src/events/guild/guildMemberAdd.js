const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(member.guild.id);
      
      // Check if logging is enabled for this category
      if (!guildSettings.isCategoryEnabled('MEMBERS') || !guildSettings.setupCompleted) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('MEMBERS');
      if (!logChannelId) return;
      
      const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Create account age string
      const createdAt = member.user.createdAt;
      const createdDaysAgo = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
      const accountAge = `${createdDaysAgo} days ago`;
      
      // Create embed
      const embed = createLogEmbed({
        category: 'MEMBERS',
        action: 'Member Joined',
        description: `${member} joined the server.`,
        fields: [
          { name: 'User ID', value: member.id, inline: true },
          { name: 'Account Created', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R> (${accountAge})`, inline: true },
          { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true }
        ],
        thumbnail: member.displayAvatarURL({ dynamic: true })
      });
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging member join: ${error.message}`);
    }
  }
};
