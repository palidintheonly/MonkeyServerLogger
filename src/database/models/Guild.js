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
     * @param {object|string} options - Either options object with where/defaults or guildId string
     * @param {string} [guildName] - The guild name (when using old method signature)
     * @returns {Promise<Array>} - [guild, created]
     */
    static async findOrCreate(options, guildName) {
      try {
        let queryOptions;
        let guildId;
        
        // Support both formats for backward compatibility:
        // 1. findOrCreate(guildId, guildName) - old format
        // 2. findOrCreate({where, defaults}) - new format
        if (typeof options === 'string') {
          // Old style: convert to new format
          guildId = options;
          queryOptions = {
            where: { guildId },
            defaults: {
              guildId,
              // Store guild name in settings JSON
              settings: JSON.stringify({
                guildName,
                disabledCommands: [],
                modmail: {
                  enabled: false
                }
              }),
              // Required fields from the schema (ensure they match model defaults)
              enabledCategories: '[]',
              setupCompleted: false,
              modmailEnabled: false,
              ignoredChannels: '[]',
              ignoredRoles: '[]',
              categoryChannels: '{}',
              setupProgress: JSON.stringify({ step: 0, lastUpdated: null }),
              setupData: '{}'
            }
          };
        } else {
          // New style: already in correct format, but ensure it has defaults
          queryOptions = { ...options };
          guildId = options.where?.guildId || 'unknown';
          
          // Make sure defaults is present and contains required fields
          if (!queryOptions.defaults) {
            queryOptions.defaults = {};
          }
          
          // Add required default fields if not already specified
          if (!queryOptions.defaults.enabledCategories) {
            queryOptions.defaults.enabledCategories = '[]';
          }
          if (!queryOptions.defaults.ignoredChannels) {
            queryOptions.defaults.ignoredChannels = '[]';  
          }
          if (!queryOptions.defaults.ignoredRoles) {
            queryOptions.defaults.ignoredRoles = '[]';
          }
          if (!queryOptions.defaults.categoryChannels) {
            queryOptions.defaults.categoryChannels = '{}';
          }
          if (queryOptions.defaults.setupProgress === undefined) {
            queryOptions.defaults.setupProgress = JSON.stringify({ step: 0, lastUpdated: null });
          }
          if (queryOptions.defaults.setupData === undefined) {
            queryOptions.defaults.setupData = '{}';
          }
          if (queryOptions.defaults.setupCompleted === undefined) {
            queryOptions.defaults.setupCompleted = false;
          }
          if (queryOptions.defaults.modmailEnabled === undefined) {
            queryOptions.defaults.modmailEnabled = false;
          }
          if (queryOptions.defaults.verboseLoggingEnabled === undefined) {
            queryOptions.defaults.verboseLoggingEnabled = false;
          }
        }
        
        // Log the query for debugging
        logger.debug(`Attempting Guild.findOrCreate with ${typeof options === 'string' ? 'legacy' : 'new'} format for ${guildId}`);
        
        // Use the Sequelize Model.findOrCreate method directly with proper schema
        const result = await super.findOrCreate(queryOptions);
        
        // If using old format and name changed, update it
        if (typeof options === 'string' && guildName && result[0].getSetting('guildName') !== guildName) {
          await result[0].updateSetting('guildName', guildName);
        }
        
        // Store guild name in settings JSON (make sure it exists)
        if (!result[0].getSetting('guildName') && queryOptions.defaults && queryOptions.defaults.guildId) {
          const name = typeof options === 'string' ? guildName : 
            (queryOptions.defaults.guildName || `Guild ${queryOptions.defaults.guildId}`);
          await result[0].updateSetting('guildName', name);
        }
        
        // Log success for debugging
        logger.debug(`Guild findOrCreate successful for ${guildId}`);
        
        return result;
      } catch (error) {
        logger.error(`Error finding/creating guild ${typeof options === 'string' ? options : 
          (options.where?.guildId || 'unknown')}: ${error.message}`);
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
        // Get settings using getDataValue to get raw value
        let rawSettings = this.getDataValue('settings');
        let settings = {};
        
        // Handle different settings formats
        if (typeof rawSettings === 'string') {
          // Parse string to object if needed
          try {
            settings = JSON.parse(rawSettings);
          } catch (e) {
            logger.warn(`Invalid settings JSON for guild ${this.guildId}`);
            return undefined;
          }
        } else if (rawSettings && typeof rawSettings === 'object') {
          // Use existing object
          settings = rawSettings;
        }
        
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
        // Get current settings using getDataValue to get raw value
        let rawSettings = this.getDataValue('settings');
        let currentSettings = {};
        
        // Handle different settings formats
        if (typeof rawSettings === 'string') {
          // Parse string to object if needed
          try {
            currentSettings = JSON.parse(rawSettings);
          } catch (e) {
            logger.warn(`Invalid settings JSON for guild ${this.guildId}, resetting to empty object`);
          }
        } else if (rawSettings && typeof rawSettings === 'object') {
          // Use existing object (make a copy to avoid reference issues)
          currentSettings = { ...rawSettings };
        }
        
        // If simple key, update directly
        if (!key.includes('.')) {
          currentSettings[key] = value;
          logger.debug(`Setting direct key ${key} for guild ${this.guildId}`);
        } else {
          // Handle nested keys
          let obj = currentSettings;
          const parts = key.split('.');
          const lastPart = parts.pop();
          
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Check if current level exists and is an object
            if (typeof obj[part] !== 'object' || obj[part] === null || Array.isArray(obj[part])) {
              // If not an object, overwrite with an empty object
              logger.debug(`Converting ${part} from ${typeof obj[part]} to object for guild ${this.guildId}`);
              obj[part] = {};
            }
            
            obj = obj[part];
          }
          
          obj[lastPart] = value;
          logger.debug(`Setting nested key ${key} for guild ${this.guildId}`);
        }
        
        // Update settings based on original format
        if (typeof rawSettings === 'string') {
          this.setDataValue('settings', JSON.stringify(currentSettings));
        } else {
          this.setDataValue('settings', currentSettings);
        }
        
        // Save the changes
        await this.save();
        
        // Log success
        logger.debug(`Successfully updated setting ${key} for guild ${this.guildId}`);
        
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
        // Get current settings using getDataValue to get raw value
        let rawSettings = this.getDataValue('settings');
        let currentSettings = {};
        
        // Handle different settings formats
        if (typeof rawSettings === 'string') {
          // Parse string to object if needed
          try {
            currentSettings = JSON.parse(rawSettings);
          } catch (e) {
            logger.warn(`Invalid settings JSON for guild ${this.guildId}, resetting to empty object`);
          }
        } else if (rawSettings && typeof rawSettings === 'object') {
          // Use existing object (make a copy to avoid reference issues)
          currentSettings = { ...rawSettings };
        }
        
        // Deep merge the settings
        const mergedSettings = deepMerge(currentSettings, newSettings);
        
        // Update settings based on original format
        if (typeof rawSettings === 'string') {
          this.setDataValue('settings', JSON.stringify(mergedSettings));
        } else {
          this.setDataValue('settings', mergedSettings);
        }
        
        // Save the changes
        await this.save();
        
        // Log success
        logger.debug(`Successfully updated multiple settings for guild ${this.guildId}`);
        
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
    /**
     * Synchronize modmail settings between JSON and column
     * @returns {Promise<boolean>} - Whether any changes were made
     */
    async syncModmailSettings() {
      try {
        // Extract settings from both sources
        const modmailSettings = this.getSetting('modmail') || {};
        const jsonEnabled = modmailSettings.enabled === true;
        const columnEnabled = this.modmailEnabled === true;
        
        // If settings are already consistent, no changes needed
        if (jsonEnabled === columnEnabled) {
          return false;
        }
        
        logger.info(`Fixing inconsistent modmail settings for guild ${this.guildId} - JSON: ${jsonEnabled}, Column: ${columnEnabled}`);
        
        // Determine which setting to use as the source of truth
        // Strategy: Use the JSON settings as source of truth if it exists,
        // otherwise use the column value
        const useEnabled = modmailSettings.hasOwnProperty('enabled') ? jsonEnabled : columnEnabled;
        
        // Update both settings
        if (useEnabled !== jsonEnabled) {
          await this.updateSettings({
            modmail: {
              ...modmailSettings,
              enabled: useEnabled
            }
          });
        }
        
        if (useEnabled !== columnEnabled) {
          this.modmailEnabled = useEnabled;
          await this.save();
        }
        
        logger.info(`Successfully synchronized modmail settings for guild ${this.guildId} to: ${useEnabled}`);
        return true;
      } catch (error) {
        logger.error(`Error synchronizing modmail settings for guild ${this.guildId}: ${error.message}`);
        throw error;
      }
    }
    
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
      type: DataTypes.VIRTUAL,
      get() {
        try {
          // Return guild name from settings or a default
          let settings = this.getDataValue('settings');
          
          // Handle case where settings is a JSON string
          if (typeof settings === 'string') {
            try {
              settings = JSON.parse(settings);
            } catch (e) {
              return `Guild ${this.guildId}`;
            }
          }
          
          // If settings is null/undefined or not an object
          if (!settings || typeof settings !== 'object') {
            return `Guild ${this.guildId}`;
          }
          
          return settings.guildName || `Guild ${this.guildId}`;
        } catch (error) {
          logger.warn(`Error getting guildName virtual field: ${error.message}`);
          return `Guild ${this.guildId}`;
        }
      },
      set(value) {
        try {
          // Store guild name in settings
          let currentSettings = this.getDataValue('settings');
          
          // Handle case where settings is a JSON string
          if (typeof currentSettings === 'string') {
            try {
              currentSettings = JSON.parse(currentSettings);
            } catch (e) {
              currentSettings = {};
            }
          }
          
          // If currentSettings is null/undefined or not an object
          if (!currentSettings || typeof currentSettings !== 'object') {
            currentSettings = {};
          }
          
          const newSettings = { ...currentSettings, guildName: value };
          
          // Store as JSON string if it's not already an object
          if (this.getDataValue('settings') && typeof this.getDataValue('settings') === 'string') {
            this.setDataValue('settings', JSON.stringify(newSettings));
          } else {
            this.setDataValue('settings', newSettings);
          }
        } catch (error) {
          logger.warn(`Error setting guildName virtual field: ${error.message}`);
        }
      }
    },
    loggingChannelId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    categoryChannels: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}'
    },
    ignoredChannels: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]'
    },
    ignoredRoles: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]'
    },
    enabledCategories: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]'
    },
    setupCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    modmailEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    modmailCategoryId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    modmailInfoChannelId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    setupProgress: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{"step": 0, "lastUpdated": null}'
    },
    setupData: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}'
    },
    verboseLoggingEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    verboseLoggingChannelId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    sequelize,
    modelName: 'Guild',
    tableName: 'guilds', // Explicitly set table name to match existing schema
    timestamps: true,
    paranoid: false // No deletedAt column in schema
  });
  
  // Attach deepMerge to the Guild model for testing
  Guild.deepMerge = deepMerge;
  
  return Guild;
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  // Create a copy of the target if it's not an object
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    target = {};
  }
  
  // If source is not an object or is null, return target
  if (typeof source !== 'object' || source === null) {
    return target;
  }
  
  // Prevent merging into source
  if (target === source) {
    return { ...target };
  }
  
  // Use a Set to keep track of objects we've seen to detect circular references
  const seen = new Set();
  
  // Helper function for recursive merge with cycle detection
  function mergeRecursive(target, source, path = []) {
    // Add current objects to seen set with their paths
    const targetPath = [...path, 'target'].join('.');
    const sourcePath = [...path, 'source'].join('.');
    
    // Check for circular references
    if (seen.has(targetPath) || seen.has(sourcePath)) {
      return target; // Break the recursion for circular references
    }
    
    seen.add(targetPath);
    seen.add(sourcePath);
    
    // For each property in source
    for (const key in source) {
      // Skip prototype pollution properties
      if (key === '__proto__' || key === 'constructor') {
        continue;
      }
      
      // Skip properties that would cause circular references
      if (source[key] === target || source[key] === source) {
        continue;
      }
      
      // If source property is an object (and not null or array)
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        // Make sure target property is an object we can merge into
        if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
          target[key] = {};
        }
        
        // Check depth to prevent excessive recursion (max 10 levels deep)
        if (path.length < 10) {
          // Recursively merge the objects
          mergeRecursive(target[key], source[key], [...path, key]);
        } else {
          // At max depth, just assign directly
          target[key] = { ...source[key] };
        }
      } else {
        // For non-objects (including arrays), just assign the property
        target[key] = source[key];
      }
    }
    
    return target;
  }
  
  // Start the recursive merge
  return mergeRecursive(target, source);
}