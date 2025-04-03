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
    .addChannelOption(option => 
      option.setName('logs_channel')
        .setDescription('Channel for bot logs (required)')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption(option =>
      option.setName('verbose_logging')
        .setDescription('Enable verbose logging')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('reset')
        .setDescription('Reset all settings (overrides other options)')
        .setRequired(false)
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
      
      await interaction.deferReply({ ephemeral: true });
      
      // Check if this is a reset operation
      const reset = interaction.options.getBoolean('reset');
      if (reset) {
        return await this.handleReset(interaction, client, guildSettings);
      }
      
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
        logger.error(`Error in setup: ${error.message}`);
        await interaction.editReply({
          embeds: [createErrorEmbed(`Setup error: ${error.message}`)]
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
        } else {
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
   * Handle the reset operation
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
      // Get guild settings from database
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      switch (interaction.customId) {
        case 'setup-finish':
          // Handle finish setup button
          await interaction.update({
            embeds: [createSuccessEmbed(
              "Setup completed successfully!",
              "Setup Complete"
            )],
            components: []
          });
          break;
          
        case 'setup-modmail':
          // Redirect to modmail setup
          await interaction.reply({
            embeds: [createEmbed({
              title: '📬 Modmail Setup',
              description: 'Please use the `/modmail-setup` command to configure the modmail system.',
              color: '#5865F2'
            })],
            ephemeral: true
          });
          break;
          
        case 'setup-reset-confirm':
          // Reset guild settings
          await guildSettings.update({
            loggingChannelId: null,
            modmailEnabled: false,
            modmailCategoryId: null,
            modmailInfoChannelId: null,
            categoryChannels: {},
            ignoredChannels: [],
            ignoredRoles: [],
            enabledCategories: {},
            setupCompleted: false,
            setupProgress: 0,
            setupData: {},
            verboseLoggingEnabled: false,
            verboseLoggingChannelId: null
          });
          
          // Respond to the user
          await interaction.update({
            embeds: [createSuccessEmbed(
              "All bot settings have been reset to default values.",
              "Reset Complete"
            )],
            components: []
          });
          break;
          
        case 'setup-reset-cancel':
          // Cancel reset
          await interaction.update({
            embeds: [createEmbed({
              title: "Reset Cancelled",
              description: "The reset operation has been cancelled. Your settings remain unchanged.",
              color: "#00FF00" // Green
            })],
            components: []
          });
          break;
          
        default:
          // Handle unknown button
          logger.warn(`Unknown button ID for setup: ${interaction.customId}`);
          await interaction.reply({
            embeds: [createErrorEmbed("Unknown button interaction.")],
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error(`Error handling button interaction: ${error.message}`);
      await interaction.reply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
        ephemeral: true
      }).catch(err => logger.error(`Failed to reply with error: ${err.message}`));
    }
  }
};