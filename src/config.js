/**
 * Configuration settings for the MonkeyBytes Modmail Bot
 */
require('dotenv').config();
const { version } = require('../version');

module.exports = {
  /**
   * Bot configuration
   */
  bot: {
    // Meta information
    name: 'MonkeyBytes Modmail Bot',
    company: 'MonkeyBytes',
    slogan: 'The Royal Court',
    version: version,
    description: 'A Discord modmail bot by MonkeyBytes for cross-server communication',
    
    // Links
    supportServer: process.env.SUPPORT_SERVER || '',
    
    // Owner information
    ownerId: process.env.OWNER_ID,
    
    // Default cooldown for commands in seconds
    defaultCooldown: 3
  },
  
  /**
   * Discord.js client configuration
   */
  client: {
    // Intent flags - only what's needed for modmail
    intents: [
      'Guilds',
      'GuildMembers',
      'GuildMessages', 
      'DirectMessages',
      'MessageContent'
    ],
    
    // Presence settings
    presence: {
      status: 'online',
      activities: [
        {
          name: 'DM for modmail',
          type: 'LISTENING'
        }
      ]
    },
    
    // Caching options
    cacheSettings: {
      messageCacheMaxSize: 100,
      messageCacheLifetime: 60,
      messageSweepInterval: 300
    }
  },
  
  /**
   * Command configuration
   */
  commands: {
    // Guild IDs for testing commands (empty array for global deployment)
    devGuildIds: process.env.DEV_GUILD_ID ? [process.env.DEV_GUILD_ID] : [],
    
    // Categories for organizing commands
    categories: [
      { name: 'admin', displayName: 'Administration' }
    ]
  },
  
  /**
   * Database configuration
   */
  database: {
    // Main database file
    mainDbPath: './data/database.sqlite',
    
    // Backups
    backups: {
      enabled: true,
      path: './data/backup/',
      interval: 86400000, // 24 hours in milliseconds
      maxCount: 7 // Maximum number of backups to keep
    }
  },
  
  /**
   * Logger configuration
   */
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'YYYY-MM-DD HH:mm:ss',
    logToConsole: true,
    logToFile: true,
    directory: './logs'
  }
};