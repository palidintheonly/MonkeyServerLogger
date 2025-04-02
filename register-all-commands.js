/**
 * Complete Command Registration Script for All Command Types
 * 
 * This script properly handles registration of all command types:
 * - Regular slash commands
 * - Slash commands with subcommands
 * - User context menu commands
 * - Message context menu commands
 * 
 * Run with: node register-all-commands.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes, ApplicationCommandType } = require('discord.js');

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

// Configure REST client
const rest = new REST({ version: '10' }).setToken(token);

console.log('Complete Discord Command Registration Utility');
console.log('===========================================');
console.log(`Token available: ${!!token}, Token length: ${token.length}`);
console.log(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Load command files from directories
 * @returns {Array} Array of command data objects
 */
function loadCommands() {
  const commands = [];
  const contextCommands = [];
  
  // First load from new_commands directory (highest priority)
  const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
  if (fs.existsSync(newCommandsPath)) {
    const newCommandFiles = fs.readdirSync(newCommandsPath).filter(file => file.endsWith('.js'));
    console.log(`Found ${newCommandFiles.length} commands in new_commands directory`);
    
    for (const file of newCommandFiles) {
      try {
        const filePath = path.join(newCommandsPath, file);
        delete require.cache[require.resolve(filePath)]; // Clear cache
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          console.log(`✅ Loaded command from new_commands: ${command.data.name}`);
        } else {
          console.warn(`⚠️ Command ${file} missing required properties`);
        }
      } catch (error) {
        console.error(`❌ Error loading ${file}: ${error.message}`);
      }
    }
  }
  
  // Load from regular commands directories
  const commandsPath = path.join(__dirname, 'src', 'commands');
  if (fs.existsSync(commandsPath)) {
    // Get command names already loaded (to avoid duplicates)
    const existingCommandNames = new Set(commands.map(cmd => cmd.name));
    
    // Root commands
    const rootFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of rootFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)]; // Clear cache
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          // Skip if this command name already exists
          if (!existingCommandNames.has(command.data.name)) {
            commands.push(command.data.toJSON());
            existingCommandNames.add(command.data.name);
            console.log(`✅ Loaded command from root: ${command.data.name}`);
          } else {
            console.warn(`⚠️ Skipping duplicate command: ${command.data.name}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error loading ${file}: ${error.message}`);
      }
    }
    
    // Load commands from subdirectories
    const folders = fs.readdirSync(commandsPath).filter(item => !item.includes('.'));
    for (const folder of folders) {
      // Skip context directory, we'll handle that separately
      if (folder === 'context') continue;
      
      const folderPath = path.join(commandsPath, folder);
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          delete require.cache[require.resolve(filePath)]; // Clear cache
          const command = require(filePath);
          
          if ('data' in command && 'execute' in command) {
            // Skip if this command name already exists
            if (!existingCommandNames.has(command.data.name)) {
              commands.push(command.data.toJSON());
              existingCommandNames.add(command.data.name);
              console.log(`✅ Loaded command from ${folder}: ${command.data.name}`);
            } else {
              console.warn(`⚠️ Skipping duplicate command: ${command.data.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error loading ${folder}/${file}: ${error.message}`);
        }
      }
    }
    
    // Handle context menu commands separately
    const contextPath = path.join(commandsPath, 'context');
    if (fs.existsSync(contextPath)) {
      const contextFiles = fs.readdirSync(contextPath).filter(file => file.endsWith('.js'));
      
      for (const file of contextFiles) {
        try {
          const filePath = path.join(contextPath, file);
          delete require.cache[require.resolve(filePath)]; // Clear cache
          const command = require(filePath);
          
          if ('data' in command && 'execute' in command) {
            // For context commands, we need special handling
            const commandJson = command.data.toJSON();
            
            // Add description for context menu commands (not normally needed, but useful for our validation)
            // Discord API doesn't need a description for context commands, so we add it locally
            if (command.description && !commandJson.description) {
              commandJson.description = command.description;
            }
            
            contextCommands.push(commandJson);
            console.log(`✅ Loaded context command: ${commandJson.name} (${commandJson.type === 2 ? 'User' : 'Message'})`);
          }
        } catch (error) {
          console.error(`❌ Error loading context/${file}: ${error.message}`);
        }
      }
    }
  }
  
  return [...commands, ...contextCommands];
}

/**
 * Delete all existing application commands
 * @returns {Promise<void>}
 */
async function deleteExistingCommands() {
  console.log('\n🗑️ Retrieving and deleting existing commands...');
  
  try {
    const existingCommands = await rest.get(Routes.applicationCommands(clientId));
    console.log(`Found ${existingCommands.length} existing commands`);
    
    for (const cmd of existingCommands) {
      console.log(`Deleting command: ${cmd.name} (ID: ${cmd.id})`);
      await rest.delete(Routes.applicationCommand(clientId, cmd.id));
      console.log(`✅ Deleted ${cmd.name}`);
      
      // Add a small delay between deletions
      await sleep(1000);
    }
    
    // Additional delay for Discord's cache to clear
    console.log('Waiting 5 seconds for Discord API cache to update...');
    await sleep(5000);
    
    return existingCommands.length;
  } catch (error) {
    console.error(`Failed to delete commands: ${error.message}`);
    return 0;
  }
}

/**
 * Register commands with Discord API
 * @param {Array} commands Commands to register
 */
async function registerCommands(commands) {
  console.log(`\n📝 Registering ${commands.length} commands with Discord API...`);
  
  // Convert context commands to proper format for Discord API
  const processedCommands = commands.map(cmd => {
    // For context menu commands (type 2 or 3), ensure they don't have a description field
    // Discord API rejects context commands with a description field
    if (cmd.type === ApplicationCommandType.User || cmd.type === ApplicationCommandType.Message) {
      const { description, ...rest } = cmd;
      return rest;
    }
    return cmd;
  });
  
  try {
    // Attempt bulk registration
    console.log('Attempting bulk registration...');
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: processedCommands }
    );
    
    console.log(`✅ Successfully registered ${data.length} commands in bulk`);
    
    // Print a summary of registered commands
    console.log('\n📋 Registered Commands Summary:');
    console.log('==============================');
    
    data.forEach(cmd => {
      if (cmd.type === ApplicationCommandType.ChatInput) {
        // Regular slash command
        const subcommands = cmd.options?.filter(opt => opt.type === 1);
        if (subcommands && subcommands.length > 0) {
          console.log(`📎 ${cmd.name} (with ${subcommands.length} subcommands: ${subcommands.map(sc => sc.name).join(', ')})`);
        } else {
          console.log(`📄 ${cmd.name}`);
        }
      } else if (cmd.type === ApplicationCommandType.User) {
        console.log(`👤 ${cmd.name} (User Context Menu)`);
      } else if (cmd.type === ApplicationCommandType.Message) {
        console.log(`💬 ${cmd.name} (Message Context Menu)`);
      }
    });
    
    return data;
  } catch (error) {
    console.error(`❌ Bulk registration failed: ${error.message}`);
    console.log('\n🔄 Attempting to register commands individually...');
    
    // Try one by one as fallback
    const registeredCommands = [];
    for (const command of processedCommands) {
      try {
        console.log(`Registering command: ${command.name}...`);
        const registeredCommand = await rest.post(
          Routes.applicationCommands(clientId),
          { body: command }
        );
        
        registeredCommands.push(registeredCommand);
        console.log(`✅ Successfully registered: ${command.name}`);
      } catch (error) {
        console.error(`❌ Failed to register ${command.name}: ${error.message}`);
      }
      
      // Add a delay between registrations
      await sleep(1500);
    }
    
    return registeredCommands;
  }
}

// Main function
async function main() {
  try {
    console.log('\n🚀 Starting command registration process...');
    
    // Step 1: Load all commands
    const commands = loadCommands();
    if (commands.length === 0) {
      console.error('❌ No valid commands found to register!');
      process.exit(1);
    }
    
    // Step 2: Delete existing commands
    await deleteExistingCommands();
    
    // Step 3: Register commands
    const registeredCommands = await registerCommands(commands);
    
    console.log(`\n✅ Command registration completed successfully: ${registeredCommands.length} commands registered.`);
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