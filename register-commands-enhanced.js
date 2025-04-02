/**
 * Enhanced Command Registration Script
 * 
 * This script improves command registration with detailed diagnostics
 * and validation of command structure to ensure commands appear
 * properly with their subcommands in Discord UI.
 * 
 * Run with: node register-commands-enhanced.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { logger } = require('./src/utils/logger');

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

// Configure REST client with longer timeout
const rest = new REST({ version: '10', timeout: 120000 }).setToken(token);

console.log('Discord Enhanced Command Registration Utility');
console.log('===========================================');
console.log(`Token available: ${!!token}, Token length: ${token.length}`);
console.log(`Client ID available: ${!!clientId}, Client ID: ${clientId}`);

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Diagnose command structures for Discord API compatibility
 * @param {Array} commands Array of command data objects
 * @returns {boolean} Whether all commands pass validation
 */
function diagnoseCommands(commands) {
  console.log('\n🔍 Validating command structures...');
  let allValid = true;
  
  commands.forEach(cmd => {
    console.log(`\nChecking command: ${cmd.name}`);
    
    // Basic validation
    if (!cmd.name || !cmd.description) {
      console.error(`❌ Command missing name or description: ${JSON.stringify(cmd)}`);
      allValid = false;
      return;
    }
    
    // Check for subcommands
    if (cmd.options && cmd.options.some(opt => opt.type === 1)) {
      const subcommands = cmd.options.filter(opt => opt.type === 1);
      console.log(`Command has ${subcommands.length} subcommands:`);
      
      subcommands.forEach(sc => {
        console.log(`  - ${sc.name}: ${sc.description}`);
        
        // Validate subcommand
        if (!sc.name || !sc.description) {
          console.error(`  ❌ Subcommand missing name or description`);
          allValid = false;
          return;
        }
        
        // Check subcommand options
        if (sc.options && sc.options.length > 0) {
          console.log(`    Subcommand has ${sc.options.length} options:`);
          sc.options.forEach(opt => {
            console.log(`    - ${opt.name} (type: ${opt.type}, required: ${opt.required || false})`);
            
            // Validate option
            if (!opt.name || !opt.description || opt.type === undefined) {
              console.error(`    ❌ Option missing required properties`);
              allValid = false;
            }
          });
        }
      });
    } else if (cmd.options) {
      console.log(`Command has ${cmd.options.length} direct options (not subcommands)`);
    }
  });
  
  if (allValid) {
    console.log('\n✅ All commands passed structure validation');
  } else {
    console.error('\n❌ Some commands failed validation - see logs above');
  }
  
  return allValid;
}

/**
 * Load command files from directories
 * @returns {Array} Array of command data objects
 */
function loadCommands() {
  const commands = [];
  
  // Load from new_commands directory first (priority)
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
  
  // Then load from regular commands directories if needed
  const commandsPath = path.join(__dirname, 'src', 'commands');
  if (fs.existsSync(commandsPath)) {
    // Direct commands in root
    const rootFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of rootFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)]; // Clear cache
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          // Check if command with same name already exists from new_commands
          if (!commands.some(cmd => cmd.name === command.data.name)) {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded command from commands root: ${command.data.name}`);
          } else {
            console.warn(`⚠️ Skipping duplicate command: ${command.data.name}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error loading ${file}: ${error.message}`);
      }
    }
    
    // Subdirectories
    const folders = fs.readdirSync(commandsPath).filter(item => !item.includes('.') && item !== 'context');
    for (const folder of folders) {
      const folderPath = path.join(commandsPath, folder);
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          delete require.cache[require.resolve(filePath)]; // Clear cache
          const command = require(filePath);
          
          if ('data' in command && 'execute' in command) {
            // Check if command with same name already exists
            if (!commands.some(cmd => cmd.name === command.data.name)) {
              commands.push(command.data.toJSON());
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
    
    // Context menu commands
    const contextPath = path.join(commandsPath, 'context');
    if (fs.existsSync(contextPath)) {
      const contextFiles = fs.readdirSync(contextPath).filter(file => file.endsWith('.js'));
      
      for (const file of contextFiles) {
        try {
          const filePath = path.join(contextPath, file);
          delete require.cache[require.resolve(filePath)]; // Clear cache
          const command = require(filePath);
          
          if ('data' in command && 'execute' in command) {
            if (!commands.some(cmd => cmd.name === command.data.name)) {
              commands.push(command.data.toJSON());
              console.log(`✅ Loaded context command: ${command.data.name}`);
            } else {
              console.warn(`⚠️ Skipping duplicate context command: ${command.data.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error loading context/${file}: ${error.message}`);
        }
      }
    }
  }
  
  return commands;
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
 * @returns {Promise<Array>} Registered commands
 */
async function registerCommands(commands) {
  console.log(`\n📝 Registering ${commands.length} commands with Discord API...`);
  
  try {
    // Attempt bulk registration first
    console.log('Attempting bulk registration...');
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    
    console.log(`✅ Successfully registered ${data.length} commands in bulk`);
    return data;
  } catch (error) {
    console.error(`❌ Bulk registration failed: ${error.message}`);
    console.log('\n🔄 Attempting to register commands individually...');
    
    // Try one by one as fallback
    const registeredCommands = [];
    for (const command of commands) {
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

/**
 * Print information about registered commands
 * @param {Array} commands Registered commands
 */
function printCommandSummary(commands) {
  console.log('\n📋 Registered Commands Summary:');
  console.log('==============================');
  
  commands.forEach(cmd => {
    const subcommands = cmd.options?.filter(opt => opt.type === 1);
    if (subcommands && subcommands.length > 0) {
      console.log(`📎 ${cmd.name} (with ${subcommands.length} subcommands: ${subcommands.map(sc => sc.name).join(', ')})`);
    } else {
      console.log(`📄 ${cmd.name}`);
    }
  });
}

// Main function
async function main() {
  try {
    console.log('\n🚀 Starting enhanced command registration process...');
    
    // Step 1: Load all commands
    const commands = loadCommands();
    if (commands.length === 0) {
      console.error('❌ No valid commands found to register!');
      process.exit(1);
    }
    
    // Step 2: Diagnose commands for structure issues
    console.log('\nValidating command structures before registration...');
    const validationResult = diagnoseCommands(commands);
    if (!validationResult) {
      console.warn('⚠️ Some commands may not register correctly due to validation issues!');
      
      // Ask for confirmation to continue
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const response = await new Promise(resolve => {
        readline.question('Continue with registration despite validation issues? (y/N): ', resolve);
      });
      readline.close();
      
      if (response.toLowerCase() !== 'y') {
        console.log('Registration cancelled by user.');
        process.exit(0);
      }
    }
    
    // Step 3: Delete existing commands
    await deleteExistingCommands();
    
    // Step 4: Register commands
    const registeredCommands = await registerCommands(commands);
    
    // Step 5: Print summary
    printCommandSummary(registeredCommands);
    
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