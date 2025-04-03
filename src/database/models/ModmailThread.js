const { DataTypes, Op } = require('sequelize');
const { logger } = require('../../utils/logger');

/**
 * ModmailThread model for tracking active modmail conversations
 * @param {Sequelize} sequelize Sequelize instance
 * @returns {Model} ModmailThread model
 */
module.exports = (sequelize) => {
  const ModmailThread = sequelize.define('ModmailThread', {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID that initiated the thread'
    },
    userTag: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user tag/username for display purposes'
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord guild ID where this thread exists'
    },
    channelId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Discord channel ID for this thread'
    },
    status: {
      type: DataTypes.ENUM('open', 'closed'),
      allowNull: false,
      defaultValue: 'open',
      comment: 'Status of the thread'
    },
    lastActivity: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the last activity in this thread occurred'
    },
    // JSON field to store warnings sent to avoid duplicate warnings
    warningsSent: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { thirty: false, ten: false },
      comment: 'Which auto-close warnings have been sent'
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
        name: 'userId_index'
      },
      {
        fields: ['guildId'],
        name: 'guildId_index'
      },
      {
        fields: ['channelId'],
        name: 'channelId_index',
        unique: true
      },
      {
        fields: ['status'],
        name: 'status_index'
      }
    ]
  });

  // Virtual field to parse JSON warningsSent
  ModmailThread.prototype.getWarningsSent = function() {
    const warningsSent = this.getDataValue('warningsSent');
    if (typeof warningsSent === 'string') {
      try {
        return JSON.parse(warningsSent);
      } catch (e) {
        return { thirty: false, ten: false };
      }
    }
    return warningsSent || { thirty: false, ten: false };
  };

  ModmailThread.prototype.setWarningsSent = function(value) {
    this.setDataValue('warningsSent', 
      typeof value === 'string' ? value : JSON.stringify(value)
    );
  };

  /**
   * Find all active threads for a user
   * @param {string} userId - Discord user ID
   * @returns {Promise<Array<ModmailThread>>} - Array of active threads
   */
  ModmailThread.findActiveThreadsByUser = async function(userId) {
    try {
      return await this.findAll({
        where: {
          userId: userId,
          status: 'open'
        }
      });
    } catch (error) {
      logger.error(`Error finding active threads for user ${userId}: ${error.message}`);
      return [];
    }
  };

  /**
   * Find a thread by channel ID
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<ModmailThread>} - Thread or null
   */
  ModmailThread.findByChannel = async function(channelId) {
    try {
      return await this.findOne({
        where: {
          channelId: channelId
        }
      });
    } catch (error) {
      logger.error(`Error finding thread by channel ${channelId}: ${error.message}`);
      return null;
    }
  };

  /**
   * Create a new modmail thread
   * @param {Object} data - Thread data
   * @param {string} data.userId - Discord user ID
   * @param {string} data.userTag - Discord user tag
   * @param {string} data.guildId - Discord guild ID
   * @param {string} data.channelId - Discord channel ID
   * @returns {Promise<ModmailThread>} - The created thread
   */
  ModmailThread.createThread = async function(data) {
    try {
      // Check if there's already an open thread for this user in this guild
      const existingThread = await this.findOne({
        where: {
          userId: data.userId,
          guildId: data.guildId,
          status: 'open'
        }
      });

      if (existingThread) {
        // If the thread already exists but the channel is different, close the old one
        if (existingThread.channelId !== data.channelId) {
          await existingThread.update({
            status: 'closed'
          });
        } else {
          // If the thread exists with the same channel, just update the lastActivity
          await existingThread.update({
            lastActivity: new Date(),
            userTag: data.userTag // Update tag in case it changed
          });
          return existingThread;
        }
      }

      // Create a new thread
      return await this.create({
        userId: data.userId,
        userTag: data.userTag,
        guildId: data.guildId,
        channelId: data.channelId,
        status: 'open',
        lastActivity: new Date(),
        warningsSent: { thirty: false, ten: false }
      });
    } catch (error) {
      logger.error(`Error creating thread for user ${data.userId}: ${error.message}`);
      throw error;
    }
  };

  /**
   * Update thread activity
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<boolean>} - Whether the update was successful
   */
  ModmailThread.updateActivity = async function(channelId) {
    try {
      const thread = await this.findOne({
        where: {
          channelId: channelId,
          status: 'open'
        }
      });

      if (thread) {
        await thread.update({
          lastActivity: new Date(),
          warningsSent: { thirty: false, ten: false } // Reset warnings when there's activity
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error updating thread activity for channel ${channelId}: ${error.message}`);
      return false;
    }
  };

  /**
   * Close a thread
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<boolean>} - Whether the update was successful
   */
  ModmailThread.closeThread = async function(channelId) {
    try {
      const thread = await this.findOne({
        where: {
          channelId: channelId
        }
      });

      if (thread) {
        await thread.update({
          status: 'closed'
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error closing thread for channel ${channelId}: ${error.message}`);
      return false;
    }
  };

  /**
   * Find threads that need auto-close warnings or need to be auto-closed
   * @param {number} idleTime - Time in milliseconds to consider a thread idle
   * @returns {Promise<Array<ModmailThread>>} - Array of threads that need attention
   */
  ModmailThread.findIdleThreads = async function(idleTime) {
    try {
      const idleDate = new Date(Date.now() - idleTime);
      
      return await this.findAll({
        where: {
          status: 'open',
          lastActivity: {
            [Op.lt]: idleDate
          }
        }
      });
    } catch (error) {
      logger.error(`Error finding idle threads: ${error.message}`);
      return [];
    }
  };

  return ModmailThread;
};