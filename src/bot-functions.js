// Common bot functions for use in both simple-bot.js and deployment.js
const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const { logger } = require('./utils/logger');
const { PermissionsBitField } = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('./utils/embedBuilder');

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
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure logging settings')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
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
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
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
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
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
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName('disable')
    .setDescription('Disable the bot in this server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
  new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Manage the modmail system')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
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

/**
 * Register commands to all available guilds
 * @param {Client} client Discord client instance
 */
async function registerCommandsToGuilds(client) {
  try {
    const appId = process.env.DISCORD_APPLICATION_ID || client.user.id;
    const token = process.env.DISCORD_BOT_TOKEN;
    
    if (!appId) {
      logger.warn('No application ID found, skipping slash command registration');
      return;
    }
    
    if (!token) {
      logger.warn('No bot token found, skipping slash command registration');
      return;
    }
    
    const rest = new REST({ version: '10' }).setToken(token);
    
    logger.info('Started refreshing application (/) commands...');
    
    const commandData = commands.map(command => command.toJSON());
    logger.info(`Prepared ${commandData.length} commands for registration`);
    
    // Register to each guild the bot is in
    const guilds = Array.from(client.guilds.cache.values());
    
    for (const guild of guilds) {
      try {
        logger.info(`Registering commands to guild ${guild.name} (${guild.id})`);
        
        const guildResponse = await rest.put(
          Routes.applicationGuildCommands(appId, guild.id),
          { body: commandData }
        );
        
        if (Array.isArray(guildResponse)) {
          logger.info(`Successfully registered ${guildResponse.length} application commands to guild ${guild.name}`);
          
          guildResponse.forEach(cmd => {
            logger.info(`- Registered guild command: ${cmd.name}`);
          });
        }
      } catch (error) {
        logger.error(`Failed to register commands to guild ${guild.name}:`, error);
      }
    }
    
    // Also register globally
    try {
      const globalResponse = await rest.put(
        Routes.applicationCommands(appId),
        { body: commandData }
      );
      
      if (Array.isArray(globalResponse)) {
        logger.info(`Successfully registered ${globalResponse.length} global application commands`);
      }
    } catch (globalError) {
      logger.error('Failed to register global commands:', globalError);
    }
    
    logger.info('Slash command registration complete');
  } catch (error) {
    logger.error('Error during command registration:', error);
  }
}

/**
 * Handle Discord interactions
 * @param {Interaction} interaction Discord interaction object
 * @param {Client} client Discord client
 */
async function handleInteraction(interaction, client) {
  // Log all interactions for debugging
  logger.info(`Received interaction: ${interaction.type} from ${interaction.user.tag} (${interaction.user.id})`);
  
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    logger.info(`Slash command executed: /${commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
    
    try {
      switch (commandName) {
        case 'ping':
          logger.info(`Executing ping command for ${interaction.user.tag}`);
          const sent = await interaction.reply({ content: 'Measuring ping...', withResponse: true });
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
            embeds: [createEmbed({
              title: 'Bot Information',
              description: 'The Royal Court Herald - Discord Logging & Management Bot',
              fields: [
                { name: 'Bot Name', value: client.user.tag, inline: true },
                { name: 'Bot ID', value: client.user.id, inline: true },
                { name: 'Uptime', value: uptimeFormatted, inline: true },
                { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: 'Users', value: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toString(), inline: true },
                { name: 'Discord.js', value: 'v14', inline: true },
                { name: 'Node.js', value: process.version, inline: true }
              ]
            })],
            flags: { ephemeral: true }
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
            embeds: [createEmbed({
              title: 'Server Information',
              description: `Information about ${guild.name}`,
              thumbnail: guild.iconURL({ dynamic: true }),
              fields: [
                { name: 'Server Name', value: guild.name, inline: true },
                { name: 'Server ID', value: guild.id, inline: true },
                { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Members', value: totalMembers.toString(), inline: true },
                { name: 'Channels', value: `${guild.channels.cache.size} (${guild.channels.cache.filter(c => c.type === 0).size} text, ${guild.channels.cache.filter(c => c.type === 2).size} voice)`, inline: true },
                { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
                { name: 'Verification Level', value: verificationLevels[guild.verificationLevel], inline: true },
                { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false }
              ]
            })]
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
          
          await interaction.reply({ embeds: [helpEmbed], flags: { ephemeral: true } });
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
            flags: { ephemeral: true }
          });
          
          logger.info(`Invite command completed for ${interaction.user.tag}`);
          break;
          
        case 'stats':
          logger.info(`Executing stats command for ${interaction.user.tag}`);
          
          // Calculate uptime
          const uptime = client.uptime;
          const days = Math.floor(uptime / 86400000);
          const hours = Math.floor((uptime % 86400000) / 3600000);
          const minutes = Math.floor((uptime % 3600000) / 60000);
          const seconds = Math.floor((uptime % 60000) / 1000);
          
          const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
          
          // Get memory usage
          const memoryUsage = process.memoryUsage();
          const memoryUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
          const memoryTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
          
          await interaction.reply({
            embeds: [createEmbed({
              title: 'Bot Statistics',
              description: 'Current performance metrics and statistics',
              fields: [
                { name: 'Uptime', value: uptimeString, inline: true },
                { name: 'Memory Usage', value: `${memoryUsedMB} MB / ${memoryTotalMB} MB`, inline: true },
                { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
                { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: 'Users', value: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toString(), inline: true },
                { name: 'Commands', value: commands.length.toString(), inline: true },
                { name: 'Platform', value: process.platform, inline: true },
                { name: 'Node.js', value: process.version, inline: true }
              ]
            })]
          });
          
          logger.info(`Stats command completed for ${interaction.user.tag}`);
          break;
          
        default:
          // Handle other commands
          logger.info(`Unknown command received: ${commandName}`);
          await interaction.reply({ 
            content: `This command is not fully implemented yet. Please check back soon!`,
            flags: { ephemeral: true } 
          });
      }
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      try {
        const errorMessage = `An error occurred while executing this command. Please try again later.`;
        
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage, flags: { ephemeral: true } });
        } else {
          await interaction.reply({ content: errorMessage, flags: { ephemeral: true } });
        }
      } catch (replyError) {
        logger.error('Error sending error response:', replyError);
      }
    }
  } else if (interaction.isButton()) {
    // Handle button interactions
    logger.info(`Button interaction: ${interaction.customId} by ${interaction.user.tag}`);
    await interaction.reply({ 
      content: 'Button interactions are not implemented yet!', 
      flags: { ephemeral: true } 
    });
  } else if (interaction.isStringSelectMenu()) {
    // Handle select menu interactions
    logger.info(`Select menu interaction: ${interaction.customId} by ${interaction.user.tag}`);
    await interaction.reply({ 
      content: 'Select menu interactions are not implemented yet!', 
      flags: { ephemeral: true } 
    });
  } else if (interaction.isModalSubmit()) {
    // Handle modal submissions
    logger.info(`Modal submission: ${interaction.customId} by ${interaction.user.tag}`);
    await interaction.reply({ 
      content: 'Modal submissions are not implemented yet!', 
      flags: { ephemeral: true } 
    });
  } else if (interaction.isContextMenuCommand()) {
    // Handle context menu commands
    logger.info(`Context menu command: ${interaction.commandName} by ${interaction.user.tag}`);
    await interaction.reply({ 
      content: 'Context menu commands are not implemented yet!', 
      flags: { ephemeral: true } 
    });
  }
}

module.exports = {
  commands,
  registerCommandsToGuilds,
  handleInteraction
};