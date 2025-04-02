const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  cooldown: 5, // 5 seconds cooldown
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display help information about the bot and its commands')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Command category to get help for')
        .setRequired(false)
        .addChoices(
          { name: '📊 Setup & Configuration', value: 'setup' },
          { name: '⚙️ Management Commands', value: 'management' },
          { name: 'ℹ️ Information Commands', value: 'info' },
          { name: '📝 Logging Features', value: 'logging' }
        )
    ),
  
  async execute(interaction, client) {
    const category = interaction.options.getString('category');
    
    if (category) {
      // Show specific category help
      switch (category) {
        case 'setup':
          await this.showSetupHelp(interaction);
          break;
        case 'management':
          await this.showManagementHelp(interaction);
          break;
        case 'info':
          await this.showInfoHelp(interaction);
          break;
        case 'logging':
          await this.showLoggingHelp(interaction);
          break;
        default:
          await this.showMainHelp(interaction, client);
      }
    } else {
      // Show main help menu
      await this.showMainHelp(interaction, client);
    }
  },
  
  /**
   * Display the main help menu
   * @param {Object} interaction - Discord interaction object
   * @param {Object} client - Discord client instance
   */
  async showMainHelp(interaction, client) {
    // Create the main help embed
    const embed = createEmbed({
      title: `${config.bot.name} - ${config.bot.slogan}`,
      description: `Welcome to the Royal Court logging system! Here's how to use your new logging bot.`,
      thumbnail: client.user.displayAvatarURL({ dynamic: true }),
      fields: [
        {
          name: '📊 Setup & Configuration',
          value: '`/setup` - Initial bot setup (admin only)\n`/logs` - Configure logging channels',
          inline: false
        },
        {
          name: '⚙️ Management Commands',
          value: '`/enable` - Enable a log category\n`/disable` - Disable a log category\n`/categories` - Manage all categories\n`/ignore` - Configure ignored channels/roles',
          inline: false
        },
        {
          name: 'ℹ️ Information Commands',
          value: '`/help` - Show this help menu\n`/ping` - Check bot latency\n`/stats` - View bot statistics',
          inline: false
        },
        {
          name: '📝 Logging Features',
          value: 'Use `/help logging` to see all tracked events',
          inline: false
        }
      ],
      footer: `${config.bot.name} v${config.bot.version}`
    });
    
    // Create buttons for category navigation
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help-setup')
          .setLabel('Setup Guide')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('help-management')
          .setLabel('Management')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('help-info')
          .setLabel('Information')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('ℹ️'),
        new ButtonBuilder()
          .setCustomId('help-logging')
          .setLabel('Logging Features')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📝')
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [row]
      // /* Removed ephemeral: false to avoid warnings */ is default behavior, removed to avoid deprecation warning
    });
  },
  
  /**
   * Display setup help information
   * @param {Object} interaction - Discord interaction object
   */
  async showSetupHelp(interaction) {
    const embed = createEmbed({
      title: '📊 Setup & Configuration Guide',
      description: 'Learn how to set up and configure the logging system.',
      fields: [
        {
          name: '/setup',
          value: 'Initialize the logging system for your server. This will create a logging channel and guide you through the initial configuration. (Admin only)',
          inline: false
        },
        {
          name: '/logs view',
          value: 'View your current logging configuration, including which categories are enabled and which channels they log to.',
          inline: false
        },
        {
          name: '/logs setchannel',
          value: 'Assign a specific channel to receive logs for a particular category. Useful for separating different types of logs.',
          inline: false
        },
        {
          name: '/logs reset',
          value: 'Reset a category to use the main logging channel instead of a custom one.',
          inline: false
        },
        {
          name: 'Best Practices',
          value: '• Create separate channels for high-volume logs like message or voice logs\n• Limit access to log channels to server staff only\n• Use `/ignore` to exclude bot-heavy channels from message logging',
          inline: false
        }
      ],
      footer: 'All setup commands require Administrator permission'
    });
    
    await interaction.reply({
      embeds: [embed],
      /* Removed ephemeral: false to avoid warnings */
    });
  },
  
  /**
   * Display management command help
   * @param {Object} interaction - Discord interaction object
   */
  async showManagementHelp(interaction) {
    const embed = createEmbed({
      title: '⚙️ Management Commands',
      description: 'These commands help you manage your logging system after initial setup.',
      fields: [
        {
          name: '/enable [category]',
          value: 'Enable a specific logging category that was previously disabled.',
          inline: false
        },
        {
          name: '/disable [category]',
          value: 'Disable a specific logging category to stop receiving those types of logs.',
          inline: false
        },
        {
          name: '/categories',
          value: 'Manage all log categories at once with a simple selection menu.',
          inline: false
        },
        {
          name: '/ignore channel [channel]',
          value: 'Exclude a specific channel from being logged. Good for bot-spam channels.',
          inline: false
        },
        {
          name: '/ignore role [role]',
          value: 'Exclude users with a specific role from being logged. Good for bots or automated roles.',
          inline: false
        },
        {
          name: '/ignore list',
          value: 'View all currently ignored channels and roles.',
          inline: false
        }
      ],
      footer: 'All management commands require Administrator permission'
    });
    
    await interaction.reply({
      embeds: [embed],
      /* Removed ephemeral: false to avoid warnings */
    });
  },
  
  /**
   * Display information command help
   * @param {Object} interaction - Discord interaction object
   */
  async showInfoHelp(interaction) {
    const embed = createEmbed({
      title: 'ℹ️ Information Commands',
      description: 'Commands that provide information about the bot and its status.',
      fields: [
        {
          name: '/help [category]',
          value: 'Display help information about the bot and its commands. Optionally specify a category for more detailed help.',
          inline: false
        },
        {
          name: '/ping',
          value: 'Check the bot\'s response time and WebSocket latency. Useful for troubleshooting.',
          inline: false
        },
        {
          name: '/stats',
          value: 'View detailed statistics about the bot, including uptime, server count, memory usage, and logging activity.',
          inline: false
        }
      ],
      footer: 'Information commands can be used by any member'
    });
    
    await interaction.reply({
      embeds: [embed],
      /* Removed ephemeral: false to avoid warnings */
    });
  },
  
  /**
   * Display logging features help
   * @param {Object} interaction - Discord interaction object
   */
  async showLoggingHelp(interaction) {
    const embed = createEmbed({
      title: '📝 Logging Features',
      description: 'Here\'s everything that the bot can track and log in your server:',
      fields: [
        {
          name: `${config.logging.categories.MESSAGES.emoji} Message Logs`,
          value: '• Message edits\n• Message deletions\n• Bulk message deletions\n• Attachments and embeds',
          inline: true
        },
        {
          name: `${config.logging.categories.MEMBERS.emoji} Member Logs`,
          value: '• Join/leave tracking\n• Nickname changes\n• Role changes\n• Timeouts/mutes\n• Server boosts',
          inline: true
        },
        {
          name: `${config.logging.categories.VOICE.emoji} Voice Logs`,
          value: '• Voice channel joins\n• Voice channel leaves\n• Channel switching\n• Mute/deafen status\n• Streaming status',
          inline: true
        },
        {
          name: `${config.logging.categories.ROLES.emoji} Role Logs`,
          value: '• Role creation\n• Role deletion\n• Role updates\n• Permission changes',
          inline: true
        },
        {
          name: `${config.logging.categories.CHANNELS.emoji} Channel Logs`,
          value: '• Channel creation\n• Channel deletion\n• Channel updates\n• Permission overwrites',
          inline: true
        },
        {
          name: `${config.logging.categories.SERVER.emoji} Server Logs`,
          value: '• Server setting changes\n• Emoji updates\n• Webhook creation\n• Integration changes',
          inline: true
        }
      ],
      footer: 'Use /logs to configure which channel receives each type of log'
    });
    
    await interaction.reply({
      embeds: [embed],
      /* Removed ephemeral: false to avoid warnings */
    });
  },
  
  /**
   * Handle button interactions
   * @param {Object} interaction - Button interaction object
   * @param {Object} client - Discord client instance
   */
  async handleButton(interaction, client) {
    // Handle help navigation buttons
    switch (interaction.customId) {
      case 'help-setup':
        await this.showSetupHelp(interaction);
        break;
      case 'help-management':
        await this.showManagementHelp(interaction);
        break;
      case 'help-info':
        await this.showInfoHelp(interaction);
        break;
      case 'help-logging':
        await this.showLoggingHelp(interaction);
        break;
      default:
        await interaction.reply({
          content: 'Unknown button interaction',
          ephemeral: true
        });
    }
  }
};
