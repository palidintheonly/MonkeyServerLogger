const { SlashCommandBuilder, version: discordJsVersion } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const config = require('../../config');
const { sequelize } = require('../../database/db');
const os = require('os');

module.exports = {
  cooldown: 10, // 10 seconds cooldown
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display bot and logging statistics'),
  
  async execute(interaction, client) {
    await interaction.deferReply();
    
    try {
      // Get uptime information
      const botUptime = formatUptime(client.uptime);
      
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
      const systemTotalMB = (os.totalmem() / 1024 / 1024).toFixed(2);
      
      // Get system info
      const cpuCores = os.cpus().length;
      const nodeVersion = process.version;
      
      // Get guild count and user reach
      const guildCount = client.guilds.cache.size;
      let userCount = 0;
      client.guilds.cache.forEach(guild => {
        userCount += guild.memberCount;
      });
      
      // Get database stats
      const guildSettings = await sequelize.models.Guild.count();
      
      // Count active logging channels across all guilds
      let activeLogChannels = 0;
      let enabledCategories = 0;
      const allGuilds = await sequelize.models.Guild.findAll();
      
      allGuilds.forEach(guild => {
        if (guild.setupCompleted) {
          activeLogChannels++;
          
          // Count enabled categories
          const categories = guild.enabledCategories;
          Object.values(categories).forEach(enabled => {
            if (enabled) enabledCategories++;
          });
        }
      });
      
      // Get shard information if the bot is sharded
      let shardStats = [];
      let totalServers = guildCount;
      let totalUsers = userCount;
      
      if (client.shard) {
        try {
          // Get shard ID
          const shardId = client.shard.ids[0];
          const shardCount = client.shard.count;
          
          // Attempt to get global stats from all shards
          const serverCounts = await client.shard.fetchClientValues('guilds.cache.size');
          const userCounts = await client.shard.broadcastEval(c => {
            return c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
          });
          
          // Calculate totals
          totalServers = serverCounts.reduce((acc, count) => acc + count, 0);
          totalUsers = userCounts.reduce((acc, count) => acc + count, 0);
          
          // Add shard information
          shardStats = [
            `**Current Shard:** ${shardId + 1}/${shardCount}`,
            `**Servers on Shard:** ${guildCount}`,
            `**Users on Shard:** ${userCount.toLocaleString()}`
          ];
        } catch (error) {
          logger.error(`Error fetching shard statistics: ${error.message}`);
          shardStats = ["**Shard Info:** Error fetching shard data"];
        }
      }
      
      // Create the stats embed
      const embed = createEmbed({
        title: `${config.bot.name} - ${config.bot.slogan}`,
        description: `Bot statistics and information`,
        thumbnail: client.user.displayAvatarURL({ dynamic: true }),
        fields: [
          {
            name: '📊 Bot Stats',
            value: [
              `**Servers:** ${totalServers}`,
              `**Users:** ${totalUsers.toLocaleString()}`,
              `**Uptime:** ${botUptime}`,
              `**Memory:** ${memoryUsedMB}MB / ${systemTotalMB}MB`
            ].join('\n'),
            inline: true
          },
          {
            name: '🔧 System Info',
            value: [
              `**Node.js:** ${nodeVersion}`,
              `**Discord.js:** v${discordJsVersion}`,
              `**CPU Cores:** ${cpuCores}`,
              `**Platform:** ${process.platform}`
            ].join('\n'),
            inline: true
          },
          {
            name: '📝 Logging Stats',
            value: [
              `**Configured Servers:** ${guildSettings}`,
              `**Active Log Channels:** ${activeLogChannels}`,
              `**Enabled Categories:** ${enabledCategories}`,
              `**Version:** ${config.bot.version}`
            ].join('\n'),
            inline: false
          }
        ],
        footer: `Requested by ${interaction.user.tag}`,
        timestamp: true
      });
      
      // Add shard information if applicable
      if (client.shard) {
        embed.addFields([{
          name: '🔄 Shard Info',
          value: shardStats.join('\n'),
          inline: false
        }]);
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      logger.error(`Error executing stats command: ${error.message}`);
      
      const errorEmbed = createEmbed({
        title: 'Error Fetching Stats',
        description: 'There was an error retrieving the bot statistics. Please try again later.',
        color: '#DD2E44', // Red
        timestamp: true
      });
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

/**
 * Format uptime into a readable string
 * @param {number} ms - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  const parts = [];
  
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  
  return parts.join(', ');
}
