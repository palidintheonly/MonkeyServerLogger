// Deployment-ready Discord.js bot with web server
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { logger } = require('./src/utils/logger');
const http = require('http');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const app = express();

// Discord OAuth2 Configuration
const CLIENT_ID = process.env.CLIENT_ID || process.env.DISCORD_APPLICATION_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET; // You'll need to add this to your .env file
const OWNER_ID = process.env.OWNER_ID || '446345650309955614'; // Owner's Discord ID
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://discord-bot.jujustudios.replit.app/auth/discord/callback';

// Setup passport
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Configure Discord strategy
passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify']
  },
  (accessToken, refreshToken, profile, done) => {
    // Check if user is the owner
    if (profile.id !== OWNER_ID) {
      return done(null, false, { message: 'You do not have permission to access this page.' });
    }
    
    // Store user info in the session
    process.nextTick(() => {
      return done(null, profile);
    });
  }
));

// Import Discord bot functionality
const { 
  commands, 
  handleInteraction, 
  registerCommandsToGuilds 
} = require('./src/bot-functions');

// Configure Express middleware
app.use(session({
  secret: 'royal-court-herald-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

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

// Helper function to check if user is authenticated and is the owner
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user.id === OWNER_ID) {
    return next();
  }
  res.redirect('/login');
}

// Auth routes
app.get('/login', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>The Royal Court Herald - Login</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            max-width: 500px;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
          }
          h1 { color: #5865F2; margin-bottom: 30px; }
          .login-button {
            background-color: #5865F2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.3s;
          }
          .login-button:hover {
            background-color: #4752C4;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>The Royal Court Herald - Admin Login</h1>
          <p>You must be the bot owner to access this page.</p>
          <a href="/auth/discord" class="login-button">Login with Discord</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
  passport.authenticate('discord', { 
    failureRedirect: '/login-failed'
  }),
  (req, res) => {
    res.redirect('/admin');
  }
);

app.get('/login-failed', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Access Denied</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            max-width: 500px;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
          }
          h1 { color: #ED4245; margin-bottom: 30px; }
          .back-button {
            background-color: #5865F2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Access Denied</h1>
          <p>Sorry, you do not have permission to access this page. Only the bot owner can access the admin dashboard.</p>
          <a href="/login" class="back-button">Back to Login</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

// Admin dashboard route
app.get('/admin', isAuthenticated, (req, res) => {
  const uptime = Math.floor(client.uptime / 1000);
  res.send(`
    <html>
      <head>
        <title>Admin Dashboard - The Royal Court Herald</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          header {
            background-color: #5865F2;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          h1 { margin: 0; }
          .logout {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            background-color: rgba(255,255,255,0.1);
            border-radius: 4px;
          }
          .card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
          }
          .card-title {
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-top: 0;
            color: #5865F2;
          }
          .status { 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
            display: inline-block;
          }
          .online { background-color: #57F287; color: white; }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .stat-card {
            background-color: #5865F2;
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin: 10px 0;
          }
          .guild-list {
            list-style: none;
            padding: 0;
          }
          .guild-item {
            display: flex;
            justify-content: space-between;
            padding: 15px;
            border-bottom: 1px solid #eee;
          }
          .guild-item:last-child {
            border-bottom: none;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>The Royal Court Herald - Admin Dashboard</h1>
          <a href="/logout" class="logout">Logout</a>
        </header>
        <div class="container">
          <div class="card">
            <h2 class="card-title">Bot Status</h2>
            <span class="status online">Online</span>
            <p>Welcome back, ${req.user.username}! You are logged in as the bot owner.</p>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <h3>Servers</h3>
              <div class="stat-value">${client.guilds.cache.size}</div>
            </div>
            <div class="stat-card">
              <h3>Users</h3>
              <div class="stat-value">${client.users.cache.size}</div>
            </div>
            <div class="stat-card">
              <h3>Commands</h3>
              <div class="stat-value">${commands.length}</div>
            </div>
            <div class="stat-card">
              <h3>Uptime</h3>
              <div class="stat-value">${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h</div>
            </div>
          </div>
          
          <div class="card">
            <h2 class="card-title">Servers</h2>
            <ul class="guild-list">
              ${Array.from(client.guilds.cache.values()).map(guild => `
                <li class="guild-item">
                  <span>${guild.name}</span>
                  <span>${guild.memberCount} members</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Public status page
app.get('/', (req, res) => {
  if (req.isAuthenticated() && req.user.id === OWNER_ID) {
    return res.redirect('/admin');
  }
  
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
          .login-link {
            display: inline-block;
            margin-top: 20px;
            color: #5865F2;
            text-decoration: none;
          }
          .login-link:hover {
            text-decoration: underline;
          }
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
          <a href="/login" class="login-link">Admin Login</a>
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