const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder  } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const config = require('../../config');

module.exports = {
  cooldown: config.cooldowns.management,
  data: new SlashCommandBuilder()
    .setName('categories')
    .setDescription('Manage all logging categories at once')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  
  async execute(interaction, client) {
    // Check if setup has been completed
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    if (!guildSettings.setupCompleted) {
      await interaction.reply({
        embeds: [createErrorEmbed('You need to set up the logging system first. Use `/setup` to get started.')],
        ephemeral: true
      });
      return;
    }
    
    // Create category overview embed
    const categoryFields = [];
    
    for (const [key, category] of Object.entries(config.logging.categories)) {
      const enabled = guildSettings.isCategoryEnabled(key);
      const channelId = guildSettings.getCategoryChannel(key);
      
      let channelText = 'Default channel';
      if (channelId && channelId !== guildSettings.loggingChannelId) {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        channelText = channel ? `${channel}` : 'Unknown channel';
      } else if (guildSettings.loggingChannelId) {
        const channel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
        channelText = channel ? `${channel}` : 'Unknown channel';
      }
      
      categoryFields.push({
        name: `${category.emoji} ${category.name}`,
        value: `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${channelText}`,
        inline: true
      });
    }
    
    const embed = createEmbed({
      title: 'Logging Categories Overview',
      description: 'Select which categories you want to enable:',
      fields: categoryFields
    });
    
    // Create select menu for categories
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('categories-toggle')
      .setPlaceholder('Select categories to enable')
      .setMinValues(0)
      .setMaxValues(Object.keys(config.logging.categories).length)
      .addOptions(Object.entries(config.logging.categories).map(([key, category]) => ({
        label: category.name,
        value: key,
        description: category.description.substring(0, 90),
        emoji: category.emoji,
        default: guildSettings.isCategoryEnabled(key)
      })));
    
    const selectRow = new ActionRowBuilder().addComponents(categorySelect);
    
    await interaction.reply({
      embeds: [embed],
      components: [selectRow],
      ephemeral: false
    });
  },
  
  /**
   * Handle select menu interactions
   * @param {Object} interaction - Select menu interaction
   * @param {Object} client - Discord client
   */
  async handleSelectMenu(interaction, client) {
    if (interaction.customId === 'categories-toggle') {
      await interaction.deferUpdate();
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Update enabled categories
      const enabledCategories = {};
      
      // Set all categories based on selection
      Object.keys(config.logging.categories).forEach(category => {
        enabledCategories[category] = interaction.values.includes(category);
      });
      
      // Update guild settings
      await guildSettings.update({ enabledCategories });
      
      // Format updated categories for response
      const enabledList = Object.entries(config.logging.categories)
        .filter(([key]) => interaction.values.includes(key))
        .map(([_, category]) => `${category.emoji} ${category.name}`)
        .join('\n');
      
      const disabledList = Object.entries(config.logging.categories)
        .filter(([key]) => !interaction.values.includes(key))
        .map(([_, category]) => `${category.emoji} ${category.name}`)
        .join('\n');
      
      const responseEmbed = createSuccessEmbed(
        'Your logging categories have been updated.',
        'Categories Updated'
      );
      
      if (enabledList) {
        responseEmbed.addFields({ name: '✅ Enabled Categories', value: enabledList, inline: true });
      } else {
        responseEmbed.addFields({ name: '✅ Enabled Categories', value: 'No categories enabled', inline: true });
      }
      
      if (disabledList) {
        responseEmbed.addFields({ name: '❌ Disabled Categories', value: disabledList, inline: true });
      } else {
        responseEmbed.addFields({ name: '❌ Disabled Categories', value: 'No categories disabled', inline: true });
      }
      
      // Update the original message
      await interaction.editReply({
        embeds: [responseEmbed],
        components: []
      });
      
      // Log the action
      logger.info(`${interaction.user.tag} updated logging categories in ${interaction.guild.name}`);
    }
  }
};
