const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../../utils/embedBuilder');
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
    await interaction.deferReply({ ephemeral: true });
    
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
    await interaction.deferReply({ ephemeral: true });
    
    // Check if the user has administrator permissions, since we can't set it at the subcommand level
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      logger.warn(`Non-admin user ${interaction.user.tag} (${interaction.user.id}) attempted to use reload command`);
      
      await interaction.editReply({
        content: '❌ You need Administrator permissions to use this command.',
      });
      return;
    }
    
    try {
      // Update the message to show progress
      await interaction.editReply({
        content: '⏳ Starting command reload process... This may take a moment.',
      });
      
      // We need to access the main bot.js file where registerCommands is defined
      const path = require('path');
      const botPath = path.resolve(__dirname, '../../../bot.js');
      
      // Clear the require cache for the bot.js file and all related command files
      logger.info(`Clearing require cache for all command files (requested by ${interaction.user.tag})`);
      Object.keys(require.cache).forEach(key => {
        if (key.includes('commands') || key.includes('bot.js')) {
          delete require.cache[key];
          logger.debug(`Cleared cache for: ${key}`);
        }
      });
      
      // Update progress
      await interaction.editReply({
        content: '🗑️ Command cache cleared. Now reloading bot modules...',
      });
      
      // Re-require the bot.js file with fresh code
      const bot = require(botPath);
      
      if (typeof bot.registerCommands === 'function') {
        // Clear client.commands collection first
        client.commands.clear();
        client.contextCommands.clear();
        logger.info(`Command collections cleared by ${interaction.user.tag}`);
        
        // Update progress
        await interaction.editReply({
          content: '⚙️ Now deleting old commands from Discord API and registering fresh commands...',
        });
        
        // Force reload with cache clearing and command deletion
        const result = await bot.registerCommands(true);
        
        // Generate a detailed success message
        const successEmbed = createSuccessEmbed(
          'All commands have been reloaded with a fresh cache. Old commands were deleted and new ones registered. The changes are now available.',
          '🔄 Commands Force-Refreshed'
        );
        
        successEmbed.addFields(
          { name: '🧹 Cache Cleared', value: 'All command module caches have been cleared', inline: true },
          { name: '🗑️ Old Commands', value: 'All previous commands were deleted from Discord', inline: true },
          { name: '✅ Registration', value: 'New commands have been registered successfully', inline: true },
          { name: '🕒 Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        );
        
        logger.info(`Commands manually reloaded by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guild.name} (${interaction.guild.id})`);
        console.log(`ADMIN ACTION: Commands force-reloaded by ${interaction.user.tag} in ${interaction.guild.name}`);
        
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
        embeds: [createErrorEmbed(`Failed to reload commands: ${error.message}`, 'Command Reload Error')]
      });
    }
  }
};
