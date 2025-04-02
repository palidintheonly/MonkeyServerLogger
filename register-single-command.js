/**
 * Minimal Single Command Registration Script
 * 
 * This script registers just a single command to troubleshoot API connectivity issues.
 */
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Configure REST client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

async function main() {
  console.log('Starting minimal command registration test...');
  
  // Verify environment variables
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error('Missing required environment variables: DISCORD_BOT_TOKEN and/or CLIENT_ID');
    console.log('Please ensure DISCORD_BOT_TOKEN and CLIENT_ID are set in your .env file or Replit Secrets');
    return;
  }
  
  // Create a simple ping command
  const pingCommand = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Checks if the bot is online')
    .toJSON();
  
  try {
    console.log('Attempting to register a single command...');
    
    // Register the command
    const response = await rest.post(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: pingCommand }
    );
    
    console.log('Command registered successfully!');
    console.log('Command ID:', response.id);
    console.log('Command name:', response.name);
    
  } catch (error) {
    console.error('Error registering command:');
    console.error(error);
    
    // Show detailed error response if available
    if (error.response) {
      console.error('API response details:', error.response.data);
    }
  }
}

main();