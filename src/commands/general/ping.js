/**
 * Ping Command
 * Basic command to check bot latency
 */
const { SlashCommandBuilder } = require('discord.js');
const { createInfoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response time'),
  
  cooldown: 10,
  
  async execute(interaction, client) {
    // Calculate bot and API latency
    const sent = await interaction.deferReply({ fetchReply: true });
    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    
    // Build and send embed
    const embed = createInfoEmbed(
      `**Bot Latency:** ${botLatency}ms\n**API Latency:** ${apiLatency}ms`,
      '🏓 Pong!'
    );
    
    return interaction.editReply({ embeds: [embed] });
  }
};