/**
 * Discord Modmail Bot - Main Entry Point
 * A dedicated Discord modmail bot for cross-server communication
 */
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { connectToDatabase } = require('./database/db');
const { client: clientConfig, bot: botConfig } = require('./config');
const { logger } = require('./utils/logger');
const fs = require('fs');
const path = require('path');

// Map DISCORD_APPLICATION_ID to CLIENT_ID if it exists
if (process.env.DISCORD_APPLICATION_ID && !process.env.CLIENT_ID) {
  process.env.CLIENT_ID = process.env.DISCORD_APPLICATION_ID;
  logger.info('Using DISCORD_APPLICATION_ID as CLIENT_ID');
}

// Check if bot token is available
if (!process.env.DISCORD_BOT_TOKEN) {
  logger.error('Missing DISCORD_BOT_TOKEN environment variable');
  process.exit(1);
}

// Initialize function that sets up the bot
async function initialize() {
  try {
    // Create discord.js client instance
    const client = new Client({
      intents: Object.values(GatewayIntentBits)
        .filter(intent => clientConfig.intents.includes(
          Object.keys(GatewayIntentBits)[Object.values(GatewayIntentBits).indexOf(intent)]
        )),
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
      ],
      allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
    });
    
    // Connect to database with retry mechanism
    let dbConnection;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        dbConnection = await connectToDatabase();
        logger.info(`Database connection successful after ${retryCount > 0 ? retryCount + ' retries' : 'first attempt'}`);
        break;
      } catch (dbError) {
        retryCount++;
        logger.error(`Database connection failed (attempt ${retryCount}/${maxRetries}): ${dbError.message}`);
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${dbError.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = 1000 * Math.pow(2, retryCount);
        logger.info(`Waiting ${waitTime}ms before retrying...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Make database models available on the client
    client.db = dbConnection.models;
    
    // Set up collections for command and cooldown tracking
    client.commands = new Collection();
    client.cooldowns = new Collection();
    
    // Load commands
    await loadDiscordCommands(client);
    
    // Load events
    loadEvents(client);
    
    // Log in client
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    // Return client in case it needs to be accessed from outside
    return { client };
  } catch (error) {
    logger.error(`Initialization error: ${error.message}`, { error });
    process.exit(1);
  }
}

/**
 * Load and register all commands
 * @param {Client} client - Discord.js client
 */
async function loadDiscordCommands(client) {
  const commandsPath = path.join(__dirname, 'commands');
  
  // Function to recursively load commands from directories
  const loadCommandsFromDir = (dir) => {
    if (!fs.existsSync(dir)) {
      logger.warn(`Commands directory not found: ${dir}`);
      return;
    }
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        // Load commands from subdirectory
        loadCommandsFromDir(itemPath);
      } else if (item.name.endsWith('.js')) {
        try {
          const command = require(itemPath);
          
          // Ensure command has required properties
          if (!command.data || !command.execute) {
            logger.warn(`Command at ${itemPath} is missing required properties`);
            continue;
          }
          
          // Add command to collection
          client.commands.set(command.data.name, command);
          logger.debug(`Loaded command: ${command.data.name}`);
        } catch (error) {
          logger.error(`Error loading command from ${itemPath}: ${error.message}`);
        }
      }
    }
  };
  
  // Load all commands
  loadCommandsFromDir(commandsPath);
  logger.info(`Loaded ${client.commands.size} commands`);
}

/**
 * Load and register all event handlers
 * @param {Client} client - Discord.js client
 */
function loadEvents(client) {
  // Discord.js events
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(file => file.startsWith('discord.') && file.endsWith('.js'));
  
  for (const file of eventFiles) {
    try {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      
      logger.debug(`Loaded Discord.js event: ${event.name}`);
    } catch (error) {
      logger.error(`Error loading Discord.js event from ${file}: ${error.message}`);
    }
  }
}

// Begin initialization
initialize().catch(error => {
  logger.error(`Unhandled initialization error: ${error.message}`, { error });
  process.exit(1);
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, { error });
  
  // In production, we might want to restart the bot after an uncaught exception
  if (process.env.NODE_ENV === 'production') {
    logger.info('Attempting to restart due to uncaught exception');
    process.exit(1); // Exit with error code, let process manager restart
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled promise rejection at: ${promise}, reason: ${reason}`);
});