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
  console.error('ERROR: No bot token found in environment variables!');
  console.error('Make sure DISCORD_BOT_TOKEN or TOKEN is set in your .env file');
  process.exit(1);
}

if (!clientId) {
  console.error('ERROR: No client ID found in environment variables!');
  console.error('Make sure CLIENT_ID or DISCORD_APPLICATION_ID is set in your .env file');
  process.exit(1);
}

console.log('Discord Test Command Registration Utility');
console.log('=======================================');
console.log(`Token available: ${!!token}, Token length: ${token.length}`);
console.log(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

// Create a single test command
const testCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check if the bot is responding')
  .toJSON();

// Configure REST client
const rest = new REST({ version: '10', timeout: 30000 }).setToken(token);

async function main() {
  try {
    console.log('\n🚀 Starting test command registration...');
    
    // Register the test command
    console.log('Registering command: ping');
    const data = await rest.post(
      Routes.applicationCommands(clientId),
      { body: testCommand }
    );
    
    console.log(`✅ Successfully registered test command: ${data.name}`);
    console.log('Command ID:', data.id);
    console.log('\nIf this test succeeds but other registration scripts fail,');
    console.log('the issue may be related to command validation or rate limits.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during command registration:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:');
  console.error(error);
  process.exit(1);
});