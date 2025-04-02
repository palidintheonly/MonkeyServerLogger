/**
 * Command Structure Verification Script
 * 
 * This script verifies the structure of commands in code against Discord's API 
 * without attempting to register new commands.
 */
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

// Initialize logger
const logFile = 'verify-commands.log';
fs.writeFileSync(logFile, `=== Command Verification - ${new Date().toISOString()} ===\n\n`);

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Get environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;

if (!token || !clientId) {
  log('ERROR: Missing required environment variables (DISCORD_BOT_TOKEN or CLIENT_ID)');
  process.exit(1);
}

// Create API client
const api = axios.create({
  baseURL: 'https://discord.com/api/v10',
  headers: {
    'Authorization': `Bot ${token}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

/**
 * Load commands from the code
 * @returns {Array} Array of command objects
 */
function loadCommandsFromCode() {
  const commands = [];
  
  // Load from new_commands directory (preferred location)
  const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
  if (fs.existsSync(newCommandsPath)) {
    const files = fs.readdirSync(newCommandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of files) {
      try {
        const command = require(path.join(newCommandsPath, file));
        
        if (command.data && command.execute) {
          if (typeof command.data.toJSON === 'function') {
            commands.push({
              name: command.data.name,
              source: `src/new_commands/${file}`,
              data: command.data.toJSON()
            });
          }
        }
      } catch (error) {
        log(`Error loading command ${file}: ${error.message}`);
      }
    }
  }
  
  return commands;
}

/**
 * Verify if a command has the correct structure for Discord
 * @param {Object} command Command object to verify
 * @returns {Boolean} Whether the command is valid
 */
function verifyCommandStructure(command) {
  let isValid = true;
  
  // Check required fields
  if (!command.name) {
    log(`ERROR: Command missing name: ${JSON.stringify(command)}`);
    isValid = false;
  }
  
  if (!command.description && command.type === 1) {
    log(`ERROR: Command ${command.name} missing description`);
    isValid = false;
  }
  
  // Check subcommands
  if (command.options && command.options.some(opt => opt.type === 1)) {
    const subcommands = command.options.filter(opt => opt.type === 1);
    
    for (const subcommand of subcommands) {
      if (!subcommand.name || !subcommand.description) {
        log(`ERROR: Subcommand of ${command.name} missing name or description`);
        isValid = false;
      }
    }
  }
  
  return isValid;
}

/**
 * Get a string representation of a command for comparison
 * @param {Object} command Command object
 * @returns {String} String representation
 */
function commandToString(command) {
  let str = `/${command.name}`;
  
  if (command.options && command.options.some(opt => opt.type === 1)) {
    // This is a command with subcommands
    const subcommands = command.options
      .filter(opt => opt.type === 1)
      .map(sub => sub.name)
      .join('|');
    
    str += ` [${subcommands}]`;
  } else if (command.options && command.options.length > 0) {
    // This is a command with options
    const options = command.options
      .map(opt => opt.name)
      .join(', ');
    
    str += ` {${options}}`;
  }
  
  return str;
}

/**
 * Main function
 */
async function main() {
  log('Starting command verification...');
  
  try {
    // Step 1: Get commands from Discord API
    log('Fetching commands from Discord API...');
    const apiResponse = await api.get(`/applications/${clientId}/commands`);
    const apiCommands = apiResponse.data;
    
    log(`Found ${apiCommands.length} commands on Discord API`);
    
    // Step 2: Load commands from code
    log('Loading commands from code...');
    const codeCommands = loadCommandsFromCode();
    
    log(`Found ${codeCommands.length} commands in code`);
    
    // Step 3: Verify command structures
    log('\nVerifying command structures:');
    for (const command of codeCommands) {
      log(`\nCommand: ${command.name} (from ${command.source})`);
      log(`Structure: ${commandToString(command.data)}`);
      
      const isValid = verifyCommandStructure(command.data);
      log(`Valid structure: ${isValid ? 'YES' : 'NO'}`);
      
      // Check for subcommands
      if (command.data.options && command.data.options.some(opt => opt.type === 1)) {
        const subcommands = command.data.options.filter(opt => opt.type === 1);
        log(`Has ${subcommands.length} subcommands:`);
        
        for (const sub of subcommands) {
          log(`  - ${sub.name}: ${sub.description}`);
          
          // List subcommand options
          if (sub.options && sub.options.length > 0) {
            log(`    Options:`);
            for (const opt of sub.options) {
              const required = opt.required ? ' (required)' : '';
              log(`    - ${opt.name}: ${opt.description}${required}`);
            }
          }
        }
      }
      
      // Compare with API if found
      const apiCommand = apiCommands.find(cmd => cmd.name === command.name);
      if (apiCommand) {
        log(`Found on Discord API: YES`);
        
        // Compare subcommands
        if (apiCommand.options && apiCommand.options.some(opt => opt.type === 1)) {
          const apiSubcommands = apiCommand.options.filter(opt => opt.type === 1);
          const codeSubcommands = command.data.options ? 
            command.data.options.filter(opt => opt.type === 1) : [];
          
          log(`API has ${apiSubcommands.length} subcommands, code has ${codeSubcommands.length}`);
          
          // Check for missing subcommands
          for (const codeSub of codeSubcommands) {
            const apiSub = apiSubcommands.find(s => s.name === codeSub.name);
            if (!apiSub) {
              log(`  ⚠️ Subcommand ${codeSub.name} exists in code but not on API`);
            }
          }
        }
      } else {
        log(`Found on Discord API: NO (needs registration)`);
      }
    }
    
    // Step 4: Check for commands on API not in code
    log('\nChecking for commands on API not in code:');
    for (const apiCommand of apiCommands) {
      const codeCommand = codeCommands.find(cmd => cmd.data.name === apiCommand.name);
      if (!codeCommand) {
        log(`⚠️ Command /${apiCommand.name} exists on API but not in code`);
      }
    }
    
    log('\nVerification complete!');
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (error.response) {
      log(`Status: ${error.response.status}`);
      log(`Data: ${JSON.stringify(error.response.data)}`);
    } else {
      log(`Full error: ${JSON.stringify(error)}`);
    }
  }
}

main().catch(error => {
  log(`Unhandled error: ${error.message}`);
});