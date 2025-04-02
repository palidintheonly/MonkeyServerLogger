/**
 * Command Force Registration Script
 * 
 * This standalone script deletes ALL existing Discord application commands
 * and registers them fresh from the source files.
 * 
 * Run with: node force-register-commands.js
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { logger } = require('./src/utils/logger');

logger.info('═══════════════════════════════════════════');
logger.info('COMMAND FORCE REGISTRATION SCRIPT STARTING');
logger.info('═══════════════════════════════════════════');

// Token and client ID verification
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;

if (!token) {
  logger.error('No Discord bot token found in environment variables!');
  process.exit(1);
}

if (!clientId) {
  logger.error('No Discord application ID found in environment variables!');
  process.exit(1);
}

logger.info(`Token available: ${!!token}, Token length: ${token.length}`);
logger.info(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

// Initialize REST client
const rest = new REST({ version: '10' }).setToken(token);

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main execution
async function main() {
  logger.info('Starting command force registration...');
  
  try {
    // First, load all commands from files
    logger.info('Loading commands from files...');
    const commands = [];
    const commandNames = new Set();

    // Regular commands
    const foldersPath = path.join(__dirname, 'src/commands');
    const commandFolders = fs.readdirSync(foldersPath).filter(file => !file.endsWith('.js'));
    
    // Load commands from each folder
    for (const folder of commandFolders) {
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
            logger.info(`Loaded command from ${folder}: ${commandName}`);
          }
        }
      }
    }
    
    // Add root commands (not in subfolders)
    const rootCommandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
    for (const file of rootCommandFiles) {
      const filePath = path.join(foldersPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        const commandName = command.data.name;
        if (!commandNames.has(commandName)) {
          commandNames.add(commandName);
          commands.push(command.data.toJSON());
          logger.info(`Loaded command: ${commandName}`);
        }
      }
    }
    
    // Context menu commands
    const contextPath = path.join(__dirname, 'src/commands/context');
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
            logger.info(`Loaded context command: ${command.data.name}`);
          }
        }
      }
    }
    
    logger.info(`Total unique commands loaded: ${commandNames.size}`);
    
    // Retrieve existing commands to delete them
    logger.info('1. RETRIEVING AND DELETING CURRENT COMMANDS');
    logger.info('Retrieving current application commands from Discord API...');
    
    const existingCommands = await rest.get(Routes.applicationCommands(clientId));
    
    if (existingCommands.length > 0) {
      logger.info(`Found ${existingCommands.length} existing commands, deleting them all...`);
      console.log(`Deleting ${existingCommands.length} existing commands from Discord API...`);
      
      for (const cmd of existingCommands) {
        logger.info(`Deleting command: ${cmd.name} (ID: ${cmd.id})`);
        try {
          await rest.delete(Routes.applicationCommand(clientId, cmd.id));
          logger.info(`Successfully deleted command: ${cmd.name}`);
          // Brief pause to avoid rate limits
          await sleep(300);
        } catch (deleteError) {
          logger.error(`Failed to delete command ${cmd.name}: ${deleteError.message}`);
        }
      }
      
      // Wait for API cache to refresh
      logger.info('Waiting for Discord API cache to clear (3 seconds)...');
      await sleep(3000);
    } else {
      logger.info('No existing commands found to delete.');
    }
    
    // Register new commands
    logger.info('2. REGISTERING FRESH COMMANDS');
    logger.info(`Registering ${commands.length} application commands from scratch...`);
    console.log(`Registering ${commands.length} commands with Discord API...`);
    
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    
    logger.info(`Successfully registered ${data.length} application commands with Discord API`);
    console.log('SUCCESS: All commands have been freshly registered with Discord API');
    
    // Optional guild commands for development
    if (process.env.SUPPORT_GUILD_ID) {
      logger.info(`3. ALSO REGISTERING TO DEVELOPMENT GUILD`);
      logger.info(`Also registering commands to development guild: ${process.env.SUPPORT_GUILD_ID}`);
      
      // First clear existing guild commands
      const existingGuildCommands = await rest.get(
        Routes.applicationGuildCommands(clientId, process.env.SUPPORT_GUILD_ID)
      );
      
      if (existingGuildCommands.length > 0) {
        logger.info(`Found ${existingGuildCommands.length} existing guild commands, removing them...`);
        
        for (const cmd of existingGuildCommands) {
          await rest.delete(
            Routes.applicationGuildCommand(clientId, process.env.SUPPORT_GUILD_ID, cmd.id)
          );
          logger.info(`Deleted guild command: ${cmd.name}`);
          await sleep(300);
        }
      }
      
      // Register guild commands
      await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.SUPPORT_GUILD_ID),
        { body: commands }
      );
      
      logger.info('Guild-specific command registration complete.');
    }
    
    logger.info('═══════════════════════════════════════════');
    logger.info('COMMAND FORCE REGISTRATION COMPLETED SUCCESSFULLY');
    logger.info('═══════════════════════════════════════════');
    
  } catch (error) {
    logger.error('Error during command force registration:');
    logger.error(error);
    console.error('FAILED: Command registration failed with error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();