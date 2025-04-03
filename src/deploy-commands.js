/**
 * Command Deployment Script
 * This file handles registering slash commands with Discord API
 */
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { commands: cmdConfig } = require('./config');
const { logger } = require('./utils/logger');
const fs = require('fs');
const path = require('path');

// Map DISCORD_APPLICATION_ID to CLIENT_ID if it exists
if (process.env.DISCORD_APPLICATION_ID && !process.env.CLIENT_ID) {
  process.env.CLIENT_ID = process.env.DISCORD_APPLICATION_ID;
  logger.info('Using DISCORD_APPLICATION_ID as CLIENT_ID');
}

// Check for required token and client ID
if (!process.env.DISCORD_BOT_TOKEN) {
  logger.error('Missing DISCORD_BOT_TOKEN environment variable');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  logger.error('Missing CLIENT_ID environment variable');
  process.exit(1);
}

async function main() {
  try {
    // Create REST client for Discord API
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    const clientId = process.env.CLIENT_ID;
    
    logger.info('Starting slash command deployment...');
    
    // Array to store command data
    const commands = [];
    
    // Function to load commands from a directory
    const loadCommandsFromDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          // Recursively load commands from subdirectory
          loadCommandsFromDir(itemPath);
        } else if (item.name.endsWith('.js')) {
          try {
            const command = require(itemPath);
            
            // Only add commands with proper data property
            if (command.data && command.data.toJSON) {
              commands.push(command.data.toJSON());
              logger.debug(`Loaded command: ${command.data.name}`);
            }
          } catch (error) {
            logger.error(`Error loading command from ${itemPath}: ${error.message}`);
          }
        }
      }
    };
    
    // Load all command files
    const commandsPath = path.join(__dirname, 'commands');
    loadCommandsFromDir(commandsPath);
    
    logger.info(`Found ${commands.length} commands to register`);
    
    // Log commands list
    commands.forEach(cmd => logger.debug(`- ${cmd.name}`));
    
    // Get all guilds for guild-specific command deployment
    const guilds = [];
    
    // First, use any configured development guild IDs
    const devGuildIds = cmdConfig.devGuildIds || [];
    if (devGuildIds.length > 0) {
      devGuildIds.forEach(guildId => {
        if (!guilds.includes(guildId)) {
          guilds.push(guildId);
        }
      });
    }
    
    // If we have a BOT_GUILDS environment variable, parse and use it
    if (process.env.BOT_GUILDS) {
      const configuredGuilds = process.env.BOT_GUILDS.split(',').map(id => id.trim());
      configuredGuilds.forEach(guildId => {
        if (!guilds.includes(guildId)) {
          guilds.push(guildId);
        }
      });
    }
    
    // If no guilds specified, log an error but continue (we'll use the ready event to deploy to actual guilds)
    if (guilds.length === 0) {
      logger.warn('No guild IDs specified for command deployment. Will deploy to joined guilds on bot startup.');
    }
    
    // Deploy to each guild
    for (const guildId of guilds) {
      try {
        logger.info(`Deploying ${commands.length} commands to guild ${guildId}...`);
        
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        
        logger.info(`Successfully deployed commands to guild ${guildId}`);
      } catch (guildError) {
        logger.error(`Failed to deploy commands to guild ${guildId}: ${guildError.message}`);
      }
    }
    
    // Clear global commands to ensure all commands are guild-specific
    try {
      logger.info('Clearing global commands to ensure all commands are guild-specific...');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: [] }
      );
      logger.info('Successfully cleared global commands');
    } catch (globalError) {
      logger.error(`Failed to clear global commands: ${globalError.message}`);
    }
  } catch (error) {
    logger.error(`Command deployment error: ${error.message}`, { error });
  }
}

// Execute the script
main().catch(error => {
  logger.error(`Unhandled error: ${error.message}`, { error });
  process.exit(1);
});