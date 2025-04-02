/**
 * Register All Guild Commands Script
 * 
 * This script loads and registers commands to all guilds (servers) the bot is a member of.
 * It uses the guildCommandManager for reliable per-guild command registration.
 */
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const guildCommandManager = require('./src/utils/guildCommandManager');

// Create log file
const logFile = 'guild-commands-all.log';
fs.writeFileSync(logFile, `=== Guild Command Registration - ${new Date().toISOString()} ===\n\n`);

// Logger function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Get environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID || process.env.BOT_ID;

/**
 * Main function
 */
async function main() {
  if (!token) {
    log('ERROR: Missing required environment variable DISCORD_BOT_TOKEN');
    process.exit(1);
  }
  
  log('Starting guild command registration process...');
  
  try {
    // Initialize the guild command manager
    guildCommandManager.init(token, clientId);
    log('Guild command manager initialized');
    
    // Connect to Discord to get guilds
    log('Logging in to Discord to fetch guilds...');
    await client.login(token);
    
    log(`Bot logged in as ${client.user.tag}`);
    
    // Get all guilds the bot is a member of
    const guilds = [...client.guilds.cache.values()];
    
    if (guilds.length === 0) {
      log('Bot is not a member of any guilds. Nothing to do.');
      process.exit(0);
    }
    
    log(`Bot is a member of ${guilds.length} guilds.`);
    
    const guildIds = guilds.map(guild => {
      log(`- ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
      return guild.id;
    });
    
    // Register commands to all guilds
    log(`Registering commands to ${guildIds.length} guilds...`);
    
    const results = await guildCommandManager.registerCommandsForGuilds(guildIds);
    
    // Log results
    for (const [guildId, result] of Object.entries(results)) {
      const guild = client.guilds.cache.get(guildId);
      const guildName = guild ? guild.name : 'Unknown Guild';
      
      if (result.error) {
        log(`❌ Failed to register commands to ${guildName} (${guildId}): ${result.error}`);
      } else {
        log(`✅ Successfully registered ${result.length} commands to ${guildName} (${guildId})`);
      }
    }
    
    log('Guild command registration process complete!');
  } catch (error) {
    log(`ERROR: ${error.message}`);
    log(error.stack);
    process.exit(1);
  } finally {
    // Always destroy the client when done
    if (client) {
      client.destroy();
      log('Discord client disconnected');
    }
  }
}

// Run the main function
main();