/**
 * Discord-Friendly Command Registration Script
 * 
 * This script properly handles Discord API rate limits for:
 * 1. Deleting existing application commands
 * 2. Registering the new commands from src/new_commands directory
 * 
 * Run with: node register-commands-safe.js
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./src/utils/logger');

// Configure REST client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

/**
 * Execute a function with enhanced retry logic for rate limits and timeouts
 * @param {Function} fn - Function to execute
 * @param {string} operation - Name of operation for logging
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} - Result of the function
 */
async function executeWithRateLimitHandling(fn, operation, maxRetries = 7) {
  let retries = 0;
  let lastError = null;
  
  while (retries <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.code === 429) {
        const retryAfter = error.response?.data?.retry_after ?? 5;
        retries++;
        
        logger.warn(`Rate limited on ${operation}. Waiting ${retryAfter}s before retry ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } 
      // Handle timeout errors
      else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.name === 'AbortError') {
        retries++;
        
        // Exponential backoff starting with 1s
        const delay = Math.min(Math.pow(2, retries - 1) * 1000, 60000);
        logger.warn(`Connection issue during ${operation}. Waiting ${delay/1000}s before retry ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      // Other errors should fail immediately
      else {
        logger.error(`Error during ${operation}:`, error);
        throw error;
      }
    }
  }
  
  // If we're here, we've exceeded max retries
  logger.error(`Exceeded maximum retries (${maxRetries}) for ${operation}`);
  throw lastError;
}

/**
 * Delete a Discord application command safely with rate limit handling
 * @param {string} commandId - Discord command ID
 * @param {string} commandName - Command name for logging
 */
async function safelyDeleteCommand(commandId, commandName) {
  return executeWithRateLimitHandling(
    async () => {
      const response = await rest.delete(
        Routes.applicationCommand(process.env.CLIENT_ID, commandId)
      );
      logger.info(`Deleted command: ${commandName} (${commandId})`);
      return response;
    },
    `delete command ${commandName}`
  );
}

/**
 * Safely fetch all registered application commands
 * @returns {Promise<Array>} Array of command objects
 */
async function safelyFetchCommands() {
  return executeWithRateLimitHandling(
    async () => {
      const response = await rest.get(
        Routes.applicationCommands(process.env.CLIENT_ID)
      );
      logger.info(`Fetched ${response.length} existing commands`);
      return response;
    },
    'fetch commands'
  );
}

/**
 * Register application commands one by one with rate limit handling
 * @param {Array} commands - Array of command data
 * @returns {Promise<Array>} Registered commands
 */
async function safelyRegisterCommands(commands) {
  const registeredCommands = [];
  
  for (const command of commands) {
    try {
      const registeredCommand = await executeWithRateLimitHandling(
        async () => {
          const response = await rest.post(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: command }
          );
          logger.info(`Registered command: ${command.name}`);
          return response;
        },
        `register command ${command.name}`
      );
      
      registeredCommands.push(registeredCommand);
    } catch (error) {
      logger.error(`Failed to register command ${command.name}:`, error);
      // Continue with other commands
    }
  }
  
  return registeredCommands;
}

/**
 * Load command files from the src/commands directory
 * @returns {Array} Array of command data objects
 */
function loadAllCommands() {
  const commands = [];
  
  try {
    // Load commands from new_commands directory (prioritize these)
    const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
    if (fs.existsSync(newCommandsPath)) {
      const newCommandFiles = fs.readdirSync(newCommandsPath)
        .filter(file => file.endsWith('.js'));
      
      logger.info(`Found ${newCommandFiles.length} files in new_commands directory`);
      
      for (const file of newCommandFiles) {
        try {
          const command = require(path.join(newCommandsPath, file));
          
          // Validate command has required properties
          if (command.data && command.execute) {
            // Convert SlashCommandBuilder to JSON if needed
            if (typeof command.data.toJSON === 'function') {
              commands.push(command.data.toJSON());
            } else {
              commands.push(command.data);
            }
          } else {
            logger.warn(`Command ${file} is missing required properties`);
          }
        } catch (error) {
          logger.error(`Error loading command ${file}:`, error);
        }
      }
    } else {
      logger.warn('new_commands directory not found, skipping');
    }
    
    // Optionally: Load commands from regular commands directory
    const commandsPath = path.join(__dirname, 'src', 'commands');
    if (fs.existsSync(commandsPath)) {
      // Find all command categories (subdirectories)
      const categories = fs.readdirSync(commandsPath)
        .filter(folder => fs.statSync(path.join(commandsPath, folder)).isDirectory());
      
      for (const category of categories) {
        const categoryPath = path.join(commandsPath, category);
        const commandFiles = fs.readdirSync(categoryPath)
          .filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
          try {
            const command = require(path.join(categoryPath, file));
            
            // If command is a slash command (not context menu) and has required properties
            if (command.data && command.execute) {
              // Skip if a command with the same name was already loaded from new_commands
              if (commands.some(cmd => cmd.name === command.data.name)) {
                logger.info(`Skipping command ${command.data.name} from ${category} as it already exists in new_commands`);
                continue;
              }
              
              // Convert SlashCommandBuilder to JSON if needed
              if (typeof command.data.toJSON === 'function') {
                commands.push(command.data.toJSON());
              } else {
                commands.push(command.data);
              }
            }
          } catch (error) {
            logger.error(`Error loading command ${file} from ${category}:`, error);
          }
        }
      }
    } else {
      logger.warn('commands directory not found, skipping');
    }
  } catch (error) {
    logger.error('Error loading commands:', error);
  }
  
  return commands;
}

/**
 * Print detailed information about registered commands
 * @param {Array} commands - Array of command objects
 */
function printCommandDetails(commands) {
  if (!commands || commands.length === 0) {
    console.log('No commands registered.');
    return;
  }
  
  console.log(`\n=== Registered ${commands.length} Commands ===\n`);
  
  commands.forEach(command => {
    console.log(`Command: /${command.name}`);
    console.log(`  Description: ${command.description}`);
    
    // Check for subcommands
    if (command.options && command.options.some(opt => opt.type === 1)) {
      console.log('  Subcommands:');
      command.options
        .filter(opt => opt.type === 1)
        .forEach(subcommand => {
          console.log(`    - ${subcommand.name}: ${subcommand.description}`);
          
          // Check for subcommand options
          if (subcommand.options && subcommand.options.length > 0) {
            console.log('      Options:');
            subcommand.options.forEach(opt => {
              console.log(`        - ${opt.name} (${getOptionTypeName(opt.type)}): ${opt.description}`);
            });
          }
        });
    }
    // Regular command options
    else if (command.options && command.options.length > 0) {
      console.log('  Options:');
      command.options.forEach(opt => {
        console.log(`    - ${opt.name} (${getOptionTypeName(opt.type)}): ${opt.description}`);
      });
    }
    
    console.log(''); // Empty line for readability
  });
}

/**
 * Get human-readable name for option type
 * @param {number} type - Discord API option type
 * @returns {string} Human-readable option type
 */
function getOptionTypeName(type) {
  const types = {
    1: 'Subcommand',
    2: 'Subcommand Group',
    3: 'String',
    4: 'Integer',
    5: 'Boolean',
    6: 'User',
    7: 'Channel',
    8: 'Role',
    9: 'Mentionable',
    10: 'Number',
    11: 'Attachment'
  };
  
  return types[type] || `Unknown(${type})`;
}

async function main() {
  logger.info('Starting Discord command registration...');
  
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.CLIENT_ID) {
    logger.error('Missing required environment variables: DISCORD_BOT_TOKEN and/or CLIENT_ID');
    console.log('Please ensure DISCORD_BOT_TOKEN and CLIENT_ID are set in your .env file or Replit Secrets');
    return;
  }
  
  try {
    // Load commands from files
    const commands = loadAllCommands();
    logger.info(`Loaded ${commands.length} commands from files`);
    
    // Make sure we have commands to register
    if (commands.length === 0) {
      logger.error('No commands found to register');
      return;
    }
    
    console.log(`\n=== Command Structure Validation ===\n`);
    // Validate command structures before registering
    for (const command of commands) {
      console.log(`Validating: /${command.name}`);
      
      // Check for subcommands
      if (command.options && command.options.some(opt => opt.type === 1)) {
        const subcommands = command.options.filter(opt => opt.type === 1);
        console.log(`  Has ${subcommands.length} subcommands`);
        
        // Validate each subcommand
        for (const subcommand of subcommands) {
          console.log(`  - Subcommand: ${subcommand.name}`);
          if (!subcommand.name || !subcommand.description) {
            console.log(`    ❌ ERROR: Missing name or description`);
          }
          
          // Check options
          if (subcommand.options && subcommand.options.length > 0) {
            console.log(`    Has ${subcommand.options.length} options`);
          }
        }
      } else {
        console.log(`  Regular command (no subcommands)`);
      }
    }
    
    // Fetch existing commands
    logger.info('Fetching existing commands...');
    const existingCommands = await safelyFetchCommands();
    
    // Delete existing commands
    if (existingCommands.length > 0) {
      logger.info(`Deleting ${existingCommands.length} existing commands...`);
      for (const command of existingCommands) {
        await safelyDeleteCommand(command.id, command.name);
      }
    } else {
      logger.info('No existing commands to delete');
    }
    
    // Register commands with the Discord API
    logger.info(`Registering ${commands.length} commands...`);
    const registeredCommands = await safelyRegisterCommands(commands);
    
    logger.info(`Successfully registered ${registeredCommands.length} commands`);
    printCommandDetails(registeredCommands);
    
  } catch (error) {
    logger.error('Error in command registration process:', error);
  }
}

main();