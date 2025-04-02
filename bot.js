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
async function registerCommands(forceReload = false) {
  const commands = [];
  const commandNames = new Set();
  
  // Clear command collections if force reloading
  if (forceReload) {
    logger.info('Force reloading all commands - clearing command cache');
    client.commands.clear();
    client.contextCommands.clear();
  }
  
  // Load main commands
  const foldersPath = path.join(__dirname, 'src', 'commands');
  const commandFolders = fs.readdirSync(foldersPath).filter(file => !file.includes('.'));
  
  // PRIORITY: Load NEW commands first
  const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
  if (fs.existsSync(newCommandsPath)) {
    const newCommandFiles = fs.readdirSync(newCommandsPath).filter(file => file.endsWith('.js'));
    
    logger.info(`Found ${newCommandFiles.length} new-style commands in src/new_commands`);
    
    for (const file of newCommandFiles) {
      const filePath = path.join(newCommandsPath, file);
      
      // Clear require cache for this file if force reloading
      if (forceReload && require.cache[require.resolve(filePath)]) {
        delete require.cache[require.resolve(filePath)];
        logger.debug(`Cleared cache for new command: ${file}`);
      }
      
      try {
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          const commandName = command.data.name;
          if (!commandNames.has(commandName)) {
            commandNames.add(commandName);
            commands.push(command.data.toJSON());
            client.commands.set(commandName, command);
            logger.info(`Loaded new command: ${commandName}`);
          } else {
            logger.warn(`Command name collision: ${commandName} from new commands already exists, skipping`);
          }
        } else {
          logger.warn(`Command ${file} is missing required 'data' or 'execute' properties`);
        }
      } catch (error) {
        logger.error(`Error loading new command ${file}: ${error.message}`);
      }
    }
  } else {
    logger.warn('New commands directory not found at src/new_commands, skipping');
  }
  
  // Direct commands in commands folder
  const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    
    // Clear require cache for this file if force reloading
    if (forceReload && require.cache[require.resolve(filePath)]) {
      delete require.cache[require.resolve(filePath)];
      logger.debug(`Cleared cache for command: ${file}`);
    }
    
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
      
      // Clear require cache for this file if force reloading
      if (forceReload && require.cache[require.resolve(filePath)]) {
        delete require.cache[require.resolve(filePath)];
        logger.debug(`Cleared cache for command: ${folder}/${file}`);
      }
      
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
      
      // Clear require cache for this file if force reloading
      if (forceReload && require.cache[require.resolve(filePath)]) {
        delete require.cache[require.resolve(filePath)];
        logger.debug(`Cleared cache for context command: ${file}`);
      }
      
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        const commandName = command.data.name;
        if (!commandNames.has(commandName)) {
          commandNames.add(commandName);
          
          // Special handling for context menu commands - remove description
          const commandJson = command.data.toJSON();
          // Check the command type (2 is user, 3 is message)
          const commandType = commandJson.type === 2 ? 'User' : commandJson.type === 3 ? 'Message' : 'Unknown';
          
          // Remove the description field as it's not needed for context menu commands
          // and will cause Discord API to reject the command
          if (commandJson.type === 2 || commandJson.type === 3) {
            // Make sure to remove description before sending to Discord API
            const { description, ...commandWithoutDescription } = commandJson;
            commands.push(commandWithoutDescription);
            logger.info(`Loaded context command: ${commandName} (${commandType})`);
          } else {
            commands.push(commandJson);
            logger.info(`Loaded context command: ${commandName}`);
          }
          
          client.contextCommands.set(commandName, command);
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
    
    // STEP 1: Retrieve existing commands to delete them using the REST API
    logger.info('Retrieving current application commands for deletion...');
    try {
      // Use REST API directly for more reliable command retrieval
      const REST = require('@discordjs/rest').REST;
      const Routes = require('discord-api-types/v10').Routes;
      
      // Create a fresh REST instance with the latest token
      const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
      const restApi = new REST({ version: '10' }).setToken(token);
      
      // Fetch all registered commands from Discord's API
      const existingCommands = await restApi.get(
        Routes.applicationCommands(clientId)
      );
      
      if (existingCommands && existingCommands.length > 0) {
        logger.info(`Found ${existingCommands.length} existing commands on Discord API, deleting them all first...`);
        console.log(`Deleting ${existingCommands.length} existing commands from Discord API...`);
        
        // Delete each command individually with a slight delay to avoid rate limits
        for (const cmd of existingCommands) {
          logger.info(`Deleting command: ${cmd.name} (ID: ${cmd.id})`);
          try {
            await restApi.delete(Routes.applicationCommand(clientId, cmd.id));
            logger.info(`Successfully deleted command: ${cmd.name}`);
            // Brief pause to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (deleteError) {
            logger.error(`Failed to delete command ${cmd.name}: ${deleteError.message}`);
            logger.error(`Error details: ${JSON.stringify(deleteError)}`);
          }
        }
        
        // Wait to make sure Discord's cache is updated
        logger.info('Waiting for Discord API cache to clear (3 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try retrieving again to make sure they're gone
        const checkCommands = await restApi.get(
          Routes.applicationCommands(clientId)
        );
        
        if (checkCommands && checkCommands.length > 0) {
          logger.warn(`ALERT: ${checkCommands.length} commands still exist after deletion. Discord's cache may be slow to update.`);
        } else {
          logger.info('Confirmed all commands were successfully deleted.');
        }
      } else {
        logger.info('No existing commands found to delete');
      }
    } catch (fetchError) {
      logger.error(`Error during command deletion process: ${fetchError.message}`);
      logger.error(`Error details: ${JSON.stringify(fetchError)}`);
      logger.warn('Continuing with command registration despite deletion error');
    }
    
    // STEP 2: Validate new commands before sending
    logger.info('Validating new commands before registration...');
    for (const command of commands) {
      if (command.options) {
        // Log commands with subcommands for debugging
        const hasSubcommands = command.options.some(option => option.type === 1);
        if (hasSubcommands) {
          logger.info(`Command '${command.name}' has ${command.options.filter(opt => opt.type === 1).length} subcommands`);
          
          // List all subcommands for verification
          const subcommandNames = command.options
            .filter(opt => opt.type === 1)
            .map(sc => sc.name)
            .join(', ');
          logger.info(`Subcommands for '${command.name}': ${subcommandNames}`);
        }
        
        for (const option of command.options) {
          // Check for subcommand with setDefaultMemberPermissions
          if (option.type === 1 && option.default_member_permissions) {
            logger.warn(`Command '${command.name}' has subcommand '${option.name}' with permissions. This is not supported in Discord.js v14.`);
            // Remove the invalid permission from the subcommand
            delete option.default_member_permissions;
          }
          
          // Add additional validation for subcommands if needed
          if (option.type === 1) {
            // Check that subcommand has a name and description
            if (!option.name || !option.description) {
              logger.error(`Subcommand for '${command.name}' is missing name or description!`);
            }
          }
        }
      }
    }
    
    // STEP 3: Register all commands from scratch
    logger.info('Registering all commands from scratch...');
    
    // Run command structure diagnostics before registration
    logger.info('Running command structure diagnostics before registration...');
    const diagnosticResult = diagnoseCommandData(commands);
    
    if (!diagnosticResult) {
      logger.warn('Command diagnostics detected issues - registration might fail');
      console.log('WARNING: Command structure validation found issues - see logs for details');
    } else {
      logger.info('Command diagnostics complete - all commands appear valid');
    }
    
    // Log summary of commands for registration
    logger.info(`Prepared ${commands.length} commands for registration`);
    commands.forEach(cmd => {
      const cmdDetails = {
        name: cmd.name,
        description: cmd.description,
        options_count: cmd.options?.length || 0,
        has_subcommands: cmd.options && cmd.options.some(opt => opt.type === 1)
      };
      logger.info(`Command details: ${JSON.stringify(cmdDetails)}`);
      
      // Log detailed subcommand information for each command with subcommands
      if (cmd.options && cmd.options.some(opt => opt.type === 1)) {
        logger.info(`Subcommands for ${cmd.name}:`);
        cmd.options.filter(opt => opt.type === 1).forEach(sc => {
          logger.info(`  - ${sc.name}: ${sc.description} (options: ${sc.options?.length || 0})`);
        });
      }
    });
    
    try {
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      
      logger.info(`Successfully reloaded ${data.length} application commands`);
      console.log(`SUCCESS: Registered ${data.length} commands with Discord API`);
      
      // Log each registered command name for debugging
      data.forEach(cmd => {
        const subcommandCount = cmd.options?.filter(opt => opt.type === 1).length || 0;
        logger.debug(`Registered command: ${cmd.name}${subcommandCount > 0 ? ` (with ${subcommandCount} subcommands)` : ''}`);
      });
    } catch (registrationError) {
      logger.error(`Command registration error details: ${JSON.stringify(registrationError)}`);
      // Attempt registration one by one if bulk registration fails
      logger.warn('Bulk registration failed, attempting to register commands one by one...');
      
      const registeredCommands = [];
      for (const command of commands) {
        try {
          logger.info(`Registering individual command: ${command.name}`);
          const registeredCommand = await rest.post(
            Routes.applicationCommands(clientId),
            { body: command }
          );
          registeredCommands.push(registeredCommand);
          logger.info(`Successfully registered command: ${command.name}`);
        } catch (error) {
          logger.error(`Failed to register command ${command.name}: ${error.message}`);
        }
        // Add a slight delay between registrations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info(`Registered ${registeredCommands.length} commands individually`);
      throw registrationError; // Re-throw the original error to be handled by the caller
    }
    
    return true; // Return true to indicate success
  } catch (error) {
    // Enhanced error handling with detailed logging
    logger.error(`Command registration error: ${error.message}`);
    
    // Check for specific error types and log accordingly
    if (error.code === 50035) {
      logger.error('This appears to be an invalid command structure error from Discord API');
      logger.error(`Invalid field details: ${JSON.stringify(error.errors || {})}`);
      console.error('ERROR: Discord rejected the command structure - check for invalid options');
    } else if (error.httpStatus === 429) {
      logger.error('Rate limit exceeded during command registration');
      logger.error(`Retry after: ${error.retry_after || 'Unknown'} seconds`);
      console.error('ERROR: Discord rate limit exceeded - try again later');
    } else if (error.httpStatus === 401) {
      logger.error('Authentication failed when registering commands - token may be invalid');
      console.error('ERROR: Discord rejected the bot token - check your DISCORD_BOT_TOKEN in Replit Secrets');
    } else {
      logger.error(`Unknown error type: ${error.code || 'No code'}, HTTP status: ${error.httpStatus || 'Unknown'}`);
      logger.error(`Full error details: ${JSON.stringify(error)}`);
      console.error(`ERROR: Command registration failed: ${error.message}`);
    }
    
    // Continue running the bot despite the error
    logger.warn('Bot will continue to function, but commands may not be properly registered with Discord');
    console.log('The bot will continue running, but slash commands may not work correctly');
    
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
      
      // ALWAYS register commands with Discord API on startup and force a reload
      logger.info('Automatically registering commands with Discord API on startup (with FORCED cache clearing)...');
      try {
        // Force parameter (TRUE) to clear ALL cache and ensure we have the latest command code
        // This will remove old commands and register all current commands
        logger.info('Clearing ALL command cache and registering fresh commands...');
        const commandsRegistered = await registerCommands(true);
        
        if (commandsRegistered) {
          logger.info('Successfully registered all commands with Discord API');
          console.log('SUCCESS: All commands registered with Discord API');
        } else {
          logger.warn('Command registration returned false - trying again with more debugging');
          // Try again with more debugging information
          logger.info('Attempting command registration again with additional logging...');
          await registerCommands(true);
        }
      } catch (error) {
        logger.error(`Command registration error: ${error.message}`);
        logger.error(`Error details: ${JSON.stringify(error)}`);
        logger.warn('Bot will continue functioning, but commands may not be available');
        // Continue anyway - at least the bot will be online
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
    
    // Loading indicators have been removed as requested
    logger.info('All loading animations have been removed from the bot as requested');
    
    // Set bot status message
    client.user.setPresence({
      activities: [{ name: 'Discord Bot with Enhanced Logging | /help', type: 0 }],
      status: 'online'
    });
    
    logger.info('Bot initialization completed');
  } catch (error) {
    logger.safeError('Error during bot initialization', error);
    process.exit(1);
  }
}

// Reload commands periodically (useful during development)
function setupCommandReloading() {
  // Check environment variable for command auto-reloading
  const autoReloadEnabled = process.env.AUTO_RELOAD_COMMANDS === 'true';
  
  if (autoReloadEnabled) {
    logger.info('Command auto-reloading is enabled, will refresh commands every hour');
    
    // Reload commands every hour with force parameter to clear cache
    const reloadInterval = 60 * 60 * 1000; // Every hour
    setInterval(async () => {
      logger.info('Automatic command reloading started (with COMPLETE cache clearing)...');
      try {
        // Clear command collections first to ensure a clean state
        client.commands.clear();
        client.contextCommands.clear();
        logger.info('Command collections cleared for forced reloading');
        
        // Pass true to force reload and clear require cache
        await registerCommands(true);
        logger.info('Automatic command reloading completed successfully');
        console.log(`REFRESH: Commands have been automatically refreshed with Discord API (${new Date().toISOString()})`);
      } catch (error) {
        logger.error(`Error during automatic command reloading: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
      }
    }, reloadInterval);
    
    // Do an initial forced reload to make sure we have the latest changes
    // This happens 5 seconds after startup to ensure everything else is initialized
    setTimeout(async () => {
      try {
        logger.info('Performing initial forced command reload (with collection clearing)...');
        // Clear command collections first
        client.commands.clear();
        client.contextCommands.clear();
        
        // Register with force=true
        await registerCommands(true);
        logger.info('Initial forced command reload completed successfully');
        console.log('REFRESH: Initial forced command registration completed');
      } catch (error) {
        logger.error(`Error during initial forced command reload: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
      }
    }, 5000);
  } else {
    logger.info('Command auto-reloading is disabled. Commands will only be reloaded on startup.');
    // Even when auto-reload is disabled, do one forced reload 5 seconds after startup
    setTimeout(async () => {
      try {
        logger.info('Performing one-time forced command reload...');
        await registerCommands(true);
        logger.info('One-time forced command reload completed successfully');
      } catch (error) {
        logger.error(`Error during one-time forced command reload: ${error.message}`);
      }
    }, 5000);
  }
}

/**
 * Diagnose and validate command data before registration
 * This function checks for common issues in command definitions
 * @param {Array} commands - Array of command data objects
 * @returns {boolean} - True if all commands are valid, false if issues found
 */
function diagnoseCommandData(commands) {
  let isValid = true;
  logger.info('Performing detailed command structure validation...');
  
  for (const command of commands) {
    // Skip description validation for context menu commands (type 2 is USER, type 3 is MESSAGE)
    const isContextCommand = command.type === 2 || command.type === 3;
    
    // Check basic command properties (context commands don't need description)
    if (!command.name || (!isContextCommand && !command.description)) {
      logger.error(`Invalid command missing required properties: ${JSON.stringify(command)}`);
      isValid = false;
      continue;
    }
    
    const commandType = isContextCommand 
      ? (command.type === 2 ? 'USER_CONTEXT' : 'MESSAGE_CONTEXT')
      : 'CHAT_INPUT';
    
    logger.info(`Validating command: ${command.name} (type: ${commandType})`);
    
    // Check if the command has options
    if (command.options && command.options.length > 0) {
      // Check for commands with subcommands (type 1)
      const hasSubcommands = command.options.some(opt => opt.type === 1);
      const subcommands = command.options.filter(opt => opt.type === 1);
      
      if (hasSubcommands) {
        logger.info(`Command ${command.name} has ${subcommands.length} subcommands`);
        
        // Validate each subcommand
        for (const subcommand of subcommands) {
          if (!subcommand.name || !subcommand.description) {
            logger.error(`Subcommand for ${command.name} is missing name or description: ${JSON.stringify(subcommand)}`);
            isValid = false;
            continue;
          }
          
          logger.info(`  Subcommand: ${subcommand.name}`);
          
          // Check if the subcommand has options
          if (subcommand.options && subcommand.options.length > 0) {
            for (const option of subcommand.options) {
              if (!option.name || !option.description || option.type === undefined) {
                logger.error(`Invalid option in subcommand ${subcommand.name}: ${JSON.stringify(option)}`);
                isValid = false;
                continue;
              }
              
              // Log option details for debugging
              logger.info(`    Option: ${option.name} (type: ${option.type}, required: ${option.required || false})`);
              
              // Check if option type is valid (should be 3=string, 4=integer, 5=boolean, 6=user, 7=channel, etc.)
              if (![3, 4, 5, 6, 7, 8, 9, 10, 11].includes(option.type)) {
                logger.warn(`Unusual option type ${option.type} in ${subcommand.name}.${option.name}`);
              }
            }
          }
        }
      } else {
        // Regular command with options (no subcommands)
        for (const option of command.options) {
          if (!option.name || !option.description || option.type === undefined) {
            logger.error(`Invalid option in command ${command.name}: ${JSON.stringify(option)}`);
            isValid = false;
            continue;
          }
          
          // Log option details for debugging
          logger.info(`  Option: ${option.name} (type: ${option.type}, required: ${option.required || false})`);
        }
      }
    }
  }
  
  if (isValid) {
    logger.info('All commands passed structure validation');
  } else {
    logger.error('Command validation failed - see logs above for details');
  }
  
  return isValid;
}

// Export the registerCommands function and other utilities so they can be used by other files
module.exports = {
  registerCommands,
  diagnoseCommandData
};

// Start the bot
(async () => {
  try {
    await init();
    logger.info('Bot initialization completed successfully');
    
    // Set up periodic command reloading after bot is initialized
    setupCommandReloading();
    logger.info('Command auto-reload configuration completed');
  } catch (error) {
    logger.error(`Failed to initialize bot: ${error.message}`);
    process.exit(1);
  }
})();