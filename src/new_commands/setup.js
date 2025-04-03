const { 
  SlashCommandBuilder,
  ActionRowBuilder, 
  PermissionsBitField, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { models } = require('../database/db');
const config = require('../config');

module.exports = {
  cooldown: 10, // 10 seconds cooldown for setup commands
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the bot features for your server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('wizard')
        .setDescription('Start the setup wizard for your server')
        .addChannelOption(option => 
          option.setName('logs_channel')
            .setDescription('Channel for bot logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(option =>
          option.setName('verbose_logging')
            .setDescription('Enable verbose logging')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('Configure the logging settings')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('Channel for logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(option =>
          option.setName('verbose')
            .setDescription('Enable verbose logging')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset all bot settings to default')
    ),
  
  async execute(interaction, client) {
    try {
      // Check if user is guild owner or has admin permission
      if (interaction.user.id !== interaction.guild.ownerId && 
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Only the server owner or administrators can use this command.')],
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
          await this.handleWizard(interaction, client, guildSettings);
          break;
          
        case 'logs':
          await this.handleLogs(interaction, client, guildSettings);
          break;
          
        case 'reset':
          await this.handleReset(interaction, client, guildSettings);
          break;
          
        default:
          await interaction.reply({
            embeds: [createErrorEmbed('Unknown subcommand.')],
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error(`Error executing setup command: ${error.message}`);
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
            ephemeral: true
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
          });
        }
      } catch (replyError) {
        logger.error(`Failed to reply with error: ${replyError.message}`);
      }
    }
  },
  
  /**
   * Handle the wizard subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleWizard(interaction, client, guildSettings) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get options from the slash command
      const logsChannel = interaction.options.getChannel('logs_channel');
      const verboseLogging = interaction.options.getBoolean('verbose_logging') ?? false;
      
      // Check permissions in the log channel
      const permissions = logsChannel.permissionsFor(interaction.guild.members.me);
      if (!permissions.has(PermissionsBitField.Flags.SendMessages) || 
          !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
        await interaction.editReply({
          embeds: [createErrorEmbed('I don\'t have permission to send messages and embeds in that channel. Please adjust the permissions or choose another channel.')]
        });
        return;
      }
      
      // Update logging settings
      await guildSettings.update({
        loggingChannelId: logsChannel.id,
        setupCompleted: true,
        verboseLoggingEnabled: verboseLogging
      });
      
      // Create setup result embed
      const embed = createSuccessEmbed(
        `Setup initiated for ${interaction.guild.name}`,
        "Setup Wizard"
      );
      
      embed.addFields(
        { name: "📋 Logging Channel", value: `${logsChannel}`, inline: false },
        { name: "📊 Verbose Logging", value: verboseLogging ? "Enabled" : "Disabled", inline: false }
      );
      
      // Setup verbose logging if enabled
      let verboseChannel = null;
      if (verboseLogging) {
        try {
          // Create a verbose logging channel
          const verboseChannelName = `${logsChannel.name}-verbose`;
          verboseChannel = await interaction.guild.channels.create({
            name: verboseChannelName,
            type: ChannelType.GuildText,
            topic: `Verbose Logging Channel | All debug and detailed logs`,
            reason: 'Bot Logging System Setup - Verbose Logging'
          });
          
          await guildSettings.update({
            verboseLoggingEnabled: true,
            verboseLoggingChannelId: verboseChannel.id
          });
          
          // Welcome message for verbose logging channel
          const verboseWelcomeEmbed = createEmbed({
            title: '🔍 Verbose Logging Channel',
            description: 'This channel contains detailed debug logs and additional information not included in the main logging channel.',
            color: '#5865F2',
            timestamp: true
          });
          
          await verboseChannel.send({ embeds: [verboseWelcomeEmbed] });
          embed.addFields({ name: "🔍 Verbose Channel", value: `${verboseChannel}`, inline: false });
        } catch (error) {
          logger.error(`Error setting up verbose logging: ${error.message}`);
          embed.addFields({ name: "🔍 Verbose Logging Error", value: `❌ ${error.message}`, inline: false });
        }
      }
      
      // Send test message to log channel
      await logsChannel.send({
        embeds: [createEmbed({
          title: "📊 Logging System Configured",
          description: `This channel has been set up to receive log messages from the bot.\n\nSet up by: ${interaction.user}`,
          fields: [
            { name: "Setup Date", value: new Date().toISOString() }
          ]
        })]
      });
      
      // Create a confirmation button and add hint about modmail
      const finishButton = new ButtonBuilder()
        .setCustomId('setup-finish')
        .setLabel('Finish Setup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
      
      const modmailButton = new ButtonBuilder()
        .setCustomId('setup-modmail')
        .setLabel('Setup Modmail')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📬');
      
      const row = new ActionRowBuilder().addComponents(finishButton, modmailButton);
      
      // Add hint about modmail setup
      embed.addFields({
        name: "📬 Need Modmail?",
        value: "Use the `/modmail-setup` command to configure the modmail system separately, or click the button below.",
        inline: false
      });
      
      // Respond to the user
      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      logger.error(`Error in setup wizard: ${error.message}`);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Setup error: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle the logs subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleLogs(interaction, client, guildSettings) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const channel = interaction.options.getChannel('channel');
      const verbose = interaction.options.getBoolean('verbose') ?? false;
      
      // Check permissions in the log channel
      const permissions = channel.permissionsFor(interaction.guild.members.me);
      if (!permissions.has(PermissionsBitField.Flags.SendMessages) || 
          !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
        await interaction.editReply({
          embeds: [createErrorEmbed('I don\'t have permission to send messages and embeds in that channel. Please adjust the permissions or choose another channel.')]
        });
        return;
      }
      
      // Update the logging channel in database
      await guildSettings.update({
        loggingChannelId: channel.id,
        setupCompleted: true,
        verboseLoggingEnabled: verbose
      });
      
      // Create response embed
      const embed = createSuccessEmbed(
        `Logging channel has been set to ${channel}`,
        "Logging Setup"
      );
      
      embed.addFields(
        { name: "📊 Verbose Logging", value: verbose ? "Enabled" : "Disabled", inline: false }
      );
      
      // Setup verbose logging if enabled
      if (verbose) {
        try {
          // Create a verbose logging channel
          const verboseChannelName = `${channel.name}-verbose`;
          const verboseChannel = await interaction.guild.channels.create({
            name: verboseChannelName,
            type: ChannelType.GuildText,
            topic: `Verbose Logging Channel | All debug and detailed logs`,
            reason: 'Bot Logging System Setup - Verbose Logging'
          });
          
          await guildSettings.update({
            verboseLoggingEnabled: true,
            verboseLoggingChannelId: verboseChannel.id
          });
          
          // Send info message to the verbose channel
          await verboseChannel.send({
            embeds: [createEmbed({
              title: '🔍 Verbose Logging Channel',
              description: 'This channel contains detailed debug logs and additional information.',
              color: '#5865F2',
              timestamp: true
            })]
          });
          
          embed.addFields({ name: "🔍 Verbose Channel", value: `${verboseChannel}`, inline: false });
        } catch (error) {
          logger.error(`Error setting up verbose logging channel: ${error.message}`);
          embed.addFields({ name: "Error", value: `Failed to create verbose logging channel: ${error.message}`, inline: false });
        }
      }
      
      // Send a test message to confirm it's working
      await channel.send({
        embeds: [createEmbed({
          title: "📊 Logging Channel Configured",
          description: `This channel has been set as the logging channel.\n\nSet up by: ${interaction.user}`,
          fields: [
            { name: "Setup Date", value: new Date().toISOString() }
          ]
        })]
      });
      
      // Respond to the user
      await interaction.editReply({
        embeds: [embed]
      });
    } catch (error) {
      logger.error(`Error setting up logging channel: ${error.message}`);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Failed to set up logging channel: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle the reset subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleReset(interaction, client, guildSettings) {
    try {
      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId('setup-reset-confirm')
        .setLabel('Confirm Reset')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️');
      
      const cancelButton = new ButtonBuilder()
        .setCustomId('setup-reset-cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
      
      // Send confirmation message
      await interaction.editReply({
        embeds: [createEmbed({
          title: "⚠️ Reset Confirmation",
          description: "Are you sure you want to reset all bot settings for this server?",
          fields: [
            { name: "Warning", value: "This action will reset all logging settings. It cannot be undone." }
          ],
          color: "#FF0000" // Red
        })],
        components: [row]
      });
    } catch (error) {
      logger.error(`Error initiating reset: ${error.message}`);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Failed to initiate reset: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle button interactions for this command
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    try {
      const customId = interaction.customId;
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      if (customId === 'setup-finish') {
        await interaction.reply({
          embeds: [createSuccessEmbed('Setup completed successfully!', 'Setup Complete')],
          ephemeral: true
        });
      } else if (customId === 'setup-modmail') {
        // Redirect to modmail setup
        await interaction.reply({
          embeds: [createEmbed({
            title: '📬 Modmail Setup',
            description: 'Please use the `/modmail-setup` command to configure the modmail system.',
            color: '#5865F2'
          })],
          ephemeral: true
        });
      } else if (customId === 'setup-reset-confirm') {
        // Reset all guild settings
        await guildSettings.update({
          setupCompleted: false,
          loggingChannelId: null,
          verboseLoggingEnabled: false,
          verboseLoggingChannelId: null
        });
        
        await interaction.reply({
          embeds: [createSuccessEmbed('All bot settings have been reset. Please run `/setup` again to reconfigure the bot.', 'Reset Complete')],
          ephemeral: true
        });
      } else if (customId === 'setup-reset-cancel') {
        await interaction.reply({
          embeds: [createEmbed({
            title: '❌ Reset Cancelled',
            description: 'The reset operation has been cancelled.',
            color: '#5865F2'
          })],
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error(`Error handling button interaction: ${error.message}`);
      await interaction.reply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
        ephemeral: true
      });
    }
  }
};