/**
 * Discord Bot - Main Entry Point
 * A professional Discord bot for server management
 * Using both discord.js and oceanic.js for enhanced features
 */
require('dotenv').config();
const { logger } = require('./utils/logger');
const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');
const { Client: OceanicClient, ClientOptions, Constants } = require('oceanic.js');
const fs = require('fs');
const path = require('path');
const { bot, commands: commandConfig } = require('./config');
const { connectToDatabase } = require('./database/db');

// Set up Discord.js client with appropriate intents
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction
  ],
  allowedMentions: {
    parse: ['users', 'roles'],
    repliedUser: true
  }
});

// Set up Oceanic.js client with similar intents
const oceanicClient = new OceanicClient({
  auth: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
  gateway: {
    intents: [
      Constants.Intents.GUILDS,
      Constants.Intents.GUILD_MEMBERS,
      Constants.Intents.GUILD_MESSAGES,
      Constants.Intents.GUILD_MESSAGE_REACTIONS,
      Constants.Intents.MESSAGE_CONTENT,
      Constants.Intents.DIRECT_MESSAGES,
      Constants.Intents.DIRECT_MESSAGE_REACTIONS
    ]
  },
  allowedMentions: {
    roles: true,
    users: true,
    repliedUser: true
  }
});

// Store commands and cooldowns in collections
discordClient.commands = new Collection();
discordClient.cooldowns = new Collection();

// Initialize main function
async function initialize() {
  try {
    logger.info('Bot is starting up...');
    
    // Connect to database
    logger.info('Connecting to database...');
    const db = await connectToDatabase();
    discordClient.db = db;
    oceanicClient.db = db;
    
    // Load database models
    loadDatabaseModels();
    
    // Load Discord.js commands
    await loadDiscordCommands();
    
    // Load event handlers
    loadEvents();
    
    // Create basic event files if they don't exist
    createBasicEventFiles();
    
    // Log in to Discord with both clients
    logger.info('Logging in to Discord...');
    
    // Login with Discord.js client
    await discordClient.login(process.env.DISCORD_BOT_TOKEN);
    
    // Login with Oceanic.js client
    await oceanicClient.connect();
    
    logger.info('Bot initialization completed successfully!');
  } catch (error) {
    logger.error(`Error during initialization: ${error.message}`);
    console.error('Initialization error:', error);
    process.exit(1);
  }
}

function loadDatabaseModels() {
  try {
    logger.info('Loading database models...');
    // Models are loaded automatically in the connectToDatabase function
    // This function can be used to add additional setup or validation
  } catch (error) {
    logger.error(`Error loading database models: ${error.message}`);
    throw error;
  }
}

/**
 * Load and register all commands for discord.js client
 */
async function loadDiscordCommands() {
  try {
    logger.info('Loading commands...');
    
    // Get commands directory path
    const commandsPath = path.join(__dirname, 'commands');
    
    // Check if commands directory exists
    if (!fs.existsSync(commandsPath)) {
      logger.warn('Commands directory does not exist, creating it...');
      fs.mkdirSync(commandsPath, { recursive: true });
    }
    
    // Get all command category folders
    const commandCategories = fs.readdirSync(commandsPath).filter(
      file => fs.statSync(path.join(commandsPath, file)).isDirectory()
    );
    
    if (commandCategories.length === 0) {
      logger.warn('No command categories found');
    }
    
    // Load commands from each category
    for (const category of commandCategories) {
      const categoryPath = path.join(commandsPath, category);
      
      // Get all command files in the category
      const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
      
      logger.info(`Loading commands from category: ${category}`);
      
      for (const file of commandFiles) {
        const filePath = path.join(categoryPath, file);
        
        // Load the command file
        const command = require(filePath);
        
        // Validate command has required properties
        if ('data' in command && 'execute' in command) {
          // Add the command to the collection
          discordClient.commands.set(command.data.name, command);
          logger.verbose(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
        }
      }
    }
    
    logger.info(`Loaded ${discordClient.commands.size} commands successfully`);
  } catch (error) {
    logger.error(`Error loading commands: ${error.message}`);
    throw error;
  }
}

/**
 * Load and register all event handlers
 */
function loadEvents() {
  try {
    logger.info('Loading event handlers...');
    
    // Get events directory path
    const eventsPath = path.join(__dirname, 'events');
    
    // Create events directory if it doesn't exist
    if (!fs.existsSync(eventsPath)) {
      logger.warn('Events directory does not exist, creating it...');
      fs.mkdirSync(eventsPath, { recursive: true });
      
      // Create subdirectories for each client
      fs.mkdirSync(path.join(eventsPath, 'discord'), { recursive: true });
      fs.mkdirSync(path.join(eventsPath, 'oceanic'), { recursive: true });
    }
    
    // Load Discord.js events directly in the root of events directory
    const discordEventFiles = fs.readdirSync(eventsPath).filter(
      file => file.startsWith('discord.') && file.endsWith('.js')
    );
    
    for (const file of discordEventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      
      if (event.once) {
        discordClient.once(event.name, (...args) => event.execute(...args, discordClient));
      } else {
        discordClient.on(event.name, (...args) => event.execute(...args, discordClient));
      }
      
      logger.verbose(`Loaded Discord.js event: ${event.name}`);
    }
    
    // Load Discord.js events from discord/ subdirectory
    const discordEventsDir = path.join(eventsPath, 'discord');
    if (fs.existsSync(discordEventsDir)) {
      const discordDirEventFiles = fs.readdirSync(discordEventsDir).filter(file => file.endsWith('.js'));
      
      for (const file of discordDirEventFiles) {
        const filePath = path.join(discordEventsDir, file);
        const event = require(filePath);
        
        if (event.once) {
          discordClient.once(event.name, (...args) => event.execute(...args, discordClient));
        } else {
          discordClient.on(event.name, (...args) => event.execute(...args, discordClient));
        }
        
        logger.verbose(`Loaded Discord.js event from directory: ${event.name}`);
      }
    }
    
    // Load Oceanic.js events from oceanic/ subdirectory
    const oceanicEventsDir = path.join(eventsPath, 'oceanic');
    if (fs.existsSync(oceanicEventsDir)) {
      const oceanicEventFiles = fs.readdirSync(oceanicEventsDir).filter(file => file.endsWith('.js'));
      
      for (const file of oceanicEventFiles) {
        const filePath = path.join(oceanicEventsDir, file);
        const event = require(filePath);
        
        oceanicClient.on(event.name, (...args) => event.execute(...args, oceanicClient));
        logger.verbose(`Loaded Oceanic.js event: ${event.name}`);
      }
    }
    
    // Create default discord.js event listeners if we don't have any basic ready event
    if (discordEventFiles.length === 0 && !fs.existsSync(path.join(eventsPath, 'discord', 'ready.js'))) {
      createBasicEventFiles();
    }
    
    logger.info('Event handlers loaded successfully');
  } catch (error) {
    logger.error(`Error loading events: ${error.message}`);
    throw error;
  }
}

/**
 * Creates basic event files if they don't exist yet
 */
function createBasicEventFiles() {
  const eventsPath = path.join(__dirname, 'events');
  
  // Create basic discord.js ready event if it doesn't exist
  const readyEventPath = path.join(eventsPath, 'discord.ready.js');
  if (!fs.existsSync(readyEventPath)) {
    const readyEvent = `/**
 * Discord.js Ready Event
 */
const { logger } = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.info(\`Discord.js client ready! Logged in as \${client.user.tag}\`);
  }
};`;
    
    fs.writeFileSync(readyEventPath, readyEvent);
    logger.info('Created basic Discord.js ready event');
  }
  
  // Create basic discord.js interactionCreate event if it doesn't exist
  const interactionEventPath = path.join(eventsPath, 'discord.interactionCreate.js');
  if (!fs.existsSync(interactionEventPath)) {
    const interactionEvent = `/**
 * Discord.js Interaction Event
 */
const { Events, Collection } = require('discord.js');
const { logger } = require('../utils/logger');
const { commands } = require('../config');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Only process command interactions
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    
    // If command doesn't exist
    if (!command) {
      logger.warn(\`User \${interaction.user.tag} tried to use unknown command: \${interaction.commandName}\`);
      return;
    }
    
    // Handle cooldowns
    const { cooldowns } = client;
    
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? commands.cooldownDefault) * 1000;
    
    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        
        logger.debug(\`User \${interaction.user.tag} tried to use \${command.data.name} while on cooldown\`);
        
        return interaction.reply({
          content: \`Please wait \${timeLeft.toFixed(1)} more second\${timeLeft === 1 ? '' : 's'} before using the \\\`\${command.data.name}\\\` command again.\`,
          ephemeral: true
        });
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    
    try {
      logger.debug(\`User \${interaction.user.tag} used command: \${interaction.commandName}\`);
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(\`Error executing command \${interaction.commandName}: \${error.message}\`, { error });
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      }
    }
  }
};`;
    
    fs.writeFileSync(interactionEventPath, interactionEvent);
    logger.info('Created basic Discord.js interaction event');
  }
  
  // Create basic Oceanic.js ready event if it doesn't exist
  const oceanicReadyDir = path.join(eventsPath, 'oceanic');
  if (!fs.existsSync(oceanicReadyDir)) {
    fs.mkdirSync(oceanicReadyDir, { recursive: true });
  }
  
  const oceanicReadyPath = path.join(oceanicReadyDir, 'ready.js');
  if (!fs.existsSync(oceanicReadyPath)) {
    const oceanicReady = `/**
 * Oceanic.js Ready Event
 */
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'ready',
  execute(client) {
    logger.info(\`Oceanic.js client ready! Logged in as \${client.user.tag}\`);
  }
};`;
    
    fs.writeFileSync(oceanicReadyPath, oceanicReady);
    logger.info('Created basic Oceanic.js ready event');
  }
}

// Start the bot
initialize().catch(error => {
  logger.error(`Fatal error during bot startup: ${error.message}`);
  console.error('Fatal error during bot startup:', error);
  process.exit(1);
});