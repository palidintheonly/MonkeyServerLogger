/**
 * Ping Command
 * Responds with latency information
 */
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response time and latency'),
  
  cooldown: 5, // 5 seconds cooldown
  
  async execute(interaction, client) {
    try {
      // Record start time
      const start = Date.now();
      
      // Defer reply for accurate response time calculation
      await interaction.deferReply();
      
      // Calculate response time
      const responseTime = Date.now() - start;
      
      // Get API ping (websocket heartbeat)
      const apiPing = Math.round(client.ws.ping);
      
      // Create embed with ping information
      const embed = createEmbed({
        title: '🏓 Pong!',
        description: 'Bot latency and response time information',
        fields: [
          { name: 'Response Time', value: `${responseTime}ms`, inline: true },
          { name: 'API Latency', value: `${apiPing}ms`, inline: true },
          { name: 'Uptime', value: formatUptime(client.uptime), inline: false }
        ],
        footer: { text: `Requested by ${interaction.user.tag}` },
        timestamp: true
      });
      
      // Color coding based on ping quality
      if (apiPing < 100) {
        embed.setColor('#57F287'); // Green for good ping
      } else if (apiPing < 200) {
        embed.setColor('#FEE75C'); // Yellow for average ping
      } else {
        embed.setColor('#ED4245'); // Red for poor ping
      }
      
      // Send response
      await interaction.followUp({ embeds: [embed] });
      
      logger.verbose(`Ping command executed by ${interaction.user.tag} (API: ${apiPing}ms, Response: ${responseTime}ms)`);
    } catch (error) {
      logger.error(`Error in ping command: ${error.message}`);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'There was an error while executing the ping command.', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: 'There was an error while executing the ping command.', 
          ephemeral: true 
        });
      }
    }
  }
};

// Format uptime into a readable string
function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000) % 60;
  const minutes = Math.floor(uptime / (1000 * 60)) % 60;
  const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}