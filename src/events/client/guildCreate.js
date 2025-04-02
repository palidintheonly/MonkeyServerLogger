const { Events } = require('discord.js');
const { logger } = require('../../utils/logger');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  name: Events.GuildCreate,
  once: false,
  
  async execute(guild, client) {
    logger.info(`Bot joined a new guild: ${guild.name} (${guild.id})`);
    console.log(`NEW SERVER: Bot was added to ${guild.name} (${guild.id})`);
    
    // Log guild information
    const memberCount = guild.memberCount || 'Unknown';
    const owner = guild.members.cache.get(guild.ownerId)?.user?.tag || 'Unknown';
    
    logger.info(`Guild details: Owner: ${owner}, Members: ${memberCount}`);
    
    // Force register commands to ensure they're available in the new guild
    try {
      logger.info(`Forcing command registration after joining new guild: ${guild.name}`);
      
      // Import the module with the registerCommands function
      const botFunctions = require('../../../bot.js');
      
      if (typeof botFunctions.registerCommands === 'function') {
        // Force command registration with cache clearing
        await botFunctions.registerCommands(true);
        logger.info(`Successfully registered commands after joining ${guild.name}`);
      } else {
        logger.warn('Cannot register commands after joining guild - registerCommands function not found');
      }
    } catch (error) {
      logger.error(`Failed to register commands after joining guild ${guild.name}:`, error);
    }
    
    // Try to find a general/system channel to send a welcome message
    let targetChannel = guild.systemChannel;
    
    // If there's no system channel, try to find a general text channel
    if (!targetChannel) {
      const generalChannel = guild.channels.cache.find(
        channel => 
          channel.name.includes('general') && 
          channel.type === 0 && // TextChannel
          channel.permissionsFor(guild.members.me).has('SendMessages')
      );
      
      if (generalChannel) {
        targetChannel = generalChannel;
      }
    }
    
    // Send welcome message if we found a suitable channel
    if (targetChannel) {
      try {
        const welcomeEmbed = createEmbed({
          title: '👋 Thank you for adding me!',
          description: 'I\'m here to help monitor and manage your server!',
          fields: [
            {
              name: '🛠 Getting Started',
              value: 'Use `/setup wizard` to configure the bot for your server.'
            },
            {
              name: '📚 Commands',
              value: 'Use `/help` to see all available commands.'
            }
          ],
          footer: 'The Royal Court Herald',
          color: '#5865F2' // Discord blue
        });
        
        await targetChannel.send({ embeds: [welcomeEmbed] });
        logger.info(`Sent welcome message to channel #${targetChannel.name} in ${guild.name}`);
      } catch (error) {
        logger.error(`Failed to send welcome message to ${guild.name}:`, error);
      }
    } else {
      logger.warn(`Couldn't find a suitable channel to send welcome message in ${guild.name}`);
    }
  }
};