const { DataTypes } = require('sequelize');
const config = require('../../config');

/**
 * Guild model definition - stores server-specific configurations
 * @param {Sequelize} sequelize Sequelize instance
 * @returns {Model} Guild model
 */
module.exports = (sequelize) => {
  const Guild = sequelize.define('Guild', {
    // Guild ID (Discord server ID)
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true
    },
    
    // Main logging channel ID
    loggingChannelId: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    
    // Category-specific log channels (JSON)
    categoryChannels: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
      get() {
        try {
          return JSON.parse(this.getDataValue('categoryChannels'));
        } catch {
          return {};
        }
      },
      set(value) {
        this.setDataValue('categoryChannels', JSON.stringify(value));
      }
    },
    
    // Ignored channels for logging (JSON array)
    ignoredChannels: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      get() {
        try {
          return JSON.parse(this.getDataValue('ignoredChannels'));
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('ignoredChannels', JSON.stringify(value));
      }
    },
    
    // Ignored roles for logging (JSON array)
    ignoredRoles: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      get() {
        try {
          return JSON.parse(this.getDataValue('ignoredRoles'));
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('ignoredRoles', JSON.stringify(value));
      }
    },
    
    // Enabled/disabled log categories (JSON)
    enabledCategories: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: () => {
        const defaultCategories = {};
        // Only enable the default categories from config
        Object.keys(config.logging.categories).forEach(category => {
          defaultCategories[category] = config.logging.defaultCategories.includes(category);
        });
        return JSON.stringify(defaultCategories);
      },
      get() {
        try {
          return JSON.parse(this.getDataValue('enabledCategories'));
        } catch {
          // If invalid JSON, return only default categories enabled
          const defaultCategories = {};
          Object.keys(config.logging.categories).forEach(category => {
            defaultCategories[category] = config.logging.defaultCategories.includes(category);
          });
          return defaultCategories;
        }
      },
      set(value) {
        this.setDataValue('enabledCategories', JSON.stringify(value));
      }
    },
    
    // Setup completed flag
    setupCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    // Setup progress tracking
    setupProgress: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{"step": 0, "lastUpdated": null}',
      get() {
        try {
          return JSON.parse(this.getDataValue('setupProgress'));
        } catch {
          return { step: 0, lastUpdated: null };
        }
      },
      set(value) {
        // Always include the current timestamp when updating
        const progress = typeof value === 'object' ? value : { step: 0 };
        progress.lastUpdated = new Date().toISOString();
        this.setDataValue('setupProgress', JSON.stringify(progress));
      }
    },
    
    // Setup data storage for persisting between sessions
    setupData: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
      get() {
        try {
          return JSON.parse(this.getDataValue('setupData'));
        } catch {
          return {};
        }
      },
      set(value) {
        this.setDataValue('setupData', JSON.stringify(value));
      }
    },
    
    // Modmail enabled flag
    modmailEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    // Modmail category ID
    modmailCategoryId: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    
    // Modmail info channel ID
    modmailInfoChannelId: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    
    // Verbose logging enabled flag
    verboseLoggingEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    // Verbose logging channel ID (separate from main logging)
    verboseLoggingChannelId: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    }
  }, {
    // Additional model options
    tableName: 'guilds'
  });

  // Instance methods
  Guild.prototype.isChannelIgnored = function(channelId) {
    return this.ignoredChannels.includes(channelId);
  };

  Guild.prototype.isRoleIgnored = function(roleId) {
    return this.ignoredRoles.includes(roleId);
  };

  Guild.prototype.isCategoryEnabled = function(category) {
    return this.enabledCategories[category] === true;
  };

  Guild.prototype.getCategoryChannel = function(category) {
    return this.categoryChannels[category] || this.loggingChannelId;
  };
  
  Guild.prototype.isModmailEnabled = function() {
    return this.modmailEnabled === true;
  };
  
  Guild.prototype.getModmailCategory = function() {
    return this.modmailCategoryId;
  };
  
  // Verbose logging methods
  Guild.prototype.isVerboseLoggingEnabled = function() {
    return this.verboseLoggingEnabled === true;
  };
  
  Guild.prototype.getVerboseLoggingChannel = function() {
    return this.verboseLoggingChannelId;
  };
  
  // Setup progress and data management methods
  Guild.prototype.getSetupProgress = function() {
    return this.setupProgress;
  };
  
  Guild.prototype.updateSetupProgress = async function(step, additionalData = {}) {
    const progress = this.setupProgress;
    progress.step = step;
    progress.lastInteraction = new Date().toISOString();
    
    // Store any additional data provided
    const setupData = { ...this.setupData, ...additionalData };
    
    await this.update({
      setupProgress: progress,
      setupData: setupData
    });
    
    return this;
  };
  
  Guild.prototype.storeSetupData = async function(key, value) {
    const setupData = this.setupData;
    setupData[key] = value;
    
    await this.update({
      setupData: setupData
    });
    
    return this;
  };
  
  Guild.prototype.getSetupData = function(key, defaultValue = null) {
    const setupData = this.setupData;
    return key in setupData ? setupData[key] : defaultValue;
  };
  
  Guild.prototype.clearSetupData = async function() {
    await this.update({
      setupData: {},
      setupProgress: { step: 0, lastUpdated: new Date().toISOString() }
    });
    
    return this;
  };
  
  // Static methods
  Guild.findOrCreateGuild = async function(guildId) {
    const [guild] = await this.findOrCreate({
      where: { guildId },
      defaults: { guildId }
    });
    return guild;
  };

  return Guild;
};
