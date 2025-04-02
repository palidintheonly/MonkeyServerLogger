const { ActivityType, version: discordJsVersion } = require('discord.js');
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
    
    // Log detailed bot information
    logger.info('==================================================');
    logger.info(`${shardInfo}Bot Ready! Connection successful!`);
    logger.info(`Logged in as: ${client.user.tag} (ID: ${client.user.id})`);
    logger.info(`Currently serving ${serverCount} servers`);
    logger.info(`Discord API Version: v${client.options.rest.version}`);
    logger.info(`Discord.js Version: v${discordJsVersion}`);
    logger.info(`Node.js Version: ${process.version}`);
    logger.info(`Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
    logger.info(`Uptime: ${Math.round(process.uptime())} seconds`);
    
    // Log information about the bot's permissions and intents
    const intents = Object.keys(client.options.intents).join(', ');
    logger.info(`Registered Intents: ${intents}`);
    
    // Log total stats if this is shard 0 or not sharded
    if (!client.shard || client.shard.ids.includes(0)) {
      // Log helpful information
      logger.info(`Invite Link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
      logger.info('==================================================');
      logger.info('Monkey Bytes - The Royal Court is now online!');
      
      // Get server stats from all shards if sharded
      if (client.shard) {
        try {
          const serverCounts = await client.shard.fetchClientValues('guilds.cache.size');
          const totalServers = serverCounts.reduce((acc, count) => acc + count, 0);
          logger.info(`Total servers across all shards: ${totalServers}`);
          
          // Get shard status
          const shardPings = await client.shard.broadcastEval(c => c.ws.ping);
          logger.info('Shard Status:');
          shardPings.forEach((ping, shardId) => {
            logger.info(`Shard ${shardId}: ${ping}ms`);
          });
        } catch (error) {
          logger.error('Error fetching shard statistics:', error);
        }
      }
    }
    
    // Log connected guilds for diagnostic purposes
    const connectedGuilds = client.guilds.cache.map(guild => 
      `${guild.name} (${guild.id}) - ${guild.memberCount} members`
    );
    
    if (connectedGuilds.length > 0) {
      logger.info('Connected to the following guilds:');
      connectedGuilds.forEach(guild => logger.info(`- ${guild}`));
    } else {
      logger.warn('Not connected to any guilds yet!');
    }
    logger.info('==================================================');
  }
};
