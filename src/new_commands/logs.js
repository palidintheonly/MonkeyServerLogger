const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  ChannelType, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { logger: enhancedLogger } = require('../utils/enhanced-logger');
const { models } = require('../database/db');
const config = require('../config');

module.exports = {
  cooldown: 10, // 10 seconds cooldown
  category: 'Management',
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Manage logging settings and channels')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current logging configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a log channel for a specific category')
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable a specific log category')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('The log category to toggle')
            .setRequired(true)
            .addChoices(
              ...Object.entries(config.logging.categories).map(([key, category]) => ({
                name: `${category.emoji} ${category.name}`,
                value: key
              }))
            )
        )
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether to enable or disable this category')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('verbose')
        .setDescription('Configure verbose logging settings')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable verbose logging')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel for verbose logs (debug level)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
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
    
    let subcommand;
    try {
      subcommand = interaction.options.getSubcommand();
    } catch (error) {
      // No subcommand specified, show help message
      const embed = createEmbed({
        title: '📊 Logging Configuration',
        description: 'Please specify a subcommand to manage logs.',
        color: '#3498db',
        fields: [
          { name: '`/logs view`', value: 'View current logging configuration' },
          { name: '`/logs set`', value: 'Set logging channel' },
          { name: '`/logs reset`', value: 'Reset logging configuration' },
          { name: '`/logs toggle`', value: 'Toggle logging categories' },
          { name: '`/logs verbose`', value: 'Configure verbose logging' }
        ]
      });
      
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
      return;
    }
    
    switch (subcommand) {
      case 'view':
        await this.handleView(interaction, guildSettings);
        break;
        
      case 'set':
        await this.handleSet(interaction, guildSettings);
        break;
        
      case 'reset':
        await this.handleReset(interaction, guildSettings);
        break;
        
      case 'toggle':
        await this.handleToggle(interaction, guildSettings);
        break;
        
      case 'verbose':
        await this.handleVerbose(interaction, guildSettings, client);
        break;
        
      default:
        await interaction.reply({
          embeds: [createErrorEmbed('Unknown subcommand.')],
          ephemeral: true
        });
    }
  },
  
  /**
   * Handle the view subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings
   */
  async handleView(interaction, guildSettings) {
    // Get the main logging channel
    let mainChannel = null;
    if (guildSettings.loggingChannelId) {
      mainChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
    }
    
    // Get verbose logging channel if enabled
    let verboseChannel = null;
    if (guildSettings.verboseLoggingEnabled && guildSettings.verboseLoggingChannelId) {
      verboseChannel = await interaction.guild.channels.fetch(guildSettings.verboseLoggingChannelId).catch(() => null);
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
    
    // Create the main embed fields
    const mainFields = [
      {
        name: '📊 Main Logging Channel',
        value: mainChannel ? `${mainChannel}` : 'Not set - Please run `/setup`',
        inline: false
      },
      {
        name: '🔍 Verbose Logging',
        value: guildSettings.verboseLoggingEnabled 
          ? `**Status:** ✅ Enabled\n**Channel:** ${verboseChannel ? verboseChannel : 'Invalid Channel'}`
          : '**Status:** ❌ Disabled\nUse `/logs verbose enabled:true channel:#channel` to enable',
        inline: false
      }
    ];
    
    // Create the embed
    const embed = createEmbed({
      title: `${config.bot.name} Logging Configuration`,
      description: `Here's your current logging setup for ${interaction.guild.name}:`,
      thumbnail: interaction.guild.iconURL({ dynamic: true }),
      fields: [
        ...mainFields,
        ...fields
      ]
    });
    
    // Create buttons
    const enableAllButton = new ButtonBuilder()
      .setCustomId('logs-enable-all')
      .setLabel('Enable All')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');
      
    const disableAllButton = new ButtonBuilder()
      .setCustomId('logs-disable-all')
      .setLabel('Disable All')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌');
    
    const buttonRow = new ActionRowBuilder().addComponents(enableAllButton, disableAllButton);
    
    // Send the embed
    await interaction.reply({
      embeds: [embed],
      components: [buttonRow],
      ephemeral: false
    });
  },
  
  /**
   * Handle the set subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings
   */
  async handleSet(interaction, guildSettings) {
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
   * Handle the reset subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings
   */
  async handleReset(interaction, guildSettings) {
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
   * Handle the toggle subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings
   */
  async handleToggle(interaction, guildSettings) {
    const category = interaction.options.getString('category');
    const enabled = interaction.options.getBoolean('enabled');
    
    // Validate the category
    if (!config.logging.categories[category]) {
      await interaction.reply({
        embeds: [createErrorEmbed(`Invalid category: ${category}`)],
        ephemeral: true
      });
      return;
    }
    
    // Update the category status
    const enabledCategories = guildSettings.enabledCategories || {};
    enabledCategories[category] = enabled;
    
    await guildSettings.update({ enabledCategories });
    
    // Create success embed
    const embed = createSuccessEmbed(
      `${config.logging.categories[category].emoji} **${config.logging.categories[category].name}** logs are now ${enabled ? 'enabled' : 'disabled'}.`,
      'Log Category Updated'
    );
    
    await interaction.reply({ embeds: [embed] });
  },
  
  /**
   * Handle the verbose subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings
   * @param {Object} client - Discord client
   */
  async handleVerbose(interaction, guildSettings, client) {
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    
    await interaction.deferReply();
    
    try {
      // If enabling, check if a channel is provided
      if (enabled && !channel && !guildSettings.verboseLoggingChannelId) {
        await interaction.editReply({
          embeds: [createErrorEmbed("Please provide a channel to receive verbose logs.")]
        });
        return;
      }
      
      // Update settings
      const updateData = { verboseLoggingEnabled: enabled };
      
      // Update channel if provided
      if (channel) {
        updateData.verboseLoggingChannelId = channel.id;
      }
      
      // Update guild settings
      await guildSettings.update(updateData);
      
      // Refresh settings
      const updatedSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Get the verbose logging channel
      let verboseChannel = null;
      if (updatedSettings.verboseLoggingChannelId) {
        verboseChannel = await interaction.guild.channels.fetch(updatedSettings.verboseLoggingChannelId).catch(() => null);
      }
      
      // Update the logger settings
      if (enabled) {
        if (verboseChannel) {
          enhancedLogger.setLogChannel(verboseChannel, true);
          enhancedLogger.setVerboseLogging(true);
          logger.info(`Verbose logging enabled for ${interaction.guild.name} in channel #${verboseChannel.name}`);
          
          // Send a test message to the verbose channel
          try {
            const testEmbed = createEmbed({
              title: "🔍 Verbose Logging Test",
              description: `This channel has been set to receive verbose debug logs.\n\nSet up by: ${interaction.user}`,
              color: "#808080",
              fields: [
                { name: "Status", value: "✅ Enabled", inline: true },
                { name: "Log Level", value: "DEBUG", inline: true },
                { name: "Configuration Time", value: new Date().toISOString(), inline: false }
              ]
            });
            
            await verboseChannel.send({ embeds: [testEmbed] });
            
            // Send a test debug log
            enhancedLogger.debug("Verbose logging test message", { 
              guild: interaction.guild.name,
              enabled_by: interaction.user.tag,
              test: true
            });
          } catch (error) {
            logger.error(`Error sending test message to verbose log channel: ${error.message}`);
          }
        }
      } else {
        enhancedLogger.setVerboseLogging(false);
        logger.info(`Verbose logging disabled for ${interaction.guild.name}`);
      }
      
      // Create success embed
      const embed = createSuccessEmbed(
        enabled 
          ? `Verbose logging is now enabled${verboseChannel ? ` in channel ${verboseChannel}` : ''}.`
          : "Verbose logging is now disabled.",
        "Verbose Logging Settings Updated"
      );
      
      // Add field about what verbose logging does
      embed.addFields({ 
        name: "About Verbose Logging", 
        value: "Verbose logging includes detailed debug-level information that can be useful for troubleshooting. " +
               "It includes more technical details than regular logs and is recommended for advanced users only.",
        inline: false
      });
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error updating verbose logging settings: ${error.message}`);
      
      await interaction.editReply({
        embeds: [createErrorEmbed(`Error updating verbose logging settings: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle button interactions for this command
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    // Get guild settings from database
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      if (interaction.customId === 'logs-enable-all') {
        // Enable all log categories
        const enabledCategories = {};
        
        // Set all categories to enabled
        Object.keys(config.logging.categories).forEach(category => {
          enabledCategories[category] = true;
        });
        
        // Update guild settings
        await guildSettings.update({ enabledCategories });
        
        // Create response
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            "All log categories have been enabled.",
            "Log Categories Updated"
          )]
        });
      } 
      else if (interaction.customId === 'logs-disable-all') {
        // Disable all log categories
        const enabledCategories = {};
        
        // Set all categories to disabled
        Object.keys(config.logging.categories).forEach(category => {
          enabledCategories[category] = false;
        });
        
        // Update guild settings
        await guildSettings.update({ enabledCategories });
        
        // Create response
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            "All log categories have been disabled.",
            "Log Categories Updated"
          )]
        });
      }
      else {
        // Handle unknown button
        await interaction.editReply({
          embeds: [createErrorEmbed("Unknown button interaction.")]
        });
      }
    } catch (error) {
      logger.error(`Error handling logs button ${interaction.customId}: ${error.message}`);
      
      await interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
      });
    }
  }
};