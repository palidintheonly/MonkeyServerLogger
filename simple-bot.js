// Simple Discord.js bot without sharding
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { logger } = require('./src/utils/logger');

// Define some simple slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with bot latency'),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Get information about the bot'),
    
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Get information about the server')
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
    activities: [{ name: 'with Discord.js', type: ActivityType.Playing }],
    status: 'online'
  });
  
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
  
  // Start HTTP server
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Discord bot is running!');
  });
  
  server.listen(5000, '0.0.0.0', () => {
    logger.info('Health check server running on port 5000');
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
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'ping':
        const sent = await interaction.reply({ content: 'Measuring ping...', fetchReply: true });
        const pingTime = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Bot Latency: ${pingTime}ms | API Latency: ${Math.round(client.ws.ping)}ms`);
        break;
        
      case 'info':
        await interaction.reply({
          content: [
            `**Bot Info**`,
            `Name: ${client.user.tag}`,
            `ID: ${client.user.id}`,
            `Uptime: ${Math.floor(client.uptime / 60000)} minutes`,
            `Servers: ${client.guilds.cache.size}`,
            `Discord.js: v14`
          ].join('\n'),
          ephemeral: true
        });
        break;
        
      case 'serverinfo':
        const guild = interaction.guild;
        await interaction.reply({
          content: [
            `**Server Info**`,
            `Name: ${guild.name}`,
            `ID: ${guild.id}`,
            `Owner: <@${guild.ownerId}>`,
            `Members: ${guild.memberCount}`,
            `Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
            `Channels: ${guild.channels.cache.size}`,
            `Roles: ${guild.roles.cache.size}`
          ].join('\n')
        });
        break;
    }
  } catch (error) {
    logger.error(`Error executing command ${commandName}:`, error);
    
    // Reply with error if we haven't responded yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'There was an error executing this command!', 
        ephemeral: true 
      }).catch(e => logger.error('Could not send error response:', e));
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