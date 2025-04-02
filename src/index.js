require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./utils/logger');
const { connectToDatabase } = require('./database/db');
const config = require('./config');

// Check if running as a shard or directly
const isSharded = process.argv.includes('--shard');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ],
  shards: isSharded ? 'auto' : undefined,
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Command registration
async function registerCommands() {
  const commands = [];
  // Read command folders
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath).filter(file => !file.includes('.'));
  
  // First, load commands directly in the commands folder
  const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
  
  // Then, load commands from subfolders
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command from ${folder}: ${command.data.name}`);
      } else {
        logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }
  }

  // Register commands with Discord
  const rest = new REST().setToken(process.env.TOKEN);

  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    logger.error(error);
  }
}

// Event handler registration
function registerEvents() {
  // Client events
  const clientEventsPath = path.join(__dirname, 'events', 'client');
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
  const guildEventsPath = path.join(__dirname, 'events', 'guild');
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

// Initialize bot
async function init() {
  logger.info('Starting Monkey Bytes Discord Bot...');
  
  try {
    // Connect to the database
    await connectToDatabase();
    logger.info('Database connection established');
    
    // Register events
    registerEvents();
    
    // Register commands
    await registerCommands();
    
    // Login to Discord
    await client.login(process.env.TOKEN);
    
    logger.info('Bot initialization completed');
  } catch (error) {
    logger.error('Error during bot initialization:', error);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start the bot
init();
