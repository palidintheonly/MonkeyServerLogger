/**
 * Guild Model
 * Manages guild-specific settings and configurations
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Guild = sequelize.define('Guild', {
    // Discord guild ID as the primary key
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    
    // Guild name
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // Guild-specific settings in JSON format
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        prefix: '!',                    // Default command prefix (legacy)
        language: 'en',                 // Default language
        moderationEnabled: true,        // Whether moderation commands are enabled
        moderationLogChannel: null,     // Channel ID for moderation logs
        joinLogChannel: null,           // Channel ID for member join logs
        leaveLogChannel: null,          // Channel ID for member leave logs
        messageLogChannel: null,        // Channel ID for message logs
        welcomeChannel: null,           // Channel ID for welcome messages
        welcomeMessage: 'Welcome to {server}, {user}!', // Default welcome message
        autoRoles: [],                  // Roles to give to new members
        disabledCommands: [],           // List of disabled command names
        verificationLevel: 0,           // 0-4 verification level
        autoBanEnabled: false,          // Auto ban features
        autoMuteEnabled: false,         // Auto mute features
        modmailEnabled: false,          // Whether modmail is enabled
        modmailCategory: null,          // Category ID for modmail channels
        modmailLogChannel: null         // Channel ID for modmail logs
      }
    },
    
    // Whether the guild is premium
    premium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Premium tier (0 = none, 1 = bronze, 2 = silver, 3 = gold)
    premiumTier: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // When premium expires (if applicable)
    premiumExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Statistics about the guild
    stats: {
      type: DataTypes.JSON,
      defaultValue: {
        memberCount: 0,
        messageCount: 0,
        commandCount: 0,
        lastActive: null
      }
    }
  });
  
  // Find a guild by ID or create it if it doesn't exist
  Guild.findOrCreateGuild = async function(id, name) {
    const [guild, created] = await this.findOrCreate({
      where: { id },
      defaults: { name }
    });
    
    return { guild, created };
  };
  
  // Get a specific setting from the guild
  Guild.prototype.getSetting = function(key) {
    return this.settings[key];
  };
  
  // Update a specific setting in the guild
  Guild.prototype.updateSetting = async function(key, value) {
    const settings = { ...this.settings };
    settings[key] = value;
    
    this.settings = settings;
    await this.save();
    
    return this;
  };
  
  // Update stats for the guild
  Guild.prototype.updateStats = async function(stats) {
    this.stats = { ...this.stats, ...stats };
    await this.save();
    
    return this;
  };
  
  // Check if a command is disabled in this guild
  Guild.prototype.isCommandDisabled = function(commandName) {
    return this.settings.disabledCommands.includes(commandName);
  };
  
  // Enable or disable a command in this guild
  Guild.prototype.setCommandEnabled = async function(commandName, enabled) {
    const disabledCommands = [...this.settings.disabledCommands];
    
    if (enabled) {
      // Enable by removing from disabled list
      const index = disabledCommands.indexOf(commandName);
      if (index !== -1) {
        disabledCommands.splice(index, 1);
      }
    } else {
      // Disable by adding to disabled list if not already there
      if (!disabledCommands.includes(commandName)) {
        disabledCommands.push(commandName);
      }
    }
    
    return this.updateSetting('disabledCommands', disabledCommands);
  };
  
  return Guild;
};