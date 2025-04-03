/**
 * Bot Configuration File
 * Centralized settings for the Discord bot
 */

// Bot information
const bot = {
  name: 'Advanced Discord Bot',
  version: '1.0.0',
  defaultEmbedColor: '#5865F2', // Discord blue
  iconURL: null, // URL for the bot's avatar
  supportServer: null, // Discord invite URL for support
  website: null, // Bot website URL
  github: null, // GitHub repository URL
  owners: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : [],
};

// Client IDs
const clientId = process.env.CLIENT_ID;

// Database configuration
const database = {
  // SQLite connection string
  sqlite: {
    dialect: 'sqlite',
    storage: './data/database.sqlite',
    logging: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true',
  },
  
  // MySQL/PostgreSQL connection (optional)
  /*
  mysql: {
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development'
  }
  */
};

// Command configuration
const commands = {
  cooldownDefault: 3, // Default cooldown in seconds
  devGuildId: process.env.GUILD_ID || null, // For guild-only commands during development
  globalCommands: true, // Whether to register commands globally
};

// Logging configuration
const logging = {
  level: process.env.LOG_LEVEL || 'info',
  colors: {
    info: 'blue',
    warn: 'yellow',
    error: 'red',
    debug: 'green',
    verbose: 'cyan'
  },
};

// Moderation configuration
const moderation = {
  defaultMuteDuration: 60 * 60 * 1000, // 1 hour in milliseconds
  defaultTempbanDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  maxWarnings: 3, // Number of warnings before auto-action
  warningExpiration: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
};

// Modmail configuration
const modmail = {
  threadInactiveTime: 48, // Hours until a thread is considered inactive
  closeThreadAfterInactive: 72, // Hours until an inactive thread is closed
  closedThreadsMaxAge: 30, // Days to keep closed threads in database
};

// Export configuration
module.exports = {
  bot,
  clientId,
  database,
  commands,
  logging,
  moderation,
  modmail
};