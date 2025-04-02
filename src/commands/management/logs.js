const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, SelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const config = require('../../config');

module.exports = {
  cooldown: config.cooldowns.management,
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure log categories and channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current logging configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setchannel')
        .setDescription('Set a channel for a specific log category')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('The log category to configure')
            .setRequired(true)
            .addChoices(
              ...Object.entries(config.logging.categories).map(([key, category]) => ({
                name: `${category.emoji} ${category.name}`,
                value: key
              }))
            )
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to use for this log category')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset a category to use the main logging channel')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('The log category to reset')
            .setRequired(true)
            .addChoices(
              ...Object.entries(config.logging.categories).map(([key, category]) => ({
                name: `${category.emoji} ${category.name}`,
                value: key
              }))
            )
        )
    ),
  
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
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'view') {
      await this.handleViewCommand(interaction, guildSettings);
    } else if (subcommand === 'setchannel') {
      await this.handleSetChannelCommand(interaction, guildSettings);
    } else if (subcommand === 'reset') {
      await this.handleResetCommand(interaction, guildSettings);
    }
  },
  
  /**
   * Handle the logs view command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleViewCommand(interaction, guildSettings) {
    // Get the main logging channel
    let mainChannel = null;
    if (guildSettings.loggingChannelId) {
      mainChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
    }
    
    // Create fields for all categories
    const fields = [];
    
    for (const [key, category] of Object.entries(config.logging.categories)) {
      const enabled = guildSettings.isCategoryEnabled(key);
      const channelId = guildSettings.getCategoryChannel(key);
      
      let channelText;
      if (channelId && channelId !== guildSettings.loggingChannelId) {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        channelText = channel ? `${channel} (Custom)` : 'Invalid Channel';
      } else {
        channelText = mainChannel ? `${mainChannel} (Default)` : 'Default Channel Not Set';
      }
      
      fields.push({
        name: `${category.emoji} ${category.name}`,
        value: `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${channelText}`,
        inline: true
      });
    }
    
    // Create the embed
    const embed = createEmbed({
      title: `${config.bot.name} Logging Configuration`,
      description: `Here's your current logging setup for ${interaction.guild.name}:`,
      thumbnail: interaction.guild.iconURL({ dynamic: true }),
      fields: [
        {
          name: '📊 Main Logging Channel',
          value: mainChannel ? `${mainChannel}` : 'Not set - Please run `/setup`',
          inline: false
        },
        ...fields
      ]
    });
    
    // Create category management button
    const categoryButton = new ButtonBuilder()
      .setCustomId('logs-manage-categories')
      .setLabel('Manage Categories')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋');
    
    const buttonRow = new ActionRowBuilder().addComponents(categoryButton);
    
    // Send the embed
    await interaction.reply({
      embeds: [embed],
      components: [buttonRow],
      ephemeral: false
    });
  },
  
  /**
   * Handle the logs setchannel command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleSetChannelCommand(interaction, guildSettings) {
    const category = interaction.options.getString('category');
    const channel = interaction.options.getChannel('channel');
    
    // Validate the category
    if (!config.logging.categories[category]) {
      await interaction.reply({
        embeds: [createErrorEmbed(`Invalid category: ${category}`)],
        ephemeral: true
      });
      return;
    }
    
    // Update the category channel
    const categoryChannels = guildSettings.categoryChannels;
    categoryChannels[category] = channel.id;
    
    await guildSettings.update({ categoryChannels });
    
    // Create success embed
    const embed = createSuccessEmbed(
      `${config.logging.categories[category].emoji} **${config.logging.categories[category].name}** logs will now be sent to ${channel}.`,
      'Log Channel Updated'
    );
    
    await interaction.reply({ embeds: [embed] });
    
    // Send a test message to the new channel
    try {
      const testEmbed = createEmbed({
        title: `${config.logging.categories[category].emoji} Test Log Message`,
        description: `This channel has been set to receive **${config.logging.categories[category].name}** logs.\n\nSet up by: ${interaction.user}`,
        fields: [
          { name: 'Category', value: config.logging.categories[category].name, inline: true },
          { name: 'Status', value: guildSettings.isCategoryEnabled(category) ? '✅ Enabled' : '❌ Disabled', inline: true }
        ]
      });
      
      await channel.send({ embeds: [testEmbed] });
    } catch (error) {
      logger.error(`Error sending test message to log channel: ${error.message}`);
      
      await interaction.followUp({
        embeds: [createErrorEmbed(`Could not send a test message to ${channel}. Please check the bot's permissions.`)],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle the logs reset command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleResetCommand(interaction, guildSettings) {
    const category = interaction.options.getString('category');
    
    // Validate the category
    if (!config.logging.categories[category]) {
      await interaction.reply({
        embeds: [createErrorEmbed(`Invalid category: ${category}`)],
        ephemeral: true
      });
      return;
    }
    
    // Check if a main logging channel exists
    if (!guildSettings.loggingChannelId) {
      await interaction.reply({
        embeds: [createErrorEmbed('No main logging channel set. Please run `/setup` first.')],
        ephemeral: true
      });
      return;
    }
    
    // Get the main logging channel
    const mainChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
    
    if (!mainChannel) {
      await interaction.reply({
        embeds: [createErrorEmbed('The main logging channel could not be found. Please run `/setup` again.')],
        ephemeral: true
      });
      return;
    }
    
    // Update the category channel
    const categoryChannels = guildSettings.categoryChannels;
    delete categoryChannels[category];
    
    await guildSettings.update({ categoryChannels });
    
    // Create success embed
    const embed = createSuccessEmbed(
      `${config.logging.categories[category].emoji} **${config.logging.categories[category].name}** logs will now be sent to the main logging channel: ${mainChannel}.`,
      'Log Channel Reset'
    );
    
    await interaction.reply({ embeds: [embed] });
  },
  
  /**
   * Handle button interactions
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    if (interaction.customId === 'logs-manage-categories') {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Create select menu for enabling/disabling categories
      const categorySelect = new SelectMenuBuilder()
        .setCustomId('logs-toggle-categories')
        .setPlaceholder('Select categories to enable')
        .setMinValues(0)
        .setMaxValues(Object.keys(config.logging.categories).length)
        .addOptions(Object.entries(config.logging.categories).map(([key, category]) => ({
          label: category.name,
          value: key,
          description: `Toggle ${category.name} logging`,
          emoji: category.emoji,
          default: guildSettings.isCategoryEnabled(key)
        })));
      
      const selectRow = new ActionRowBuilder().addComponents(categorySelect);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: 'Manage Log Categories',
          description: 'Select which categories you want to enable:',
          fields: [
            { name: 'Instructions', value: 'Categories that are selected will be enabled. Unselected categories will be disabled.' }
          ]
        })],
        components: [selectRow],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle select menu interactions
   * @param {Object} interaction - Select menu interaction
   * @param {Object} client - Discord client
   */
  async handleSelectMenu(interaction, client) {
    if (interaction.customId === 'logs-toggle-categories') {
      await interaction.deferUpdate();
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Get enabled categories
      const enabledCategories = {};
      
      // Set all categories based on selection
      Object.keys(config.logging.categories).forEach(category => {
        enabledCategories[category] = interaction.values.includes(category);
      });
      
      // Update guild settings
      await guildSettings.update({ enabledCategories });
      
      // Create response message
      const enabledList = Object.entries(config.logging.categories)
        .filter(([key]) => interaction.values.includes(key))
        .map(([_, category]) => `${category.emoji} ${category.name}`)
        .join('\n');
      
      const disabledList = Object.entries(config.logging.categories)
        .filter(([key]) => !interaction.values.includes(key))
        .map(([_, category]) => `${category.emoji} ${category.name}`)
        .join('\n');
      
      const embed = createSuccessEmbed(
        'Log categories updated successfully!',
        'Categories Updated'
      );
      
      // Add fields for enabled and disabled categories
      if (enabledList) {
        embed.addFields({ name: '✅ Enabled Categories', value: enabledList, inline: true });
      }
      
      if (disabledList) {
        embed.addFields({ name: '❌ Disabled Categories', value: disabledList, inline: true });
      }
      
      await interaction.editReply({
        embeds: [embed],
        components: []
      });
    }
  }
};
