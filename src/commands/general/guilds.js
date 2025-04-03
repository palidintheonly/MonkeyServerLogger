/**
 * Guilds Command
 * Shows a list of servers that the user shares with the bot where modmail is enabled
 */
const { SlashCommandBuilder } = require('discord.js');
const { createInfoEmbed, createErrorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guilds')
    .setDescription('Shows a list of servers where you can use modmail'),
  
  cooldown: 10,
  
  async execute(interaction, client) {
    // Defer reply as this might take a moment to process
    await interaction.deferReply({ flags: 1 << 6 }); // Use flags instead of ephemeral
    
    try {
      // Find all guilds where both the bot and user are members and modmail is enabled
      const availableGuilds = [];
      
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          // Check if user is in this guild
          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) continue;
          
          // Check if modmail is enabled in this guild - use findByPk to avoid schema issues
          const guildSettings = await client.db.Guild.findByPk(guildId);
          
          // Use proper getSetting method if we found a guild
          const modmailEnabled = guildSettings && guildSettings.getSetting('modmail.enabled');
          
          if (modmailEnabled) {
            availableGuilds.push({
              name: guild.name,
              id: guild.id,
              memberCount: guild.memberCount,
              icon: guild.iconURL({ dynamic: true })
            });
          }
        } catch (error) {
          console.error(`Error checking guild ${guild.name}:`, error);
          // Continue with next guild
        }
      }
      
      if (availableGuilds.length === 0) {
        return interaction.editReply({
          embeds: [createInfoEmbed(
            'You don\'t have access to any servers with modmail enabled.\n\n' +
            'Ask a server admin to set up modmail using `/modmail-setup enable`.',
            'No Available Servers'
          )]
        });
      }
      
      // Create an embed with the list of servers
      const embed = createInfoEmbed(
        'These are the servers where you can use modmail:\n\n' +
        availableGuilds.map(g => `• **${g.name}** (${g.memberCount} members)`).join('\n'),
        'Available Modmail Servers'
      );
      
      // Add information on how to start a modmail conversation
      embed.addFields({
        name: 'How to Start a Conversation',
        value: 'To start a modmail conversation, simply send a direct message to this bot.'
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in guilds command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
      });
    }
  }
};