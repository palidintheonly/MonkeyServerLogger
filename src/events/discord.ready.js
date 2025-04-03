/**
 * Discord.js Ready Event
 */
const { Events, ActivityType } = require('discord.js');
const { logger } = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,  // This event will only fire once
  
  execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    
    // Set bot presence/activity
    client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: '/help',
          type: ActivityType.Listening
        }
      ]
    });
    
    // Log some stats
    logger.info(`Connected to ${client.guilds.cache.size} guilds with ${client.channels.cache.size} channels`);
    
    // Set up any scheduled tasks
    setupScheduledTasks(client);
  }
};

/**
 * Set up scheduled tasks
 * @param {Client} client - Discord client
 */
function setupScheduledTasks(client) {
  // Check for expired mod actions every hour
  setInterval(async () => {
    try {
      if (client.db && client.db.ModAction) {
        const expiredActions = await client.db.ModAction.expireActions();
        if (expiredActions.length > 0) {
          logger.info(`Expired ${expiredActions.length} moderation actions`);
        }
      }
    } catch (error) {
      logger.error(`Error expiring mod actions: ${error.message}`);
    }
  }, 3600000); // Every hour
  
  // Check for inactive modmail threads daily
  setInterval(async () => {
    try {
      if (client.db && client.db.ModmailThread) {
        // Find threads inactive for 72 hours (3 days)
        const inactiveThreads = await client.db.ModmailThread.findInactiveThreads(72);
        
        for (const thread of inactiveThreads) {
          try {
            // Close the thread due to inactivity
            await thread.closeThread('SYSTEM', 'Automatically closed due to inactivity');
            
            // Try to get the channel to send a closing message
            const guild = client.guilds.cache.get(thread.guildId);
            if (!guild) continue;
            
            const channel = await guild.channels.fetch(thread.id).catch(() => null);
            if (channel) {
              await channel.send({
                content: '📭 This modmail thread has been automatically closed due to 72 hours of inactivity.'
              });
            }
            
            logger.info(`Automatically closed inactive modmail thread ${thread.id} in guild ${thread.guildId}`);
          } catch (threadError) {
            logger.error(`Error auto-closing thread ${thread.id}: ${threadError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking inactive modmail threads: ${error.message}`);
    }
  }, 86400000); // Every 24 hours
}