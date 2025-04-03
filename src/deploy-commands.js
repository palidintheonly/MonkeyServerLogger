/**
 * Command Deployment Script
 * This file handles registering slash commands with Discord API
 */
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { clientId, commands: commandConfig } = require('./config');
const fs = require('fs');
const path = require('path');
const { logger } = require('./utils/logger');

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token) {
  logger.error('Deploy-commands error: No Discord bot token provided in environment variables');
  process.exit(1);
}

if (!clientId) {
  logger.error('Deploy-commands error: No client ID provided in environment variables');
  process.exit(1);
}

async function main() {
  try {
    logger.info('Starting command deployment...');
    
    // Array for command data
    const commandsData = [];
    
    // Get commands directory absolute path
    const commandsPath = path.join(__dirname, 'commands');
    
    // Get all command categories folders
    const commandCategories = fs.readdirSync(commandsPath).filter(
      file => fs.statSync(path.join(commandsPath, file)).isDirectory()
    );
    
    // Load commands from each category folder
    for (const category of commandCategories) {
      const categoryPath = path.join(commandsPath, category);
      const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
      
      logger.info(`Loading commands from category: ${category}`);
      
      for (const file of commandFiles) {
        const filePath = path.join(categoryPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          commandsData.push(command.data.toJSON());
          logger.verbose(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
        }
      }
    }
    
    logger.info(`Loaded ${commandsData.length} commands total`);
    
    // Create REST instance
    const rest = new REST({ version: '10' }).setToken(token);
    
    // Register commands
    if (guildId && !commandConfig.globalCommands) {
      // Guild-only registration (for testing)
      logger.info(`Registering ${commandsData.length} commands to guild ${guildId}...`);
      
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData },
      );
      
      logger.info(`Successfully registered ${commandsData.length} commands to guild ${guildId}`);
      
      // Log commands to a file
      fs.writeFileSync('./guild-commands.log', JSON.stringify(commandsData, null, 2));
    } else {
      // Global registration
      logger.info(`Registering ${commandsData.length} commands globally...`);
      
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData },
      );
      
      logger.info(`Successfully registered ${commandsData.length} commands globally`);
      
      // Log commands to a file
      fs.writeFileSync('./global-commands.log', JSON.stringify(commandsData, null, 2));
    }
    
    // If we also want guild-specific commands when in production
    if (guildId && commandConfig.globalCommands) {
      logger.info(`Also registering commands to development guild ${guildId}...`);
      
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData },
      );
      
      logger.info(`Successfully registered commands to development guild ${guildId}`);
      
      // Log commands to a file for the guild separately
      fs.writeFileSync('./guild-commands-all.log', JSON.stringify(commandsData, null, 2));
    }
  } catch (error) {
    logger.error(`Error deploying commands: ${error.message}`);
    console.error(error);
  }
}

// Execute the main function
main();