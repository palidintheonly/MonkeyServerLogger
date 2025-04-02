/**
 * Alternate Command Registration Script
 * 
 * This script uses a different approach to register commands with Discord API.
 * It uses axios instead of discord.js REST API wrapper for better timeout control
 * and error handling.
 */
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Logger helper
const logFile = 'alternate-register.log';
fs.writeFileSync(logFile, `=== Alternate Command Registration - ${new Date().toISOString()} ===\n\n`);

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;

// Log environment variable existence (not values)
log(`DISCORD_BOT_TOKEN exists: ${Boolean(process.env.DISCORD_BOT_TOKEN)}`);
log(`TOKEN exists: ${Boolean(process.env.TOKEN)}`);
log(`DISCORD_APPLICATION_ID exists: ${Boolean(process.env.DISCORD_APPLICATION_ID)}`);
log(`CLIENT_ID exists: ${Boolean(process.env.CLIENT_ID)}`);

if (!token) {
  log('ERROR: No bot token found in environment variables');
  process.exit(1);
}

if (!clientId) {
  log('ERROR: No client ID found in environment variables');
  process.exit(1);
}

// Create HTTP client with default headers
const client = axios.create({
  baseURL: 'https://discord.com/api/v10',
  headers: {
    'Authorization': `Bot ${token}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Helper to create a test command
function createTestCommand() {
  return {
    name: 'testping',
    description: 'A simple test ping command',
    type: 1, // CHAT_INPUT
    options: []
  };
}

// Main function
async function main() {
  log('Starting alternate command registration...');

  try {
    // Step 1: Verify bot identity
    log('Step 1: Verifying bot identity...');
    const botResponse = await client.get('/users/@me')
      .catch(error => {
        log(`Error getting bot identity: ${error.message}`);
        if (error.response) {
          log(`Status: ${error.response.status}`);
          log(`Data: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      });
    
    log(`Connected as: ${botResponse.data.username} (${botResponse.data.id})`);
    
    // Step 2: Check existing commands
    log('Step 2: Checking existing commands...');
    const existingCommandsResponse = await client.get(`/applications/${clientId}/commands`)
      .catch(error => {
        log(`Error fetching commands: ${error.message}`);
        if (error.response) {
          log(`Status: ${error.response.status}`);
          log(`Data: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      });
    
    const existingCommands = existingCommandsResponse.data;
    log(`Found ${existingCommands.length} existing commands`);
    
    if (existingCommands.length > 0) {
      // Delete existing commands
      log('Deleting existing commands...');
      for (const cmd of existingCommands) {
        log(`Deleting command: ${cmd.name} (${cmd.id})`);
        try {
          await client.delete(`/applications/${clientId}/commands/${cmd.id}`);
          log(`Successfully deleted ${cmd.name}`);
        } catch (error) {
          log(`Error deleting command ${cmd.name}: ${error.message}`);
          if (error.response) {
            log(`Status: ${error.response.status}`);
            log(`Data: ${JSON.stringify(error.response.data)}`);
          }
        }
        // Sleep a bit to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    // Step 3: Register a test command
    log('Step 3: Registering test command...');
    const testCommand = createTestCommand();
    log(`Command data: ${JSON.stringify(testCommand)}`);
    
    try {
      const response = await client.post(
        `/applications/${clientId}/commands`,
        testCommand
      );
      
      log(`Test command registration successful!`);
      log(`Response: ${JSON.stringify(response.data)}`);
    } catch (error) {
      log(`Error registering test command: ${error.message}`);
      if (error.response) {
        log(`Status: ${error.response.status}`);
        log(`Data: ${JSON.stringify(error.response.data)}`);
      }
    }
    
  } catch (error) {
    log(`Unhandled error: ${error.message}`);
  }
}

// Install axios if it doesn't exist and then run the script
const execute = async () => {
  try {
    // Try to require axios
    require.resolve('axios');
    log('Axios is already installed');
    await main();
  } catch (error) {
    // Axios not found, install it
    log('Axios not found, installing...');
    const { execSync } = require('child_process');
    execSync('npm install axios --no-save');
    log('Axios installed, running main script...');
    await main();
  }
};

execute().catch(error => {
  log(`Fatal error: ${error.message}`);
});