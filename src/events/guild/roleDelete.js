const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'roleDelete',
  once: false,
  async execute(role, client) {
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(role.guild.id);
      
      // Skip if logging is not set up or role logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('ROLES')) {
        return;
      }
      
      // Skip if the role is ignored
      if (guildSettings.isRoleIgnored(role.id)) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('ROLES');
      if (!logChannelId) return;
      
      const logChannel = await role.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Format role color
      const hexColor = role.hexColor === '#000000' ? 'None' : role.hexColor;
      
      // Create the log embed
      const embed = createLogEmbed({
        category: 'ROLES',
        action: 'Role Deleted',
        description: `A role was deleted: **${role.name}**`,
        fields: [
          { name: 'Role Name', value: role.name, inline: true },
          { name: 'Role ID', value: role.id, inline: true },
          { name: 'Color', value: hexColor, inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Position', value: role.position.toString(), inline: true }
        ],
        color: '#DD2E44' // Red color for deletion
      });
      
      // Set embed color to role color if it exists
      if (hexColor !== 'None') {
        embed.setColor(hexColor);
      }
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
      
      // If this was an ignored role, update the database
      if (guildSettings.ignoredRoles.includes(role.id)) {
        const updatedIgnoredRoles = guildSettings.ignoredRoles.filter(id => id !== role.id);
        await guildSettings.update({ ignoredRoles: updatedIgnoredRoles });
      }
    } catch (error) {
      logger.error(`Error logging role deletion: ${error.message}`);
    }
  }
};
