/**
 * ModmailThread Model
 * Tracks modmail threads between users and moderators
 */
const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const ModmailThread = sequelize.define('ModmailThread', {
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
    
    // The user ID who initiated the thread
    userId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // The Discord channel ID for the thread
    channelId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // Status of the thread (OPEN, CLOSED)
    status: {
      type: DataTypes.ENUM('OPEN', 'CLOSED'),
      defaultValue: 'OPEN'
    },
    
    // Optional closing reason
    closedReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // User ID of moderator who closed the thread
    closedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // When the thread was closed
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // When the thread was last active
    lastMessageAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    
    // Optional thread subject/title
    subject: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Optional metadata for thread
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    }
  });
  
  /**
   * Find all threads for a specific user
   * @param {string} userId - The user ID
   * @returns {Promise<Array<ModmailThread>>}
   */
  ModmailThread.findUserThreads = function(userId) {
    return this.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  };
  
  /**
   * Find a user's active thread
   * @param {string} userId - The user ID 
   * @param {string} guildId - The guild ID
   * @returns {Promise<ModmailThread|null>}
   */
  ModmailThread.findActiveThread = function(userId, guildId) {
    return this.findOne({
      where: {
        userId,
        guildId,
        status: 'OPEN'
      }
    });
  };
  
  /**
   * Find threads that have been inactive for a period
   * @param {number} hours - Hours since last activity
   * @returns {Promise<Array<ModmailThread>>}
   */
  ModmailThread.findInactiveThreads = function(hours) {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return this.findAll({
      where: {
        status: 'OPEN',
        lastMessageAt: {
          [Op.lt]: cutoff
        }
      }
    });
  };
  
  /**
   * Update the last activity timestamp
   */
  ModmailThread.prototype.updateActivity = async function() {
    this.lastMessageAt = new Date();
    await this.save();
    return this;
  };
  
  /**
   * Close a thread
   * @param {string} userId - The user ID of who closed it
   * @param {string} reason - The reason for closing
   */
  ModmailThread.prototype.close = async function(userId, reason = 'Thread closed') {
    this.status = 'CLOSED';
    this.closedBy = userId;
    this.closedReason = reason;
    this.closedAt = new Date();
    
    await this.save();
    return this;
  };
  
  return ModmailThread;
};