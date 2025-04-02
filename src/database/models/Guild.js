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
        // Set all categories to enabled by default
        Object.keys(config.logging.categories).forEach(category => {
          defaultCategories[category] = config.logging.categories[category].enabled;
        });
        return JSON.stringify(defaultCategories);
      },
      get() {
        try {
          return JSON.parse(this.getDataValue('enabledCategories'));
        } catch {
          // If invalid JSON, return all categories enabled
          const defaultCategories = {};
          Object.keys(config.logging.categories).forEach(category => {
            defaultCategories[category] = true;
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
