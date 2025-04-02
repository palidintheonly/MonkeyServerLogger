// Deployment-ready Discord.js bot with web server
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { logger } = require('./src/utils/logger');
const { formatTimeGMT, formatUptime } = require('./src/utils/timeUtils');
const http = require('http');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const app = express();

// Import dashboard database
const { sequelize, models, initDashboardDB } = require('./src/dashboard/db');
const { DashboardUser } = models;

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
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists, create if not
      let user = await DashboardUser.findByPk(profile.id);
      
      if (!user) {
        // New user, set access level
        const accessLevel = profile.id === OWNER_ID ? 'owner' : 'user';
        
        user = await DashboardUser.create({
          id: profile.id,
          username: profile.username,
          discriminator: profile.discriminator,
          avatar: profile.avatar,
          accessLevel: accessLevel,
          accessToken: accessToken,
          refreshToken: refreshToken
        });
        
        logger.info(`New user registered: ${profile.username} (${profile.id})`);
      } else {
        // Update existing user info
        user.username = profile.username;
        user.discriminator = profile.discriminator;
        user.avatar = profile.avatar;
        user.lastLogin = new Date();
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;
        
        await user.save();
        logger.info(`User logged in: ${profile.username} (${profile.id})`);
      }
      
      // Add accessLevel to the profile object for use in middleware
      profile.accessLevel = user.accessLevel;
      
      return done(null, profile);
    } catch (error) {
      logger.error('Authentication error:', error);
      return done(error);
    }
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

// Helper function to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Helper function to check if user is the owner
function isOwner(req, res, next) {
  if (req.isAuthenticated() && req.user.id === OWNER_ID) {
    return next();
  }
  res.redirect('/unauthorized');
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
            background-color: #36393f; /* Discord dark background */
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 500px;
            background-color: #2f3136; /* Discord darker background */
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
            text-align: center;
            border: 1px solid #202225; /* Discord border color */
          }
          h1 { 
            color: #ffffff; 
            margin-bottom: 30px; 
          }
          p {
            color: #b9bbbe; /* Discord secondary text color */
            margin-bottom: 25px;
          }
          .login-button {
            background-color: #5865F2; /* Discord blurple */
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
            background-color: #4752C4; /* Darker blurple */
            box-shadow: 0 0 10px rgba(88, 101, 242, 0.5);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>The Royal Court Herald</h1>
          <p>You must login with Discord to access this website.</p>
          <a href="/auth/discord" class="login-button">Login with Discord</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/unauthorized', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Admin Access Only</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #36393f; /* Discord dark background */
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 500px;
            background-color: #2f3136; /* Discord darker background */
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
            text-align: center;
            border: 1px solid #202225; /* Discord border color */
          }
          h1 { color: #ED4245; margin-bottom: 30px; }
          p { color: #b9bbbe; margin-bottom: 25px; }
          .button {
            background-color: #5865F2; /* Discord blurple */
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-top: 20px;
            transition: background-color 0.3s;
          }
          .button:hover {
            background-color: #4752C4; /* Darker blurple */
            box-shadow: 0 0 10px rgba(88, 101, 242, 0.5);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Admin Access Only</h1>
          <p>This section is only available to the bot owner. You are logged in as ${req.user.username}, but you do not have admin privileges.</p>
          <a href="/" class="button">Back to Dashboard</a>
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
        <title>Login Failed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #36393f; /* Discord dark background */
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 500px;
            background-color: #2f3136; /* Discord darker background */
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
            text-align: center;
            border: 1px solid #202225; /* Discord border color */
          }
          h1 { color: #ED4245; margin-bottom: 30px; }
          p { color: #b9bbbe; margin-bottom: 25px; }
          .back-button {
            background-color: #5865F2; /* Discord blurple */
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-top: 20px;
            transition: background-color 0.3s;
          }
          .back-button:hover {
            background-color: #4752C4; /* Darker blurple */
            box-shadow: 0 0 10px rgba(88, 101, 242, 0.5);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Login Failed</h1>
          <p>There was a problem authenticating with Discord. Please try again.</p>
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

// Admin dashboard route (requires owner)
app.get('/admin', isOwner, (req, res) => {
  // Using formatUptime directly with client.uptime
  res.send(`
    <html>
      <head>
        <title>Admin Dashboard - The Royal Court Herald</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #36393f; /* Discord dark background */
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          header {
            background-color: #202225; /* Discord darker gray */
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
          h1 { margin: 0; color: #ffffff; }
          h2, h3 { color: #ffffff; }
          .nav-links {
            display: flex;
            gap: 20px;
            align-items: center;
          }
          .nav-link, .logout {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            background-color: #5865F2; /* Discord blurple */
            border-radius: 4px;
            transition: background-color 0.3s;
          }
          .nav-link:hover, .logout:hover {
            background-color: #4752C4; /* Darker blurple */
            box-shadow: 0 0 8px rgba(88, 101, 242, 0.5);
          }
          .card {
            background-color: #2f3136; /* Discord darker background */
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid #202225; /* Discord border color */
          }
          .card-title {
            border-bottom: 1px solid #40444b; /* Discord separator color */
            padding-bottom: 10px;
            margin-top: 0;
            color: #ffffff;
          }
          p { 
            color: #b9bbbe; /* Discord secondary text color */
            line-height: 1.5; 
          }
          .status { 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
            display: inline-block;
          }
          .online { background-color: #57F287; color: white; }
          .owner-badge {
            background-color: #ED4245; /* Discord red */
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            margin-left: 10px;
            font-size: 12px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .stat-card {
            background-color: #5865F2; /* Discord blurple */
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .stat-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
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
            border-bottom: 1px solid #40444b; /* Discord separator color */
            transition: background-color 0.2s;
          }
          .guild-item:hover {
            background-color: #40444b; /* Discord hover color */
          }
          .guild-item:last-child {
            border-bottom: none;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>The Royal Court Herald - Admin Dashboard</h1>
          <div class="nav-links">
            <a href="/" class="nav-link">Home</a>
            <a href="/logout" class="logout">Logout</a>
          </div>
        </header>
        <div class="container">
          <div class="card">
            <h2 class="card-title">Bot Status</h2>
            <span class="status online">Online</span>
            <p>Welcome back, ${req.user.username}! <span class="owner-badge">Owner</span></p>
            <p>You have full administrative access to the bot.</p>
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
              <div class="stat-value">${formatUptime(client.uptime)}</div>
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

// Main dashboard page (requires login)
app.get('/', isAuthenticated, (req, res) => {
  // If user is the owner, redirect to admin panel
  if (req.user.id === OWNER_ID) {
    return res.redirect('/admin');
  }
  
  // Using formatUptime directly with client.uptime
  res.send(`
    <html>
      <head>
        <title>The Royal Court Herald - Dashboard</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #36393f; /* Discord dark background */
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
          }
          header {
            background-color: #202225; /* Discord darker gray */
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
          h1 { margin: 0; color: #ffffff; }
          h2 { color: #ffffff; }
          .logout {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            background-color: #5865F2; /* Discord blurple */
            border-radius: 4px;
            transition: background-color 0.3s;
          }
          .logout:hover {
            background-color: #4752C4; /* Darker blurple */
            box-shadow: 0 0 8px rgba(88, 101, 242, 0.5);
          }
          .card {
            background-color: #2f3136; /* Discord darker background */
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid #202225; /* Discord border color */
          }
          .card-title {
            border-bottom: 1px solid #40444b; /* Discord separator color */
            padding-bottom: 10px;
            margin-top: 0;
            color: #ffffff;
          }
          p { 
            color: #b9bbbe; /* Discord secondary text color */
            line-height: 1.5;
          }
          .status { 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
            display: inline-block;
          }
          .online { background-color: #57F287; color: white; }
          .info { 
            background-color: #5865F2; /* Discord blurple */
            color: white; 
            margin: 15px 0; 
            padding: 15px; 
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: #5865F2;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>The Royal Court Herald</h1>
          <div class="user-info">
            <span>Welcome, ${req.user.username}</span>
            <a href="/logout" class="logout">Logout</a>
          </div>
        </header>
        <div class="container">
          <div class="card">
            <h2 class="card-title">Bot Status</h2>
            <span class="status online">Online</span>
            <p>You are viewing the status dashboard for The Royal Court Herald Discord bot.</p>
          </div>
          
          <div class="card">
            <h2 class="card-title">Bot Information</h2>
            <div class="info">
              <p><strong>Bot Name:</strong> ${client.user ? client.user.tag : 'Connecting...'}</p>
              <p><strong>Servers:</strong> ${client.guilds.cache.size}</p>
              <p><strong>Uptime:</strong> ${formatUptime(client.uptime)}</p>
              <p><strong>Server Time:</strong> ${formatTimeGMT(new Date())}</p>
              <p><strong>Commands:</strong> ${commands.length}</p>
            </div>
          </div>
          
          <div class="card">
            <h2 class="card-title">About</h2>
            <p>The Royal Court Herald is a powerful Discord bot engineered to enhance server management through intelligent, dynamic interaction technologies, with a focus on robust error handling and comprehensive server configuration.</p>
            <p>The bot provides extensive logging and moderation features, as well as a modmail system for members to communicate with server staff.</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Public API endpoint for status (doesn't require login)
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    bot: client.user ? client.user.tag : 'connecting',
    uptime: client.uptime,
    uptime_formatted: formatUptime(client.uptime),
    server_time: formatTimeGMT(new Date()),
    servers: client.guilds.cache.size,
    commands: commands.length
  });
});

// Public status HTML page (doesn't require login)
app.get('/public', (req, res) => {
  // Using formatUptime directly with client.uptime
  res.send(`
    <html>
      <head>
        <title>The Royal Court Herald - Status</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #36393f; /* Discord dark background */
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 800px;
            background-color: #2f3136; /* Discord darker background */
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
            border: 1px solid #202225; /* Discord border color */
          }
          h1 { 
            color: #ffffff; 
            margin-bottom: 20px;
          }
          .status { 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
          }
          .online { background-color: #57F287; color: white; }
          .info { 
            background-color: #5865F2; /* Discord blurple */
            color: white; 
            margin: 15px 0; 
            padding: 15px; 
            border-radius: 8px; 
          }
          .login-link {
            display: inline-block;
            margin-top: 20px;
            color: #ffffff;
            text-decoration: none;
            padding: 10px 20px;
            background-color: #5865F2; /* Discord blurple */
            border-radius: 4px;
            transition: background-color 0.3s;
          }
          .login-link:hover {
            background-color: #4752C4; /* Darker blurple */
            box-shadow: 0 0 10px rgba(88, 101, 242, 0.5);
          }
          p {
            color: #b9bbbe; /* Discord secondary text color */
            margin-bottom: 15px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>The Royal Court Herald - Status</h1>
          <div class="status online">
            <strong>Status:</strong> Online
          </div>
          <div class="info">
            <p><strong>Bot Name:</strong> ${client.user ? client.user.tag : 'Connecting...'}</p>
            <p><strong>Servers:</strong> ${client.guilds.cache.size}</p>
            <p><strong>Uptime:</strong> ${formatUptime(client.uptime)}</p>
            <p><strong>Server Time:</strong> ${formatTimeGMT(new Date())}</p>
            <p><strong>Commands:</strong> ${commands.length}</p>
          </div>
          <p>This is the public status page for The Royal Court Herald Discord bot.</p>
          <a href="/login" class="login-link">Login for Full Dashboard</a>
        </div>
      </body>
    </html>
  `);
});

// Initialize the dashboard database and start the server
(async () => {
  try {
    // Connect to the dashboard database
    const dbInit = await initDashboardDB();
    if (!dbInit) {
      logger.error('Failed to initialize dashboard database');
    }
    
    // Start Express server on port 3000
    const server = app.listen(3000, '0.0.0.0', () => {
      logger.info('Web server running on port 3000');
    });
  } catch (error) {
    logger.error('Failed to start web server:', error);
  }
})();

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