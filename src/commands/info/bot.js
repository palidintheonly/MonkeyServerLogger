/**
 * Bot Info Command
 * Displays information about the bot
 */
const { SlashCommandBuilder, version: discordJsVersion } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { bot } = require('../../config');
const os = require('os');
const { version: oceanicVersion } = require('oceanic.js');

// Calculate uptime in a human-readable format
function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000) % 60;
  const minutes = Math.floor(uptime / (1000 * 60)) % 60;
  const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Format memory usage in a human-readable format
function formatMemoryUsage(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
  else return (bytes / 1073741824).toFixed(2) + ' GB';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Get information about the bot'),
  
  cooldown: 10, // 10 second cooldown
  
  async execute(interaction, client) {
    try {
      // Get bot uptime
      const uptime = client.uptime;
      
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const rss = formatMemoryUsage(memoryUsage.rss);
      const heapUsed = formatMemoryUsage(memoryUsage.heapUsed);
      
      // Get server count
      const serverCount = client.guilds.cache.size;
      
      // Get user count (approximate)
      const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      
      // Create info embed
      const embed = createEmbed({
        title: `${client.user.username} Info`,
        description: 'Professional Discord bot for server management',
        thumbnail: client.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Bot Version', value: bot.version, inline: true },
          { name: 'Servers', value: serverCount.toString(), inline: true },
          { name: 'Users', value: userCount.toString(), inline: true },
          { name: 'Uptime', value: formatUptime(uptime), inline: true },
          { name: 'Memory', value: `RSS: ${rss} | Heap: ${heapUsed}`, inline: true },
          { name: 'Platform', value: `${os.type()} ${os.release()}`, inline: true },
          { name: 'Node.js', value: process.version, inline: true },
          { name: 'Discord.js', value: `v${discordJsVersion}`, inline: true },
          { name: 'Oceanic.js', value: `v${oceanicVersion}`, inline: true }
        ],
        footer: { text: `Requested by ${interaction.user.tag}` },
        timestamp: true
      });
      
      // Add links if available
      if (bot.supportServer || bot.website || bot.github) {
        let links = '';
        if (bot.supportServer) links += `[Support Server](${bot.supportServer}) | `;
        if (bot.website) links += `[Website](${bot.website}) | `;
        if (bot.github) links += `[GitHub](${bot.github}) | `;
        
        // Remove trailing separator
        links = links.replace(/\s\|\s$/, '');
        
        embed.addFields({ name: 'Links', value: links });
      }
      
      // Send the embed
      await interaction.reply({ embeds: [embed] });
      
      logger.verbose(`Bot info command executed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error in bot info command: ${error.message}`);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'There was an error while executing the info command.', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: 'There was an error while executing the info command.', 
          ephemeral: true 
        });
      }
    }
  }
};