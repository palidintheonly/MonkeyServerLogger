/**
 * Guild Command Manager
 * 
 * This module manages guild-specific command registration to avoid Discord's
 * global command registration rate limits.
 */
const fs = require('fs');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { Collection } = require('discord.js');
const { logger } = require('./logger');

// Create a collection to store command data
const commands = new Collection();
let rest = null;
let applicationId = null;

/**
 * Initialize the guild command manager
 * @param {string} token - Bot token
 * @param {string} botClientId - Bot client ID
 */
function init(token, botClientId) {
  if (!token) throw new Error('Bot token is required');
  if (!botClientId) throw new Error('Bot client ID is required');
  
  rest = new REST({ version: '10' }).setToken(token);
  applicationId = botClientId;
  
  logger.info('Guild command manager initialized');
  return true;
}

/**
 * Load commands from the src/new_commands directory
 * @returns {Array} Array of command data objects
 */
function loadCommands() {
  // Clear command cache first
  clearCommandCache();
  
  // Load new commands from the src/new_commands directory
  const commandsPath = path.join(process.cwd(), 'src', 'new_commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  logger.info(`Loading ${commandFiles.length} commands from ${commandsPath}`);
  
  const commandData = [];
  
  for (const file of commandFiles) {
    try {
      // Clear require cache for this specific file to ensure we get the latest version
      const filePath = path.join(commandsPath, file);
      delete require.cache[require.resolve(filePath)];
      
      // Load the command module
      const command = require(filePath);
      
      // Store the command in our collection
      commands.set(command.data.name, command);
      
      // Add the command data to our array
      commandData.push(command.data.toJSON());
      
      logger.info(`Loaded command: ${command.data.name}`);
    } catch (error) {
      logger.error(`Failed to load command from file ${file}: ${error.message}`);
    }
  }
  
  logger.info(`Successfully loaded ${commandData.length} commands`);
  return commandData;
}

/**
 * Register commands for a specific guild
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Array>} - Array of registered commands
 */
async function registerCommandsForGuild(guildId) {
  if (!rest) throw new Error('Guild command manager not initialized. Call init() first.');
  if (!guildId) throw new Error('Guild ID is required');
  
  try {
    // Load commands
    const commandData = loadCommands();
    
    if (commandData.length === 0) {
      logger.warn('No commands found to register');
      return [];
    }
    
    // Log command registration attempt
    logger.info(`Attempting to register ${commandData.length} commands to guild ${guildId}`);
    
    // Put method to register commands
    const registeredCommands = await rest.put(
      Routes.applicationGuildCommands(applicationId, guildId),
      { body: commandData }
    );
    
    logger.info(`Successfully registered ${registeredCommands.length} commands to guild ${guildId}`);
    return registeredCommands;
  } catch (error) {
    // Enhanced error reporting
    logger.error(`Failed to register commands to guild ${guildId}: ${error.message}`);
    logger.error(`Error details: ${JSON.stringify(error)}`);
    
    // Rethrow the error for the caller to handle
    throw error;
  }
}

/**
 * Register commands for multiple guilds
 * @param {Array} guildIds - Array of guild IDs
 * @returns {Promise<Object>} - Object mapping guild IDs to registration results
 */
async function registerCommandsForGuilds(guildIds) {
  if (!rest) throw new Error('Guild command manager not initialized. Call init() first.');
  if (!guildIds || !Array.isArray(guildIds)) throw new Error('Array of guild IDs is required');
  
  logger.info(`Registering commands to ${guildIds.length} guilds`);
  
  const results = {};
  
  // Register commands to each guild
  for (const guildId of guildIds) {
    try {
      const result = await registerCommandsForGuild(guildId);
      results[guildId] = result;
    } catch (error) {
      results[guildId] = { error: error.message };
      logger.error(`Failed to register commands to guild ${guildId}: ${error.message}`);
    }
    
    // Add a small delay between guild registrations to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Clear command cache to force reloading commands from files
 */
function clearCommandCache() {
  commands.clear();
  logger.info('Command cache cleared');
}

module.exports = {
  init,
  loadCommands,
  registerCommandsForGuild,
  registerCommandsForGuilds,
  clearCommandCache
};