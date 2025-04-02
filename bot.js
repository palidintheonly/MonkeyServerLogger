// Main entry point for the Discord bot
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./src/utils/logger');
const { connectToDatabase } = require('./src/database/db');

// Setup client with appropriate intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration || GatewayIntentBits.GuildBans,
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

// Error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Shutting down gracefully...');
  process.exit(0);
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
  
  const rest = new REST().setToken(token);
  
  try {
    logger.info(`Started refreshing ${commands.length} application commands`);
    
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    
    logger.info(`Successfully reloaded ${data.length} application commands`);
  } catch (error) {
    logger.error('Error registering commands:', error);
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

// Health check server
function startHealthServer() {
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Discord bot is running!');
  });
  
  server.listen(5000, '0.0.0.0', () => {
    logger.info('Health check server running on port 5000');
  });
  
  server.on('error', (error) => {
    logger.error('HTTP server error:', error);
  });
}

// Main initialization function
async function init() {
  logger.info('Starting Monkey Bytes Discord Bot...');
  
  try {
    // Connect to database
    await connectToDatabase();
    logger.info('Database connection established');
    
    // Register events
    registerEvents();
    
    // Register commands
    await registerCommands();
    
    // Login to Discord
    const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
    await client.login(token);
    
    // Start HTTP health check server
    client.once(Events.ClientReady, () => {
      startHealthServer();
    });
    
    logger.info('Bot initialization completed');
  } catch (error) {
    logger.error('Error during bot initialization:', error);
    process.exit(1);
  }
}

// Start the bot
init();