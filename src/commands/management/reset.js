const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const config = require('../../config');

module.exports = {
  cooldown: config.cooldowns.management,
  // Custom properties for loading indicators
  loadingStyle: 'dots',
  loadingColor: 'red',
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset server database settings')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Reset all settings for this server to default')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logging')
        .setDescription('Reset only logging settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('modmail')
        .setDescription('Reset only modmail settings')
    ),

  /**
   * Execute the reset command
   * @param {Object} interaction - Discord interaction object
   * @param {Object} client - Discord client
   */
  async execute(interaction, client) {
    try {
      // Check for required permissions
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          embeds: [createErrorEmbed('You need Administrator permissions to reset server settings.')],
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand();
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      if (subcommand === 'all') {
        await this.handleAllReset(interaction, client, guildSettings);
      } else if (subcommand === 'logging') {
        await this.handleLoggingReset(interaction, client, guildSettings);
      } else if (subcommand === 'modmail') {
        await this.handleModmailReset(interaction, client, guildSettings);
      }
    } catch (error) {
      logger.error(`Error executing reset command: ${error.message}`, { stack: error.stack });
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
          ephemeral: true
        });
      }
    }
  },
  
  /**
   * Handle the reset all subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleAllReset(interaction, client, guildSettings) {
    const confirmButton = new ButtonBuilder()
      .setCustomId('reset-all-confirm')
      .setLabel('Reset Everything')
      .setStyle(ButtonStyle.Danger);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('reset-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder().addComponents(cancelButton, confirmButton);
    
    const confirmEmbed = createEmbed({
      title: '⚠️ Reset All Settings?',
      description: 'Are you sure you want to reset all bot settings for this server? This will:\n\n• Clear all logging preferences\n• Disable modmail if enabled\n• Reset any custom configurations\n\n**This action cannot be undone!**',
      color: '#FF0000' // Red
    });
    
    await interaction.reply({
      embeds: [confirmEmbed],
      components: [buttonRow],
      ephemeral: true
    });
  },
  
  /**
   * Handle the reset logging subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleLoggingReset(interaction, client, guildSettings) {
    const confirmButton = new ButtonBuilder()
      .setCustomId('reset-logging-confirm')
      .setLabel('Reset Logging')
      .setStyle(ButtonStyle.Danger);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('reset-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder().addComponents(cancelButton, confirmButton);
    
    const confirmEmbed = createEmbed({
      title: '⚠️ Reset Logging Settings?',
      description: 'Are you sure you want to reset all logging settings for this server? This will:\n\n• Clear all logging channels\n• Reset enabled/disabled log categories\n• Clear ignored channels and roles\n• Disable verbose logging\n\n**This action cannot be undone!**',
      color: '#FF0000' // Red
    });
    
    await interaction.reply({
      embeds: [confirmEmbed],
      components: [buttonRow],
      ephemeral: true
    });
  },
  
  /**
   * Handle the reset modmail subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleModmailReset(interaction, client, guildSettings) {
    const confirmButton = new ButtonBuilder()
      .setCustomId('reset-modmail-confirm')
      .setLabel('Reset Modmail')
      .setStyle(ButtonStyle.Danger);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('reset-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder().addComponents(cancelButton, confirmButton);
    
    const confirmEmbed = createEmbed({
      title: '⚠️ Reset Modmail Settings?',
      description: 'Are you sure you want to reset all modmail settings for this server? This will:\n\n• Disable modmail functionality\n• Remove modmail category configuration\n• Clear modmail info channel\n\n**Note:** This will not delete any channels created by modmail.',
      color: '#FF0000' // Red
    });
    
    await interaction.reply({
      embeds: [confirmEmbed],
      components: [buttonRow],
      ephemeral: true
    });
  },
  
  /**
   * Handle button interactions
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    try {
      const customId = interaction.customId;
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      if (customId === 'reset-all-confirm') {
        // Reset all settings to default
        guildSettings.setupCompleted = false;
        guildSettings.setupProgress = { step: 0, lastUpdated: new Date().toISOString() };
        guildSettings.setupData = {};
        guildSettings.loggingChannelId = null;
        guildSettings.modmailEnabled = false;
        guildSettings.modmailCategoryId = null;
        guildSettings.modmailInfoChannelId = null;
        guildSettings.verboseLoggingEnabled = false;
        guildSettings.verboseLoggingChannelId = null;
        guildSettings.ignoredChannels = [];
        guildSettings.ignoredRoles = [];
        
        // Reset enabled categories to default
        const defaultCategories = {};
        Object.keys(config.logging.categories).forEach(category => {
          defaultCategories[category] = config.logging.defaultCategories.includes(category);
        });
        guildSettings.enabledCategories = defaultCategories;
        guildSettings.categoryChannels = {};
        
        await guildSettings.save();
        
        const resetEmbed = createSuccessEmbed(
          'All settings have been reset to default. Use `/setup wizard` to set up the bot again.',
          '✅ Settings Reset'
        );
        
        await interaction.update({
          embeds: [resetEmbed],
          components: []
        });
        
        logger.info(`All settings reset for guild ${interaction.guild.name} (${interaction.guild.id})`);
      }
      
      if (customId === 'reset-logging-confirm') {
        // Reset only logging settings
        guildSettings.loggingChannelId = null;
        guildSettings.verboseLoggingEnabled = false;
        guildSettings.verboseLoggingChannelId = null;
        guildSettings.ignoredChannels = [];
        guildSettings.ignoredRoles = [];
        
        // Reset enabled categories to default
        const defaultCategories = {};
        Object.keys(config.logging.categories).forEach(category => {
          defaultCategories[category] = config.logging.defaultCategories.includes(category);
        });
        guildSettings.enabledCategories = defaultCategories;
        guildSettings.categoryChannels = {};
        
        await guildSettings.save();
        
        const resetEmbed = createSuccessEmbed(
          'Logging settings have been reset to default. Use `/setup logs` to configure logging again.',
          '✅ Logging Reset'
        );
        
        await interaction.update({
          embeds: [resetEmbed],
          components: []
        });
        
        logger.info(`Logging settings reset for guild ${interaction.guild.name} (${interaction.guild.id})`);
      }
      
      if (customId === 'reset-modmail-confirm') {
        // Reset only modmail settings
        guildSettings.modmailEnabled = false;
        guildSettings.modmailCategoryId = null;
        guildSettings.modmailInfoChannelId = null;
        
        await guildSettings.save();
        
        const resetEmbed = createSuccessEmbed(
          'Modmail settings have been reset. Use `/setup modmail` to configure modmail again.',
          '✅ Modmail Reset'
        );
        
        await interaction.update({
          embeds: [resetEmbed],
          components: []
        });
        
        logger.info(`Modmail settings reset for guild ${interaction.guild.name} (${interaction.guild.id})`);
      }
      
      if (customId === 'reset-cancel') {
        await interaction.update({
          embeds: [createEmbed({ 
            title: 'Reset Cancelled', 
            description: 'No changes were made to your settings.', 
            color: '#5865F2' 
          })],
          components: []
        });
      }
      
    } catch (error) {
      logger.error(`Error handling reset button: ${error.message}`, { stack: error.stack });
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
          ephemeral: true
        });
      }
    }
  }
};