const { Sequelize } = require('sequelize');
const config = require('../config');
const { logger } = require('../utils/logger');
const { createEmbed } = require('../utils/embedBuilder');
const path = require('path');
const fs = require('fs');

// Initialize Sequelize with SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/database.sqlite'),
  logging: msg => logger.debug(msg),
  define: {
    timestamps: true
  }
});

// Model registry
const models = {};

// Initialize models
function initModels() {
  const modelsPath = path.join(__dirname, 'models');
  const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
  
  for (const file of modelFiles) {
    const model = require(path.join(modelsPath, file))(sequelize);
    models[model.name] = model;
    logger.info(`Loaded model: ${model.name}`);
  }
  
  // Define relationships between models if needed
  // Example: models.User.hasMany(models.Post);
}

// Connect to the database with retry logic
async function connectToDatabase() {
  let retries = 0;
  
  while (retries < config.database.retryAttempts) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');
      
      // Initialize models
      initModels();
      
      // Sync database (create tables if they don't exist)
      // Use force: false to prevent dropping tables
      // Use alter: false to prevent issues with existing indexes
      await sequelize.sync({ force: false, alter: false });
      logger.info('Database synchronized successfully');
      
      return true;
    } catch (error) {
      retries++;
      logger.error(`Database connection attempt ${retries} failed:`, error);
      
      if (retries >= config.database.retryAttempts) {
        logger.error('Maximum database connection retry attempts reached');
        throw error;
      }
      
      // Wait before retrying
      logger.info(`Retrying in ${config.database.retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, config.database.retryDelay));
    }
  }
}

/**
 * Initialize modmail auto-close functionality
 * This sets up periodic checks for idle modmail threads across shards
 * @param {Object} client - Discord client instance
 */
function initModmailAutoClose(client) {
  // Run every 30 minutes
  setInterval(async () => {
    try {
      // Skip if models aren't initialized yet
      if (!models.ModmailThread) return;
      
      // Find threads that have been inactive for over 24 hours
      const idleTime = 24 * 60 * 60 * 1000; // 24 hours
      const idleThreads = await models.ModmailThread.findIdleThreads(idleTime);
      
      if (idleThreads.length > 0) {
        logger.info(`Found ${idleThreads.length} idle modmail threads to close`);
        
        for (const thread of idleThreads) {
          // Check if this guild is accessible by this shard
          const guild = client.guilds.cache.get(thread.guildId);
          if (!guild) continue; // Skip if guild is not on this shard
          
          try {
            // Try to fetch the channel
            const channel = await guild.channels.fetch(thread.channelId).catch(() => null);
            if (!channel) {
              // Channel doesn't exist, mark thread as closed
              await models.ModmailThread.closeThread(thread.channelId);
              continue;
            }
            
            // Close the thread
            await channel.send({
              embeds: [
                createEmbed({
                  title: '🔒 Thread Auto-Closed',
                  description: 'This modmail thread has been automatically closed due to 24 hours of inactivity.',
                  color: '#FF5555',
                  timestamp: true
                })
              ]
            });
            
            // Archive or rename the channel
            await channel.setName(`closed-${channel.name}`);
            
            // Mark thread as closed in database
            await models.ModmailThread.closeThread(thread.channelId);
            
            logger.info(`Auto-closed modmail thread for ${thread.userTag} after 24 hours of inactivity.`);
          } catch (error) {
            logger.error(`Error auto-closing modmail thread ${thread.channelId}: ${error.message}`);
          }
        }
      }
      
      // Find threads that need warnings
      // Check for threads inactive for 23.5 hours (30 min warning)
      const thirtyMinWarningTime = idleTime - (30 * 60 * 1000);
      const thirtyMinWarningThreads = await models.ModmailThread.findAll({
        where: {
          status: 'open',
          lastActivity: {
            [sequelize.Op.lt]: new Date(Date.now() - thirtyMinWarningTime),
            [sequelize.Op.gt]: new Date(Date.now() - idleTime) // Only threads that haven't reached full idle time
          }
        }
      });
      
      // Process 30-minute warnings
      for (const thread of thirtyMinWarningThreads) {
        // Check if warning has been sent (in the warningsSent JSON)
        const warnings = thread.warningsSent || { thirty: false, ten: false };
        if (warnings.thirty) continue; // Skip if warning already sent
        
        // Check if this guild is accessible by this shard
        const guild = client.guilds.cache.get(thread.guildId);
        if (!guild) continue;
        
        try {
          const channel = await guild.channels.fetch(thread.channelId).catch(() => null);
          if (!channel) continue;
          
          // Send warning
          await channel.send({
            embeds: [
              createEmbed({
                title: '⚠️ Inactivity Warning',
                description: 'This modmail thread will be automatically closed in 30 minutes due to inactivity.',
                color: '#FFA500',
                timestamp: true
              })
            ]
          });
          
          // Update warning status in database
          warnings.thirty = true;
          await thread.update({ warningsSent: warnings });
          
          logger.info(`Sent 30-minute inactivity warning for thread ${thread.channelId}`);
        } catch (error) {
          logger.error(`Error sending 30-minute warning for thread ${thread.channelId}: ${error.message}`);
        }
      }
      
      // Check for threads inactive for 23 hours 50 minutes (10 min warning)
      const tenMinWarningTime = idleTime - (10 * 60 * 1000);
      const tenMinWarningThreads = await models.ModmailThread.findAll({
        where: {
          status: 'open',
          lastActivity: {
            [sequelize.Op.lt]: new Date(Date.now() - tenMinWarningTime),
            [sequelize.Op.gt]: new Date(Date.now() - idleTime) // Only threads that haven't reached full idle time
          }
        }
      });
      
      // Process 10-minute warnings
      for (const thread of tenMinWarningThreads) {
        // Check if warning has been sent
        const warnings = thread.warningsSent || { thirty: false, ten: false };
        if (warnings.ten) continue; // Skip if warning already sent
        
        // Check if this guild is accessible by this shard
        const guild = client.guilds.cache.get(thread.guildId);
        if (!guild) continue;
        
        try {
          const channel = await guild.channels.fetch(thread.channelId).catch(() => null);
          if (!channel) continue;
          
          // Send warning
          await channel.send({
            embeds: [
              createEmbed({
                title: '⚠️ Final Warning',
                description: 'This modmail thread will be automatically closed in 10 minutes due to inactivity.',
                color: '#FF5555', 
                timestamp: true
              })
            ]
          });
          
          // Update warning status in database
          warnings.ten = true;
          await thread.update({ warningsSent: warnings });
          
          logger.info(`Sent 10-minute inactivity warning for thread ${thread.channelId}`);
        } catch (error) {
          logger.error(`Error sending 10-minute warning for thread ${thread.channelId}: ${error.message}`);
        }
      }
      
    } catch (error) {
      logger.error(`Error in modmail auto-close processor: ${error.message}`);
    }
  }, 30 * 60 * 1000); // Run every 30 minutes
  
  logger.info('Initialized modmail auto-close system');
}

module.exports = {
  sequelize,
  models,
  connectToDatabase,
  initModmailAutoClose
};
