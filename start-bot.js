// Simple Discord bot starter file
require('dotenv').config();
const { execSync } = require('child_process');

// Start the web server in the background
console.log('Starting web server...');
const webServerProcess = require('child_process').spawn('node', ['minimal-server.js'], {
  detached: true,
  stdio: 'ignore'
});
webServerProcess.unref();

// Start the Discord bot
console.log('Starting Discord bot...');
require('./simple-bot.js');