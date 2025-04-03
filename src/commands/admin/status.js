/**
 * Status Command
 * Shows bot status information including uptime, memory usage, and more
 */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createInfoEmbed } = require('../../utils/embedBuilder');
const os = require('os');
const { version } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Shows the bot\'s current status and system information')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  cooldown: 10,
  
  async execute(interaction, client) {
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
    const memoryUsedPercent = (memoryUsage.rss / os.totalmem() * 100).toFixed(2);
    
    // Get CPU load
    const cpuLoad = os.loadavg()[0];
    const cpuLoadPercent = (cpuLoad * 100 / os.cpus().length).toFixed(2);
    
    // Get uptime
    const uptimeSeconds = process.uptime();
    let uptime = '';
    
    // Calculate days, hours, minutes, seconds
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    
    if (days > 0) uptime += `${days}d `;
    if (hours > 0) uptime += `${hours}h `;
    if (minutes > 0) uptime += `${minutes}m `;
    uptime += `${seconds}s`;
    
    // Calculate ping
    const ws = client.ws.ping;
    const messagePing = Date.now() - interaction.createdTimestamp;
    
    // Get guild count
    const guildCount = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    
    // Get database stats
    const guildSettingsCount = await client.db.Guild.count();
    const threadsCount = await client.db.ModmailThread.count();
    
    // Get API version
    const nodeVersion = process.version;
    
    // Create embed
    const statusEmbed = createInfoEmbed(
      `Bot status information as of <t:${Math.floor(Date.now() / 1000)}:F>`,
      'Bot Status'
    );
    
    // Add fields
    statusEmbed.addFields(
      { name: 'Uptime', value: uptime, inline: true },
      { name: 'Memory Usage', value: `${memoryUsedMB} MB (${memoryUsedPercent}%)`, inline: true },
      { name: 'CPU Load', value: `${cpuLoadPercent}%`, inline: true },
      { name: 'Ping', value: `WS: ${ws}ms\nAPI: ${messagePing}ms`, inline: true },
      { name: 'Database', value: `${guildSettingsCount} guilds\n${threadsCount} threads`, inline: true },
      { name: 'Servers', value: `${guildCount} servers\n${totalUsers} users`, inline: true },
      { name: 'Versions', value: `Node.js: ${nodeVersion}\nDiscord.js: v${version}`, inline: false }
    );
    
    // Add system info in footer
    statusEmbed.setFooter({ 
      text: `OS: ${os.type()} ${os.release()} | Platform: ${os.platform()} | Arch: ${os.arch()}`
    });
    
    await interaction.reply({ embeds: [statusEmbed] });
  }
};