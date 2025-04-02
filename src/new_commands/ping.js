const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { REST, Routes } = require('discord.js');
const config = require('../config');

module.exports = {
  cooldown: 5, // 5 seconds cooldown for ping command
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and status')
    .addBooleanOption(option => 
      option.setName('reload_commands')
        .setDescription('Force reload all commands (admin only)')
        .setRequired(false)
    ),
    
  async execute(interaction, client) {
    const reloadCommands = interaction.options.getBoolean('reload_commands') || false;
    
    if (reloadCommands) {
      // Check if user has permission to reload commands
      if (!interaction.member.permissions.has('Administrator')) {
        await interaction.reply({
          embeds: [createEmbed({
            title: "⛔ Permission Denied",
            description: "Only administrators can reload commands.",
            color: "#FF0000"
          })],
          ephemeral: true
        });
        return;
      }
      
      await interaction.deferReply();
      
      try {
        // Force reload commands
        await this.reloadCommands(interaction, client);
      } catch (error) {
        logger.error(`Error reloading commands: ${error.message}`);
        await interaction.editReply({
          embeds: [createEmbed({
            title: "❌ Error",
            description: `Failed to reload commands: ${error.message}`,
            color: "#FF0000"
          })]
        });
      }
      return;
    }
    
    // Regular ping command logic
    const sent = await interaction.reply({ 
      embeds: [createEmbed({
        title: "🏓 Pinging...",
        description: "Calculating ping...",
        color: "#FFCC00"
      })],
      fetchReply: true 
    });
    
    const pingMs = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);
    
    const uptime = this.formatUptime(client.uptime);
    const guildCount = client.guilds.cache.size;
    const userCount = client.users.cache.size;
    
    await interaction.editReply({
      embeds: [createEmbed({
        title: "🏓 Pong!",
        description: "Bot is online and responsive.",
        fields: [
          { name: "Message Latency", value: `${pingMs}ms`, inline: true },
          { name: "API Latency", value: `${apiPing}ms`, inline: true },
          { name: "Uptime", value: uptime, inline: true },
          { name: "Servers", value: guildCount.toString(), inline: true },
          { name: "Users", value: userCount.toString(), inline: true },
          { name: "Memory Usage", value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true }
        ],
        footer: { text: `Discord.js v${require('discord.js').version}` }
      })]
    });
  },
  
  /**
   * Format uptime into a readable string
   * @param {number} ms - Uptime in milliseconds
   * @returns {string} Formatted uptime string
   */
  formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
  },
  
  /**
   * Reload all commands
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async reloadCommands(interaction, client) {
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN || process.env.TOKEN);
    
    try {
      // Step 1: Delete all global commands
      await interaction.editReply({
        embeds: [createEmbed({
          title: "🔄 Reloading Commands",
          description: "Step 1/3: Deleting existing global commands...",
          color: "#FFCC00"
        })]
      });
      
      // Delete all existing global commands
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      
      // Step 2: Fetch all commands to register
      await interaction.editReply({
        embeds: [createEmbed({
          title: "🔄 Reloading Commands",
          description: "Step 2/3: Preparing command data...",
          color: "#FFCC00"
        })]
      });
      
      const commands = [];
      client.commands.forEach(command => {
        if (command.data) {
          commands.push(command.data.toJSON());
        }
      });
      
      // Step 3: Register all commands globally
      await interaction.editReply({
        embeds: [createEmbed({
          title: "🔄 Reloading Commands",
          description: "Step 3/3: Registering commands globally...",
          color: "#FFCC00"
        })]
      });
      
      // Register all commands globally
      const data = await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      
      // Report success
      await interaction.editReply({
        embeds: [createEmbed({
          title: "✅ Commands Reloaded",
          description: `Successfully registered ${data.length} commands globally.`,
          color: "#00FF00"
        })]
      });
      
      logger.info(`${interaction.user.tag} reloaded ${data.length} commands`);
    } catch (error) {
      logger.error(`Error reloading commands: ${error.message}`);
      throw error;
    }
  }
};