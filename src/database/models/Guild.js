/**
 * Guild Model
 * Manages guild-specific settings and configurations
 */
const { DataTypes, Model } = require('sequelize');
const { logger } = require('../../utils/logger');

module.exports = (sequelize) => {
  class Guild extends Model {
    /**
     * Find or create a guild entry
     * @param {string} guildId - The guild ID
     * @param {string} guildName - The guild name
     * @returns {Promise<Array>} - [guild, created]
     */
    static async findOrCreate(guildId, guildName) {
      try {
        return await Guild.findOrCreate({
          where: { guildId },
          defaults: {
            guildName,
            joinedAt: new Date(),
            settings: {
              disabledCommands: [],
              modmail: {
                enabled: false
              }
            }
          }
        });
      } catch (error) {
        logger.error(`Error finding/creating guild ${guildId}: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Get a setting value
     * @param {string} key - The setting key
     * @returns {any} - The setting value
     */
    getSetting(key) {
      try {
        const settings = this.settings || {};
        
        // If simple key, return directly
        if (!key.includes('.')) {
          return settings[key];
        }
        
        // Handle nested keys
        let result = settings;
        const parts = key.split('.');
        
        for (const part of parts) {
          if (result === undefined || result === null) return undefined;
          result = result[part];
        }
        
        return result;
      } catch (error) {
        logger.error(`Error getting setting ${key} for guild ${this.guildId}: ${error.message}`);
        return undefined;
      }
    }
    
    /**
     * Update a setting value
     * @param {string} key - The setting key
     * @param {any} value - The new value
     * @returns {Promise<Guild>} - The updated guild
     */
    async updateSetting(key, value) {
      try {
        const settings = this.settings || {};
        
        // If simple key, update directly
        if (!key.includes('.')) {
          settings[key] = value;
        } else {
          // Handle nested keys
          let obj = settings;
          const parts = key.split('.');
          const lastPart = parts.pop();
          
          for (const part of parts) {
            if (obj[part] === undefined || obj[part] === null) {
              obj[part] = {};
            }
            obj = obj[part];
          }
          
          obj[lastPart] = value;
        }
        
        this.settings = settings;
        await this.save();
        
        return this;
      } catch (error) {
        logger.error(`Error updating setting ${key} for guild ${this.guildId}: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Update multiple settings at once
     * @param {Object} settings - Object with key/value pairs to update
     * @returns {Promise<Guild>} - The updated guild
     */
    async updateSettings(newSettings) {
      try {
        // Deep merge the settings
        this.settings = deepMerge(this.settings || {}, newSettings);
        await this.save();
        
        return this;
      } catch (error) {
        logger.error(`Error updating settings for guild ${this.guildId}: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Check if a command is disabled in this guild
     * @param {string} commandName - The command to check
     * @returns {boolean} - Whether the command is disabled
     */
    isCommandDisabled(commandName) {
      try {
        const disabledCommands = this.getSetting('disabledCommands') || [];
        return disabledCommands.includes(commandName);
      } catch (error) {
        logger.error(`Error checking disabled command ${commandName} for guild ${this.guildId}: ${error.message}`);
        return false;
      }
    }
    
    /**
     * Enable or disable a command in this guild
     * @param {string} commandName - The command to toggle
     * @param {boolean} disabled - Whether to disable the command
     * @returns {Promise<Guild>} - The updated guild
     */
    async toggleCommand(commandName, disabled) {
      try {
        let disabledCommands = this.getSetting('disabledCommands') || [];
        
        if (disabled && !disabledCommands.includes(commandName)) {
          // Disable the command
          disabledCommands.push(commandName);
        } else if (!disabled && disabledCommands.includes(commandName)) {
          // Enable the command
          disabledCommands = disabledCommands.filter(cmd => cmd !== commandName);
        }
        
        await this.updateSetting('disabledCommands', disabledCommands);
        return this;
      } catch (error) {
        logger.error(`Error toggling command ${commandName} for guild ${this.guildId}: ${error.message}`);
        throw error;
      }
    }
  }
  
  Guild.init({
    guildId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    guildName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    sequelize,
    modelName: 'Guild',
    timestamps: true,
    paranoid: true
  });
  
  return Guild;
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  // For each property in source
  for (const key in source) {
    // If it's an object and not null or an array
    if (
      source[key] && 
      typeof source[key] === 'object' && 
      !Array.isArray(source[key]) &&
      target[key] && 
      typeof target[key] === 'object' && 
      !Array.isArray(target[key])
    ) {
      // Recursively merge the objects
      deepMerge(target[key], source[key]);
    } else {
      // Otherwise just assign the property
      target[key] = source[key];
    }
  }
  
  return target;
}