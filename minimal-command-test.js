/**
 * Minimal Command Test Script
 * 
 * This script tests the Discord API connectivity by registering a single
 * simple ping command without any subcommands or options.
 */
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Set up simple logging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  fs.appendFileSync('minimal-test.log', `[${new Date().toISOString()}] ${message}\n`);
}

// Clear previous log
try {
  fs.writeFileSync('minimal-test.log', `=== Minimal Command Test - ${new Date().toISOString()} ===\n\n`);
} catch (error) {
  console.error(`Error clearing log: ${error.message}`);
}

// Show environment variables (without revealing token)
log(`Environment Variables:`);
log(`TOKEN exists: ${Boolean(process.env.TOKEN)}`);
log(`DISCORD_BOT_TOKEN exists: ${Boolean(process.env.DISCORD_BOT_TOKEN)}`);
log(`CLIENT_ID exists: ${Boolean(process.env.CLIENT_ID)}`);
log(`DISCORD_APPLICATION_ID exists: ${Boolean(process.env.DISCORD_APPLICATION_ID)}`);

// Define a minimal slash command
const command = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check if the bot is online')
  .toJSON();

// Main registration function
async function registerCommand() {
  log('Starting minimal command registration test...');
  
  // Get token and client ID from environment variables
  const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
  const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;
  
  if (!token) {
    log('ERROR: No bot token found in environment variables.');
    return;
  }
  
  if (!clientId) {
    log('ERROR: No client ID found in environment variables.');
    return;
  }
  
  log(`Using client ID: ${clientId}`);
  log(`Token length: ${token.length}`);
  
  // Create REST instance
  const rest = new REST({ version: '10' }).setToken(token);
  
  try {
    // Step 1: Test connectivity by checking the bot user
    log('\nStep 1: Testing API connectivity...');
    try {
      const botUser = await rest.get(Routes.user('@me'));
      log(`SUCCESS: Connected to Discord API as ${botUser.username} (ID: ${botUser.id})`);
    } catch (error) {
      log(`ERROR: Failed to connect to Discord API: ${error.message}`);
      log(`Error details: ${JSON.stringify(error, null, 2)}`);
      return;
    }
    
    // Step 2: Get existing commands (if any)
    log('\nStep 2: Checking existing commands...');
    try {
      const existingCommands = await rest.get(Routes.applicationCommands(clientId));
      log(`Found ${existingCommands.length} existing commands.`);
      
      if (existingCommands.length > 0) {
        log('Existing commands:');
        existingCommands.forEach(cmd => {
          log(`- ${cmd.name} (ID: ${cmd.id})`);
        });
      }
    } catch (error) {
      log(`ERROR: Failed to fetch existing commands: ${error.message}`);
      log(`Error details: ${JSON.stringify(error, null, 2)}`);
    }
    
    // Step 3: Register the test command
    log('\nStep 3: Registering test command...');
    try {
      log(`Command data: ${JSON.stringify(command, null, 2)}`);
      
      // Set a longer timeout for this request
      const result = await rest.put(
        Routes.applicationCommands(clientId),
        { body: [command], timeout: 15000 }
      );
      
      log(`SUCCESS: Registered ${result.length} commands`);
      log(`Registration result: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      log(`ERROR: Failed to register command: ${error.message}`);
      
      if (error.code === 'ETIMEDOUT') {
        log('The request timed out. This could be due to network issues or Discord API latency.');
      } else if (error.code === 50035) {
        log('Invalid form body error. Check command structure.');
      }
      
      log(`Error details: ${JSON.stringify(error, null, 2)}`);
    }
    
  } catch (error) {
    log(`CRITICAL ERROR: ${error.message}`);
    log(`Error details: ${JSON.stringify(error, null, 2)}`);
  }
}

// Run the test
registerCommand().catch(error => {
  log(`Unhandled error: ${error.message}`);
  log(`Error details: ${JSON.stringify(error, null, 2)}`);
});