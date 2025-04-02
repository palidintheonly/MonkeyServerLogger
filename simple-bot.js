// Simple Discord.js bot without sharding
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { logger } = require('./src/utils/logger');

// Import necessary permissions
const { PermissionFlagsBits } = require('discord.js');

// Define all slash commands based on the original command structure
const commands = [
  // Info Commands
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with bot latency'),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Get information about the bot'),
    
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Get information about the server'),
    
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows available commands and bot features'),
    
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invite link for the bot'),
    
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display bot statistics and performance metrics'),
  
  // Management Commands
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the logging system for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure logging settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand => 
      subcommand
        .setName('view')
        .setDescription('View current logging configuration'))
    .addSubcommand(subcommand => 
      subcommand
        .setName('setchannel')
        .setDescription('Set a custom logging channel for a category')
        .addStringOption(option => 
          option.setName('category')
            .setDescription('The log category to configure')
            .setRequired(true))
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('The channel to send logs to')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('reset')
        .setDescription('Reset logging configuration to defaults')),
    
  new SlashCommandBuilder()
    .setName('categories')
    .setDescription('Manage log categories')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand => 
      subcommand
        .setName('list')
        .setDescription('List available log categories'))
    .addSubcommand(subcommand => 
      subcommand
        .setName('enable')
        .setDescription('Enable a log category')
        .addStringOption(option => 
          option.setName('category')
            .setDescription('The category to enable')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('disable')
        .setDescription('Disable a log category')
        .addStringOption(option => 
          option.setName('category')
            .setDescription('The category to disable')
            .setRequired(true))),
            
  new SlashCommandBuilder()
    .setName('ignore')
    .setDescription('Configure channels, roles, or users to ignore for logging')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand => 
      subcommand
        .setName('channel')
        .setDescription('Ignore or unignore a channel for logging')
        .addChannelOption(option => 
          option.setName('channel')
            .setDescription('The channel to ignore/unignore')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('role')
        .setDescription('Ignore or unignore a role for logging')
        .addRoleOption(option => 
          option.setName('role')
            .setDescription('The role to ignore/unignore')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('list')
        .setDescription('List all ignored channels and roles')),
        
  new SlashCommandBuilder()
    .setName('enable')
    .setDescription('Enable the bot in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder()
    .setName('disable')
    .setDescription('Disable the bot in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Manage the modmail system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand => 
      subcommand
        .setName('reply')
        .setDescription('Reply to a modmail thread')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The user to reply to')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('close')
        .setDescription('Close a modmail thread')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The user whose thread to close')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('reason')
            .setDescription('The reason for closing the thread')
            .setRequired(false)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('block')
        .setDescription('Block a user from using modmail')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The user to block')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('reason')
            .setDescription('The reason for blocking the user')
            .setRequired(false)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('unblock')
        .setDescription('Unblock a user from using modmail')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('The user to unblock')
            .setRequired(true)))
];

// Create a simple client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Log when ready
client.once('ready', async () => {
  logger.info('==================================================');
  logger.info('Simple bot is ready!');
  logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
  logger.info(`Serving ${client.guilds.cache.size} servers`);
  logger.info('==================================================');
  
  // Set activity
  client.user.setPresence({
    activities: [{ name: 'with Loading Animations & Enhanced Logging | /help', type: ActivityType.Playing }],
    status: 'online'
  });
  
  // Initialize activeLoaders collection for tracking loading indicators
  client.activeLoaders = new Map();
  logger.info('Animated loading indicators initialized for interactive commands');
  
  // Log guilds the bot is in
  logger.info('Bot is in the following guilds:');
  client.guilds.cache.forEach(guild => {
    logger.info(`- ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
  });
  
  // Log application commands
  try {
    const commands = await client.application.commands.fetch();
    logger.info(`Bot has ${commands.size} registered global commands:`);
    commands.forEach(cmd => {
      logger.info(`- ${cmd.name}: ${cmd.description}`);
    });
  } catch (error) {
    logger.error('Failed to fetch application commands:', error);
  }
  
  // Minimal HTTP server for Replit health check only
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Discord bot is running!');
  });
  
  server.listen(9000, '0.0.0.0', () => {
    logger.info('Health check server running on port 9000');
  });
});

// Handle errors
client.on('error', error => {
  logger.error('Discord client error:', error);
});

// Log disconnect events
client.on('disconnect', () => {
  logger.warn('Bot disconnected from Discord');
});

// Log reconnecting events
client.on('reconnecting', () => {
  logger.info('Bot reconnecting to Discord');
});

// Process error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
});

// Add command handler
client.on('interactionCreate', async interaction => {
  // Log all interactions for debugging
  logger.info(`Received interaction: ${interaction.type} from ${interaction.user.tag} (${interaction.user.id})`);
  
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    logger.info(`Slash command executed: /${commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
    
    try {
      switch (commandName) {
        case 'ping':
          logger.info(`Executing ping command for ${interaction.user.tag}`);
          const sent = await interaction.reply({ content: 'Measuring ping...', fetchReply: true });
          const pingTime = sent.createdTimestamp - interaction.createdTimestamp;
          await interaction.editReply(`Bot Latency: ${pingTime}ms | API Latency: ${Math.round(client.ws.ping)}ms`);
          logger.info(`Ping command completed: ${pingTime}ms latency`);
          break;
          
        case 'info':
          logger.info(`Executing info command for ${interaction.user.tag}`);
          const uptimeMinutes = Math.floor(client.uptime / 60000);
          const uptimeHours = Math.floor(uptimeMinutes / 60);
          const uptimeDays = Math.floor(uptimeHours / 24);
          
          const uptimeFormatted = uptimeDays > 0 
            ? `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m` 
            : uptimeHours > 0 
              ? `${uptimeHours}h ${uptimeMinutes % 60}m` 
              : `${uptimeMinutes}m`;
              
          await interaction.reply({
            content: [
              `**Bot Info**`,
              `Name: ${client.user.tag}`,
              `ID: ${client.user.id}`,
              `Uptime: ${uptimeFormatted}`,
              `Servers: ${client.guilds.cache.size}`,
              `Users: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`,
              `Discord.js: v14`,
              `Node.js: ${process.version}`
            ].join('\n'),
            ephemeral: true
          });
          logger.info(`Info command completed for ${interaction.user.tag}`);
          break;
          
        case 'serverinfo':
          logger.info(`Executing serverinfo command for ${interaction.user.tag} in ${interaction.guild.name}`);
          const guild = interaction.guild;
          
          // Count members by status
          const totalMembers = guild.memberCount;
          
          // Get verification level in a readable format
          const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Very High'
          };
          
          await interaction.reply({
            content: [
              `**Server Info**`,
              `Name: ${guild.name}`,
              `ID: ${guild.id}`,
              `Owner: <@${guild.ownerId}>`,
              `Members: ${totalMembers}`,
              `Channels: ${guild.channels.cache.size} (${guild.channels.cache.filter(c => c.type === 0).size} text, ${guild.channels.cache.filter(c => c.type === 2).size} voice)`,
              `Roles: ${guild.roles.cache.size}`,
              `Verification Level: ${verificationLevels[guild.verificationLevel]}`,
              `Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`
            ].join('\n')
          });
          logger.info(`Serverinfo command completed for ${interaction.user.tag}`);
          break;
          
        case 'help':
          logger.info(`Executing help command for ${interaction.user.tag}`);
          
          // Group commands by category for better organization
          const helpEmbed = {
            title: '🤖 The Royal Court Bot - Help Menu',
            description: 'Here are all the available commands:',
            color: 0x5865F2,
            fields: [
              {
                name: '📊 Information Commands',
                value: [
                  '`/ping` - Check the bot\'s response time',
                  '`/info` - Get information about the bot',
                  '`/serverinfo` - Get information about the server',
                  '`/stats` - View bot statistics',
                  '`/invite` - Get an invite link for the bot',
                  '`/help` - Show this help menu'
                ].join('\n'),
                inline: false
              },
              {
                name: '⚙️ Setup & Management',
                value: [
                  '`/setup` - Initial bot setup (Admin only)',
                  '`/enable` - Enable bot functionality',
                  '`/disable` - Disable bot functionality'
                ].join('\n'),
                inline: false
              },
              {
                name: '📝 Logging Configuration',
                value: [
                  '`/logs view` - View current logging settings',
                  '`/logs setchannel` - Set custom log channels',
                  '`/logs reset` - Reset to default settings',
                  '`/categories` - Manage logging categories',
                  '`/ignore` - Configure ignored channels/roles'
                ].join('\n'),
                inline: false
              },
              {
                name: '📬 Modmail System',
                value: [
                  '`/modmail reply` - Reply to a user\'s modmail',
                  '`/modmail close` - Close a modmail thread',
                  '`/modmail block` - Block a user from modmail',
                  '`/modmail unblock` - Unblock a user from modmail'
                ].join('\n'),
                inline: false
              },
              {
                name: '🔗 Need More Help?',
                value: 'For detailed usage instructions, use each command\'s built-in help options or contact the bot owner.',
                inline: false
              }
            ],
            footer: {
              text: 'The Royal Court Bot • Made with ❤️'
            }
          };
          
          await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
          logger.info(`Help command completed for ${interaction.user.tag}`);
          break;
          
        case 'invite':
          logger.info(`Executing invite command for ${interaction.user.tag}`);
          
          const inviteEmbed = {
            title: '🔗 Invite The Royal Court Bot',
            description: 'Click the button below to add this bot to your own server!',
            color: 0x5865F2,
            fields: [
              {
                name: 'Required Permissions',
                value: 'The bot requires admin permissions for full functionality, including creating channels and managing guild logs.',
                inline: false
              }
            ]
          };
          
          // Application ID is needed for invite link
          const appId = process.env.DISCORD_APPLICATION_ID || client.user.id;
          const inviteLink = `https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot%20applications.commands&permissions=8`;
          
          await interaction.reply({
            embeds: [inviteEmbed],
            components: [{
              type: 1, // ActionRow
              components: [{
                type: 2, // Button
                style: 5, // Link button
                label: 'Add to Server',
                url: inviteLink
              }]
            }],
            ephemeral: true
          });
          
          logger.info(`Invite command completed for ${interaction.user.tag}`);
          break;
          
        case 'stats':
          logger.info(`Executing stats command for ${interaction.user.tag}`);
          
          // Calculate uptime in a readable format
          const uptimeMs = client.uptime;
          const seconds = Math.floor(uptimeMs / 1000) % 60;
          const minutes = Math.floor(uptimeMs / (1000 * 60)) % 60;
          const hours = Math.floor(uptimeMs / (1000 * 60 * 60)) % 24;
          const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
          
          const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
          
          // Count total users across all guilds
          const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
          
          // Count total channels across all guilds
          const totalChannels = client.guilds.cache.reduce((acc, guild) => acc + guild.channels.cache.size, 0);
          
          // Get memory usage
          const memoryUsage = process.memoryUsage();
          const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
          const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;
          
          const statsEmbed = {
            title: '📊 Bot Statistics',
            color: 0x5865F2,
            fields: [
              {
                name: '⏱️ Uptime',
                value: uptimeString,
                inline: true
              },
              {
                name: '🏓 Ping',
                value: `${Math.round(client.ws.ping)}ms`,
                inline: true
              },
              {
                name: '🖥️ Memory Usage',
                value: `${memoryUsedMB}MB / ${memoryTotalMB}MB`,
                inline: true
              },
              {
                name: '🌐 Servers',
                value: client.guilds.cache.size.toString(),
                inline: true
              },
              {
                name: '👥 Users',
                value: totalUsers.toString(),
                inline: true
              },
              {
                name: '📝 Channels',
                value: totalChannels.toString(),
                inline: true
              },
              {
                name: '⚙️ System',
                value: `Node.js ${process.version}\nDiscord.js v14`,
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'The Royal Court Bot',
              icon_url: client.user.displayAvatarURL()
            }
          };
          
          await interaction.reply({ embeds: [statsEmbed] });
          logger.info(`Stats command completed for ${interaction.user.tag}`);
          break;
          
        case 'setup':
          logger.info(`Executing setup command for ${interaction.user.tag}`);
          await interaction.reply({
            content: "The setup command is available in the full bot version.\n\nPlease run the main bot.js instead using `node bot.js` to access the complete functionality including server setup, logging, and modmail features.",
            ephemeral: true
          });
          break;
        
        default:
          logger.warn(`Unknown command received: ${commandName}`);
          await interaction.reply({ 
            content: `I don't recognize that command. Try /ping, /info, or /serverinfo!`, 
            ephemeral: true 
          });
      }
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      logger.error(`Error details: ${error.message}`);
      
      // Reply with error if we haven't responded yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error executing this command! The error has been logged.', 
          ephemeral: true 
        }).catch(e => logger.error('Could not send error response:', e));
      }
    }
  } else if (interaction.isButton()) {
    // Handle button interactions
    logger.info(`Button interaction: ${interaction.customId} by ${interaction.user.tag}`);
    
    try {
      if (interaction.customId.startsWith('help-')) {
        // Handle help button interactions
        const section = interaction.customId.split('-')[1];
        
        const helpEmbed = {
          title: '🤖 The Royal Court Bot - Help Menu',
          color: 0x5865F2
        };
        
        switch (section) {
          case 'main':
            helpEmbed.description = 'Here are all the available commands:';
            helpEmbed.fields = [
              {
                name: '📊 Information Commands',
                value: '`/ping`, `/info`, `/help`, etc.'
              },
              {
                name: '⚙️ Setup & Management',
                value: 'These commands are available in the full bot version.'
              }
            ];
            break;
            
          case 'management':
            helpEmbed.description = 'Management commands help:';
            helpEmbed.fields = [{
              name: 'Note',
              value: 'Management commands are only available in the full bot version. Please use the main bot.js for complete functionality.'
            }];
            break;
            
          default:
            helpEmbed.description = 'This help section is only available in the full bot version.';
        }
        
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        return;
      }
      
      // Default response for other buttons
      await interaction.reply({ 
        content: 'This button interaction is only available in the full bot version. Please use the main bot.js for complete functionality.', 
        flags: { ephemeral: true }
      });
    } catch (error) {
      logger.error(`Error handling button interaction: ${error.message}`);
      await interaction.reply({ 
        content: 'There was an error processing this button interaction.', 
        flags: { ephemeral: true }
      });
    }
  } else if (interaction.isStringSelectMenu()) {
    // Handle select menu interactions
    logger.info(`Select menu interaction: ${interaction.customId} by ${interaction.user.tag}`);
    
    try {
      if (interaction.customId === 'help-categories') {
        // Handle help category selection
        const selectedCategory = interaction.values[0];
        
        const helpEmbed = {
          title: '🤖 The Royal Court Bot - Help',
          color: 0x5865F2,
          footer: {
            text: 'Need more help? Join our support server!'
          }
        };
        
        // Build help content based on selection
        switch (selectedCategory) {
          case 'general':
            helpEmbed.description = '**General Commands**\n\nThese commands provide basic information about the bot.';
            helpEmbed.fields = [
              {
                name: '/ping',
                value: 'Check the bot\'s response time and latency.'
              },
              {
                name: '/info',
                value: 'Get information about the bot.'
              },
              {
                name: '/help',
                value: 'Display this help menu.'
              }
            ];
            break;
            
          case 'setup':
            helpEmbed.description = '**Setup Information**\n\nComplete functionality is available in the main bot version.';
            helpEmbed.fields = [
              {
                name: 'Server Setup',
                value: 'Configure logging channels, permissions and more with the full version of the bot.'
              }
            ];
            break;
            
          case 'moderation':
            helpEmbed.description = '**Moderation Commands**\n\nComplete functionality is available in the main bot version.';
            helpEmbed.fields = [
              {
                name: 'Moderation Tools',
                value: 'Advanced moderation features are available in the full version of the bot.'
              }
            ];
            break;
            
          default:
            helpEmbed.description = 'Please select a valid help category.';
        }
        
        // Create a new row of buttons for navigation
        const row = {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: 'Back to Main Menu',
              custom_id: 'help-main',
              emoji: {
                name: '🔙'
              }
            }
          ]
        };
        
        await interaction.reply({ 
          embeds: [helpEmbed], 
          components: [row], 
          ephemeral: true 
        });
      } else if (interaction.customId.startsWith('logs-')) {
        await interaction.reply({
          content: 'Logging configuration is only available in the full bot version. Please use the main bot.js for complete functionality.',
          ephemeral: true
        });
      } else if (interaction.customId.startsWith('setup-')) {
        await interaction.reply({
          content: 'Setup configuration is only available in the full bot version. Please use the main bot.js for complete functionality.',
          ephemeral: true
        });
      } else {
        // Default response for other select menus
        await interaction.reply({ 
          content: 'This select menu interaction is only available in the full bot version. Please use the main bot.js for complete functionality.', 
          ephemeral: true 
        });
      }
    } catch (error) {
      logger.error(`Error handling select menu interaction: ${error.message}`);
      await interaction.reply({ 
        content: 'There was an error processing this selection.', 
        ephemeral: true 
      });
    }
  } else if (interaction.isModalSubmit()) {
    // Handle modal submissions
    logger.info(`Modal submission: ${interaction.customId} by ${interaction.user.tag}`);
    
    try {
      // Handle different modal types based on customId
      if (interaction.customId === 'reportModal') {
        // This is for the report message modal
        const reportReason = interaction.fields.getTextInputValue('reportReason');
        const reportDetails = interaction.fields.getTextInputValue('reportDetails');
        
        logger.info(`Received report from ${interaction.user.tag}: ${reportReason}`);
        
        // Create an embed for the report
        const reportEmbed = {
          title: '📝 Message Report',
          color: 0xf44336, // Red color for reports
          description: 'Your report has been received and will be reviewed by server moderators.',
          fields: [
            {
              name: 'Reason',
              value: reportReason || 'No reason provided'
            },
            {
              name: 'Details',
              value: reportDetails || 'No details provided'
            }
          ],
          footer: {
            text: `Reported by ${interaction.user.tag}`
          },
          timestamp: new Date()
        };
        
        await interaction.reply({ embeds: [reportEmbed], ephemeral: true });
      } else if (interaction.customId.startsWith('feedback-')) {
        // Handle feedback modals
        const feedbackText = interaction.fields.getTextInputValue('feedbackText');
        
        logger.info(`Received feedback from ${interaction.user.tag}`);
        
        // Create an embed for feedback confirmation
        const feedbackEmbed = {
          title: '📋 Feedback Received',
          color: 0x4caf50, // Green for confirmation
          description: 'Thank you for your feedback! Your input helps us improve the bot.',
          fields: [
            {
              name: 'Your Feedback',
              value: feedbackText || 'No feedback provided'
            }
          ],
          footer: {
            text: `From ${interaction.user.tag}`
          },
          timestamp: new Date()
        };
        
        await interaction.reply({ embeds: [feedbackEmbed], ephemeral: true });
      } else if (interaction.customId.startsWith('modmail-')) {
        // Handle modmail modals - just provide a placeholder response
        const messageContent = interaction.fields.getTextInputValue('messageContent');
        
        logger.info(`Received modmail message from ${interaction.user.tag}`);
        
        const modmailEmbed = {
          title: '📫 Modmail Message',
          color: 0x2196f3, // Blue for modmail
          description: 'Your message has been sent to the server moderators.',
          fields: [
            {
              name: 'Your Message',
              value: messageContent || 'No message content'
            }
          ],
          footer: {
            text: 'Please note: This is a simplified version of modmail. Full functionality is available in the main bot.'
          },
          timestamp: new Date()
        };
        
        await interaction.reply({ embeds: [modmailEmbed], ephemeral: true });
      } else {
        // Default response for other modal types
        await interaction.reply({ 
          content: 'This modal submission is only fully supported in the main bot version. Please use the main bot.js for complete functionality.', 
          ephemeral: true 
        });
      }
    } catch (error) {
      logger.error(`Error handling modal submission: ${error.message}`);
      await interaction.reply({ 
        content: 'There was an error processing your submission. Please try again later.', 
        ephemeral: true 
      });
    }
  } else if (interaction.isContextMenuCommand()) {
    // Handle context menu commands
    logger.info(`Context menu command: ${interaction.commandName} by ${interaction.user.tag}`);
    
    try {
      if (interaction.commandName === 'User Info') {
        // Handle user info context command
        const targetUser = interaction.targetUser;
        
        // Calculate join date and creation date
        const joinDate = interaction.targetMember ? interaction.targetMember.joinedAt : null;
        const creationDate = targetUser.createdAt;
        
        // Get time ago string
        const getTimeAgo = (date) => {
          const now = new Date();
          const diffInSeconds = Math.floor((now - date) / 1000);
          
          if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
          
          const diffInMinutes = Math.floor(diffInSeconds / 60);
          if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
          
          const diffInHours = Math.floor(diffInMinutes / 60);
          if (diffInHours < 24) return `${diffInHours} hours ago`;
          
          const diffInDays = Math.floor(diffInHours / 24);
          if (diffInDays < 30) return `${diffInDays} days ago`;
          
          const diffInMonths = Math.floor(diffInDays / 30);
          if (diffInMonths < 12) return `${diffInMonths} months ago`;
          
          const diffInYears = Math.floor(diffInMonths / 12);
          return `${diffInYears} years ago`;
        };
        
        // Format dates for display
        const formatDate = (date) => {
          if (!date) return 'Unknown';
          return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()} (${getTimeAgo(date)})`;
        };
        
        const userInfoEmbed = {
          title: `User Information: ${targetUser.username}`,
          color: 0x3498db,
          thumbnail: {
            url: targetUser.displayAvatarURL({ dynamic: true, size: 128 })
          },
          fields: [
            {
              name: 'User ID',
              value: targetUser.id,
              inline: true
            },
            {
              name: 'Account Created',
              value: formatDate(creationDate),
              inline: false
            }
          ],
          footer: {
            text: `Requested by ${interaction.user.tag}`
          },
          timestamp: new Date()
        };
        
        // Add joined server date if available
        if (joinDate) {
          userInfoEmbed.fields.push({
            name: 'Joined Server',
            value: formatDate(joinDate),
            inline: false
          });
        }
        
        // Add roles if available
        if (interaction.targetMember && interaction.targetMember.roles.cache.size > 1) {
          const roles = interaction.targetMember.roles.cache
            .filter(role => role.id !== interaction.guild.id) // Filter out @everyone role
            .map(role => `<@&${role.id}>`)
            .join(', ');
            
          if (roles) {
            userInfoEmbed.fields.push({
              name: 'Roles',
              value: roles.length > 1024 ? 'Too many roles to display' : roles,
              inline: false
            });
          }
        }
        
        await interaction.reply({
          embeds: [userInfoEmbed],
          ephemeral: true
        });
      } else if (interaction.commandName === 'Report Message') {
        // Create a modal for reporting the message
        const modal = {
          title: "Report Message",
          custom_id: "reportModal",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "reportReason",
                  label: "Reason for Report",
                  style: 1,
                  min_length: 5,
                  max_length: 100,
                  placeholder: "Explain why you're reporting this message",
                  required: true
                }
              ]
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "reportDetails",
                  label: "Additional Details",
                  style: 2,
                  min_length: 10,
                  max_length: 1000,
                  placeholder: "Provide any additional context or details about this report",
                  required: true
                }
              ]
            }
          ]
        };
        
        await interaction.showModal(modal);
      } else {
        await interaction.reply({ 
          content: 'This context menu command is only fully supported in the main bot version. Please use the main bot.js for complete functionality.', 
          ephemeral: true 
        });
      }
    } catch (error) {
      logger.error(`Error handling context menu command: ${error.message}`);
      await interaction.reply({ 
        content: 'There was an error processing this command. Please try again later.', 
        ephemeral: true 
      });
    }
  }
});

// Function to register slash commands
async function registerCommands() {
  try {
    const appId = process.env.DISCORD_APPLICATION_ID;
    
    logger.info(`Application ID from environment: ${appId ? 'Found' : 'Not found'}`);
    
    if (!appId) {
      logger.warn('No DISCORD_APPLICATION_ID found in environment, skipping slash command registration');
      return;
    }
    
    const rest = new REST({ version: '10' }).setToken(token);
    
    // Test connection to Discord API
    logger.info('Testing connection to Discord API...');
    try {
      const currentUser = await rest.get(Routes.user('@me'));
      logger.info(`API Connection successful! Logged in as ${currentUser.username}#${currentUser.discriminator}`);
    } catch (apiError) {
      logger.error('Failed to connect to Discord API:', apiError);
      logger.error(`API Error details: ${apiError.message}`);
      return; // Don't proceed if we can't connect to the API
    }
    
    logger.info('Started refreshing application (/) commands...');
    
    const commandData = commands.map(command => command.toJSON());
    logger.info(`Prepared ${commandData.length} commands for registration`);
    
    // First try to get current commands
    try {
      const currentCommands = await rest.get(
        Routes.applicationCommands(appId)
      );
      logger.info(`Current registered commands: ${currentCommands.length}`);
    } catch (getError) {
      logger.warn(`Could not fetch current commands: ${getError.message}`);
    }
    
    // Global commands
    logger.info(`Registering commands to application ID: ${appId}`);
    try {
      // Log all data we're sending
      logger.info(`Sending command data to Discord API: ${JSON.stringify(commandData.map(cmd => ({ name: cmd.name, description: cmd.description })))}`);
      
      // Get the first guild we're in to register commands to
      const firstGuild = client.guilds.cache.first();
      logger.info(`Registering commands to guild ${firstGuild?.name || 'unknown'} (${firstGuild?.id || 'unknown'})`);
      console.log(`Registering commands to guild ${firstGuild?.name || 'unknown'} (${firstGuild?.id || 'unknown'})`);
      
      // Try guild commands first since they update instantly
      if (firstGuild) {
        logger.info(`Making PUT request to ${Routes.applicationGuildCommands(appId, firstGuild.id)}`);
        console.log(`Making PUT request to ${Routes.applicationGuildCommands(appId, firstGuild.id)}`);
        
        const guildResponse = await rest.put(
          Routes.applicationGuildCommands(appId, firstGuild.id),
          { body: commandData }
        );
        
        logger.info(`Guild command registration response received, type: ${typeof guildResponse}`);
        console.log(`Guild command registration response received, type: ${typeof guildResponse}`);
        
        if (Array.isArray(guildResponse)) {
          logger.info(`Successfully registered ${guildResponse.length} application commands to guild ${firstGuild.name}`);
          console.log(`Successfully registered ${guildResponse.length} application commands to guild ${firstGuild.name}`);
          for (const cmd of guildResponse) {
            logger.info(`- Registered guild command: ${cmd.name}`);
            console.log(`- Registered guild command: ${cmd.name}`);
          }
        }
      }
      
      // Also try global registration
      logger.info(`Making PUT request to ${Routes.applicationCommands(appId)}`);
      console.log(`Making PUT request to ${Routes.applicationCommands(appId)}`);
      
      const response = await rest.put(
        Routes.applicationCommands(appId),
        { body: commandData }
      );
      
      logger.info(`Registration response received, type: ${typeof response}`);
      console.log(`Registration response received, type: ${typeof response}`);
      
      if (Array.isArray(response)) {
        logger.info(`Successfully registered ${response.length} application commands globally`);
        for (const cmd of response) {
          logger.info(`- Registered command: ${cmd.name}`);
          console.log(`- Registered command: ${cmd.name}`);
        }
      } else {
        logger.warn(`Unexpected response format: ${typeof response}`);
        logger.info(`Response from Discord API: ${JSON.stringify(response).substring(0, 200)}...`);
        console.log(`Unexpected response format: ${typeof response}`);
        console.log(`Response from Discord API: ${JSON.stringify(response).substring(0, 200)}...`);
      }
      
      // Verify commands were registered by fetching them again - but do it immediately for faster feedback
      logger.info("Verifying command registration by fetching from Discord API...");
      console.log("Verifying command registration by fetching from Discord API...");
      
      try {
        const verifyCommands = await rest.get(Routes.applicationCommands(appId));
        logger.info(`Verification request returned type: ${typeof verifyCommands}`);
        console.log(`Verification request returned type: ${typeof verifyCommands}`);
        
        if (Array.isArray(verifyCommands)) {
          logger.info(`Verification: Found ${verifyCommands.length} registered commands`);
          console.log(`Verification: Found ${verifyCommands.length} registered commands`);
          
          verifyCommands.forEach(cmd => {
            logger.info(`- Verified command: ${cmd.name}`);
            console.log(`- Verified command: ${cmd.name}`);
          });
        } else {
          logger.warn("Verification: Unexpected response format when verifying commands");
          console.log("Verification: Unexpected response format when verifying commands");
          console.log(JSON.stringify(verifyCommands).substring(0, 200));
        }
      } catch (verifyError) {
        logger.error("Error verifying command registration:", verifyError);
        console.error("Error verifying command registration:", verifyError);
      }
    } catch (putError) {
      logger.error("Error during PUT request for command registration:", putError);
      console.error("Error during PUT request for command registration:", putError);
      
      if (putError.httpStatus) {
        logger.error(`HTTP Status: ${putError.httpStatus}`);
        console.error(`HTTP Status: ${putError.httpStatus}`);
      }
      if (putError.code) {
        logger.error(`Discord API Error Code: ${putError.code}`);
        console.error(`Discord API Error Code: ${putError.code}`);
      }
      
      logger.error(`Error stack: ${putError.stack}`);
      console.error(`Error stack: ${putError.stack}`);
    }
  } catch (error) {
    logger.error('Error registering commands:', error);
    logger.error(`Error details: ${error.message}`);
    if (error.code) {
      logger.error(`Discord API Error Code: ${error.code}`);
    }
    if (error.httpStatus) {
      logger.error(`HTTP Status: ${error.httpStatus}`);
    }
  }
}

// Get token
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
if (!token) {
  logger.error('No Discord bot token found in environment variables!');
  process.exit(1);
}

// Safe logging of token existence only (no content exposed)
const tokenLength = token.length;
logger.info(`Token available: ${!!token}, Token length: ${tokenLength}`);

// Login
logger.info('Attempting to connect to Discord...');
client.login(token).then(async () => {
  // Register commands after successful login
  await registerCommands();
}).catch(error => {
  logger.error('Failed to log in to Discord:', error);
});