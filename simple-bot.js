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

// Safe logging of token (partial masking)
const tokenLength = token.length;
const tokenFirstChars = token.substring(0, 5);
const tokenLastChars = token.substring(tokenLength - 5);
logger.info(`Using token of length ${tokenLength}, starting with ${tokenFirstChars}... and ending with ...${tokenLastChars}`);

// Login
logger.info('Attempting to connect to Discord...');
client.login(token).then(async () => {
  // Register commands after successful login
  await registerCommands();
}).catch(error => {
  logger.error('Failed to log in to Discord:', error);
});