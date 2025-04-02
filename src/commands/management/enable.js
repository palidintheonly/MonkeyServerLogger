const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const config = require('../../config');

module.exports = {
  cooldown: config.cooldowns.management,
  data: new SlashCommandBuilder()
    .setName('enable')
    .setDescription('Enable a specific logging category')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('The logging category to enable')
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
    
    // Check if already enabled
    if (guildSettings.isCategoryEnabled(category)) {
      await interaction.reply({
        embeds: [createErrorEmbed(`The ${config.logging.categories[category].name} category is already enabled.`)],
        flags: { ephemeral: true }
      });
      return;
    }
    
    // Enable the category
    const enabledCategories = guildSettings.enabledCategories;
    enabledCategories[category] = true;
    
    await guildSettings.update({ enabledCategories });
    
    // Get the logging channel for this category
    const channelId = guildSettings.getCategoryChannel(category);
    let channelMention = 'the default logging channel';
    
    if (channelId) {
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (channel) {
        channelMention = channel;
      }
    }
    
    // Create success embed
    const embed = createSuccessEmbed(
      `${config.logging.categories[category].emoji} The **${config.logging.categories[category].name}** category has been enabled. Logs will be sent to ${channelMention}.`,
      'Category Enabled'
    );
    
    await interaction.reply({ embeds: [embed] });
  }
};
