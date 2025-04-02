/**
 * Minimal Single Command Registration Script
 * 
 * This script registers just a single command to troubleshoot API connectivity issues.
 */
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Get environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;

// Validate environment variables
if (!token) {
  console.error('ERROR: No bot token found!');
  process.exit(1);
}

if (!clientId) {
  console.error('ERROR: No client ID found!');
  process.exit(1);
}

console.log(`Token available: ${!!token}, Token length: ${token.length}`);
console.log(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

// Create a minimal ping command
const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check if the bot is online')
  .toJSON();

// Setup REST client with longer timeout
const rest = new REST({ version: '10', timeout: 90000 }).setToken(token);

// Main function
async function main() {
  try {
    console.log('Attempting to register a single command (ping)...');
    
    // Register the command
    const response = await rest.post(
      Routes.applicationCommands(clientId),
      { body: pingCommand }
    );
    
    console.log('Successfully registered command:');
    console.log(`Name: ${response.name}`);
    console.log(`ID: ${response.id}`);
    
  } catch (error) {
    console.error('Error registering command:');
    console.error(`Status: ${error.status}`);
    console.error(`Message: ${error.message}`);
    
    // Check if it's a token or API issue
    if (error.message.includes('401')) {
      console.error('\nPossible token issue - make sure your bot token is valid and has applications.commands.write scope');
    } else if (error.message.includes('403')) {
      console.error('\nPermission issue - make sure your bot has proper permissions');
    } else if (error.message.includes('429')) {
      console.error('\nRate limit issue - Discord API is rate limiting your requests');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\nConnection issue - unable to reach Discord API');
    }
  }
}

// Run the script with a bigger timeout
const scriptTimeout = setTimeout(() => {
  console.error('Script timed out after 60 seconds');
  process.exit(1);
}, 60000);

main()
  .catch(console.error)
  .finally(() => clearTimeout(scriptTimeout));