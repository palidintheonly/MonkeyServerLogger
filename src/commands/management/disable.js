const { SlashCommandBuilder, PermissionsBitField  } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const config = require('../../config');

module.exports = {
  cooldown: config.cooldowns.management,
  data: new SlashCommandBuilder()
    .setName('disable')
    .setDescription('Disable a specific logging category')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('The logging category to disable')
        .setRequired(true)
        .addChoices(
          ...Object.entries(config.logging.categories).map(([key, category]) => ({
            name: `${category.emoji} ${category.name}`,
            value: key
          }))
        )
    ),
  
  async execute(interaction, client) {
    // Check if setup has been completed
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    if (!guildSettings.setupCompleted) {
      await interaction.reply({
        embeds: [createErrorEmbed('You need to set up the logging system first. Use `/setup` to get started.')],
        flags: { ephemeral: true }
      });
      return;
    }
    
    const category = interaction.options.getString('category');
    
    // Validate the category
    if (!config.logging.categories[category]) {
      await interaction.reply({
        embeds: [createErrorEmbed(`Invalid category: ${category}`)],
        flags: { ephemeral: true }
      });
      return;
    }
    
    // Check if already disabled
    if (!guildSettings.isCategoryEnabled(category)) {
      await interaction.reply({
        embeds: [createErrorEmbed(`The ${config.logging.categories[category].name} category is already disabled.`)],
        flags: { ephemeral: true }
      });
      return;
    }
    
    // Disable the category
    const enabledCategories = guildSettings.enabledCategories;
    enabledCategories[category] = false;
    
    await guildSettings.update({ enabledCategories });
    
    // Create success embed
    const embed = createSuccessEmbed(
      `${config.logging.categories[category].emoji} The **${config.logging.categories[category].name}** category has been disabled. Events from this category will no longer be logged.`,
      'Category Disabled'
    );
    
    await interaction.reply({ embeds: [embed] });
  }
};
