/**
 * Help Command
 * Displays information about available commands
 */
const { SlashCommandBuilder } = require('discord.js');
const { createInfoEmbed } = require('../../utils/embedBuilder');
const { bot } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with bot commands')
    .addStringOption(option => 
      option.setName('command')
        .setDescription('Get help for a specific command')
        .setRequired(false)
    ),
  
  cooldown: 5,
  
  async execute(interaction, client) {
    const commandName = interaction.options.getString('command');
    
    if (commandName) {
      return this.showCommandHelp(interaction, client, commandName);
    } else {
      return this.showGeneralHelp(interaction, client);
    }
  },
  
  async showGeneralHelp(interaction, client) {
    // Group commands by category
    const categories = {};
    
    for (const [name, command] of client.commands) {
      // Skip commands that shouldn't be visible
      if (command.hidden) continue;
      
      // Get the command category (folder name)
      const category = command.category || 'general';
      
      if (!categories[category]) {
        categories[category] = [];
      }
      
      categories[category].push(`\`/${name}\` - ${command.data.description}`);
    }
    
    // Build the embed
    const embed = createInfoEmbed(
      'Here are the available commands.\nUse `/help <command>` for more details about a specific command.',
      'Command Help'
    );
    
    // Add category fields
    for (const [category, commands] of Object.entries(categories)) {
      // Format category name (capitalize first letter)
      const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
      
      embed.addFields({
        name: `${formattedCategory} Commands`,
        value: commands.join('\n'),
        inline: false
      });
    }
    
    // Add footer with support info
    if (bot.supportServer) {
      embed.setFooter({
        text: `Need more help? Join our support server.`,
        iconURL: client.user.displayAvatarURL()
      });
    }
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
  
  async showCommandHelp(interaction, client, commandName) {
    // Find the requested command
    const command = client.commands.get(commandName);
    
    if (!command) {
      return interaction.reply({
        content: `I couldn't find a command called \`${commandName}\`.`,
        ephemeral: true
      });
    }
    
    // Build the embed
    const embed = createInfoEmbed(
      `**Description:** ${command.data.description}\n\n` +
      (command.longDescription ? `${command.longDescription}\n\n` : '') +
      (command.usage ? `**Usage:** ${command.usage}\n\n` : '') +
      (command.examples ? `**Examples:**\n${command.examples.join('\n')}\n\n` : '') +
      (command.cooldown ? `**Cooldown:** ${command.cooldown} seconds` : ''),
      `Command: /${commandName}`
    );
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};