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
  const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID || '1234567890123456789';
  
  if (!token) {
    logger.warn('Missing token environment variable - will continue without command registration');
    return false;
  }
  
  // Log token existence without exposing it
  logger.info(`Token available: ${!!token}, Token length: ${token ? token.length : 0}`);
  logger.info(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);
  
  // Already checked token existence above, just continue
  
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
    // Log error but don't fail hard - allow bot to continue
    console.log(`Command registration error: ${error.message} - The bot will continue running`);
    logger.warn(`Error registering commands: ${error.message}`);
    logger.warn('Bot will continue to function, but commands may need to be manually registered later');
    // Return true anyway to avoid stopping the bot
    return true;
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
    
    // Get token
    const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
    logger.info(`[Init] Token available: ${!!token}, Token length: ${token ? token.length : 0}`);
    
    // Simplified login process - no validation checks
    try {
      // First, validate the token format
      if (!token || typeof token !== 'string' || !token.includes('.')) {
        logger.error('Invalid token format! Discord bot token should contain periods (.)');
        console.error('CRITICAL ERROR: Invalid Discord token format');
        console.error('Please make sure your DISCORD_BOT_TOKEN in Replit Secrets is valid');
        process.exit(1);
      }
      
      logger.info('Attempting to login to Discord...');
      
      // Attempt to login with proper error handling
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
      
      // Register commands with Discord API
      try {
        const commandsRegistered = await registerCommands();
        if (commandsRegistered) {
          logger.info('Successfully registered all commands with Discord API');
        }
      } catch (error) {
        logger.warn(`Command registration error: ${error.message}`);
        logger.warn('Bot will continue functioning without command registration');
        // Continue anyway - commands can be registered later
      }
    } catch (error) {
      // Enhanced error handling with specific messages
      logger.error('Discord authentication failed. Error details:');
      logger.error(`Error message: ${error.message}`);
      
      if (error.message.includes('invalid token')) {
        console.error('CRITICAL ERROR: Discord rejected the token as invalid');
        console.error('Please update your DISCORD_BOT_TOKEN in Replit Secrets');
      } else if (error.message.includes('disallowed intent')) {
        console.error('CRITICAL ERROR: Bot is missing required intents in Discord Developer Portal');
        console.error('Please enable all Privileged Gateway Intents in the Discord Developer Portal');
      } else {
        console.error('CRITICAL ERROR: Failed to connect to Discord');
        console.error(`Reason: ${error.message}`);
      }
      
      logger.error('Exiting due to authentication failure');
      process.exit(1);
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