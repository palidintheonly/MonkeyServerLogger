const { DataTypes } = require('sequelize');
const { logger } = require('../../utils/logger');

/**
 * BlockedUser model for tracking users blocked from using modmail
 * @param {Sequelize} sequelize Sequelize instance
 * @returns {Model} BlockedUser model
 */
module.exports = (sequelize) => {
  const BlockedUser = sequelize.define('BlockedUser', {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID of blocked user'
    },
    blockedById: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord user ID of the staff member who blocked the user'
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord guild ID where the user is blocked'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for blocking the user'
    },
    blockedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the user was blocked'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether the block is currently active'
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'guildId'],
        where: {
          isActive: true
        },
        name: 'unique_active_block'
      },
      {
        fields: ['userId'],
        name: 'userId_index'
      },
      {
        fields: ['guildId'],
        name: 'guildId_index'
      }
    ]
  });

  /**
   * Check if a user is blocked in a specific guild
   * @param {string} userId - Discord user ID to check
   * @param {string} guildId - Guild ID to check
   * @returns {Promise<boolean>} Whether the user is blocked
   */
  BlockedUser.isUserBlocked = async function(userId, guildId) {
    try {
      const blockedUser = await this.findOne({
        where: {
          userId: userId,
          guildId: guildId,
          isActive: true
        }
      });
      
      return !!blockedUser;
    } catch (error) {
      logger.error(`Error checking if user ${userId} is blocked in guild ${guildId}: ${error.message}`);
      return false;
    }
  };

  /**
   * Block a user
   * @param {string} userId - Discord user ID to block
   * @param {string} blockedById - ID of staff member who blocked the user
   * @param {string} guildId - Guild ID where to block the user
   * @param {string} reason - Reason for the block (optional)
   */
  BlockedUser.blockUser = async function(userId, blockedById, guildId, reason = 'No reason provided') {
    try {
      // First check if there's already an active block
      const existingBlock = await this.findOne({
        where: {
          userId: userId,
          guildId: guildId,
          isActive: true
        }
      });
      
      if (existingBlock) {
        // If already blocked, just update the reason and blockedById
        await existingBlock.update({
          reason: reason,
          blockedById: blockedById,
          blockedAt: new Date()
        });
        
        return existingBlock;
      }
      
      // Otherwise create a new block
      return await this.create({
        userId: userId,
        blockedById: blockedById,
        guildId: guildId,
        reason: reason,
        isActive: true
      });
    } catch (error) {
      logger.error(`Error blocking user ${userId} in guild ${guildId}: ${error.message}`);
      throw error;
    }
  };

  /**
   * Unblock a user
   * @param {string} userId - Discord user ID to unblock
   * @param {string} guildId - Guild ID where to unblock the user
   */
  BlockedUser.unblockUser = async function(userId, guildId) {
    try {
      const blockedUser = await this.findOne({
        where: {
          userId: userId,
          guildId: guildId,
          isActive: true
        }
      });
      
      if (blockedUser) {
        await blockedUser.update({
          isActive: false
        });
      }
      
      return true;
    } catch (error) {
      logger.error(`Error unblocking user ${userId} in guild ${guildId}: ${error.message}`);
      throw error;
    }
  };

  return BlockedUser;
};