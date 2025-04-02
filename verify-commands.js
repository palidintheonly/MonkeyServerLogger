/**
 * Command Structure Verification Script
 * 
 * This script verifies the structure of commands in code against Discord's API 
 * without attempting to register new commands.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Create log file
const logFile = 'verify-commands.log';
fs.writeFileSync(logFile, `=== Command Verification - ${new Date().toISOString()} ===\n\n`);

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

/**
 * Load commands from the code
 * @returns {Array} Array of command objects
 */
function loadCommandsFromCode() {
  try {
    const commands = [];

    // Load new commands
    const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
    if (fs.existsSync(newCommandsPath)) {
      const commandFiles = fs.readdirSync(newCommandsPath).filter(file => file.endsWith('.js'));
      log(`Found ${commandFiles.length} command files in ${newCommandsPath}`);

      for (const file of commandFiles) {
        try {
          const filePath = path.join(newCommandsPath, file);
          
          // Clear require cache to ensure we get the latest version
          delete require.cache[require.resolve(filePath)];
          
          const command = require(filePath);
          
          if (command.data && typeof command.data.toJSON === 'function') {
            const commandData = command.data.toJSON();
            commands.push(commandData);
            log(`Loaded command: ${commandData.name}`);
          } else {
            log(`WARNING: Command in ${file} is missing required 'data' property or toJSON method`);
          }
        } catch (error) {
          log(`ERROR: Failed to load command from ${file}: ${error.message}`);
        }
      }
    } else {
      log(`WARNING: Directory not found: ${newCommandsPath}`);
    }

    log(`Successfully loaded ${commands.length} commands`);
    return commands;
  } catch (error) {
    log(`ERROR: Failed to load commands: ${error.message}`);
    return [];
  }
}

/**
 * Verify if a command has the correct structure for Discord
 * @param {Object} command Command object to verify
 * @returns {Boolean} Whether the command is valid
 */
function verifyCommandStructure(command) {
  if (!command.name || !command.description) {
    log(`ERROR: Command missing required name or description: ${JSON.stringify(command)}`);
    return false;
  }

  log(`Verifying command: ${command.name}`);
  
  let isValid = true;
  
  // Check for options
  if (command.options && command.options.length > 0) {
    // Check for subcommands (type 1)
    const hasSubcommands = command.options.some(opt => opt.type === 1);
    
    if (hasSubcommands) {
      log(`Command ${command.name} has subcommands:`);
      const subcommands = command.options.filter(opt => opt.type === 1);
      
      for (const subcommand of subcommands) {
        log(`  - ${subcommand.name}: ${subcommand.description}`);
        
        if (!subcommand.name || !subcommand.description) {
          log(`    ERROR: Subcommand missing name or description`);
          isValid = false;
        }
        
        // Check subcommand options
        if (subcommand.options && subcommand.options.length > 0) {
          log(`    Options:`);
          for (const option of subcommand.options) {
            if (!option.name || !option.description || option.type === undefined) {
              log(`      ERROR: Option missing required properties`);
              isValid = false;
            } else {
              const required = option.required ? 'Required' : 'Optional';
              log(`      - ${option.name}: ${option.description} (Type: ${option.type}, ${required})`);
            }
          }
        }
      }
    } else {
      // Regular options
      log(`Command ${command.name} has options:`);
      for (const option of command.options) {
        if (!option.name || !option.description || option.type === undefined) {
          log(`  ERROR: Option missing required properties`);
          isValid = false;
        } else {
          const required = option.required ? 'Required' : 'Optional';
          log(`  - ${option.name}: ${option.description} (Type: ${option.type}, ${required})`);
        }
      }
    }
  }
  
  if (isValid) {
    log(`Command ${command.name} has valid structure`);
  } else {
    log(`Command ${command.name} has structure issues`);
  }
  
  return isValid;
}

/**
 * Get a string representation of a command for comparison
 * @param {Object} command Command object
 * @returns {String} String representation
 */
function commandToString(command) {
  return JSON.stringify(command, null, 2);
}

/**
 * Main function
 */
async function main() {
  log('Starting command verification process...');
  
  // Load commands from code
  const commands = loadCommandsFromCode();
  
  if (commands.length === 0) {
    log('No commands found. Exiting.');
    process.exit(1);
  }
  
  log(`Verifying ${commands.length} commands...`);
  
  // Verify each command
  let validCount = 0;
  let invalidCount = 0;
  
  for (const command of commands) {
    const isValid = verifyCommandStructure(command);
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }
    log('----------------------------------------');
  }
  
  // Print summary
  log('\nVerification Summary:');
  log(`Total commands: ${commands.length}`);
  log(`Valid commands: ${validCount}`);
  log(`Invalid commands: ${invalidCount}`);
  
  // Print full command JSON for debugging
  log('\nComplete command JSON for debugging:');
  commands.forEach(cmd => {
    log(`\n${cmd.name}:`);
    log(commandToString(cmd));
  });
  
  log('Command verification process complete!');
}

// Run the main function
main();