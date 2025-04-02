/**
 * New Command Registration Script
 * 
 * This script deletes ALL existing Discord application commands
 * and registers the new commands from the src/new_commands directory.
 * 
 * Run with: node register-new-commands.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes, ApplicationCommandType } = require('discord.js');
const { logger } = require('./src/utils/logger');

// Environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID || '1234567890123456789';

if (!token) {
  console.error('ERROR: No bot token found in environment variables!');
  console.error('Make sure DISCORD_BOT_TOKEN or TOKEN is set in your .env file or secrets');
  process.exit(1);
}

console.log(`Token available: ${!!token}, Token length: ${token.length}`);
console.log(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

async function main() {
  try {
    // Initialize REST client
    const rest = new REST({ version: '10' }).setToken(token);
    
    console.log('Starting command registration process...');
    
    // SKIP DELETION: Just register new commands directly
    console.log('Skipping deletion of existing commands to avoid timeouts...');
    
    // STEP 2: Load new commands from src/new_commands directory
    console.log('Loading new commands from src/new_commands directory...');
    const newCommands = [];
    const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
    
    if (!fs.existsSync(newCommandsPath)) {
      console.error('ERROR: New commands directory not found!');
      console.error('Make sure src/new_commands directory exists');
      process.exit(1);
    }
    
    const commandFiles = fs.readdirSync(newCommandsPath).filter(file => file.endsWith('.js'));
    console.log(`Found ${commandFiles.length} command files`);
    
    for (const file of commandFiles) {
      try {
        const filePath = path.join(newCommandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          // Convert SlashCommandBuilder to raw data
          newCommands.push(command.data.toJSON());
          console.log(`Loaded command: ${command.data.name}`);
        } else {
          console.warn(`Command ${file} is missing required 'data' or 'execute' properties`);
        }
      } catch (error) {
        console.error(`Error loading command ${file}:`, error);
      }
    }
    
    if (newCommands.length === 0) {
      console.error('ERROR: No valid commands found to register!');
      process.exit(1);
    }
    
    // STEP 3: Register new commands with Discord API
    console.log(`Registering ${newCommands.length} commands with Discord API...`);
    
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: newCommands }
    );
    
    console.log(`SUCCESS: Registered ${data.length} commands with Discord API`);
    
    // Log registered commands for verification
    console.log('\nRegistered commands:');
    data.forEach(cmd => {
      const subcommands = cmd.options?.filter(opt => opt.type === 1).map(sc => sc.name) || [];
      if (subcommands.length > 0) {
        console.log(`- ${cmd.name} (with subcommands: ${subcommands.join(', ')})`);
      } else {
        console.log(`- ${cmd.name}`);
      }
    });
    
  } catch (error) {
    console.error('Error during command registration:');
    console.error(error);
  }
}

// Run the script
main();