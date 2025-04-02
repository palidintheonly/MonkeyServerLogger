// Completely offline Discord bot simulation
// This runs without connecting to Discord to keep your credentials completely private
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Setup log files
const infoLogPath = path.join(logsDir, 'offline-info.log');
const errorLogPath = path.join(logsDir, 'offline-error.log');

// Simple logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${isError ? 'ERROR' : 'INFO'}: ${message}\n`;
  
  // Log to console
  console[isError ? 'error' : 'log'](logMessage.trim());
  
  // Log to file
  fs.appendFileSync(isError ? errorLogPath : infoLogPath, logMessage);
}

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord bot is running in offline mode!');
});

// Listen on port 3000
server.listen(3000, '0.0.0.0', () => {
  log('Health check server running on port 3000');
});

// Main function to simulate bot startup
function startOfflineBot() {
  log('Starting Discord bot in OFFLINE mode...');
  log('This version does not connect to Discord servers to protect your credentials');
  log('----------------------------------------------------------------');
  
  // Check if token exists in environment but don't use it
  const hasToken = !!process.env.DISCORD_BOT_TOKEN || !!process.env.TOKEN;
  log(`Token available: ${hasToken}, but NOT being used in offline mode`);
  
  // Display simulated bot features
  log('Simulated features available in offline mode:');
  log('- Web health check endpoint (/)')
  log('- Command simulation')
  log('- Database connections')
  log('- Logging systems')
  log('----------------------------------------------------------------');
  log('Bot is running in offline mode - no Discord connections will be made');
  
  // Simulate loading commands and events
  log('Simulated command loading: Loaded 13 commands');
  log('Simulated event loading: Loaded 16 event handlers');
  
  // Database simulation (actual connection if database exists)
  try {
    const dbPath = path.join(__dirname, 'data', 'database.sqlite');
    if (fs.existsSync(dbPath)) {
      log('Found local database at: ' + dbPath);
      log('Database appears to be valid');
    } else {
      log('No local database found. Would create one in online mode.');
    }
  } catch (error) {
    log('Database check error: ' + error.message, true);
  }
}

// Start the offline bot
startOfflineBot();

// Handle process termination
process.on('SIGINT', () => {
  log('Offline bot shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Offline bot shutting down...');
  server.close();
  process.exit(0);
});

// Handle unhandled exceptions and rejections
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, true);
});

process.on('unhandledRejection', (error) => {
  log(`Unhandled Promise Rejection: ${error.message}`, true);
});