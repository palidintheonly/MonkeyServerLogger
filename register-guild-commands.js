/**
 * Guild Command Registration Script
 * 
 * This script registers commands to specific guilds (servers) instead of globally,
 * which helps avoid rate limits and provides faster command updates.
 */
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create log file
const logFile = 'guild-commands.log';
fs.writeFileSync(logFile, `=== Guild Command Registration - ${new Date().toISOString()} ===\n\n`);

// Logger function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Get environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID || process.env.BOT_ID;

// Create REST client
const rest = new REST({ version: '10' }).setToken(token);

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/**
 * Load commands from the code
 * @returns {Array} Array of command objects
 */
function loadCommands() {
  try {
    const commands = [];

    // Load slash commands from new_commands directory
    const commandsPath = path.join(__dirname, 'src', 'new_commands');
    
    // Check if directory exists
    if (!fs.existsSync(commandsPath)) {
      log(`ERROR: Commands directory not found: ${commandsPath}`);
      return commands;
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    log(`Found ${commandFiles.length} command files in ${commandsPath}`);

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        
        // Clear require cache to ensure we get the latest version
        delete require.cache[require.resolve(filePath)];
        
        const command = require(filePath);
        
        if (command.data && typeof command.data.toJSON === 'function') {
          commands.push(command.data.toJSON());
          log(`Loaded command: ${command.data.name}`);
        } else {
          log(`WARNING: Command in ${file} is missing required 'data' property or toJSON method`);
        }
      } catch (error) {
        log(`ERROR: Failed to load command from ${file}: ${error.message}`);
      }
    }

    log(`Successfully loaded ${commands.length} commands`);
    return commands;
  } catch (error) {
    log(`ERROR: Failed to load commands: ${error.message}`);
    return [];
  }
}

/**
 * Register commands for a guild with retry logic
 * @param {string} guildId - Discord guild ID
 * @param {Array} commands - Array of command objects
 */
async function registerGuildCommands(guildId, commands) {
  if (!guildId) {
    log('ERROR: No guild ID provided');
    return;
  }
  
  if (!commands || commands.length === 0) {
    log('ERROR: No commands to register');
    return;
  }

  log(`Registering ${commands.length} commands to guild ${guildId}...`);
  
  // Add retry logic
  const maxRetries = 3;
  let attempt = 0;
  let success = false;
  
  while (attempt < maxRetries && !success) {
    attempt++;
    
    try {
      log(`Attempt ${attempt}/${maxRetries} to register commands to guild ${guildId}`);
      
      // Register commands with Discord API
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      
      log(`SUCCESS: Registered ${data.length} commands to guild ${guildId}`);
      success = true;
      
      // Log registered commands
      for (const cmd of data) {
        log(`- Registered: ${cmd.name} (ID: ${cmd.id})`);
        
        // Check and log subcommands if present
        if (cmd.options && cmd.options.some(opt => opt.type === 1)) {
          const subcommands = cmd.options.filter(opt => opt.type === 1);
          log(`  Has ${subcommands.length} subcommands:`);
          subcommands.forEach(sub => {
            log(`  - ${sub.name}`);
          });
        }
      }
      
      return data;
    } catch (error) {
      log(`ERROR: Failed to register commands to guild ${guildId} (Attempt ${attempt}/${maxRetries})`);
      log(`Error message: ${error.message}`);
      
      // If we have more retries, wait before trying again
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  if (!success) {
    log(`CRITICAL ERROR: Failed to register commands to guild ${guildId} after ${maxRetries} attempts`);
  }
}

/**
 * Get guilds the bot is in using discord.js client
 * @returns {Promise<Array>} Array of guild IDs
 */
async function getBotGuilds() {
  try {
    log('Logging in to Discord to fetch guilds...');
    await client.login(token);
    
    log(`Bot logged in as ${client.user.tag}`);
    
    // Get all guilds the bot is a member of
    const guilds = [...client.guilds.cache.values()];
    
    log(`Bot is a member of ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      log(`- ${guild.name} (${guild.id})`);
    });
    
    return guilds.map(g => g.id);
  } catch (error) {
    log(`ERROR: Failed to get bot guilds: ${error.message}`);
    return [];
  } finally {
    client.destroy();
  }
}

/**
 * CLI Interface - Process command arguments
 */
function processCLIArgs() {
  const args = process.argv.slice(2);
  
  // Check if a guild ID was provided
  if (args.length > 0 && args[0] === '--all') {
    return { registerAll: true };
  } else if (args.length > 0) {
    // Register to specific guild(s)
    return { guildIds: args };
  }
  
  return { promptForGuild: true };
}

/**
 * Main function
 */
async function main() {
  // Process command line arguments
  const cliArgs = processCLIArgs();
  
  // Validate token and client ID
  if (!token) {
    log('ERROR: Missing required environment variable DISCORD_BOT_TOKEN');
    process.exit(1);
  }
  
  if (!clientId) {
    log('ERROR: Missing required environment variable CLIENT_ID or DISCORD_APPLICATION_ID');
    process.exit(1);
  }
  
  // Load commands
  const commands = loadCommands();
  
  if (commands.length === 0) {
    log('No commands loaded. Exiting.');
    process.exit(1);
  }
  
  let guildsToRegister = [];
  
  // Determine which guilds to register commands to
  if (cliArgs.registerAll) {
    log('Registering commands to all guilds the bot is a member of...');
    guildsToRegister = await getBotGuilds();
    
    if (guildsToRegister.length === 0) {
      log('No guilds found. Exiting.');
      process.exit(1);
    }
  } else if (cliArgs.guildIds) {
    guildsToRegister = cliArgs.guildIds;
    log(`Registering commands to specified guilds: ${guildsToRegister.join(', ')}`);
  } else {
    log('No guild ID specified. Fetching all available guilds...');
    guildsToRegister = await getBotGuilds();
    
    if (guildsToRegister.length === 0) {
      log('No guilds found. Exiting.');
      process.exit(1);
    }
    
    log(`Defaulting to registering commands to all ${guildsToRegister.length} guilds`);
  }
  
  // Register commands to each guild
  for (const guildId of guildsToRegister) {
    await registerGuildCommands(guildId, commands);
  }
  
  log('Command registration process complete!');
}

// Run the main function
main();