const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'roleCreate',
  once: false,
  async execute(role, client) {
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(role.guild.id);
      
      // Skip if logging is not set up or role logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('ROLES')) {
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
        action: 'Role Created',
        description: `A new role was created: ${role}`,
        fields: [
          { name: 'Role Name', value: role.name, inline: true },
          { name: 'Role ID', value: role.id, inline: true },
          { name: 'Color', value: hexColor, inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Position', value: role.position.toString(), inline: true }
        ],
        color: '#77B255' // Green color for creation
      });
      
      // Set embed color to role color if it exists
      if (hexColor !== 'None') {
        embed.setColor(hexColor);
      }
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging role creation: ${error.message}`);
    }
  }
};
