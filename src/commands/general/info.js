/**
 * Info Command
 * Displays information about the bot
 */
const { SlashCommandBuilder, version: discordJsVersion } = require('discord.js');
const { createInfoEmbed } = require('../../utils/embedBuilder');
const { bot } = require('../../config');
const { version: nodeVersion } = require('process');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('View information about the bot'),
  
  cooldown: 5,
  
  async execute(interaction, client) {
    // Calculate uptime
    const uptime = this.formatUptime(client.uptime);
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const memoryTotalMB = Math.round(os.totalmem() / 1024 / 1024);
    
    // Create embed
    const embed = createInfoEmbed(
      `A Discord modmail bot for cross-server communication.`,
      `📊 Bot Information`
    );
    
    // Add system info
    embed.addFields(
      {
        name: 'System',
        value: [
          `**Node.js:** ${nodeVersion}`,
          `**Discord.js:** v${discordJsVersion}`,
          `**Memory:** ${memoryUsedMB}MB / ${memoryTotalMB}MB`,
          `**Uptime:** ${uptime}`,
          `**Platform:** ${os.platform()} ${os.release()}`
        ].join('\n'),
        inline: true
      },
      {
        name: 'Stats',
        value: [
          `**Servers:** ${client.guilds.cache.size}`,
          `**Users:** ${client.users.cache.size}`,
          `**Channels:** ${client.channels.cache.size}`,
          `**Commands:** ${client.commands.size}`
        ].join('\n'),
        inline: true
      }
    );
    
    // Add support server if available
    if (bot.supportServer) {
      embed.addFields({
        name: 'Links',
        value: `[Support Server](${bot.supportServer})`,
        inline: false
      });
    }
    
    return interaction.reply({ embeds: [embed] });
  },
  
  /**
   * Format uptime in a human-readable way
   * @param {number} ms - Uptime in milliseconds
   * @returns {string} - Formatted uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    return [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      `${seconds}s`
    ].filter(Boolean).join(' ');
  }
};