/**
 * ModmailThread Model
 * Tracks modmail threads between users and moderators
 */
const { DataTypes, Model, Op } = require('sequelize');
const { logger } = require('../../utils/logger');

module.exports = (sequelize) => {
  class ModmailThread extends Model {
    /**
     * Find all threads for a specific user
     * @param {string} userId - The user ID
     * @returns {Promise<Array<ModmailThread>>}
     */
    static async findUserThreads(userId) {
      try {
        return await ModmailThread.findAll({
          where: {
            userId
          },
          order: [['createdAt', 'DESC']]
        });
      } catch (error) {
        logger.error(`Error finding threads for user ${userId}: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Find a user's active thread
     * @param {string} userId - The user ID 
     * @param {string} guildId - The guild ID
     * @returns {Promise<ModmailThread|null>}
     */
    static async findActiveThread(userId, guildId) {
      try {
        logger.debug(`Looking for active thread for user ${userId} in guild ${guildId}`);
        const thread = await ModmailThread.findOne({
          where: {
            userId,
            guildId,
            open: true
          }
        });
        
        if (thread) {
          logger.debug(`Found active thread: ${thread.id}`);
        } else {
          logger.debug(`No active thread found for user ${userId} in guild ${guildId}`);
        }
        
        return thread;
      } catch (error) {
        logger.error(`Error finding active thread for user ${userId} in guild ${guildId}: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Find threads that have been inactive for a period
     * @param {number} hours - Hours since last activity
     * @returns {Promise<Array<ModmailThread>>}
     */
    static async findInactiveThreads(hours) {
      try {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hours);
        
        return await ModmailThread.findAll({
          where: {
            lastMessageAt: {
              [Op.lt]: cutoff
            },
            open: true
          }
        });
      } catch (error) {
        logger.error(`Error finding inactive threads: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Update the last activity timestamp
     */
    async updateActivity() {
      try {
        this.lastMessageAt = new Date();
        await this.save();
      } catch (error) {
        logger.error(`Error updating thread activity for ${this.id}: ${error.message}`);
        throw error;
      }
    }
    
    /**
     * Close a thread
     * @param {string} userId - The user ID of who closed it
     * @param {string} reason - The reason for closing
     */
    async closeThread(userId, reason) {
      try {
        this.open = false;
        this.closedAt = new Date();
        this.closedBy = userId;
        this.closeReason = reason;
        
        await this.save();
        return this;
      } catch (error) {
        logger.error(`Error closing thread ${this.id}: ${error.message}`);
        throw error;
      }
    }
  }
  
  ModmailThread.init({
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      comment: 'ID of the channel created for the thread'
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the user who initiated the thread'
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the guild where the thread was created'
    },
    open: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether the thread is currently open'
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Subject or topic of the thread'
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp of the last message in the thread'
    },
    messageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Count of messages in the thread'
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the user or system that created the thread'
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the thread was closed'
    },
    closedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID of the user who closed the thread'
    },
    closeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for closing the thread'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata about the thread'
    }
  }, {
    sequelize,
    modelName: 'ModmailThread',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['userId', 'open']
      },
      {
        fields: ['guildId', 'open']
      },
      {
        fields: ['lastMessageAt']
      }
    ]
  });
  
  return ModmailThread;
};