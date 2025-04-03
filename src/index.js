/**
 * Discord Bot - Main Entry Point
 * A professional Discord bot for server management
 */
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./utils/logger');
const { connectToDatabase } = require('./database/db');
const http = require('http');

// Check for required environment variables
if (!process.env.DISCORD_BOT_TOKEN) {
  logger.error('Missing DISCORD_BOT_TOKEN in environment variables');
  process.exit(1);
}

// Create client instance with all necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildPresences
  ]
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();
client.activeModmailThreads = new Map();
client.blockedModmailUsers = new Set();

// Create simple HTTP server for health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord bot is running!');
});

server.listen(3000, '0.0.0.0', () => {
  logger.info('Health check server running on port 3000');
});

/**
 * Load and register all commands
 */
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(commandsPath);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    
    // Skip if not a directory
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      
      // Set a name key on the command if one isn't set
      if (!command.data?.name) {
        logger.warn(`Command at ${filePath} is missing a required "data.name" property.`);
        continue;
      }
      
      // Set command handler method if not defined
      if (!command.execute) {
        logger.warn(`Command ${command.data.name} doesn't have an "execute" method`);
        continue;
      }
      
      logger.info(`Loaded command: ${command.data.name} from ${folder}/${file}`);
      client.commands.set(command.data.name, command);
    }
  }
  
  logger.info(`Loaded a total of ${client.commands.size} commands`);
}

/**
 * Load and register all event handlers
 */
function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  const eventFolders = fs.readdirSync(eventsPath);
  
  for (const folder of eventFolders) {
    const folderPath = path.join(eventsPath, folder);
    
    // Skip if not a directory
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const eventFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
      const filePath = path.join(folderPath, file);
      const event = require(filePath);
      
      if (!event.name) {
        logger.warn(`Event at ${filePath} is missing a required "name" property.`);
        continue;
      }
      
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      
      logger.info(`Loaded event: ${event.name} from ${folder}/${file}`);
    }
  }
}

/**
 * Main initialization function
 */
async function initialize() {
  try {
    logger.info('Initializing Discord bot...');
    
    // Connect to database
    await connectToDatabase();
    logger.info('Database connection established');
    
    // Load commands and events
    await loadCommands();
    loadEvents();
    
    // Login to Discord
    await client.login(process.env.DISCORD_BOT_TOKEN);
    logger.info(`Bot logged in as ${client.user.tag}`);
    
    // Set bot status
    client.user.setPresence({
      activities: [{ name: '/help | Professional Moderation', type: 3 }],
      status: 'online'
    });
    
    logger.info('Bot initialization completed');
  } catch (error) {
    logger.error('Error during bot initialization:', error);
    process.exit(1);
  }
}

// Start the bot
initialize();

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

// Handle SIGINT
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  client.destroy();
  server.close();
  process.exit(0);
});