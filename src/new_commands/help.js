const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const config = require('../config');

module.exports = {
  cooldown: 5, // 5 seconds cooldown
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display help information and command list')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Get help for a specific command')
        .setRequired(false)
    ),
    
  async execute(interaction, client) {
    const specificCommand = interaction.options.getString('command');
    
    if (specificCommand) {
      await this.showCommandHelp(interaction, client, specificCommand);
    } else {
      await this.showMainHelp(interaction, client);
    }
  },
  
  /**
   * Show main help menu
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async showMainHelp(interaction, client) {
    // Get all command categories
    const categories = new Map();
    
    // Process all commands to categorize them
    client.commands.forEach(cmd => {
      // Skip if no data
      if (!cmd.data) return;
      
      // Get category name from file path or use default
      let category = 'General';
      if (cmd.category) {
        category = cmd.category;
      }
      
      // Initialize category array if needed
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      
      // Add command to category
      categories.get(category).push({
        name: cmd.data.name,
        description: cmd.data.description
      });
    });
    
    // Create embed for main help menu
    const embed = createEmbed({
      title: "📚 Bot Help Menu",
      description: `Welcome to the help menu! Here are all the available commands.\nUse \`/help command:<command-name>\` to get more details about a specific command.`,
      fields: []
    });
    
    // Add fields for each category
    for (const [category, commands] of categories) {
      // Format commands in the category
      const commandList = commands.map(cmd => `• \`/${cmd.name}\` - ${cmd.description}`).join('\n');
      
      // Add field for this category
      embed.addFields({
        name: `${category} Commands`,
        value: commandList || 'No commands in this category',
        inline: false
      });
    }
    
    // Add footer with bot info
    embed.setFooter({
      text: `${config.bot.name} v${config.bot.version} • ${client.guilds.cache.size} servers`
    });
    
    // Send the embed
    await interaction.reply({
      embeds: [embed]
    });
  },
  
  /**
   * Show help for a specific command
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {string} commandName - The command to display help for
   */
  async showCommandHelp(interaction, client, commandName) {
    // Find the command
    const command = client.commands.get(commandName);
    
    if (!command || !command.data) {
      await interaction.reply({
        embeds: [createEmbed({
          title: "❌ Command Not Found",
          description: `The command \`${commandName}\` was not found.`,
          color: "#FF0000"
        })],
        ephemeral: true
      });
      return;
    }
    
    // Gather command options
    const options = [];
    
    // Check if command has options
    if (command.data.options && command.data.options.length > 0) {
      // For each option, add details
      for (const option of command.data.options) {
        // Handle subcommands
        if (option.type === 1) {
          options.push(`**Subcommand:** \`${option.name}\`\n${option.description}`);
          
          // Check for subcommand options
          if (option.options && option.options.length > 0) {
            for (const subOption of option.options) {
              const required = subOption.required ? '(Required)' : '(Optional)';
              options.push(`- \`${subOption.name}\` ${required}: ${subOption.description}`);
            }
          }
        } else {
          // Regular option
          const required = option.required ? '(Required)' : '(Optional)';
          options.push(`\`${option.name}\` ${required}: ${option.description}`);
        }
      }
    }
    
    // Create embed for command help
    const embed = createEmbed({
      title: `Command: /${commandName}`,
      description: command.data.description || 'No description available',
      fields: [
        {
          name: "Usage",
          value: `\`/${command.data.name}${options.length > 0 ? ' [options]' : ''}\``,
          inline: false
        }
      ]
    });
    
    // Add cooldown if available
    if (command.cooldown) {
      embed.addFields({
        name: "Cooldown",
        value: `${command.cooldown} seconds`,
        inline: true
      });
    }
    
    // Add options if available
    if (options.length > 0) {
      embed.addFields({
        name: "Options",
        value: options.join('\n'),
        inline: false
      });
    }
    
    // Send the embed
    await interaction.reply({
      embeds: [embed]
    });
  }
};