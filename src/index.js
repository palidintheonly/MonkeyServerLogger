require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./utils/logger');
const { connectToDatabase } = require('./database/db');
const config = require('./config');

// This file is used both directly and by the sharding manager
const isSharded = process.env.SHARDED === 'true' || process.argv.includes('--shard');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration || GatewayIntentBits.GuildBans, // Fallback to GuildBans if GuildModeration is not available
    GatewayIntentBits.DirectMessages, // Required for DM modmail system
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildPresences // Added for activity tracking
  ]
  // Let Discord.js Sharding Manager handle shard configuration
});

// Initialize collections
client.commands = new Collection();
client.contextCommands = new Collection();
client.cooldowns = new Collection();
client.activeModmailThreads = new Map();
client.blockedModmailUsers = new Set();

// Command registration
async function registerCommands() {
  const commands = [];
  const commandNames = new Set(); // Track command names to prevent duplicates
  
  // Read command folders
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath).filter(file => !file.includes('.'));
  
  // First, load commands directly in the commands folder
  const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      // Check for duplicate command names
      const commandName = command.data.name;
      if (commandNames.has(commandName)) {
        logger.warn(`Duplicate command name detected: ${commandName}. Skipping to prevent Discord API errors.`);
        continue;
      }
      
      commandNames.add(commandName);
      commands.push(command.data.toJSON());
      client.commands.set(commandName, command);
      logger.info(`Loaded command: ${commandName}`);
    } else {
      logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
  
  // Then, load commands from subfolders (except context folder - we'll handle that separately)
  for (const folder of commandFolders) {
    // Skip context folder here - will handle separately to avoid duplicates
    if (folder === 'context') continue;
    
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        // Check for duplicate command names
        const commandName = command.data.name;
        if (commandNames.has(commandName)) {
          logger.warn(`Duplicate command name detected: ${commandName} in ${folder}. Skipping to prevent Discord API errors.`);
          continue;
        }
        
        commandNames.add(commandName);
        commands.push(command.data.toJSON());
        client.commands.set(commandName, command);
        logger.info(`Loaded command from ${folder}: ${commandName}`);
      } else {
        logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }
  }
  
  // Load context menu commands separately and store in contextCommands collection
  const contextPath = path.join(__dirname, 'commands', 'context');
  if (fs.existsSync(contextPath)) {
    const contextFiles = fs.readdirSync(contextPath).filter(file => file.endsWith('.js'));
    
    for (const file of contextFiles) {
      const filePath = path.join(contextPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        // Check for duplicate command names
        const commandName = command.data.name;
        if (commandNames.has(commandName)) {
          logger.warn(`Duplicate context command name detected: ${commandName}. Skipping to prevent Discord API errors.`);
          continue;
        }
        
        commandNames.add(commandName);
        commands.push(command.data.toJSON());
        client.contextCommands.set(commandName, command);
        logger.info(`Loaded context command: ${commandName}`);
      } else {
        logger.warn(`The context command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }
  }
  
  logger.info(`Total unique commands loaded: ${commandNames.size}`);

  // Register commands with Discord - Force reload approach with retries
  const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
  if (!token) {
    logger.error('No Discord bot token found in environment variables!');
    process.exit(1);
  }
  const rest = new REST().setToken(token);
  
  // Utility function for delay with exponential backoff
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Generic retry function with exponential backoff
  const retryOperation = async (operation, maxRetries = 3, baseDelay = 1000) => {
    let attempts = 0;
    let lastError;
    
    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempts++;
        
        if (attempts >= maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempts);
        logger.warn(`API operation failed, retrying in ${delay}ms... (${attempts}/${maxRetries})`);
        await sleep(delay);
      }
    }
    
    throw lastError;
  };

  try {
    logger.info(`Started force-refreshing ${commands.length} application (/) commands.`);

    // Step 1: Retrieve existing commands with retry mechanism
    logger.info('Retrieving current application commands...');
    const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;
    const existingCommands = await retryOperation(
      () => rest.get(Routes.applicationCommands(clientId)),
      3, 2000
    );
    
    if (existingCommands.length > 0) {
      logger.info(`Found ${existingCommands.length} existing commands, removing them all...`);
      
      // Step 2: Delete each command individually with retry mechanism
      for (const cmd of existingCommands) {
        logger.info(`Deleting command: ${cmd.name} (${cmd.id})`);
        await retryOperation(
          () => rest.delete(Routes.applicationCommand(clientId, cmd.id)),
          3, 1000
        );
      }
    }

    // Step 3: Wait a moment to ensure Discord's cache is updated
    logger.info('Waiting for Discord API cache to clear...');
    await sleep(3000); // Increase wait time to 3 seconds
    
    // Step 4: Register all commands fresh with retry mechanism
    logger.info('Registering all commands from scratch...');
    const data = await retryOperation(
      () => rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      ),
      3, 5000
    );

    logger.info(`Successfully force-reloaded ${data.length} application (/) commands.`);
    
    // Optional: Register to a specific guild for development if SUPPORT_GUILD_ID is provided
    if (process.env.SUPPORT_GUILD_ID) {
      logger.info(`Also registering commands to support guild: ${process.env.SUPPORT_GUILD_ID}`);
      
      // First clear existing guild commands with retry mechanism
      const existingGuildCommands = await retryOperation(
        () => rest.get(
          Routes.applicationGuildCommands(clientId, process.env.SUPPORT_GUILD_ID)
        ),
        3, 1000
      );
      
      if (existingGuildCommands.length > 0) {
        logger.info(`Found ${existingGuildCommands.length} existing guild commands, removing them...`);
        for (const cmd of existingGuildCommands) {
          await retryOperation(
            () => rest.delete(
              Routes.applicationGuildCommand(clientId, process.env.SUPPORT_GUILD_ID, cmd.id)
            ),
            3, 1000
          );
        }
      }
      
      // Then register new guild commands with retry mechanism
      await retryOperation(
        () => rest.put(
          Routes.applicationGuildCommands(clientId, process.env.SUPPORT_GUILD_ID),
          { body: commands }
        ),
        3, 5000
      );
      
      logger.info('Guild-specific command registration complete.');
    }
  } catch (error) {
    logger.safeError('Error during command registration', error);
    if (error.rawError?.errors) {
      logger.safeError('Error details', error.rawError.errors);
    }
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
    
    // Check token availability
    const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
    if (!token) {
      logger.error('No Discord bot token found in environment variables (checked DISCORD_BOT_TOKEN and TOKEN)!');
      process.exit(1);
    }
    
    logger.info('Discord bot token found in environment variables');
    
    // Check for client ID
    const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;
    if (!clientId) {
      logger.error('No Discord client ID found in environment variables (checked DISCORD_APPLICATION_ID and CLIENT_ID)!');
      process.exit(1);
    }
    logger.info(`Using client ID: ${clientId}`);
    
    // Register commands
    await registerCommands();
    
    // Login to Discord with direct token reference
    logger.info('Attempting to log in to Discord...');
    try {
      await client.login(token);
      logger.info('Successfully logged in to Discord!');
    } catch (loginError) {
      logger.safeError('Failed to log in to Discord', loginError);
      throw loginError;
    }
    
    logger.info('Bot initialization completed');
  } catch (error) {
    logger.safeError('Error during bot initialization', error);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', error => {
  logger.safeError('Unhandled promise rejection', error);
});

process.on('uncaughtException', error => {
  logger.safeError('Uncaught exception', error);
  process.exit(1);
});

// Add basic HTTP server to keep deployment healthy
// We'll only run the HTTP server on the primary process to avoid port conflicts
// For ShardingManager, this means only run on the manager process, not the shards

// In a sharded environment, we need to be very careful with detecting if we're the first shard
let shouldRunHttpServer = false;

// First check if we're running in the ShardingManager (not a shard)
if (!isSharded) {
  shouldRunHttpServer = true;
  logger.info('Running as standalone client, will start HTTP server');
} else {
  // We're a shard, check if we're shard 0
  try {
    // Attempt to extract shard ID directly from client
    const currentShardId = client.shard?.ids[0];
    
    if (currentShardId === 0) {
      shouldRunHttpServer = true;
      logger.info('Running as shard 0, will start HTTP server');
    } else {
      logger.info(`Running as shard ${currentShardId}, will NOT start HTTP server`);
    }
  } catch (error) {
    logger.warn('Failed to determine shard ID, will NOT start HTTP server:', error);
  }
}

// Only run the HTTP server if we determined this is the right process
if (shouldRunHttpServer) {
  // Delay starting HTTP server until after client is ready to ensure we don't have port conflicts
  client.once(Events.ClientReady, () => {
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end(`Discord bot is running! ${isSharded ? `(Shard ${client.shard?.ids[0] || 0})` : ''}`);
    });

    // Try multiple ports in case the default is in use
    const tryPort = (port) => {
      server.once('error', err => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${port} is already in use, trying next port...`);
          tryPort(port + 1);
        } else {
          logger.safeError(`Server error`, err);
        }
      });
      
      server.once('listening', () => {
        const address = server.address();
        logger.info(`Health check server running on port ${address.port}`);
      });
      
      server.listen(port, '0.0.0.0');
    };
    
    tryPort(7000); // Start with port 7000 which should be available
      
    // Handle other HTTP server errors that might occur after listening
    server.on('error', (error) => {
      if (error.code !== 'EADDRINUSE') { // EADDRINUSE is already handled in tryPort
        logger.safeError('HTTP server error', error);
      }
    });
  });
} else {
  logger.info('Skipping health check server on this process to avoid port conflicts');
}

// Start the bot
init();
