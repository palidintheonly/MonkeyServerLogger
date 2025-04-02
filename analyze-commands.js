// This file is for analyzing and fixing any command registration conflicts
const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

// Create collections to track commands from different sources
const commandsFromFiles = new Collection();
const commandsFromBotFunctions = new Collection();

// Import the bot-functions commands
const botFunctions = require('./src/bot-functions.js');
if (botFunctions.commands) {
  console.log('Found command definitions in bot-functions.js:');
  botFunctions.commands.forEach(cmd => {
    console.log(`- ${cmd.name} (from bot-functions)`);
    commandsFromBotFunctions.set(cmd.name, true);
  });
} else {
  console.log('No commands array found in bot-functions.js');
}

// Load commands from files (same logic as in bot.js)
const foldersPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(foldersPath).filter(file => !file.includes('.'));

// Direct commands in commands folder
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(foldersPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    const commandName = command.data.name;
    console.log(`- ${commandName} (from file ${file})`);
    commandsFromFiles.set(commandName, {
      file,
      hasSubcommands: command.data.options && command.data.options.some(opt => opt.type === 1)
    });
  }
}

// Commands in subfolders (except context)
for (const folder of commandFolders) {
  if (folder === 'context') continue;
  
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      const commandName = command.data.name;
      console.log(`- ${commandName} (from ${folder}/${file})`);
      commandsFromFiles.set(commandName, {
        file: `${folder}/${file}`,
        hasSubcommands: command.data.options && command.data.options.some(opt => opt.type === 1)
      });
    }
  }
}

// Context menu commands
const contextPath = path.join(foldersPath, 'context');
if (fs.existsSync(contextPath)) {
  const contextFiles = fs.readdirSync(contextPath).filter(file => file.endsWith('.js'));
  
  for (const file of contextFiles) {
    const filePath = path.join(contextPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      const commandName = command.data.name;
      console.log(`- ${commandName} (context command from ${file})`);
      commandsFromFiles.set(commandName, {
        file: `context/${file}`,
        isContextCommand: true
      });
    }
  }
}

// Check for conflicts
console.log('\nChecking for conflicts between bot-functions.js and command files...');
let conflicts = false;

commandsFromFiles.forEach((info, name) => {
  if (commandsFromBotFunctions.has(name)) {
    console.log(`⚠️ CONFLICT: Command '${name}' is defined in both ${info.file} and bot-functions.js`);
    conflicts = true;
    
    if (info.hasSubcommands) {
      console.log(`   The file version (${info.file}) has subcommands`);
    }
  }
});

if (!conflicts) {
  console.log('✅ No conflicts found between bot-functions.js and command files');
} else {
  console.log('\n🛑 Conflicts detected! Recommendation:');
  console.log('1. Remove the duplicate commands from bot-functions.js, OR');
  console.log('2. Make sure both definitions are identical (including subcommands)');
}

// Log command registration method in bot.js
console.log('\nAnalyzing bot.js command registration method...');
try {
  const botJsContent = fs.readFileSync('./bot.js', 'utf8');
  if (botJsContent.includes('registerCommandsToGuilds')) {
    console.log('⚠️ bot.js is using registerCommandsToGuilds from bot-functions.js');
    console.log('This may cause conflicts with the built-in registerCommands function');
  } else {
    console.log('✅ bot.js is using its own registerCommands function');
  }
} catch (error) {
  console.log(`Error reading bot.js: ${error.message}`);
}

console.log('\nAnalysis complete. Use this information to fix any command registration issues.');