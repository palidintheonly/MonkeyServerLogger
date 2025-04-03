/**
 * ModAction Model
 * Tracks moderation actions performed by moderators
 */
const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const ModAction = sequelize.define('ModAction', {
    // Auto-incrementing ID
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // The Discord guild ID
    guildId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // The user ID who performed the action
    moderatorId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // The user ID who received the action
    targetId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // The type of action (WARN, MUTE, KICK, BAN, UNMUTE, UNBAN)
    actionType: {
      type: DataTypes.ENUM('WARN', 'MUTE', 'KICK', 'BAN', 'UNMUTE', 'UNBAN'),
      allowNull: false
    },
    
    // Optional reason for the action
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Optional duration for temporary actions in milliseconds
    duration: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    
    // Optional expiration date for temporary actions
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Whether the action has been completed/resolved
    resolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Optional resolution information
    resolvedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Optional resolution reason
    resolvedReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Optional resolution date
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Optional metadata for the action
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    }
  });
  
  /**
   * Find all actions for a specific target in a guild
   * @param {string} guildId - The guild ID
   * @param {string} targetId - The target user ID
   * @returns {Promise<Array<ModAction>>} - Array of mod actions
   */
  ModAction.findUserActions = function(guildId, targetId) {
    return this.findAll({
      where: {
        guildId,
        targetId
      },
      order: [['createdAt', 'DESC']]
    });
  };
  
  /**
   * Find a user's active actions of a certain type
   * @param {string} guildId - The guild ID
   * @param {string} targetId - The target user ID
   * @param {string} actionType - Type of action to find
   * @returns {Promise<ModAction|null>} - The active action or null
   */
  ModAction.findActiveAction = function(guildId, targetId, actionType) {
    return this.findOne({
      where: {
        guildId,
        targetId,
        actionType,
        resolved: false
      }
    });
  };
  
  /**
   * Expire or resolve actions that have reached their expiration time
   * @returns {Promise<Array>} - Array of expired actions
   */
  ModAction.resolveExpiredActions = async function() {
    const now = new Date();
    const expiredActions = await this.findAll({
      where: {
        expiresAt: {
          [Op.lt]: now  // Op needs to be imported from sequelize
        },
        resolved: false
      }
    });
    
    for (const action of expiredActions) {
      action.resolved = true;
      action.resolvedReason = 'Auto-expired';
      action.resolvedAt = now;
      await action.save();
    }
    
    return expiredActions;
  };
  
  // Resolve a mod action manually
  ModAction.prototype.resolve = async function(userId, reason = 'Manually resolved') {
    this.resolved = true;
    this.resolvedBy = userId;
    this.resolvedReason = reason;
    this.resolvedAt = new Date();
    
    await this.save();
    return this;
  };
  
  return ModAction;
};