// Combined Discord Bot and Express server for Replit deployment
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { logger } = require('./src/utils/logger');

// Express app setup
const app = express();
const port = 5000;

// Create a Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Basic routes
app.get('/', (req, res) => {
  res.send('Discord bot is running!');
});

app.get('/status', (req, res) => {
  res.json({
    status: client.user ? 'online' : 'offline',
    botUsername: client.user ? client.user.tag : 'Not connected',
    uptime: client.uptime ? `${Math.floor(client.uptime / 60000)} minutes` : '0',
    servers: client.guilds?.cache.size || 0
  });
});

// Start the server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on port ${port}`);
  logger.info(`Web server running on port ${port}`);
});

// Set up Discord bot events
client.once('ready', () => {
  logger.info('==================================================');
  logger.info('Discord bot is ready!');
  logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
  logger.info(`Serving ${client.guilds.cache.size} servers`);
  logger.info('==================================================');
  
  // Set activity
  client.user.setPresence({
    activities: [{ name: 'with Discord.js', type: ActivityType.Playing }],
    status: 'online'
  });
  
  // Log guilds the bot is in
  logger.info('Bot is in the following guilds:');
  client.guilds.cache.forEach(guild => {
    logger.info(`- ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
  });
});

// Basic ping command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  if (interaction.commandName === 'ping') {
    const sent = await interaction.reply({ content: 'Measuring ping...', fetchReply: true });
    const pingTime = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Bot Latency: ${pingTime}ms | API Latency: ${Math.round(client.ws.ping)}ms`);
  }
});

// Handle errors to prevent crashes
client.on('error', error => {
  logger.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

// Login to Discord
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  logger.error('No Discord bot token found in environment variables!');
} else {
  client.login(token).then(() => {
    logger.info('Successfully logged in to Discord');
  }).catch(error => {
    logger.error('Failed to log in to Discord:', error);
  });
}

// Function to keep the process running
function keepAlive() {
  return setInterval(() => {
    logger.debug('Keeping the application alive...');
  }, 60000); // Log every minute
}

// Start keep-alive process to prevent the workflow from exiting
const keepAliveInterval = keepAlive();