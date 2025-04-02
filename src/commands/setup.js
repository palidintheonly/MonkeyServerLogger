const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionsBitField, ChannelType, SelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { models } = require('../database/db');
const config = require('../config');
const { LoadingIndicator } = require('../utils/loadingIndicator');

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
    
    try {
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
      logger.error(`Error executing setup ${subcommand} subcommand: ${error.message}`);
      await interaction.reply({
        embeds: [createErrorEmbed(`An error occurred while setting up: ${error.message}`)],
        ephemeral: true
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
    const setupProgress = guildSettings.getSetupProgress();
    
    // If we have a setup in progress, ask if the user wants to resume
    if (setupProgress.step > 0 && !guildSettings.setupCompleted) {
      const lastUpdated = new Date(setupProgress.lastUpdated);
      const timeAgo = this.getTimeAgo(lastUpdated);
      
      const resumeEmbed = createEmbed({
        title: '⚙️ Setup In Progress',
        description: `You have a setup that was started ${timeAgo}. Would you like to resume where you left off or start fresh?`,
        color: '#FFA500', // Orange
        fields: [
          {
            name: 'Progress',
            value: `You completed ${setupProgress.step} of 3 steps.`
          },
          {
            name: 'Stored Information',
            value: Object.keys(guildSettings.setupData).length 
              ? `You've already provided: ${Object.keys(guildSettings.setupData).join(', ')}`
              : 'No information stored yet.'
          }
        ]
      });
      
      // Create buttons for resume or restart
      const resumeButton = new ButtonBuilder()
        .setCustomId('setup-resume')
        .setLabel('Resume Setup')
        .setStyle(ButtonStyle.Success);
      
      const restartButton = new ButtonBuilder()
        .setCustomId('setup-restart')
        .setLabel('Start Fresh')
        .setStyle(ButtonStyle.Danger);
      
      const buttonRow = new ActionRowBuilder().addComponents(resumeButton, restartButton);
      
      await interaction.reply({
        embeds: [resumeEmbed],
        components: [buttonRow],
        ephemeral: true
      });
      
      return;
    }
    
    // Either no setup in progress or user chose to start fresh
    // Create a modal for initial setup
    const modal = new ModalBuilder()
      .setCustomId('setup-modal')
      .setTitle('Royal Court Logging Setup');
    
    // Add text input for the main logging channel
    const channelNameInput = new TextInputBuilder()
      .setCustomId('channelName')
      .setLabel('Main logging channel name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(config.logging.defaultChannelName)
      .setRequired(false)
      .setMaxLength(100);
    
    // Add input for modmail channel
    const modmailChannelInput = new TextInputBuilder()
      .setCustomId('modmailChannel')
      .setLabel('Modmail channel name (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('modmail-tickets')
      .setRequired(false)
      .setMaxLength(100);
    
    // Add a description field
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Logging system description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add a custom description for your logging system...')
      .setRequired(false)
      .setMaxLength(1000);
    
    // Add toggle for enabling modmail
    const modmailToggleInput = new TextInputBuilder()
      .setCustomId('enableModmail')
      .setLabel('Enable Modmail? (yes/no)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('yes')
      .setRequired(false)
      .setMaxLength(3);
      
    // Add toggle for enabling verbose logging
    const verboseLoggingToggleInput = new TextInputBuilder()
      .setCustomId('enableVerboseLogging')
      .setLabel('Enable Verbose Logging? (yes/no)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('no')
      .setRequired(false)
      .setMaxLength(3);
    
    // Pre-fill form if resuming setup
    if (guildSettings.setupData.channelName) {
      channelNameInput.setValue(guildSettings.setupData.channelName);
    }
    
    if (guildSettings.setupData.modmailChannel) {
      modmailChannelInput.setValue(guildSettings.setupData.modmailChannel);
    }
    
    if (guildSettings.setupData.description) {
      descriptionInput.setValue(guildSettings.setupData.description);
    }
    
    if (guildSettings.setupData.enableModmail !== undefined) {
      modmailToggleInput.setValue(guildSettings.setupData.enableModmail ? 'yes' : 'no');
    }
    
    // Add the components to the modal
    const firstActionRow = new ActionRowBuilder().addComponents(channelNameInput);
    const secondActionRow = new ActionRowBuilder().addComponents(modmailChannelInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(modmailToggleInput);
    const fourthActionRow = new ActionRowBuilder().addComponents(verboseLoggingToggleInput);
    const fifthActionRow = new ActionRowBuilder().addComponents(descriptionInput);
    
    // Add inputs to the modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
    
    // Update setup progress
    await guildSettings.updateSetupProgress(1);
    
    // Show the modal
    await interaction.showModal(modal);
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
      
      if (!permissions.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks])) {
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
    
    // Create loading indicator
    const loader = new LoadingIndicator({
      text: "Configuring modmail system...",
      style: "dots",
      color: "blue"
    });
    
    await loader.start(interaction);
    
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
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.ownerId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
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
        
        await loader.stop({
          text: "✅ Modmail system enabled successfully!",
          success: true
        });
      } else {
        // Disabling modmail system
        guildSettings.modmailEnabled = false;
        await guildSettings.save();
        
        await loader.stop({
          text: "Modmail system has been disabled. You can re-enable it at any time.",
          success: true
        });
      }
    } catch (error) {
      logger.error(`Error configuring modmail: ${error.message}`);
      await loader.stop({
        text: `Error: ${error.message}`,
        success: false
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
  
  /**
   * Handle the modal submission
   * @param {Object} interaction - Modal interaction
   * @param {Object} client - Discord client
   */
  // Custom properties for loading indicators
  loadingStyle: 'gear',
  loadingColor: 'purple',

  async handleModal(interaction, client) {
    try {
      logger.info(`Processing setup modal for ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guild.name}`);
      
      // Get any existing loader from the interaction or create our own
      let loader;
      if (client.activeLoaders && client.activeLoaders.has(interaction.id)) {
        loader = client.activeLoaders.get(interaction.id);
        logger.info(`Using existing loader for interaction ${interaction.id}`);
      } else {
        // Create a unique setup loader
        try {
          // Check if the interaction is still valid
          if (interaction.replied) {
            logger.warn(`Setup modal interaction ${interaction.id} was already replied to`);
            return;
          }
          
          // Safely defer the reply
          await interaction.deferReply({ ephemeral: true }).catch(err => {
            logger.error(`Failed to defer reply for setup modal: ${err.message}`);
            throw new Error('Invalid interaction: Unable to defer reply');
          });
          
          logger.info(`Creating new loader for interaction ${interaction.id}`);
          loader = new LoadingIndicator({
            text: "Setting up your logging system...",
            style: "gear",
            color: "purple"
          });
          
          await loader.start(interaction);
        } catch (error) {
          logger.error(`Error starting loader: ${error.message}`);
          // Continue without a loader if we can't create one
          logger.warn('Continuing setup process without loading animation');
        }
      }
      
      // Get the input values
      const channelName = interaction.fields.getTextInputValue('channelName').trim() || config.logging.defaultChannelName;
      const description = interaction.fields.getTextInputValue('description').trim() || 'The Royal Court logging system powered by Monkey Bytes.';
      const modmailChannelName = interaction.fields.getTextInputValue('modmailChannel').trim() || 'modmail-tickets';
      
      // Check if modmail should be enabled
      let enableModmail = false;
      try {
        const modmailToggle = interaction.fields.getTextInputValue('enableModmail').trim().toLowerCase();
        enableModmail = modmailToggle === 'yes' || modmailToggle === 'y';
      } catch (error) {
        // If field is missing or empty, default to false
        enableModmail = false;
      }
      
      // Check if verbose logging should be enabled
      let enableVerboseLogging = false;
      try {
        const verboseToggle = interaction.fields.getTextInputValue('enableVerboseLogging').trim().toLowerCase();
        enableVerboseLogging = verboseToggle === 'yes' || verboseToggle === 'y';
      } catch (error) {
        // If field is missing or empty, default to false
        enableVerboseLogging = false;
      }
      
      // Find or create a guild record in the database
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Store the form data for potential resume later
      await guildSettings.updateSetupProgress(2, {
        channelName: channelName,
        description: description,
        modmailChannel: modmailChannelName,
        enableModmail: enableModmail,
        enableVerboseLogging: enableVerboseLogging
      });
      
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
          reason: 'Monkey Bytes Logging System Setup'
        });
        
        logger.info(`Created logging channel ${loggingChannel.name} in ${interaction.guild.name}`);
      }
      
      // Set up modmail category and channel if enabled
      let modmailChannel = null;
      let modmailCategoryId = null;
      
      if (enableModmail) {
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
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.ownerId,
                  allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                }
              ]
            });
            
            logger.info(`Created modmail category in ${interaction.guild.name}`);
          }
          
          modmailCategoryId = modmailCategory.id;
          
          // Create a welcome/info channel for modmail in the category
          modmailChannel = await interaction.guild.channels.create({
            name: modmailChannelName,
            type: ChannelType.GuildText,
            parent: modmailCategory.id,
            topic: 'Modmail system information and tickets'
          });
          
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
          
          // Set environment variable for this server as support guild if requested
          if (process.env.SUPPORT_GUILD_ID === undefined || process.env.SUPPORT_GUILD_ID === '') {
            process.env.SUPPORT_GUILD_ID = interaction.guild.id;
            logger.info(`Set ${interaction.guild.name} (${interaction.guild.id}) as SUPPORT_GUILD_ID for modmail system`);
          }
        } catch (error) {
          logger.error(`Error setting up modmail: ${error.message}`);
        }
      }
      
      // Set up verbose logging channel if enabled
      let verboseLoggingChannelId = null;
      
      if (enableVerboseLogging) {
        try {
          // Create a verbose logging channel
          const verboseChannelName = `${channelName}-verbose`;
          const verboseLoggingChannel = await interaction.guild.channels.create({
            name: verboseChannelName,
            type: ChannelType.GuildText,
            topic: `${config.bot.name} - Verbose Logging Channel | All debug and detailed logs`,
            reason: 'Monkey Bytes Logging System Setup - Verbose Logging'
          });
          
          verboseLoggingChannelId = verboseLoggingChannel.id;
          logger.info(`Created verbose logging channel ${verboseLoggingChannel.name} in ${interaction.guild.name}`);
          
          // Welcome message for verbose logging channel
          const verboseWelcomeEmbed = createEmbed({
            title: '🔍 Verbose Logging Channel',
            description: 'This channel contains detailed debug logs and additional information about bot operations.',
            fields: [
              {
                name: '⚠️ Warning',
                value: 'This channel may receive a high volume of messages. It is recommended to mute notifications for this channel.'
              },
              {
                name: '📋 Information',
                value: 'Debug logs include detailed information about command execution, error states, and bot interactions.'
              }
            ],
            color: '#808080', // Gray color for debug/verbose
            timestamp: true
          });
          
          await verboseLoggingChannel.send({ embeds: [verboseWelcomeEmbed] });
        } catch (error) {
          logger.error(`Error setting up verbose logging channel: ${error.message}`);
        }
      }
      
      // Update the guild settings
      await guildSettings.update({
        loggingChannelId: loggingChannel.id,
        setupCompleted: true,
        modmailEnabled: enableModmail,
        modmailCategoryId: modmailCategoryId,
        modmailInfoChannelId: modmailChannel?.id,
        verboseLoggingEnabled: enableVerboseLogging,
        verboseLoggingChannelId: verboseLoggingChannelId
      });
      
      // Create the welcome embed for the logging channel
      const welcomeEmbed = createEmbed({
        title: `${config.bot.name} Logging System`,
        description: description,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        fields: [
          { name: '🔧 Configuration', value: 'Use `/logs` to configure individual log categories and channels.' },
          { name: '⚠️ Permissions', value: 'Make sure this channel has limited visibility to server staff only.' },
          { name: '🛠️ Additional Setup', value: 'Use `/help` to see all available commands.' }
        ]
      });
      
      // Add modmail info to welcome embed if enabled
      if (enableModmail) {
        welcomeEmbed.addFields({
          name: '📬 Modmail System',
          value: `The modmail system has been enabled. Check ${modmailChannel} for details on how it works.`
        });
      }
      
      // Add verbose logging info to welcome embed if enabled
      if (enableVerboseLogging && verboseLoggingChannelId) {
        try {
          const verboseChannel = await interaction.guild.channels.fetch(verboseLoggingChannelId);
          welcomeEmbed.addFields({
            name: '🔍 Verbose Logging',
            value: `Verbose logging has been enabled. Check ${verboseChannel} for detailed debug logs.`
          });
        } catch (error) {
          logger.error(`Error fetching verbose logging channel: ${error.message}`);
        }
      }
      
      // Send the welcome message to the logging channel
      await loggingChannel.send({ embeds: [welcomeEmbed] });
      
      // Send category selection message
      const categorySelectionEmbed = createEmbed({
        title: 'Log Category Setup',
        description: 'Select which log categories you want to enable or disable:',
        fields: Object.entries(config.logging.categories).map(([key, category]) => ({
          name: `${category.emoji} ${category.name}`,
          value: category.description,
          inline: true
        }))
      });
      
      // Create select menu for categories
      const categorySelect = new SelectMenuBuilder()
        .setCustomId('setup-categories')
        .setPlaceholder('Select categories to configure')
        .setMinValues(1)
        .setMaxValues(Object.keys(config.logging.categories).length)
        .addOptions(Object.entries(config.logging.categories).map(([key, category]) => ({
          label: category.name,
          value: key,
          description: `${category.description.substring(0, 90)}...`,
          emoji: category.emoji,
          default: category.enabled
        })));
      
      const selectRow = new ActionRowBuilder().addComponents(categorySelect);
      
      // Create confirm button
      const confirmButton = new ButtonBuilder()
        .setCustomId('setup-confirm')
        .setLabel('Confirm Setup')
        .setStyle(ButtonStyle.Success);
      
      const buttonRow = new ActionRowBuilder().addComponents(confirmButton);
      
      // Create setup success message
      let setupSuccessMessage = `Logging channel ${loggingChannel} has been set up!`;
      if (enableModmail) {
        setupSuccessMessage += `\nModmail system has been enabled in the ${modmailChannel} channel.`;
      }
      if (enableVerboseLogging && verboseLoggingChannelId) {
        try {
          const verboseChannel = await interaction.guild.channels.fetch(verboseLoggingChannelId);
          setupSuccessMessage += `\nVerbose logging has been enabled in the ${verboseChannel} channel.`;
        } catch (error) {
          logger.error(`Error fetching verbose logging channel: ${error.message}`);
        }
      }
      
      // Update our loading indicator and change to success state
      await loader.updateText("Almost done...");
      
      // Stop the loader with our success components
      await loader.stop({
        text: setupSuccessMessage,
        embeds: [categorySelectionEmbed],
        components: [selectRow, buttonRow],
        success: true
      });
      
      // Track this loader if client supports it
      if (client.activeLoaders) {
        client.activeLoaders.delete(interaction.id);
      }
      
    } catch (error) {
      logger.error(`Error in setup modal handler: ${error.stack || error.message}`);
      
      try {
        // If we have a loader, stop it with error state
        if (loader) {
          await loader.stop({
            text: `An error occurred during setup. Please try again.`,
            success: false
          }).catch(e => {
            logger.error(`Failed to stop loader: ${e.message}`);
          });
        } else {
          // Fallback if loader wasn't available
          // Check if the interaction is still valid and handle accordingly
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [createErrorEmbed(`An error occurred during setup. Please try again.`)],
              ephemeral: true
            }).catch(e => {
              logger.error(`Failed to reply to interaction: ${e.message}`);
            });
          } else if (interaction.deferred) {
            await interaction.editReply({
              embeds: [createErrorEmbed(`An error occurred during setup. Please try again.`)],
              ephemeral: true
            }).catch(e => {
              logger.error(`Failed to edit reply: ${e.message}`);
            });
          }
        }
      } catch (responseError) {
        logger.error(`Critical error in error handler: ${responseError.message}`);
        console.error(`Failed to respond to user after setup error: ${responseError.message}`);
      } finally {
        // Always clean up the loader
        if (client.activeLoaders && client.activeLoaders.has(interaction.id)) {
          client.activeLoaders.delete(interaction.id);
        }
      }
    }
  },
  
  /**
   * Handle select menu interactions
   * @param {Object} interaction - Select menu interaction
   * @param {Object} client - Discord client
   */
  async handleSelectMenu(interaction, client) {
    if (interaction.customId === 'setup-categories') {
      await interaction.deferUpdate();
      
      // Create a loading indicator for category selection
      const loader = new LoadingIndicator({
        text: "Updating log categories...",
        style: this.loadingStyle || "dots",
        color: this.loadingColor || "blue" 
      });
      
      // Start the loader
      await loader.start(interaction);
      
      // Get the selected categories
      const selectedCategories = interaction.values;
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Create enabled categories object
      const enabledCategories = {};
      
      // Set all categories to disabled initially
      Object.keys(config.logging.categories).forEach(category => {
        enabledCategories[category] = selectedCategories.includes(category);
      });
      
      // Update guild settings with enabled categories and track progress
      await guildSettings.update({
        enabledCategories: enabledCategories
      });
      
      // Update setup progress
      await guildSettings.updateSetupProgress(3, { 
        selectedCategories: selectedCategories 
      });
      
      // Update the embed to show selected categories
      const updatedEmbed = createEmbed({
        title: 'Log Category Setup',
        description: 'You have selected the following categories:',
        fields: Object.entries(config.logging.categories)
          .filter(([key]) => selectedCategories.includes(key))
          .map(([key, category]) => ({
            name: `${category.emoji} ${category.name}`,
            value: category.description,
            inline: true
          }))
      });
      
      // Stop the loader with success state
      await loader.stop({
        text: 'Log categories have been updated!',
        embeds: [updatedEmbed],
        components: interaction.message.components,
        success: true
      });
    }
  },
  
  /**
   * Handle button interactions
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    try {
      const customId = interaction.customId;
      
      // Handle setup resume/restart buttons
      if (customId === 'setup-resume') {
        await interaction.deferUpdate().catch(() => logger.warn('Could not defer update for resume button'));
        
        // Get guild settings to continue setup
        const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
        const setupProgress = guildSettings.getSetupProgress();
        
        // Create a new modal for the setup form
        const modal = new ModalBuilder()
          .setCustomId('setup-modal')
          .setTitle('Royal Court Logging Setup');
      
      // Add text input for the main logging channel
      const channelNameInput = new TextInputBuilder()
        .setCustomId('channelName')
        .setLabel('Main logging channel name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.logging.defaultChannelName)
        .setRequired(false)
        .setMaxLength(100);
      
      // Add input for modmail channel
      const modmailChannelInput = new TextInputBuilder()
        .setCustomId('modmailChannel')
        .setLabel('Modmail channel name (optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('modmail-tickets')
        .setRequired(false)
        .setMaxLength(100);
      
      // Add a description field
      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Logging system description (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Add a custom description for your logging system...')
        .setRequired(false)
        .setMaxLength(1000);
      
      // Add toggle for enabling modmail
      const modmailToggleInput = new TextInputBuilder()
        .setCustomId('enableModmail')
        .setLabel('Enable Modmail? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('yes')
        .setRequired(false)
        .setMaxLength(3);
        
      // Add toggle for verbose logging
      const verboseLoggingToggleInput = new TextInputBuilder()
        .setCustomId('enableVerboseLogging')
        .setLabel('Enable Verbose Logging? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('no')
        .setRequired(false)
        .setMaxLength(3);
      
      // Pre-fill the modal with the existing data
      if (guildSettings.setupData.channelName) {
        channelNameInput.setValue(guildSettings.setupData.channelName);
      }
      
      if (guildSettings.setupData.modmailChannel) {
        modmailChannelInput.setValue(guildSettings.setupData.modmailChannel);
      }
      
      if (guildSettings.setupData.description) {
        descriptionInput.setValue(guildSettings.setupData.description);
      }
      
      if (guildSettings.setupData.enableModmail !== undefined) {
        modmailToggleInput.setValue(guildSettings.setupData.enableModmail ? 'yes' : 'no');
      }
      
      if (guildSettings.setupData.enableVerboseLogging !== undefined) {
        verboseLoggingToggleInput.setValue(guildSettings.setupData.enableVerboseLogging ? 'yes' : 'no');
      }
      
      // Add the components to the modal
      const firstActionRow = new ActionRowBuilder().addComponents(channelNameInput);
      const secondActionRow = new ActionRowBuilder().addComponents(modmailChannelInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(modmailToggleInput);
      const fourthActionRow = new ActionRowBuilder().addComponents(verboseLoggingToggleInput);
      const fifthActionRow = new ActionRowBuilder().addComponents(descriptionInput);
      
      // Add inputs to the modal
      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
      
      // Show the modal to continue from where they left off
      await interaction.showModal(modal);
      
    } else if (interaction.customId === 'setup-restart') {
      await interaction.deferUpdate();
      
      // Get guild settings to reset them
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Clear all setup data and progress
      await guildSettings.clearSetupData();
      
      // Start fresh with a new modal
      const modal = new ModalBuilder()
        .setCustomId('setup-modal')
        .setTitle('Monkey Bytes Logging Setup');
      
      // Add text input for the main logging channel
      const channelNameInput = new TextInputBuilder()
        .setCustomId('channelName')
        .setLabel('Main logging channel name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.logging.defaultChannelName)
        .setRequired(false)
        .setMaxLength(100);
      
      // Add input for modmail channel
      const modmailChannelInput = new TextInputBuilder()
        .setCustomId('modmailChannel')
        .setLabel('Modmail channel name (optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('modmail-tickets')
        .setRequired(false)
        .setMaxLength(100);
      
      // Add a description field
      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Logging system description (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Add a custom description for your logging system...')
        .setRequired(false)
        .setMaxLength(1000);
      
      // Add toggle for enabling modmail
      const modmailToggleInput = new TextInputBuilder()
        .setCustomId('enableModmail')
        .setLabel('Enable Modmail? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('yes')
        .setRequired(false)
        .setMaxLength(3);
        
      // Add toggle for verbose logging
      const verboseLoggingToggleInput = new TextInputBuilder()
        .setCustomId('enableVerboseLogging')
        .setLabel('Enable Verbose Logging? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('no')
        .setRequired(false)
        .setMaxLength(3);
      
      // Add the components to the modal
      const firstActionRow = new ActionRowBuilder().addComponents(channelNameInput);
      const secondActionRow = new ActionRowBuilder().addComponents(modmailChannelInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(modmailToggleInput);
      const fourthActionRow = new ActionRowBuilder().addComponents(verboseLoggingToggleInput);
      const fifthActionRow = new ActionRowBuilder().addComponents(descriptionInput);
      
      // Add inputs to the modal
      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
      
      // Update setup progress to step 1 (starting fresh)
      await guildSettings.updateSetupProgress(1);
      
      // Show the modal
      await interaction.showModal(modal);
      
    } else if (interaction.customId === 'setup-confirm') {
      await interaction.deferUpdate();
      
      // Create a loading indicator for the final confirmation
      const loader = new LoadingIndicator({
        text: "Finalizing your setup...",
        style: this.loadingStyle || "pulse",
        color: this.loadingColor || "blue"
      });
      
      // Start the loader by editing the reply
      await loader.start(interaction);
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Mark setup as completed and clear temporary setup data
      await guildSettings.clearSetupData();
      
      // Build success message
      let successMessage = `Setup completed successfully! The logging system is now active.\n\nUse \`/logs\` to manage log channels for each category, \`/ignore\` to configure ignored channels/roles, and \`/help\` to see all available commands.`;
      
      // Add modmail info if enabled
      if (guildSettings.modmailEnabled) {
        successMessage += `\n\n📬 **Modmail System**\nThe modmail system is active. Users can send direct messages to the bot to contact staff. Staff can reply using \`/modmail reply\` in the modmail channels.`;
      }
      
      // Add verbose logging info if enabled
      if (guildSettings.verboseLoggingEnabled) {
        successMessage += `\n\n🔍 **Verbose Logging**\nVerbose logging is enabled. Detailed debug logs will be sent to the verbose logging channel.`;
      }
      
      // Create final success embed
      const finalEmbed = createSuccessEmbed(
        successMessage,
        '✅ Setup Complete'
      );
      
      // Update our loading indicator with progress messages
      await loader.updateText("Writing configuration...");
      
      // Stop the loader with success state
      await loader.stop({
        text: successMessage,
        embeds: [finalEmbed],
        components: [],
        success: true
      });
      
      // Send a message to the logging channel
      if (guildSettings.loggingChannelId) {
        try {
          const loggingChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId);
          
          // Build the setup complete embed fields
          const fields = [
            {
              name: '📝 Log Categories',
              value: 'All enabled log categories will be reported in this channel unless configured otherwise with `/logs`.',
              inline: false
            }
          ];
          
          // Add modmail field if enabled
          if (guildSettings.modmailEnabled && guildSettings.modmailInfoChannelId) {
            try {
              const modmailChannel = await interaction.guild.channels.fetch(guildSettings.modmailInfoChannelId);
              if (modmailChannel) {
                fields.push({
                  name: '📬 Modmail System',
                  value: `The modmail system is active. Check ${modmailChannel} for more information.`,
                  inline: false
                });
              }
            } catch (error) {
              logger.error(`Error fetching modmail channel: ${error.message}`);
            }
          }
          
          // Add verbose logging field if enabled
          if (guildSettings.verboseLoggingEnabled && guildSettings.verboseLoggingChannelId) {
            try {
              const verboseChannel = await interaction.guild.channels.fetch(guildSettings.verboseLoggingChannelId);
              if (verboseChannel) {
                fields.push({
                  name: '🔍 Verbose Logging',
                  value: `Verbose logging is enabled. Detailed debug information will be sent to ${verboseChannel}.`,
                  inline: false
                });
              }
            } catch (error) {
              logger.error(`Error fetching verbose logging channel: ${error.message}`);
            }
          }
          
          const setupCompleteEmbed = createEmbed({
            title: `${config.bot.name} Logging System Active`,
            description: `The logging system has been configured by ${interaction.user}.`,
            color: '#77B255',
            timestamp: true,
            fields: fields
          });
          
          await loggingChannel.send({ embeds: [setupCompleteEmbed] });
        } catch (error) {
          logger.error(`Error sending confirmation to logging channel: ${error.message}`);
        }
      }
    } // End of if-else chain for customId
    
    // Handle any reset-specific buttons
    if (customId === 'setup-reset-confirm') {
      // Reset all settings to default
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Reset all settings
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
    } else if (customId === 'setup-reset-cancel') {
      // Cancel the reset operation
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
