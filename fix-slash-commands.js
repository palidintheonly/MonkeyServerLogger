/**
 * Fix Slash Commands Registration Script
 * 
 * This script focuses on fixing slash commands to display their subcommands
 * properly in the Discord UI, ensuring users can select options.
 * 
 * Run with: node fix-slash-commands.js
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./src/utils/logger');

// Configure REST client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

/**
 * Load command files from the src/new_commands directory
 * @returns {Array} Array of command data objects
 */
function loadCommands() {
  const commands = [];
  
  try {
    // Load only from new_commands directory (our fixed commands)
    const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
    if (fs.existsSync(newCommandsPath)) {
      const newCommandFiles = fs.readdirSync(newCommandsPath)
        .filter(file => file.endsWith('.js'));
      
      console.log(`Found ${newCommandFiles.length} command files in new_commands directory`);
      
      for (const file of newCommandFiles) {
        try {
          const command = require(path.join(newCommandsPath, file));
          
          // Validate command has required properties
          if (command.data && command.execute) {
            // Convert SlashCommandBuilder to JSON if needed
            if (typeof command.data.toJSON === 'function') {
              const commandData = command.data.toJSON();
              commands.push(commandData);
              console.log(`Loaded command: ${commandData.name}`);
            } else {
              commands.push(command.data);
              console.log(`Loaded command: ${command.data.name}`);
            }
          } else {
            console.warn(`Command ${file} is missing required properties`);
          }
        } catch (error) {
          console.error(`Error loading command ${file}:`, error);
        }
      }
    } else {
      console.warn('new_commands directory not found');
    }
  } catch (error) {
    console.error('Error loading commands:', error);
  }
  
  return commands;
}

/**
 * Delete all existing application commands
 * @returns {Promise<void>}
 */
async function deleteExistingCommands() {
  console.log('Fetching existing commands...');
  
  try {
    // Get existing commands
    const existingCommands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID)
    );
    console.log(`Found ${existingCommands.length} existing commands`);
    
    // Delete each command
    for (const command of existingCommands) {
      console.log(`Deleting command: ${command.name} (${command.id})`);
      
      try {
        await rest.delete(
          Routes.applicationCommand(process.env.CLIENT_ID, command.id)
        );
        console.log(`Deleted command: ${command.name}`);
      } catch (error) {
        console.error(`Error deleting command ${command.name}:`, error);
        // Continue with other commands
      }
      
      // Add a small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('All existing commands deleted');
  } catch (error) {
    console.error('Error deleting existing commands:', error);
  }
}

/**
 * Register commands with Discord API
 * @param {Array} commands Commands to register
 */
async function registerCommands(commands) {
  console.log(`Registering ${commands.length} commands...`);
  
  // Print the full JSON to verify structure
  console.log('\nCommand data to register:');
  console.log(JSON.stringify(commands, null, 2));
  
  try {
    // Use put to replace all commands at once
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log(`Successfully registered ${data.length} application commands`);
    
    // Print details of registered commands
    data.forEach(command => {
      console.log(`- ${command.name}: ${command.id}`);
      
      // Check for subcommands
      if (command.options && command.options.some(opt => opt.type === 1)) {
        console.log('  Subcommands:');
        command.options.filter(opt => opt.type === 1).forEach(sc => {
          console.log(`  - ${sc.name}`);
        });
      }
    });
  } catch (error) {
    console.error('Error registering commands:', error);
    
    // Print more details about the error
    if (error.response) {
      console.error('Response error details:', error.response.data);
    }
  }
}

async function main() {
  console.log('Starting Discord command registration...');
  
  // Verify environment variables
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error('Missing required environment variables: DISCORD_BOT_TOKEN and/or CLIENT_ID');
    console.log('Please ensure DISCORD_BOT_TOKEN and CLIENT_ID are set in your .env file or Replit Secrets');
    return;
  }
  
  try {
    // Delete all existing commands
    await deleteExistingCommands();
    
    // Load new commands
    const commands = loadCommands();
    
    if (commands.length === 0) {
      console.error('No commands loaded, aborting registration');
      return;
    }
    
    // Register new commands
    await registerCommands(commands);
    
  } catch (error) {
    console.error('Error in command registration process:', error);
  }
}

main();