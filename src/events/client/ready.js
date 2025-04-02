const { ActivityType } = require('discord.js');
const { logger } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    const serverCount = client.guilds.cache.size;
    
    // Set bot activity
    client.user.setPresence({
      activities: [{ 
        name: `${config.bot.slogan} | /help`, 
        type: ActivityType.Watching 
      }],
      status: 'online'
    });
    
    // Log shard information
    const shardInfo = client.shard 
      ? `[Shard ${client.shard.ids.join('/')}] ` 
      : '';
    
    logger.info(`${shardInfo}Ready! Logged in as ${client.user.tag}`);
    logger.info(`${shardInfo}Serving ${serverCount} servers`);
    
    // Log total stats if this is shard 0 or not sharded
    if (!client.shard || client.shard.ids.includes(0)) {
      // Log helpful information
      logger.info(`Invite Link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
      logger.info('Monkey Bytes - The Royal Court is now online!');
      
      // Get server stats from all shards if sharded
      if (client.shard) {
        try {
          const serverCounts = await client.shard.fetchClientValues('guilds.cache.size');
          const totalServers = serverCounts.reduce((acc, count) => acc + count, 0);
          logger.info(`Total servers across all shards: ${totalServers}`);
        } catch (error) {
          logger.error('Error fetching shard statistics:', error);
        }
      }
    }
  }
};
