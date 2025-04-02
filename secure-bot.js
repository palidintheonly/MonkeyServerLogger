// Secure Discord bot with proper token handling
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Create a minimal HTTP server for health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord bot is running!');
});

// Listen on port 3000 for health checks
server.listen(3000, '0.0.0.0', () => {
  console.log('Health check server running on port 3000');
});

// Setup logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const errorLogPath = path.join(logsDir, 'secure-error.log');
const infoLogPath = path.join(logsDir, 'secure-info.log');

// Secure logging function that never logs tokens
function secureLog(message, isError = false) {
  // Never log the actual token
  if (typeof message === 'string') {
    // Redact anything that looks like a token
    message = message.replace(/[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g, '[REDACTED_TOKEN]');
    message = message.replace(/(token|api[_-]?key|auth[_-]?token|password|secret)[=:]["']?\S+["']?/gi, '$1=[REDACTED]');
    message = message.replace(/(TOKEN|DISCORD_BOT_TOKEN|CLIENT_SECRET)=\S+/g, '$1=[REDACTED]');
  }

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${isError ? 'ERROR' : 'INFO'}: ${message}\n`;
  
  // Log to console
  console[isError ? 'error' : 'log'](logMessage.trim());
  
  // Log to file
  fs.appendFileSync(isError ? errorLogPath : infoLogPath, logMessage);
}

// Initialize the client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Register ready event
client.once(Events.ClientReady, () => {
  secureLog(`Logged in as ${client.user.tag}`);
  secureLog(`Bot is in ${client.guilds.cache.size} guilds`);
  
  // Set presence
  client.user.setPresence({
    activities: [{ name: 'Discord Server | /help', type: 0 }],
    status: 'online'
  });
});

// Main function to start the bot
async function startBot() {
  secureLog('Starting secure Discord bot...');
  
  // Get token - prioritize DISCORD_BOT_TOKEN but fall back to TOKEN
  const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
  
  if (!token) {
    secureLog('No Discord bot token found in environment variables!', true);
    process.exit(1);
  }
  
  // Log that we have a token without showing it
  secureLog(`Token available: true, Length: ${token.length}`);
  
  try {
    // Login to Discord
    await client.login(token);
    secureLog('Successfully connected to Discord!');
  } catch (error) {
    // Log error without including the token
    secureLog(`Failed to connect to Discord: ${error.message}`, true);
    
    // Provide more helpful error information
    if (error.code === 'TokenInvalid') {
      secureLog('The token appears to be invalid or malformed.', true);
      secureLog('Please check your DISCORD_BOT_TOKEN in environment variables.', true);
    } else if (error.code === 'DisallowedIntents') {
      secureLog('The bot is requesting privileged intents that have not been enabled.', true);
      secureLog('Go to the Discord Developer Portal and enable the required intents.', true);
    }
    
    process.exit(1);
  }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
  secureLog('Bot shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  secureLog('Bot shutting down...');
  client.destroy();
  process.exit(0);
});

// Handle unhandled exceptions and rejections
process.on('uncaughtException', (error) => {
  secureLog(`Uncaught Exception: ${error.message}`, true);
});

process.on('unhandledRejection', (error) => {
  secureLog(`Unhandled Promise Rejection: ${error.message}`, true);
});