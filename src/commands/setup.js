const { 
  SlashCommandBuilder,
  ActionRowBuilder, 
  PermissionsBitField, 
  ChannelType, 
  SelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { models } = require('../database/db');
const config = require('../config');


module.exports = {
  cooldown: config.cooldowns.setup,
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the logging system for your server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('wizard')
        .setDescription('Start the setup wizard with a guided interface')
        .addStringOption(option => 
          option.setName('channel_name')
            .setDescription('Name for the main logging channel')
            .setRequired(false)
        )
        .addStringOption(option => 
          option.setName('modmail_channel')
            .setDescription('Name for the modmail channel')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('enable_modmail')
            .setDescription('Enable or disable the modmail system')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('enable_verbose_logging')
            .setDescription('Enable or disable verbose logging')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('Configure the logging channel')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('The channel for logs')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('modmail')
        .setDescription('Configure the modmail system')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable the modmail system')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Modmail info channel')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset all settings to default')
    ),
  
  /**
   * Execute the setup command
   * @param {Object} interaction - Discord interaction object
   * @param {Object} client - Discord client
   */
  async execute(interaction, client) {
    try {
      // Check if user is guild owner or has admin permission
      if (interaction.user.id !== interaction.guild.ownerId && 
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Only the server owner or administrators can use the setup command.')],
          ephemeral: true
        });
        return;
      }
      
      // Get guild settings from database
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Handle different subcommands
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'wizard':
          await this.handleWizardSubcommand(interaction, client, guildSettings);
          break;
          
        case 'logs':
          await this.handleLogsSubcommand(interaction, client, guildSettings);
          break;
          
        case 'modmail':
          await this.handleModmailSubcommand(interaction, client, guildSettings);
          break;
          
        case 'reset':
          await this.handleResetSubcommand(interaction, client, guildSettings);
          break;
          
        default:
          // If no subcommand specified or not recognized, default to wizard
          await this.handleWizardSubcommand(interaction, client, guildSettings);
      }
    } catch (error) {
      logger.error(`Error executing setup ${interaction.options.getSubcommand()} subcommand: ${error.message}`);
      await interaction.reply({
        embeds: [createErrorEmbed(`An error occurred while setting up: ${error.message}`)],
        ephemeral: true
      }).catch(err => {
        logger.error(`Failed to send error response: ${err.message}`);
      });
    }
  },
  
  /**
   * Handle the wizard subcommand that guides users through setup
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleWizardSubcommand(interaction, client, guildSettings) {
    try {
      // Get options from the slash command
      const channelName = interaction.options.getString('channel_name') || config.logging.defaultChannelName;
      const modmailChannelName = interaction.options.getString('modmail_channel') || 'modmail-tickets';
      const enableModmail = interaction.options.getBoolean('enable_modmail') ?? false;
      const enableVerboseLogging = interaction.options.getBoolean('enable_verbose_logging') ?? false;
      
      // Inform user we're setting up
      await interaction.reply({
        content: "Setting up your logging system...",
        ephemeral: true
      });
      
      // Store setup data
      await guildSettings.updateSetupProgress(2, {
        channelName: channelName,
        description: 'The Royal Court logging system.',
        modmailChannel: modmailChannelName,
        enableModmail: enableModmail,
        enableVerboseLogging: enableVerboseLogging
      });
      
      // Creating logging channel
      
      // Create the logging channel if it doesn't exist
      let loggingChannel;
      
      if (guildSettings.loggingChannelId) {
        // Try to use existing channel
        loggingChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
      }
      
      if (!loggingChannel) {
        // Create a new channel
        loggingChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: `${config.bot.name} - ${config.bot.slogan} | Logging Channel`,
          reason: 'Royal Court Logging System Setup'
        });
        
        logger.info(`Created logging channel ${loggingChannel.name} in ${interaction.guild.name}`);
      }
      
      // Store the logging channel ID
      guildSettings.loggingChannelId = loggingChannel.id;
      await guildSettings.save();
      
      // Set up verbose logging if enabled
      let verboseLoggingChannel = null;
      
      if (enableVerboseLogging) {
        // Setting up verbose logging
        
        try {
          // Create a verbose logging channel
          const verboseChannelName = `${channelName}-verbose`;
          verboseLoggingChannel = await interaction.guild.channels.create({
            name: verboseChannelName,
            type: ChannelType.GuildText,
            topic: `${config.bot.name} - Verbose Logging Channel | All debug and detailed logs`,
            reason: 'Royal Court Logging System Setup - Verbose Logging'
          });
          
          guildSettings.verboseLoggingEnabled = true;
          guildSettings.verboseLoggingChannelId = verboseLoggingChannel.id;
          await guildSettings.save();
          
          logger.info(`Created verbose logging channel ${verboseLoggingChannel.name} in ${interaction.guild.name}`);
          
          // Welcome message for verbose logging channel
          const verboseWelcomeEmbed = createEmbed({
            title: '🔍 Verbose Logging Channel',
            description: 'This channel contains detailed debug logs and additional information not included in the main logging channel.',
            color: '#5865F2',
            timestamp: true
          });
          
          await verboseLoggingChannel.send({ embeds: [verboseWelcomeEmbed] });
        } catch (error) {
          logger.error(`Error setting up verbose logging: ${error.message}`);
          // Don't fail the whole setup if just verbose logging fails
        }
      }
      
      // Set up modmail if enabled
      if (enableModmail) {
        // Setting up modmail system
        
        try {
          // Create or find a modmail category
          let modmailCategory = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === 'MODMAIL TICKETS'
          );
          
          if (!modmailCategory) {
            modmailCategory = await interaction.guild.channels.create({
              name: 'MODMAIL TICKETS',
              type: ChannelType.GuildCategory,
              permissionOverwrites: [
                {
                  id: interaction.guild.id, // @everyone role
                  deny: PermissionsBitField.Flags.ViewChannel
                },
                {
                  id: interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.ownerId,
                  allow: PermissionsBitField.Flags.ViewChannel | PermissionsBitField.Flags.SendMessages | PermissionsBitField.Flags.ReadMessageHistory
                }
              ]
            });
            
            logger.info(`Created modmail category in ${interaction.guild.name}`);
          }
          
          // Update guild settings
          guildSettings.modmailEnabled = true;
          guildSettings.modmailCategoryId = modmailCategory.id;
          
          // Create a welcome/info channel for modmail in the category
          const modmailChannel = await interaction.guild.channels.create({
            name: modmailChannelName,
            type: ChannelType.GuildText,
            parent: modmailCategory.id,
            topic: 'Modmail system information and tickets'
          });
          
          guildSettings.modmailInfoChannelId = modmailChannel.id;
          await guildSettings.save();
          
          // Create welcome message for modmail channel
          const modmailWelcomeEmbed = createEmbed({
            title: '📬 Modmail System',
            description: 'This channel is for the modmail system. Users who DM the bot will have their messages forwarded here. Staff can reply to these messages using the `/modmail` commands.',
            fields: [
              {
                name: '📋 Available Commands',
                value: '`/modmail reply` - Reply to a user via modmail\n`/modmail close` - Close a modmail thread\n`/modmail block` - Block a user from using modmail\n`/modmail unblock` - Unblock a user from modmail'
              },
              {
                name: '⚠️ Important Notes',
                value: '- When users DM the bot, a new channel will be created under this category\n- Only members with access to this category can view modmail conversations\n- Be professional in your responses as you represent the server'
              }
            ],
            color: '#5865F2',
            timestamp: true
          });
          
          await modmailChannel.send({ embeds: [modmailWelcomeEmbed] });
          logger.info(`Created modmail info channel ${modmailChannel.name} in ${interaction.guild.name}`);
        } catch (error) {
          logger.error(`Error setting up modmail: ${error.message}`);
          // Don't fail the whole setup if just modmail fails
        }
      }
      
      // Mark setup as completed
      guildSettings.setupCompleted = true;
      await guildSettings.save();
      
      // Finalize setup
      
      // Construct the success message
      let successMessage = `✅ **Setup completed successfully!**\n\nLogging channel: ${loggingChannel}`;
      
      if (verboseLoggingChannel) {
        successMessage += `\nVerbose logging channel: ${verboseLoggingChannel}`;
      }
      
      if (enableModmail) {
        successMessage += `\nModmail system is **enabled**`;
      }
      
      // Create completion embed with next steps
      const setupCompleteEmbed = createSuccessEmbed(
        successMessage,
        '✅ Setup Complete'
      );
      
      // Add an additional field with next steps
      setupCompleteEmbed.addFields([
        {
          name: 'Next Steps',
          value: '• Use `/help` to see all available commands\n• Configure specific logging channels with `/logs`\n• Manage ignored channels and roles with `/ignore`'
        }
      ]);
      
      // Create completion components
      const helpButton = new ButtonBuilder()
        .setCustomId('help-button')
        .setLabel('View Help')
        .setStyle(ButtonStyle.Primary);
      
      const setupCompleteComponents = new ActionRowBuilder().addComponents(helpButton);
      
      // Send the final setup message
      await interaction.editReply({
        content: null,
        embeds: [setupCompleteEmbed],
        components: [setupCompleteComponents]
      });
      
      // Send a welcome message to the logging channel
      const loggingWelcomeEmbed = createEmbed({
        title: '📝 Logging System Activated',
        description: `The Royal Court logging system has been configured by ${interaction.user}.`,
        fields: [
          {
            name: '📋 Available Log Types',
            value: 'All enabled log categories will be reported in this channel.'
          },
          {
            name: '⚙️ Configuration Options',
            value: 'Use `/logs` to configure specific channels for different log types, and `/ignore` to exclude channels or roles from logging.'
          }
        ],
        color: '#5865F2',
        timestamp: true
      });
      
      await loggingChannel.send({ embeds: [loggingWelcomeEmbed] });
    } catch (error) {
      logger.error(`Error in setup wizard: ${error.message}`);
      
      // Try to reply if we haven't already
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [createErrorEmbed(`An error occurred during setup: ${error.message}`)],
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            embeds: [createErrorEmbed(`An error occurred during setup: ${error.message}`)],
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error(`Failed to send error response for wizard: ${replyError.message}`);
      }
    }
  },
  
  /**
   * Handle the logs subcommand to configure logging channels
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleLogsSubcommand(interaction, client, guildSettings) {
    const channel = interaction.options.getChannel('channel');
    
    if (channel) {
      // User provided a channel, set it as logging channel
      if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          embeds: [createErrorEmbed('The logging channel must be a text channel.')],
          ephemeral: true
        });
        return;
      }
      
      // Test permissions in the channel
      const botMember = interaction.guild.members.me;
      const permissions = channel.permissionsFor(botMember);
      
      if (!permissions.has(PermissionsBitField.Flags.SendMessages) || !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
        await interaction.reply({
          embeds: [createErrorEmbed('I don\'t have permission to send messages and embeds in that channel. Please adjust the permissions or choose another channel.')],
          ephemeral: true
        });
        return;
      }
      
      // Set the channel as logging channel
      guildSettings.loggingChannelId = channel.id;
      await guildSettings.save();
      
      // Send a welcome message to the channel
      const welcomeEmbed = createEmbed({
        title: '📝 Logging Channel Configured',
        description: 'This channel has been set up to receive logging messages from The Royal Court Herald bot.',
        fields: [
          {
            name: '📋 Available Commands',
            value: 'Use `/help` to see a list of available commands.'
          }
        ],
        color: '#5865F2',
        timestamp: true
      });
      
      await channel.send({ embeds: [welcomeEmbed] });
      
      // Confirm to the user
      await interaction.reply({
        embeds: [createSuccessEmbed(`Logging channel set to ${channel.toString()}`)],
        ephemeral: true
      });
    } else {
      // No channel provided, show current settings
      const currentChannel = guildSettings.loggingChannelId 
        ? interaction.guild.channels.cache.get(guildSettings.loggingChannelId)
        : null;
      
      const settingsEmbed = createEmbed({
        title: '⚙️ Logging Settings',
        description: 'Current logging configuration for this server.',
        fields: [
          {
            name: 'Logging Channel',
            value: currentChannel ? currentChannel.toString() : 'Not set'
          },
          {
            name: 'Setup Completed',
            value: guildSettings.setupCompleted ? 'Yes' : 'No'
          },
          {
            name: 'How to Change',
            value: 'Use `/setup logs channel:#channel-name` to set a specific channel for logs.'
          }
        ],
        color: '#5865F2'
      });
      
      await interaction.reply({
        embeds: [settingsEmbed],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle the modmail subcommand to configure the modmail system
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleModmailSubcommand(interaction, client, guildSettings) {
    const enableModmail = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    
    // Show modmail configuration message
    await interaction.reply({
      content: "Configuring modmail system...",
      ephemeral: true
    });
    
    try {
      if (enableModmail) {
        // Enabling modmail system
        let modmailCategory = interaction.guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name === 'MODMAIL TICKETS'
        );
        
        // Create category if it doesn't exist
        if (!modmailCategory) {
          modmailCategory = await interaction.guild.channels.create({
            name: 'MODMAIL TICKETS',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.id, // @everyone role
                deny: PermissionsBitField.Flags.ViewChannel
              },
              {
                id: interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.ownerId,
                allow: PermissionsBitField.Flags.ViewChannel | PermissionsBitField.Flags.SendMessages | PermissionsBitField.Flags.ReadMessageHistory
              }
            ]
          });
        }
        
        // Create or use the specified modmail info channel
        let modmailChannel;
        
        if (channel && channel.type === ChannelType.GuildText) {
          // Use the specified channel
          modmailChannel = channel;
          
          // Move to the modmail category if not already there
          if (modmailChannel.parentId !== modmailCategory.id) {
            await modmailChannel.setParent(modmailCategory.id);
          }
        } else {
          // Create a new channel
          modmailChannel = await interaction.guild.channels.create({
            name: 'modmail-info',
            type: ChannelType.GuildText,
            parent: modmailCategory.id,
            topic: 'Modmail system information and tickets'
          });
        }
        
        // Create welcome message for modmail channel
        const modmailWelcomeEmbed = createEmbed({
          title: '📬 Modmail System',
          description: 'This channel is for the modmail system. Users who DM the bot will have their messages forwarded here. Staff can reply to these messages using the `/modmail` commands.',
          fields: [
            {
              name: '📋 Available Commands',
              value: '`/modmail reply` - Reply to a user via modmail\n`/modmail close` - Close a modmail thread\n`/modmail block` - Block a user from using modmail\n`/modmail unblock` - Unblock a user from modmail'
            },
            {
              name: '⚠️ Important Notes',
              value: '- When users DM the bot, a new channel will be created under this category\n- Only members with access to this category can view modmail conversations\n- Be professional in your responses as you represent the server'
            }
          ],
          color: '#5865F2',
          timestamp: true
        });
        
        await modmailChannel.send({ embeds: [modmailWelcomeEmbed] });
        
        // Update guild settings
        guildSettings.modmailEnabled = true;
        guildSettings.modmailCategoryId = modmailCategory.id;
        guildSettings.modmailInfoChannelId = modmailChannel.id;
        await guildSettings.save();
        
        // Notify user of success
        await interaction.editReply({
          content: "✅ Modmail system enabled successfully!"
        });
      } else {
        // Disabling modmail system
        guildSettings.modmailEnabled = false;
        await guildSettings.save();
        
        // Notify user of success
        await interaction.editReply({
          content: "Modmail system has been disabled. You can re-enable it at any time."
        });
      }
    } catch (error) {
      logger.error(`Error configuring modmail: ${error.message}`);
      // Show error message
      await interaction.editReply({
        content: `Error: ${error.message}`
      });
    }
  },
  
  /**
   * Handle the reset subcommand to reset all settings
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleResetSubcommand(interaction, client, guildSettings) {
    // Create confirm buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('setup-reset-confirm')
      .setLabel('Reset Everything')
      .setStyle(ButtonStyle.Danger);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('setup-reset-cancel')
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
   * Calculate time ago from a given date
   * @param {Date} date - The date to calculate from
   * @returns {string} Time ago string
   */
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr = Math.round(diffMin / 60);
    const diffDays = Math.round(diffHr / 24);
    
    if (diffSec < 60) {
      return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    } else if (diffHr < 24) {
      return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  },
  
  // Modal handling has been removed and replaced with direct option handling in the wizard subcommand
  
  /**
   * Handle button interactions for the setup command
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    try {
      const customId = interaction.customId;
      
      // Handle setup resume/restart buttons
      if (customId === 'setup-resume' || customId === 'setup-restart') {
        await interaction.deferUpdate().catch(err => logger.warn(`Could not defer update: ${err.message}`));
        
        // Get guild settings
        const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
        
        if (customId === 'setup-restart') {
          // Clear setup data if starting fresh
          await guildSettings.updateSetupProgress(0, {});
        }
        
        // Inform the user that we are now using slash command options instead of modal forms
        const embed = createEmbed({
          title: 'Setup Wizard Changes',
          description: 'The setup process now uses direct slash command options instead of modal forms. Please use the `/setup wizard` command with the following options:',
          fields: [
            {
              name: 'Available Options',
              value: '`channel_name` - Name for the main logging channel\n`modmail_channel` - Name for the modmail channel\n`enable_modmail` - Whether to enable modmail\n`enable_verbose_logging` - Whether to enable verbose logging'
            }
          ],
          color: '#5865F2'
        });
        
        await interaction.editReply({
          embeds: [embed],
        });
        
        // Update setup progress
        if (customId === 'setup-restart') {
          await guildSettings.updateSetupProgress(1);
        }
      }
      
      // Handle reset confirmation buttons
      if (customId === 'setup-reset-confirm') {
        const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
        
        // Reset all settings to default
        guildSettings.setupCompleted = false;
        guildSettings.setupProgress = JSON.stringify({ step: 0, lastUpdated: new Date().toISOString() });
        guildSettings.setupData = JSON.stringify({});
        guildSettings.loggingChannelId = null;
        guildSettings.modmailEnabled = false;
        guildSettings.modmailCategoryId = null;
        guildSettings.modmailInfoChannelId = null;
        guildSettings.verboseLoggingEnabled = false;
        guildSettings.verboseLoggingChannelId = null;
        guildSettings.ignoredChannels = JSON.stringify([]);
        guildSettings.ignoredRoles = JSON.stringify([]);
        guildSettings.enabledCategories = JSON.stringify(config.logging.defaultCategories);
        guildSettings.categoryChannels = JSON.stringify({});
        
        await guildSettings.save();
        
        const resetEmbed = createSuccessEmbed(
          'All settings have been reset to default. Use `/setup wizard` to set up the bot again.',
          '✅ Settings Reset'
        );
        
        await interaction.update({
          embeds: [resetEmbed],
          components: []
        });
      }
      
      // Handle reset cancellation
      if (customId === 'setup-reset-cancel') {
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
      logger.error(`Error handling setup button: ${error.message}`);
      
      // Attempt to send error response even if the original interaction might be expired
      try {
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
      } catch (replyError) {
        logger.error(`Failed to reply with error: ${replyError.message}`);
      }
    }
  },
  
  /**
   * Handle select menu interactions
   * @param {Object} interaction - Select menu interaction
   * @param {Object} client - Discord client
   */
  async handleSelectMenu(interaction, client) {
    try {
      // No select menus in the basic setup command yet
      await interaction.reply({
        embeds: [createErrorEmbed('This select menu is not yet implemented.')],
        ephemeral: true
      });
    } catch (error) {
      logger.error(`Error handling setup select menu: ${error.message}`);
    }
  }
};