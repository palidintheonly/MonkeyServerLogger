// Combined Discord bot and web server file
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
const port = 5000;

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// Collection for commands
client.commands = new Map();

// Load and register commands
async function registerCommands() {
  try {
    // Simple example ping command
    const pingCommand = {
      data: {
        name: 'ping',
        description: 'Check bot latency'
      },
      execute: async (interaction) => {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Pong! Bot Latency: ${latency}ms | API Latency: ${Math.round(client.ws.ping)}ms`);
      }
    };
    
    // Add to commands collection
    client.commands.set(pingCommand.data.name, pingCommand);
    
    // Register to Discord API
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
    const commandsData = [pingCommand.data];
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: commandsData }
    );
    
    console.log('Successfully registered global commands');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error executing command:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Error executing command', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Error executing command', ephemeral: true });
    }
  }
});

// Client ready event
client.once(Events.ClientReady, () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  // Log server information
  const guilds = client.guilds.cache;
  console.log(`Bot is serving ${guilds.size} servers:`);
  guilds.forEach(guild => {
    console.log(`- ${guild.name} (${guild.id}): ${guild.memberCount} members`);
  });
});

// Set up express routes
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Discord Bot</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #36393f;
            color: #dcddde;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .container {
            max-width: 800px;
            width: 100%;
            background-color: #2f3136;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
            border: 1px solid #202225;
          }
          h1 { color: #ffffff; }
          .status {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            background-color: #57F287;
            color: white;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>The Royal Court Herald</h1>
          <div class="status">Bot Status: Online</div>
          <p>The bot is currently connected to ${client.guilds.cache.size} servers.</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/status', (req, res) => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  
  res.json({
    status: 'online',
    servers: client.guilds.cache.size,
    uptime: uptimeFormatted,
    bot_name: client.user ? client.user.tag : 'Connecting...',
    api_ping: client.ws.ping ? `${Math.round(client.ws.ping)}ms` : 'N/A'
  });
});

// Start the web server
app.listen(port, '0.0.0.0', () => {
  // Use this exact console log message format for Replit workflow detection
  console.log(`Listening on port ${port}`);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    registerCommands();
  })
  .catch(err => {
    console.error('Failed to login to Discord:', err);
  });

// Process error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});