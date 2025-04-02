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
          option.setName('enable_modmail')
            .setDescription('Enable modmail system')
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
            .addChannelTypes(ChannelType.GuildText)
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
      let subcommand;
      try {
        subcommand = interaction.options.getSubcommand();
      } catch (error) {
        // No subcommand specified, show help message
        const embed = createEmbed({
          title: '⚙️ Bot Setup',
          description: 'Please specify a subcommand to configure the bot.',
          color: '#3498db',
          fields: [
            { name: '`/setup wizard`', value: 'Start the step-by-step setup wizard' },
            { name: '`/setup logs`', value: 'Configure logging channels' },
            { name: '`/setup modmail`', value: 'Configure the modmail system' },
            { name: '`/setup reset`', value: 'Reset bot configuration' }
          ]
        });
        
        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        return;
      }
      
      switch (subcommand) {
        case 'wizard':
          await this.handleWizard(interaction, client, guildSettings);
          break;
          
        case 'logs':
          await this.handleLogs(interaction, client, guildSettings);
          break;
          
        case 'modmail':
          await this.handleModmail(interaction, client, guildSettings);
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
      await interaction.reply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
        ephemeral: true
      }).catch(e => logger.error(`Failed to reply with error: ${e.message}`));
    }
  },
  
  /**
   * Handle the setup wizard subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleWizard(interaction, client, guildSettings) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get options from the slash command
      const logsChannel = interaction.options.getChannel('logs_channel');
      const enableModmail = interaction.options.getBoolean('enable_modmail') ?? false;
      
      // Update logging settings
      await guildSettings.update({
        loggingChannelId: logsChannel.id,
        setupCompleted: true
      });
      
      // Create initial embed
      const embed = createSuccessEmbed(
        `Setup initiated for ${interaction.guild.name}`,
        "Setup Wizard"
      );
      
      embed.addFields(
        { name: "📋 Logging Channel", value: `${logsChannel}`, inline: false },
        { name: "📬 Modmail", value: enableModmail ? "Enabled" : "Disabled", inline: false }
      );
      
      // Check if modmail should be enabled
      if (enableModmail) {
        try {
          // Create a modmail category if one doesn't exist
          const category = await interaction.guild.channels.create({
            name: 'Modmail Tickets',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: interaction.guild.members.me.id,
                allow: [PermissionsBitField.Flags.ViewChannel]
              }
            ]
          });
          
          // Create an info channel
          const infoChannel = await interaction.guild.channels.create({
            name: 'modmail-info',
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: interaction.guild.members.me.id,
                allow: [PermissionsBitField.Flags.ViewChannel]
              }
            ]
          });
          
          // Update guild settings with modmail info
          await guildSettings.update({
            modmailEnabled: true,
            modmailCategoryId: category.id,
            modmailInfoChannelId: infoChannel.id
          });
          
          // Send info to the modmail info channel
          await infoChannel.send({
            embeds: [createEmbed({
              title: "📬 Modmail System Info",
              description: "This channel will display information about modmail conversations.",
              fields: [
                { name: "How It Works", value: "Users can DM the bot to contact server moderators." },
                { name: "Setup Info", value: `Set up by: ${interaction.user}\nSetup Date: ${new Date().toISOString()}` }
              ]
            })]
          });
          
          embed.addFields({ name: "📬 Modmail Setup", value: "✅ Modmail has been set up successfully!", inline: false });
        } catch (error) {
          logger.error(`Error setting up modmail: ${error.message}`);
          embed.addFields({ name: "📬 Modmail Setup Error", value: `❌ ${error.message}`, inline: false });
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
      
      // Create a confirmation button
      const finishButton = new ButtonBuilder()
        .setCustomId('setup-finish')
        .setLabel('Finish Setup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
      
      const row = new ActionRowBuilder().addComponents(finishButton);
      
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
      
      // Update the logging channel in database
      await guildSettings.update({
        loggingChannelId: channel.id,
        setupCompleted: true
      });
      
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
        embeds: [createSuccessEmbed(
          `Logging channel has been set to ${channel}.`,
          "Logging Setup"
        )]
      });
    } catch (error) {
      logger.error(`Error setting up logging channel: ${error.message}`);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Failed to set up logging channel: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle the modmail subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleModmail(interaction, client, guildSettings) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      
      if (enabled) {
        // Set up modmail system
        let category;
        let infoChannel = channel;
        
        // If no channel is provided or if there's no existing modmail category
        if (!infoChannel || !guildSettings.modmailCategoryId) {
          // Create a new category
          category = await interaction.guild.channels.create({
            name: 'Modmail Tickets',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: interaction.guild.members.me.id,
                allow: [PermissionsBitField.Flags.ViewChannel]
              }
            ]
          });
          
          // Only create an info channel if one wasn't provided
          if (!infoChannel) {
            infoChannel = await interaction.guild.channels.create({
              name: 'modmail-info',
              type: ChannelType.GuildText,
              parent: category,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: interaction.guild.members.me.id,
                  allow: [PermissionsBitField.Flags.ViewChannel]
                }
              ]
            });
          } else if (category) {
            // If a channel was provided but we created a new category
            await infoChannel.setParent(category.id, { lockPermissions: false });
          }
        }
        
        // Update guild settings
        await guildSettings.update({
          modmailEnabled: true,
          modmailCategoryId: category?.id || guildSettings.modmailCategoryId,
          modmailInfoChannelId: infoChannel.id
        });
        
        // Send info to the modmail info channel
        await infoChannel.send({
          embeds: [createEmbed({
            title: "📬 Modmail System Info",
            description: "This channel will display information about modmail conversations.",
            fields: [
              { name: "How It Works", value: "Users can DM the bot to contact server moderators." },
              { name: "Setup Info", value: `Set up by: ${interaction.user}\nSetup Date: ${new Date().toISOString()}` }
            ]
          })]
        });
        
        // Respond to the user
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            `Modmail system has been enabled. Info channel: ${infoChannel}`,
            "Modmail Setup"
          )]
        });
      } else {
        // Disable modmail system
        await guildSettings.update({
          modmailEnabled: false
        });
        
        // Respond to the user
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            "Modmail system has been disabled.",
            "Modmail Setup"
          )]
        });
      }
    } catch (error) {
      logger.error(`Error setting up modmail: ${error.message}`);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Failed to set up modmail: ${error.message}`)]
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
    await interaction.deferReply({ ephemeral: true });
    
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
            { name: "Warning", value: "This action will reset all logging and modmail settings. It cannot be undone." }
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
  }
};