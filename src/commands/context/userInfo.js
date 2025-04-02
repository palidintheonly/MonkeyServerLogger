const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('User Info')
    .setType(ApplicationCommandType.User)
    .setDMPermission(false),
  description: 'View detailed information about a user',
  
  async execute(interaction, client) {
    try {
      // Get the target user
      const targetUser = interaction.targetUser;
      const targetMember = interaction.targetMember;
      
      // If we don't have a valid GuildMember object, fetch it
      const member = targetMember || await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      // Account creation date
      const createdAt = new Date(targetUser.createdTimestamp);
      const createdAgo = this.getTimeAgo(createdAt);
      
      // Server join date (if available)
      let joinedAt = null;
      let joinedAgo = null;
      if (member) {
        joinedAt = new Date(member.joinedTimestamp);
        joinedAgo = this.getTimeAgo(joinedAt);
      }
      
      // Format dates
      const createdFormatted = `${createdAt.toLocaleDateString()} (${createdAgo})`;
      const joinedFormatted = member ? `${joinedAt.toLocaleDateString()} (${joinedAgo})` : 'Not a member of this server';
      
      // Get the member's roles
      const roles = member ? 
        member.roles.cache
          .filter(role => role.id !== interaction.guild.id) // Filter out @everyone
          .sort((a, b) => b.position - a.position) // Sort by position
          .map(role => `<@&${role.id}>`)
          .join(', ') || 'None' 
        : 'Not a member of this server';
      
      // Create the embed
      const embed = createEmbed({
        title: `User Information - ${targetUser.tag}`,
        description: `Detailed information about ${targetUser.toString()}`,
        thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 }),
        fields: [
          {
            name: 'User ID',
            value: targetUser.id,
            inline: true
          },
          {
            name: 'Account Type',
            value: targetUser.bot ? 'Bot' : 'User',
            inline: true
          },
          {
            name: 'Account Created',
            value: createdFormatted,
            inline: false
          },
          {
            name: 'Joined Server',
            value: joinedFormatted,
            inline: false
          }
        ],
        timestamp: true
      });
      
      // Add roles field if the user is a member of the server
      if (member) {
        embed.addFields([{
          name: `Roles [${member.roles.cache.size - 1}]`, // -1 for @everyone
          value: roles,
          inline: false
        }]);
        
        // Add nickname if user has one
        if (member.nickname) {
          embed.addFields([{
            name: 'Nickname',
            value: member.nickname,
            inline: true
          }]);
        }
      }
      
      // Send the embed
      await interaction.reply({ 
        embeds: [embed], 
        ephemeral: true 
      });
      
      logger.info(`User ${interaction.user.tag} requested info about ${targetUser.tag} (${targetUser.id})`);
      
    } catch (error) {
      logger.error(`Error in User Information context menu: ${error.message}`);
      
      await interaction.reply({ 
        content: 'There was an error fetching user information. Please try again later.', 
        ephemeral: true 
      });
    }
  },
  
  /**
   * Calculate time ago from a given date
   * @param {Date} date - The date to calculate from
   * @returns {string} Time ago string
   */
  getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    
    // Convert to appropriate time unit
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) {
      return `${years} year${years !== 1 ? 's' : ''} ago`;
    } else if (months > 0) {
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    }
  }
};