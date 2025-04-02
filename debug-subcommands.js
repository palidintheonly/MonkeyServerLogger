/**
 * Debug Subcommands Script 
 * 
 * This script adds additional logging to diagnose issues with
 * slash command subcommands not displaying properly in Discord UI
 */
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Utility function to inspect an object's properties
function inspectObject(obj, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return '...';
  
  const indent = '  '.repeat(depth);
  let result = '';
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) {
      result += `${indent}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      result += `${indent}${key}: {\n`;
      result += inspectObject(value, depth + 1, maxDepth);
      result += `${indent}}\n`;
    } else if (Array.isArray(value)) {
      result += `${indent}${key}: [\n`;
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          result += `${indent}  [${index}]: {\n`;
          result += inspectObject(item, depth + 2, maxDepth);
          result += `${indent}  }\n`;
        } else {
          result += `${indent}  [${index}]: ${item}\n`;
        }
      });
      result += `${indent}]\n`;
    } else {
      result += `${indent}${key}: ${value}\n`;
    }
  }
  
  return result;
}

// Load a command to check its structure
function examineCommand(commandName) {
  console.log(`\n🔍 Examining command: ${commandName}\n`);
  
  // Look in src/new_commands first
  const newCommandsPath = path.join(__dirname, 'src', 'new_commands');
  const newCommandFile = path.join(newCommandsPath, `${commandName}.js`);
  
  if (fs.existsSync(newCommandFile)) {
    try {
      // Load the command
      const command = require(newCommandFile);
      
      // Check the command's data
      if ('data' in command && command.data) {
        console.log('Command data structure:');
        
        // If it's a SlashCommandBuilder, convert to JSON
        let commandData;
        if (typeof command.data.toJSON === 'function') {
          commandData = command.data.toJSON();
          console.log(`Command uses SlashCommandBuilder: true`);
        } else {
          commandData = command.data;
          console.log(`Command uses SlashCommandBuilder: false`);
        }
        
        // Check for subcommands
        const hasSubcommands = commandData.options && commandData.options.some(opt => opt.type === 1);
        console.log(`Has subcommands: ${hasSubcommands}`);
        
        if (hasSubcommands) {
          console.log('\nSubcommands:');
          const subcommands = commandData.options.filter(opt => opt.type === 1);
          
          subcommands.forEach(sc => {
            console.log(`  - ${sc.name}: ${sc.description}`);
            
            if (sc.options && sc.options.length > 0) {
              console.log('    Options:');
              sc.options.forEach(opt => {
                console.log(`    - ${opt.name} (type: ${opt.type}, required: ${opt.required || false})`);
              });
            }
          });
        }
        
        // Check execute methods
        console.log(`\nImplements execute(): ${typeof command.execute === 'function'}`);
        
        // Check for subcommand handling in execute
        if (typeof command.execute === 'function') {
          const executeStr = command.execute.toString();
          const hasSubcommandCheck = executeStr.includes('options.getSubcommand');
          console.log(`Checks for subcommands in execute(): ${hasSubcommandCheck}`);
          
          if (hasSubcommandCheck) {
            // Find subcommand handler methods
            const methods = Object.keys(command).filter(key => 
              typeof command[key] === 'function' && 
              key.startsWith('handle') && 
              key !== 'handleButton' && 
              key !== 'handleSelectMenu'
            );
            
            if (methods.length > 0) {
              console.log('\nSubcommand handler methods:');
              methods.forEach(method => console.log(`  - ${method}()`));
            } else {
              console.log('\n⚠️ No subcommand handler methods found');
            }
          }
        }
        
        // JSON structure of command (for debugging)
        console.log('\nJSON representation:');
        console.log(JSON.stringify(commandData, null, 2));
      } else {
        console.log(`⚠️ Command does not have 'data' property`);
      }
    } catch (error) {
      console.error(`❌ Error examining command: ${error.message}`);
      console.error(error.stack);
    }
  } else {
    console.log(`⚠️ Command file not found in src/new_commands: ${commandName}.js`);
    
    // Try to find in regular commands directory
    const commandsPath = path.join(__dirname, 'src', 'commands');
    
    if (fs.existsSync(commandsPath)) {
      const categories = fs.readdirSync(commandsPath).filter(file => 
        fs.statSync(path.join(commandsPath, file)).isDirectory()
      );
      
      let found = false;
      for (const category of categories) {
        const categoryPath = path.join(commandsPath, category);
        const commandFile = path.join(categoryPath, `${commandName}.js`);
        
        if (fs.existsSync(commandFile)) {
          found = true;
          console.log(`Command found in src/commands/${category}/${commandName}.js`);
          
          try {
            const command = require(commandFile);
            
            // Check the command's data
            if ('data' in command && command.data) {
              console.log('Command data structure:');
              
              // If it's a SlashCommandBuilder, convert to JSON
              let commandData;
              if (typeof command.data.toJSON === 'function') {
                commandData = command.data.toJSON();
                console.log(`Command uses SlashCommandBuilder: true`);
              } else {
                commandData = command.data;
                console.log(`Command uses SlashCommandBuilder: false`);
              }
              
              // Check for subcommands
              const hasSubcommands = commandData.options && commandData.options.some(opt => opt.type === 1);
              console.log(`Has subcommands: ${hasSubcommands}`);
              
              if (hasSubcommands) {
                console.log('\nSubcommands:');
                const subcommands = commandData.options.filter(opt => opt.type === 1);
                
                subcommands.forEach(sc => {
                  console.log(`  - ${sc.name}: ${sc.description}`);
                  
                  if (sc.options && sc.options.length > 0) {
                    console.log('    Options:');
                    sc.options.forEach(opt => {
                      console.log(`    - ${opt.name} (type: ${opt.type}, required: ${opt.required || false})`);
                    });
                  }
                });
              }
              
              // Check execute methods
              console.log(`\nImplements execute(): ${typeof command.execute === 'function'}`);
              
              // Check for subcommand handling in execute
              if (typeof command.execute === 'function') {
                const executeStr = command.execute.toString();
                const hasSubcommandCheck = executeStr.includes('options.getSubcommand');
                console.log(`Checks for subcommands in execute(): ${hasSubcommandCheck}`);
                
                if (hasSubcommandCheck) {
                  // Find subcommand handler methods
                  const methods = Object.keys(command).filter(key => 
                    typeof command[key] === 'function' && 
                    key.startsWith('handle') && 
                    key !== 'handleButton' && 
                    key !== 'handleSelectMenu'
                  );
                  
                  if (methods.length > 0) {
                    console.log('\nSubcommand handler methods:');
                    methods.forEach(method => console.log(`  - ${method}()`));
                  } else {
                    console.log('\n⚠️ No subcommand handler methods found');
                  }
                }
              }
              
              // JSON structure of command (for debugging)
              console.log('\nJSON representation:');
              console.log(JSON.stringify(commandData, null, 2));
            } else {
              console.log(`⚠️ Command does not have 'data' property`);
            }
          } catch (error) {
            console.error(`❌ Error examining command: ${error.message}`);
            console.error(error.stack);
          }
          
          break;
        }
      }
      
      if (!found) {
        console.log(`❌ Command not found in any directory: ${commandName}.js`);
      }
    } else {
      console.log(`❌ Commands directory not found: ${commandsPath}`);
    }
  }
}

// Check a specific command - can be changed to examine other commands
examineCommand('setup');
examineCommand('logs');