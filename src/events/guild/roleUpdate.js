const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'roleUpdate',
  once: false,
  async execute(oldRole, newRole, client) {
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(newRole.guild.id);
      
      // Skip if logging is not set up or role logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('ROLES')) {
        return;
      }
      
      // Skip if the role is ignored
      if (guildSettings.isRoleIgnored(newRole.id)) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('ROLES');
      if (!logChannelId) return;
      
      const logChannel = await newRole.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Track changes
      const changes = [];
      
      // Name change
      if (oldRole.name !== newRole.name) {
        changes.push({
          name: 'Name',
          value: `\`${oldRole.name}\` → \`${newRole.name}\``,
          inline: true
        });
      }
      
      // Color change
      if (oldRole.hexColor !== newRole.hexColor) {
        const oldColor = oldRole.hexColor === '#000000' ? 'Default' : oldRole.hexColor;
        const newColor = newRole.hexColor === '#000000' ? 'Default' : newRole.hexColor;
        
        changes.push({
          name: 'Color',
          value: `\`${oldColor}\` → \`${newColor}\``,
          inline: true
        });
      }
      
      // Hoisted change
      if (oldRole.hoist !== newRole.hoist) {
        changes.push({
          name: 'Hoisted',
          value: `\`${oldRole.hoist ? 'Yes' : 'No'}\` → \`${newRole.hoist ? 'Yes' : 'No'}\``,
          inline: true
        });
      }
      
      // Mentionable change
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push({
          name: 'Mentionable',
          value: `\`${oldRole.mentionable ? 'Yes' : 'No'}\` → \`${newRole.mentionable ? 'Yes' : 'No'}\``,
          inline: true
        });
      }
      
      // Position change
      if (oldRole.position !== newRole.position) {
        changes.push({
          name: 'Position',
          value: `\`${oldRole.position}\` → \`${newRole.position}\``,
          inline: true
        });
      }
      
      // Check permissions changes
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const oldPerms = oldRole.permissions;
        const newPerms = newRole.permissions;
        
        const addedPerms = [];
        const removedPerms = [];
        
        // Check for added permissions
        for (const [key, value] of Object.entries(PermissionsBitField.Flags)) {
          if (!oldPerms.has(value) && newPerms.has(value)) {
            addedPerms.push(key.replace(/_/g, ' ').toLowerCase());
          }
        }
        
        // Check for removed permissions
        for (const [key, value] of Object.entries(PermissionsBitField.Flags)) {
          if (oldPerms.has(value) && !newPerms.has(value)) {
            removedPerms.push(key.replace(/_/g, ' ').toLowerCase());
          }
        }
        
        // Add permission changes to the fields
        if (addedPerms.length > 0) {
          changes.push({
            name: 'Permissions Added',
            value: addedPerms.map(p => `\`${p}\``).join(', '),
            inline: false
          });
        }
        
        if (removedPerms.length > 0) {
          changes.push({
            name: 'Permissions Removed',
            value: removedPerms.map(p => `\`${p}\``).join(', '),
            inline: false
          });
        }
      }
      
      // If there are no tracked changes, we can exit
      if (changes.length === 0) return;
      
      // Create the log embed
      const embed = createLogEmbed({
        category: 'ROLES',
        action: 'Role Updated',
        description: `The role ${newRole} has been updated.`,
        fields: [
          { name: 'Role ID', value: newRole.id, inline: true },
          ...changes
        ],
        color: '#3498DB' // Blue color for updates
      });
      
      // Set embed color to new role color if it exists
      if (newRole.hexColor !== '#000000') {
        embed.setColor(newRole.hexColor);
      }
      
      // Send log message
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error logging role update: ${error.message}`);
    }
  }
};
