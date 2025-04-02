const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  cooldown: 5, // 5 seconds cooldown
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response time and latency'),
  
  async execute(interaction, client) {
    // Defer reply to measure round-trip time
    await interaction.deferReply();
    
    // Calculate the bot's ping
    const sent = await interaction.fetchReply();
    const roundtripPing = sent.createdTimestamp - interaction.createdTimestamp;
    
    // Get the WebSocket ping
    const wsHeartbeat = Math.round(client.ws.ping);
    
    // Create response embed with ping information
    const embed = createEmbed({
      title: '🏓 Pong!',
      description: 'Here are the current response times:',
      fields: [
        {
          name: '📱 Roundtrip Latency',
          value: `\`${roundtripPing}ms\``,
          inline: true
        },
        {
          name: '💓 WebSocket Heartbeat',
          value: `\`${wsHeartbeat}ms\``,
          inline: true
        }
      ],
      footer: `${config.bot.name} | ${client.user.tag}`,
      timestamp: true
    });
    
    // Set color based on ping (green for good, yellow for decent, red for bad)
    if (roundtripPing < 200 && wsHeartbeat < 200) {
      embed.setColor('#77B255'); // Green
    } else if (roundtripPing < 500 && wsHeartbeat < 500) {
      embed.setColor('#FFCC00'); // Yellow
    } else {
      embed.setColor('#DD2E44'); // Red
    }
    
    // Log the ping for monitoring
    logger.debug(`Ping command used by ${interaction.user.tag} - Roundtrip: ${roundtripPing}ms, WebSocket: ${wsHeartbeat}ms`);
    
    // Send the response
    await interaction.editReply({ embeds: [embed] });
  }
};
