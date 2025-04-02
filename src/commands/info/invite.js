const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invitation link to add the bot to your server'),
  
  async execute(interaction, client) {
    try {
      // Generate invite link with proper permissions and correct scopes for commands and context menus
      const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
      
      // Create embed
      const embed = createEmbed({
        title: `${config.bot.name} - ${config.bot.slogan}`,
        description: `Thank you for your interest in ${config.bot.name}! Use the button below to add me to your server.`,
        thumbnail: client.user.displayAvatarURL(),
        fields: [
          {
            name: '📋 Features',
            value: '• Comprehensive server activity logging\n• Customizable log categories\n• Channel and role filtering\n• Context menus for easy moderation\n• Modmail system for user support',
            inline: false
          },
          {
            name: '⚙️ Required Permissions',
            value: 'The invitation link includes **Administrator** permissions to ensure all logging features work correctly. You can customize these permissions in your server settings after adding the bot.',
            inline: false
          }
        ],
        footer: 'Powered by Monkey Bytes',
        timestamp: true
      });
      
      // Create button row with invite link
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Add to Server')
            .setURL(inviteLink)
            .setStyle(ButtonStyle.Link),
          new ButtonBuilder()
            .setLabel('Support Server')
            .setURL('https://discord.gg/monkeybytes')
            .setStyle(ButtonStyle.Link)
        );
      
      // Send the response with embed and button
      await interaction.reply({ 
        embeds: [embed], 
        components: [row]
        // Removed ephemeral: false as it's the default behavior
      });
      
      logger.info(`User ${interaction.user.tag} requested an invite link`);
      
    } catch (error) {
      logger.error(`Error in invite command: ${error.message}`);
      
      // Send error message
      await interaction.reply({ 
        content: 'There was an error generating the invite link. Please try again later.',
        ephemeral: true
      });
    }
  }
};