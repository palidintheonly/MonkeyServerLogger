const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember, client) {
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(newMember.guild.id);
      
      // Check if logging is enabled for this category
      if (!guildSettings.isCategoryEnabled('MEMBERS') || !guildSettings.setupCompleted) {
        return;
      }
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('MEMBERS');
      if (!logChannelId) return;
      
      const logChannel = await newMember.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // Check for nickname change
      if (oldMember.nickname !== newMember.nickname) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Nickname Changed',
          description: `${newMember.user}'s nickname was changed.`,
          fields: [
            { name: 'User ID', value: newMember.id, inline: true },
            { name: 'Old Nickname', value: oldMember.nickname || '*None*', inline: true },
            { name: 'New Nickname', value: newMember.nickname || '*None*', inline: true }
          ],
          thumbnail: newMember.displayAvatarURL({ dynamic: true })
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      // Check for role changes
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
      
      if (addedRoles.size > 0) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Roles Added',
          description: `${newMember.user} was given ${addedRoles.size} role${addedRoles.size > 1 ? 's' : ''}.`,
          fields: [
            { name: 'User ID', value: newMember.id, inline: true },
            { name: 'Added Role(s)', value: addedRoles.map(r => `${r}`).join(', '), inline: false }
          ],
          thumbnail: newMember.displayAvatarURL({ dynamic: true }),
          color: '#77B255' // Green for adding roles
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      if (removedRoles.size > 0) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Roles Removed',
          description: `${newMember.user} lost ${removedRoles.size} role${removedRoles.size > 1 ? 's' : ''}.`,
          fields: [
            { name: 'User ID', value: newMember.id, inline: true },
            { name: 'Removed Role(s)', value: removedRoles.map(r => `${r}`).join(', '), inline: false }
          ],
          thumbnail: newMember.displayAvatarURL({ dynamic: true }),
          color: '#DD2E44' // Red for removing roles
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      // Check for boosting status change
      if (!oldMember.premiumSince && newMember.premiumSince) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Server Boosted',
          description: `${newMember.user} boosted the server!`,
          thumbnail: newMember.displayAvatarURL({ dynamic: true }),
          color: '#F47FFF' // Nitro pink color
        });
        
        await logChannel.send({ embeds: [embed] });
      } else if (oldMember.premiumSince && !newMember.premiumSince) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Boost Ended',
          description: `${newMember.user}'s server boost has ended.`,
          thumbnail: newMember.displayAvatarURL({ dynamic: true }),
          color: '#F47FFF' // Nitro pink color
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      // Check for timeout/mute changes
      if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Member Timed Out',
          description: `${newMember.user} has been timed out.`,
          fields: [
            { name: 'User ID', value: newMember.id, inline: true },
            { name: 'Until', value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:R>`, inline: true }
          ],
          thumbnail: newMember.displayAvatarURL({ dynamic: true }),
          color: '#FFCC00' // Yellow warning color
        });
        
        await logChannel.send({ embeds: [embed] });
      } else if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
        const embed = createLogEmbed({
          category: 'MEMBERS',
          action: 'Timeout Removed',
          description: `${newMember.user}'s timeout has been removed.`,
          thumbnail: newMember.displayAvatarURL({ dynamic: true }),
          color: '#77B255' // Green for positive action
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
    } catch (error) {
      logger.error(`Error logging member update: ${error.message}`);
    }
  }
};
