/**
 * Discord-Friendly Command Registration Script
 * 
 * This script properly handles Discord API rate limits for:
 * 1. Deleting existing application commands
 * 2. Registering the new commands from src/new_commands directory
 * 
 * Run with: node register-commands-safe.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

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

// Configure REST client with much longer timeout for slow connections
const rest = new REST({ version: '10', timeout: 120000 }).setToken(token);

console.log('Discord Command Registration Utility');
console.log('===================================');
console.log(`Token available: ${!!token}, Token length: ${token.length}`);
console.log(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

// Sleep utility function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute a function with enhanced retry logic for rate limits and timeouts
 * @param {Function} fn - Function to execute
 * @param {string} operation - Name of operation for logging
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} - Result of the function
 */
async function executeWithRateLimitHandling(fn, operation, maxRetries = 7) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      console.log(`Executing ${operation} (Attempt ${retries + 1}/${maxRetries + 1})...`);
      
      // Add timeout protection
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), 60000) // 60 second timeout
        )
      ]);
      
      console.log(`Successfully completed ${operation}!`);
      return result;
    } catch (error) {
      console.error(`Error during ${operation}: ${error.message}`);
      
      // Check if it's a rate limit error (multiple possible formats)
      if (error.status === 429 || (error.code && error.code === 429)) {
        // Get retry-after time from various possible locations
        const retryAfter = 
          error.headers?.get('retry-after') || 
          error.retry_after || 
          (error.raw && error.raw.retry_after) || 
          5;
        
        const waitTimeMs = retryAfter * 1000;
        
        console.log(`Rate limited! Waiting ${waitTimeMs}ms before retry...`);
        await sleep(waitTimeMs + 2000); // Add buffer time
        retries++;
        console.log(`Retrying ${operation} (Attempt ${retries + 1}/${maxRetries + 1})...`);
      } 
      // Handle timeout errors
      else if (error.message === 'Operation timed out') {
        console.log(`Request timed out during ${operation}`);
        if (retries < maxRetries) {
          const waitTime = 5000; // 5 seconds for timeout
          console.log(`Waiting ${waitTime}ms before retry...`);
          await sleep(waitTime);
          retries++;
        } else {
          throw new Error(`${operation} failed after ${maxRetries} attempts due to timeouts`);
        }
      } 
      // For all other errors, use exponential backoff
      else {
        if (retries < maxRetries) {
          const backoffTime = Math.min(Math.pow(2, retries) * 1000, 30000); // Cap at 30 seconds
          console.log(`Error occurred, retrying in ${backoffTime}ms... (Attempt ${retries + 1}/${maxRetries + 1})`);
          await sleep(backoffTime);
          retries++;
        } else {
          throw error; // Rethrow if we've exhausted retries
        }
      }
    }
  }
  
  throw new Error(`Failed ${operation} after ${maxRetries + 1} attempts`);
}

/**
 * Delete a Discord application command safely with rate limit handling
 * @param {string} commandId - Discord command ID
 * @param {string} commandName - Command name for logging
 */
async function safelyDeleteCommand(commandId, commandName) {
  try {
    await executeWithRateLimitHandling(
      async () => await rest.delete(Routes.applicationCommand(clientId, commandId)),
      `deleting command "${commandName}"`
    );
    console.log(`Successfully deleted command: ${commandName}`);
    
    // Wait 1 second between deletions to be safe
    await sleep(1000);
  } catch (error) {
    console.error(`Failed to delete command ${commandName}:`, error.message);
  }
}

/**
 * Safely fetch all registered application commands
 * @returns {Promise<Array>} Array of command objects
 */
async function safelyFetchCommands() {
  return executeWithRateLimitHandling(
    async () => await rest.get(Routes.applicationCommands(clientId)),
    'fetching commands'
  );
}

/**
 * Register application commands one by one with rate limit handling
 * @param {Array} commands - Array of command data
 * @returns {Promise<Array>} Registered commands
 */
async function safelyRegisterCommands(commands) {
  console.log('Registering commands individually to avoid timeouts...');
  const registeredCommands = [];
  
  for (const command of commands) {
    console.log(`Registering command: ${command.name}...`);
    
    try {
      const registeredCommand = await executeWithRateLimitHandling(
        async () => await rest.post(
          Routes.applicationCommands(clientId),
          { body: command }
        ),
        `registering command "${command.name}"`
      );
      
      registeredCommands.push(registeredCommand);
      console.log(`✅ Command "${command.name}" registered successfully`);
      
      // Wait between each command registration with longer delay
      console.log('Waiting 3 seconds before next command...');
      await sleep(3000);
    } catch (error) {
      console.error(`Failed to register command "${command.name}":`, error.message);
    }
  }
  
  return registeredCommands;
}

/**
 * Load command files from the new commands directory
 * @returns {Array} Array of command data objects
 */
function loadNewCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'src', 'new_commands');
  
  if (!fs.existsSync(commandsPath)) {
    console.error('ERROR: New commands directory not found!');
    console.error('Make sure src/new_commands directory exists.');
    process.exit(1);
  }
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  console.log(`Found ${commandFiles.length} command files in new commands directory.`);
  
  for (const file of commandFiles) {
    try {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.warn(`Command ${file} is missing required 'data' or 'execute' properties.`);
      }
    } catch (error) {
      console.error(`Error loading command ${file}:`, error);
    }
  }
  
  return commands;
}

/**
 * Print detailed information about registered commands
 * @param {Array} commands - Array of command objects
 */
function printCommandDetails(commands) {
  console.log('\nRegistered Commands:');
  console.log('==================');
  
  commands.forEach(cmd => {
    const subcommands = cmd.options?.filter(opt => opt.type === 1).map(sc => sc.name) || [];
    if (subcommands.length > 0) {
      console.log(`📎 ${cmd.name} (with subcommands: ${subcommands.join(', ')})`);
    } else {
      console.log(`📋 ${cmd.name}`);
    }
  });
}

// Main function
async function main() {
  try {
    console.log('\n🚀 Starting Discord command registration process...');
    
    // Step 1: Load new commands
    console.log('\n📁 Loading new commands...');
    const newCommands = loadNewCommands();
    
    if (newCommands.length === 0) {
      console.error('❌ ERROR: No valid commands found to register!');
      process.exit(1);
    }
    
    // Step 2: Get existing commands
    console.log('\n🔍 Checking for existing commands...');
    let existingCommands;
    try {
      existingCommands = await safelyFetchCommands();
      console.log(`Found ${existingCommands.length} existing commands.`);
    } catch (error) {
      console.error('❌ Failed to fetch existing commands:', error.message);
      console.log('Proceeding to registration without deleting old commands.');
      existingCommands = [];
    }
    
    // Step 3: Delete existing commands if any
    if (existingCommands.length > 0) {
      console.log('\n🗑️ Deleting existing commands...');
      for (const cmd of existingCommands) {
        await safelyDeleteCommand(cmd.id, cmd.name);
      }
      
      // Wait longer for Discord's cache to update completely
      console.log('\n⏱️ Waiting 10 seconds for Discord API cache to update...');
      await sleep(10000);
    }
    
    // Step 4: Register new commands
    console.log(`\n📝 Registering ${newCommands.length} commands with Discord API...`);
    const registeredCommands = await safelyRegisterCommands(newCommands);
    
    console.log(`\n✅ SUCCESS! Registered ${registeredCommands.length} commands with Discord API.`);
    printCommandDetails(registeredCommands);
    
  } catch (error) {
    console.error('\n❌ ERROR during command registration:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error in main function:');
  console.error(error);
  process.exit(1);
});