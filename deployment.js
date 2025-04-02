// Deployment-ready Discord.js bot with web server
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { logger } = require('./src/utils/logger');
const http = require('http');
const express = require('express');
const app = express();

// Import Discord bot functionality
const { 
  commands, 
  handleInteraction, 
  registerCommandsToGuilds 
} = require('./src/bot-functions');

// Create a Discord client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// Set up Express routes
app.get('/', (req, res) => {
  const uptime = Math.floor(client.uptime / 1000);
  res.send(`
    <html>
      <head>
        <title>Discord Bot Status</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          h1 { color: #5865F2; }
          .status { 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
          }
          .online { background-color: #57F287; color: white; }
          .info { background-color: #5865F2; color: white; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>The Royal Court Herald - Status Page</h1>
          <div class="status online">
            <strong>Status:</strong> Online
          </div>
          <div class="info">
            <p><strong>Bot Name:</strong> ${client.user ? client.user.tag : 'Connecting...'}</p>
            <p><strong>Servers:</strong> ${client.guilds.cache.size}</p>
            <p><strong>Uptime:</strong> ${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s</p>
            <p><strong>Commands:</strong> ${commands.length}</p>
          </div>
          <p>This is the status page for The Royal Court Herald Discord bot.</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    bot: client.user ? client.user.tag : 'connecting',
    uptime: client.uptime,
    servers: client.guilds.cache.size,
    commands: commands.length
  });
});

// Start Express server on port 3000
const server = app.listen(3000, '0.0.0.0', () => {
  logger.info('Web server running on port 3000');
});

// Log when the Discord client is ready
client.once('ready', async () => {
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
  
  // Register commands to guilds after connecting
  await registerCommandsToGuilds(client);
});

// Handle interactions (slash commands, buttons, select menus, etc.)
client.on('interactionCreate', async interaction => {
  await handleInteraction(interaction, client);
});

// Handle errors
client.on('error', error => {
  logger.error('Discord client error:', error);
});

// Process error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
});

// Start bot with token from environment variable
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  logger.error('ERROR: DISCORD_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

// Safe logging of token (partial masking)
const tokenLength = token.length;
const tokenFirstChars = token.substring(0, 5);
const tokenLastChars = token.substring(tokenLength - 5);
logger.info(`Using token of length ${tokenLength}, starting with ${tokenFirstChars}... and ending with ...${tokenLastChars}`);

// Login
logger.info('Attempting to connect to Discord...');
client.login(token).catch(error => {
  logger.error('Failed to log in to Discord:', error);
});