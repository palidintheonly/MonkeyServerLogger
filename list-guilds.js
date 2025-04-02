/**
 * List Guilds Script
 * 
 * This script lists all guilds (servers) that the bot is a member of
 * to help with per-guild command registration.
 */
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

// Create log file
const logFile = 'guilds-list.log';
fs.writeFileSync(logFile, `=== Guild List - ${new Date().toISOString()} ===\n\n`);

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

// Get bot token from environment variables
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;

/**
 * Main function
 */
async function main() {
  if (!token) {
    log('ERROR: Missing required environment variable DISCORD_BOT_TOKEN');
    process.exit(1);
  }
  
  try {
    // Login to Discord
    log('Logging in to Discord...');
    await client.login(token);
    
    log(`Bot logged in as ${client.user.tag}`);
    
    // Get all guilds the bot is a member of
    const guilds = [...client.guilds.cache.values()];
    
    if (guilds.length === 0) {
      log('Bot is not a member of any guilds.');
      process.exit(0);
    }
    
    log(`Bot is a member of ${guilds.length} guilds:`);
    log('=================================');
    
    // Log guild details
    guilds.forEach((guild, index) => {
      log(`${index + 1}. Guild Name: ${guild.name || 'Unknown'}`);
      log(`   Guild ID: ${guild.id}`);
      log(`   Owner ID: ${guild.ownerId || 'Unknown'}`);
      log(`   Member Count: ${guild.memberCount || 'Unknown'}`);
      log(`   Created At: ${guild.createdAt}`);
      
      // Get available channels
      const textChannels = guild.channels?.cache?.filter(channel => channel.type === 0) || [];
      log(`   Text Channels: ${textChannels.size || 0}`);
      
      // Log channel information
      if (textChannels.size > 0) {
        log('   Channel List:');
        textChannels.forEach(channel => {
          log(`     - #${channel.name} (${channel.id})`);
        });
      }
      
      log('=================================');
    });
    
    // Generate a simple CSV of guild data
    const csvData = guilds.map(guild => {
      const guildName = guild.name ? guild.name.replace(/,/g, ' ') : 'Unknown';
      const memberCount = guild.memberCount || 0;
      return `${guild.id},${guildName},${memberCount}`;
    }).join('\n');
    const csvHeader = 'guild_id,guild_name,member_count\n';
    fs.writeFileSync('guilds.csv', csvHeader + csvData);
    
    log('Guild information has been saved to guilds.csv');
    
    // Extract just IDs for easy copy-paste
    log('\nGuild IDs for easy copy-paste:');
    guilds.forEach(guild => {
      log(guild.id);
    });
  } catch (error) {
    log(`ERROR: ${error.message}`);
    process.exit(1);
  } finally {
    // Always destroy the client
    client.destroy();
    log('Discord client disconnected');
  }
}

// Run the main function
main();