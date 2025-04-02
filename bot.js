// Main entry point for the Discord bot with enhanced features
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');

// Check if required environment variables are set
if (!process.env.DISCORD_BOT_TOKEN && !process.env.TOKEN) {
  console.error('ERROR: Missing required environment variables! Please set DISCORD_BOT_TOKEN in your environment.');
  process.exit(1);
}

// Attempt to validate token format - relaxed validation
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
if (!token) {
  console.error('CRITICAL ERROR: No token found! Please set DISCORD_BOT_TOKEN in Replit Secrets.');
  console.error('Running in offline mode to prevent further errors...');
}
const fs = require('fs');
const path = require('path');
const { logger } = require('./src/utils/logger');
const { logger: enhancedLogger } = require('./src/utils/enhanced-logger');
const { models, connectToDatabase } = require('./src/database/db');
const http = require('http');

// Setup client with appropriate intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildBans, // Use GuildBans instead of GuildModeration
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildPresences
  ]
});

// Initialize collections
client.commands = new Collection();
client.contextCommands = new Collection();
client.cooldowns = new Collection();
client.activeModmailThreads = new Map();
client.blockedModmailUsers = new Set();

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord bot is running!');
});

// Listen on port 3000 for health checks
server.listen(3000, '0.0.0.0', () => {
  logger.info('Health check server running on port 3000');
});

// Command registration function
async function registerCommands() {
  const commands = [];
  const commandNames = new Set();
  
  // Load main commands
  const foldersPath = path.join(__dirname, 'src', 'commands');
  const commandFolders = fs.readdirSync(foldersPath).filter(file => !file.includes('.'));
  
  // Direct commands in commands folder
  const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      const commandName = command.data.name;
      if (!commandNames.has(commandName)) {
        commandNames.add(commandName);
        commands.push(command.data.toJSON());
        client.commands.set(commandName, command);
        logger.info(`Loaded command: ${commandName}`);
      }
    }
  }
  
  // Commands in subfolders (except context)
  for (const folder of commandFolders) {
    if (folder === 'context') continue;
    
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        const commandName = command.data.name;
        if (!commandNames.has(commandName)) {
          commandNames.add(commandName);
          commands.push(command.data.toJSON());
          client.commands.set(commandName, command);
          logger.info(`Loaded command from ${folder}: ${commandName}`);
        }
      }
    }
  }
  
  // Context menu commands
  const contextPath = path.join(foldersPath, 'context');
  if (fs.existsSync(contextPath)) {
    const contextFiles = fs.readdirSync(contextPath).filter(file => file.endsWith('.js'));
    
    for (const file of contextFiles) {
      const filePath = path.join(contextPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        const commandName = command.data.name;
        if (!commandNames.has(commandName)) {
          commandNames.add(commandName);
          commands.push(command.data.toJSON());
          client.contextCommands.set(commandName, command);
          logger.info(`Loaded context command: ${commandName}`);
        }
      }
    }
  }
  
  logger.info(`Total unique commands loaded: ${commandNames.size}`);
  
  // Register commands with Discord API
  const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
  const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;
  
  if (!token || !clientId) {
    logger.error('Missing required environment variables!');
    process.exit(1);
  }
  
  // Log token existence without exposing it
  logger.info(`Token available: ${!!token}, Token length: ${token ? token.length : 0}`);
  logger.info(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);
  
  // Skip token format validation - check only if token exists
  if (!token) {
    logger.error('No token available for Discord API access!');
    return false; // Return false to indicate failure
  }
  
  const rest = new REST({ version: '10' }).setToken(token);
  
  try {
    logger.info(`Started refreshing ${commands.length} application commands`);
    
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    
    logger.info(`Successfully reloaded ${data.length} application commands`);
    return true; // Return true to indicate success
  } catch (error) {
    logger.safeError('Error registering commands', error);
    return false; // Return false to indicate failure
  }
}

// Register event handlers
function registerEvents() {
  // Client events
  const clientEventsPath = path.join(__dirname, 'src', 'events', 'client');
  const clientEventFiles = fs.readdirSync(clientEventsPath).filter(file => file.endsWith('.js'));
  
  for (const file of clientEventFiles) {
    const filePath = path.join(clientEventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    
    logger.info(`Loaded client event: ${event.name}`);
  }
  
  // Guild events
  const guildEventsPath = path.join(__dirname, 'src', 'events', 'guild');
  const guildEventFiles = fs.readdirSync(guildEventsPath).filter(file => file.endsWith('.js'));
  
  for (const file of guildEventFiles) {
    const filePath = path.join(guildEventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    
    logger.info(`Loaded guild event: ${event.name}`);
  }
}


// Main initialization function
async function init() {
  logger.info('Starting Discord Bot...');
  
  try {
    // Connect to database
    await connectToDatabase();
    logger.info('Database connection established');
    
    // Register events
    registerEvents();
    
    // Get token and validate format
    const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
    logger.info(`[Init] Token available: ${!!token}, Token length: ${token ? token.length : 0}`);
    
    // Skip token format validation - some tokens might have non-standard formats
    if (!token) {
      logger.error('No token found! Please check your DISCORD_BOT_TOKEN in Replit Secrets.');
      process.exit(1);
    }
    
    // Register commands with better error handling
    try {
      const commandsRegistered = await registerCommands();
      if (!commandsRegistered) {
        logger.error('Failed to register commands with Discord API. Please check your token and permissions.');
        logger.error('The DISCORD_BOT_TOKEN in your Replit Secrets may need to be updated.');
        logger.info('Attempting to continue with bot login despite command registration failure...');
        // Continue execution instead of exiting
      } else {
        logger.info('Successfully registered all commands with Discord API');
      }
    } catch (error) {
      logger.error(`Command registration error: ${error.message}`);
      logger.error('The bot will attempt to login despite command registration failure');
      // Continue execution instead of aborting
    }
    
    // Login to Discord
    try {
      // Add additional diagnostic information
      logger.info('Attempting to login to Discord...');
      logger.info(`Using token from environment variable: ${token ? 'AVAILABLE (Hidden for security)' : 'NOT AVAILABLE'}`);
      logger.info(`Token length is ${token ? token.length : 0} characters`);
      logger.info(`Token format check: ${token && token.includes('.') ? 'Contains periods (.)' : 'Does NOT contain periods'}`);
      
      // Special offline mode check
      if (!token || token.length < 50 || !token.includes('.')) {
        logger.error('Token appears to be invalid or incorrectly formatted');
        logger.error('Discord tokens should contain periods and be approximately 60-70 characters long');
        logger.error('Please check the DISCORD_BOT_TOKEN in your Replit Secrets');
        
        // Write to console for visibility
        console.error('ERROR: Discord token validation failed!');
        console.error('Please make sure your DISCORD_BOT_TOKEN is set correctly in Replit Secrets');
        
        // Exit with error
        logger.error('Exiting due to token validation failure');
        setTimeout(() => process.exit(1), 3000);
        return;
      }
      
      // Attempt login with detailed error handling
      await client.login(token);
      
      // Success path
      logger.info('Successfully authenticated with Discord');
      console.log('SUCCESS: Bot has successfully connected to Discord');
      logger.info(`Bot is now online as ${client.user.tag}!`);
      
      // Log connected guilds
      logger.info(`Connected to ${client.guilds.cache.size} guilds`);
      client.guilds.cache.forEach(guild => {
        logger.info(`- ${guild.name} (${guild.id})`);
      });
    } catch (error) {
      // Extended error logging
      logger.error('Discord authentication failed. Error details:');
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error code: ${error.code || 'No error code'}`);
      logger.error(`Error name: ${error.name || 'Unknown error type'}`);
      console.error('CRITICAL ERROR: Failed to connect to Discord');
      
      if (error.code === 'TokenInvalid') {
        logger.info('The token appears to be invalid. Please ensure:');
        logger.info('1. Your bot token is correct and has not been reset');
        logger.info('2. Your bot has not been deleted from the Discord Developer Portal');
        logger.info('3. Your bot has the proper intents enabled in the Discord Developer Portal');
      }
      
      // More detailed information for specific errors
      if (error.message.includes('429')) {
        logger.error('You may be experiencing rate limiting. Wait a while before trying again.');
      } else if (error.message.includes('401')) {
        logger.error('Authentication error: The token is likely invalid or revoked.');
        logger.error('Please generate a new token in the Discord Developer Portal and update your Replit Secret.');
      }
      
      // Don't exit immediately to allow logs to be written
      logger.error('Will exit in 5 seconds due to authentication failure');
      setTimeout(() => process.exit(1), 5000);
    }
    
    // Initialize activeLoaders collection for tracking loading indicators
    client.activeLoaders = new Collection();
    logger.info('Animated loading indicators initialized for interactive commands');
    
    // Set bot status message
    client.user.setPresence({
      activities: [{ name: 'with Loading Animations & Enhanced Logging | /help', type: 0 }],
      status: 'online'
    });
    
    logger.info('Bot initialization completed');
  } catch (error) {
    logger.safeError('Error during bot initialization', error);
    process.exit(1);
  }
}

// Start the bot
init();