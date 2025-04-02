const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { logger: enhancedLogger } = require('../../utils/enhanced-logger');
const { models } = require('../../database/db');
const config = require('../../config');
const { LoadingIndicator } = require('../../utils/loadingIndicator');

module.exports = {
  cooldown: config.cooldowns.management,
  // Custom properties for loading indicators
  loadingStyle: 'dots',
  loadingColor: 'blue',
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
        flags: { ephemeral: true }
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
    } else if (subcommand === 'verbose') {
      await this.handleVerboseCommand(interaction, guildSettings, client);
    }
  },
  
  /**
   * Handle the verbose logging settings command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   * @param {Object} client - Discord client
   */
  async handleVerboseCommand(interaction, guildSettings, client) {
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    
    // Create a loading indicator
    const loader = new LoadingIndicator({
      text: `${enabled ? 'Enabling' : 'Disabling'} verbose logging...`,
      style: this.loadingStyle || "dots",
      color: this.loadingColor || "green"
    });
    
    // Start the loader
    await loader.start(interaction);
    
    try {
      // If enabling, check if a channel is provided
      if (enabled && !channel && !guildSettings.verboseLoggingChannelId) {
        await loader.stop({
          text: "You need to specify a channel when enabling verbose logging for the first time.",
          embeds: [createErrorEmbed("Please provide a channel to receive verbose logs.")],
          success: false
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
      
      // Stop the loader with success state
      await loader.stop({
        text: `Verbose logging ${enabled ? 'enabled' : 'disabled'} successfully!`,
        embeds: [embed],
        success: true
      });
      
    } catch (error) {
      logger.error(`Error updating verbose logging settings: ${error.message}`);
      
      // Stop the loader with error state
      await loader.stop({
        text: "There was an error updating verbose logging settings!",
        embeds: [createErrorEmbed(`Error: ${error.message}`)],
        success: false
      });
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
    
    // Create category management button
    const categoryButton = new ButtonBuilder()
      .setCustomId('logs-manage-categories')
      .setLabel('Manage Categories')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋');
      
    // Create verbose logging button
    const verboseButton = new ButtonBuilder()
      .setCustomId('logs-toggle-verbose')
      .setLabel(guildSettings.verboseLoggingEnabled ? 'Disable Verbose Logs' : 'Enable Verbose Logs')
      .setStyle(guildSettings.verboseLoggingEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji('🔍');
    
    const buttonRow = new ActionRowBuilder().addComponents(categoryButton, verboseButton);
    
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
        flags: { ephemeral: true }
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
        flags: { ephemeral: true }
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
        flags: { ephemeral: true }
      });
      return;
    }
    
    // Check if a main logging channel exists
    if (!guildSettings.loggingChannelId) {
      await interaction.reply({
        embeds: [createErrorEmbed('No main logging channel set. Please run `/setup` first.')],
        flags: { ephemeral: true }
      });
      return;
    }
    
    // Get the main logging channel
    const mainChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
    
    if (!mainChannel) {
      await interaction.reply({
        embeds: [createErrorEmbed('The main logging channel could not be found. Please run `/setup` again.')],
        flags: { ephemeral: true }
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
    // Get guild settings for any button handler
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    if (interaction.customId === 'logs-manage-categories') {
      // Create select menu for enabling/disabling categories
      const categorySelect = new StringSelectMenuBuilder()
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
        flags: { ephemeral: true }
      });
    }
    
    else if (interaction.customId === 'logs-toggle-verbose') {
      // Create a loading indicator
      const loader = new LoadingIndicator({
        text: guildSettings.verboseLoggingEnabled 
          ? "Disabling verbose logging..." 
          : "Configuring verbose logging...",
        style: this.loadingStyle || "dots",
        color: this.loadingColor || "green"
      });
      
      // Start the loader
      await loader.start(interaction);
      
      try {
        if (guildSettings.verboseLoggingEnabled) {
          // If currently enabled, simply disable it
          await guildSettings.update({ verboseLoggingEnabled: false });
          
          // Update the logger settings
          enhancedLogger.setVerboseLogging(false);
          logger.info(`Verbose logging disabled for ${interaction.guild.name} by ${interaction.user.tag}`);
          
          // Stop the loader with success state
          await loader.stop({
            text: "Verbose logging disabled successfully.",
            embeds: [createSuccessEmbed(
              "Verbose logging has been disabled. Debug-level logs will no longer be sent to Discord.",
              "Verbose Logging Disabled"
            )],
            success: true
          });
        } 
        else {
          // If currently disabled, need to show a channel selector
          // We'll ask the user to use the proper command instead
          const embed = createEmbed({
            title: "Enable Verbose Logging",
            description: "To enable verbose logging, you need to specify a channel to send the logs to.",
            fields: [
              { 
                name: "Command Usage", 
                value: "Use `/logs verbose enabled:true channel:#your-channel` to enable verbose logging with a specific channel."
              },
              {
                name: "What are verbose logs?",
                value: "Verbose logs include debug-level information that can be useful for troubleshooting. They are more detailed than regular logs."
              }
            ],
            color: "#5865F2" // Discord blurple
          });
          
          // Stop the loader with the instructions
          await loader.stop({
            text: "Please use the command to enable verbose logging.",
            embeds: [embed],
            success: true
          });
        }
      } 
      catch (error) {
        logger.error(`Error toggling verbose logging: ${error.message}`);
        
        // Stop the loader with error state
        await loader.stop({
          text: "There was an error updating verbose logging settings!",
          embeds: [createErrorEmbed(`Error: ${error.message}`)],
          success: false
        });
      }
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
      
      // Create a loading indicator for category toggle
      const loader = new LoadingIndicator({
        text: "Updating log categories...",
        style: this.loadingStyle || "dots",
        color: this.loadingColor || "blue"
      });
      
      // Start the loader
      await loader.start(interaction);
      
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
      
      // Stop the loader with success state
      await loader.stop({
        text: "Log categories have been updated!",
        embeds: [embed],
        components: [],
        success: true
      });
    }
  }
};
