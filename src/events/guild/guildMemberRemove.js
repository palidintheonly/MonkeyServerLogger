const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');

module.exports = {
  name: 'guildMemberRemove',
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
      
      // Calculate join duration
      const joinedAt = member.joinedAt;
      const joinDuration = joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` : 'Unknown';
      
      // Get roles (excluding @everyone)
      const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .join(', ') || 'None';
      
      // Create embed
      const embed = createLogEmbed({
        category: 'MEMBERS',
        action: 'Member Left',
        description: `${member.user.tag} (${member.id}) left the server.`,
        color: '#DD2E44', // Red color for left
        fields: [
          { name: 'Joined Server', value: joinDuration, inline: true },
          { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true }
        ],
        thumbnail: member.displayAvatarURL({ dynamic: true })
      });
      
      // Add roles field if member had roles
      if (roles !== 'None') {
        embed.addFields([
          { name: 'Roles', value: roles.length > 1024 ? roles.substring(0, 1021) + '...' : roles }
        ]);
      }
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging member leave: ${error.message}`);
    }
  }
};
