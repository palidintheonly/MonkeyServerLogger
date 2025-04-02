const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  cooldown: 5, // 5 seconds cooldown for the base command
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response time and latency')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages) // Base permission for the command
    .addSubcommand(subcommand => 
      subcommand
        .setName('check')
        .setDescription('Get the current latency information')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('reload')
        .setDescription('Reload all commands (Admin only)')
    ),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    // Handle subcommands
    if (subcommand === 'check' || !subcommand) {
      await this.handlePingCheck(interaction, client);
    } else if (subcommand === 'reload') {
      await this.handleCommandReload(interaction, client);
    }
  },
  
  // Handle the ping check subcommand
  async handlePingCheck(interaction, client) {
    // Defer reply to measure round-trip time
    await interaction.deferReply({ flags: { ephemeral: true } });
    
    // Calculate the bot's ping
    const sent = await interaction.fetchReply(); // This approach is still valid as a separate method call
    const roundtripPing = sent.createdTimestamp - interaction.createdTimestamp;
    
    // Get the WebSocket ping
    const wsHeartbeat = Math.round(client.ws.ping);
    
    // Get memory usage
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    
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
        },
        {
          name: '🧠 Memory Usage',
          value: `\`${memoryUsage} MB\``,
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
  },
  
  // Handle the command reload subcommand
  async handleCommandReload(interaction, client) {
    await interaction.deferReply({ flags: { ephemeral: true } });
    
    // Check if the user has administrator permissions, since we can't set it at the subcommand level
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      logger.warn(`Non-admin user ${interaction.user.tag} (${interaction.user.id}) attempted to use reload command`);
      
      await interaction.editReply({
        content: '❌ You need Administrator permissions to use this command.',
      });
      return;
    }
    
    try {
      // We need to access the main bot.js file where registerCommands is defined
      const path = require('path');
      const botPath = path.resolve(__dirname, '../../../bot.js');
      
      // Clear the require cache for the bot.js file
      delete require.cache[botPath];
      
      // Re-require the bot.js file
      const bot = require(botPath);
      
      if (typeof bot.registerCommands === 'function') {
        // Show "working on it" message
        await interaction.editReply({
          content: '⚙️ Reloading all commands and clearing cache... This may take a moment.',
        });
        
        // Force reload with cache clearing
        await bot.registerCommands(true);
        
        const successEmbed = createSuccessEmbed(
          'All commands have been reloaded successfully with a fresh cache. The changes will be available immediately.',
          '🔄 Commands Reloaded'
        );
        
        logger.info(`Commands manually reloaded by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guild.name} (${interaction.guild.id})`);
        
        await interaction.editReply({
          content: null,
          embeds: [successEmbed]
        });
      } else {
        logger.error(`Command reload function not found when attempted by ${interaction.user.tag}`);
        await interaction.editReply({
          content: '❌ Command reloading function not found. Please contact the bot developer.',
        });
      }
    } catch (error) {
      logger.error(`Error during manual command reload by ${interaction.user.tag}:`, error);
      await interaction.editReply({
        content: `❌ Error reloading commands: ${error.message}`,
      });
    }
  }
};
