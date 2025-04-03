/**
 * Modmail Stats Command
 * Shows statistics about modmail usage in the server
 */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createInfoEmbed, createErrorEmbed } = require('../../utils/embedBuilder');
const moment = require('moment');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modmail-stats')
    .setDescription('View statistics about modmail usage in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => 
      subcommand
        .setName('overview')
        .setDescription('View overall modmail statistics')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('timeframe')
        .setDescription('View statistics for a specific time period')
        .addStringOption(option => 
          option.setName('period')
            .setDescription('Time period to check')
            .setRequired(true)
            .addChoices(
              { name: 'Today', value: 'today' },
              { name: 'Past Week', value: 'week' },
              { name: 'Past Month', value: 'month' },
              { name: 'All Time', value: 'all' }
            )
        )
    ),
  
  cooldown: 5,
  guildOnly: true,
  
  async execute(interaction, client) {
    // Defer the reply as this might take a moment
    await interaction.deferReply();
    
    try {
      const subcommand = interaction.options.getSubcommand();
      
      // Get guild settings
      const [guildSettings] = await client.db.Guild.findOrCreate({
        where: { guildId: interaction.guild.id },
        defaults: { guildName: interaction.guild.name }
      });
      
      // Check if modmail is enabled
      const modmailEnabled = guildSettings.getSetting('modmail.enabled');
      
      if (!modmailEnabled) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Modmail is not enabled in this server. Use `/modmail-setup enable` to set it up first.',
            'Modmail Not Enabled'
          )]
        });
      }
      
      switch (subcommand) {
        case 'overview':
          await this.handleOverview(interaction, client);
          break;
        case 'timeframe':
          await this.handleTimeframe(interaction, client);
          break;
      }
    } catch (error) {
      console.error('Error in modmail-stats command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Failed to get modmail stats: ${error.message}`)]
      });
    }
  },
  
  async handleOverview(interaction, client) {
    // Get total thread count
    const totalThreadCount = await client.db.ModmailThread.count({
      where: {
        guildId: interaction.guild.id
      }
    });
    
    // Get count of active threads
    const activeThreadCount = await client.db.ModmailThread.count({
      where: {
        guildId: interaction.guild.id,
        open: true
      }
    });
    
    // Get count of closed threads
    const closedThreadCount = totalThreadCount - activeThreadCount;
    
    // Get stats about messages per thread
    const threads = await client.db.ModmailThread.findAll({
      where: {
        guildId: interaction.guild.id
      },
      attributes: ['messageCount']
    });
    
    // Calculate average messages per thread
    let avgMessagesPerThread = 0;
    if (threads.length > 0) {
      const totalMessages = threads.reduce((sum, thread) => sum + (thread.messageCount || 0), 0);
      avgMessagesPerThread = (totalMessages / threads.length).toFixed(1);
    }
    
    // Get most recent threads
    const recentThreads = await client.db.ModmailThread.findAll({
      where: {
        guildId: interaction.guild.id
      },
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    // Create stats embed
    const statsEmbed = createInfoEmbed(
      `Here are the modmail statistics for ${interaction.guild.name}:\n\n` +
      `**Total Threads:** ${totalThreadCount}\n` +
      `**Active Threads:** ${activeThreadCount}\n` +
      `**Closed Threads:** ${closedThreadCount}\n` +
      `**Avg. Messages Per Thread:** ${avgMessagesPerThread}`,
      'Modmail Statistics'
    );
    
    // Add recent threads if there are any
    if (recentThreads.length > 0) {
      const recentThreadsList = await Promise.all(recentThreads.map(async thread => {
        // Try to get username
        try {
          const user = await client.users.fetch(thread.userId).catch(() => null);
          const username = user ? user.tag : 'Unknown User';
          const status = thread.open ? '🟢 Active' : '🔴 Closed';
          const date = moment(thread.createdAt).format('MMM DD, YYYY');
          return `• ${status} | ${username} | ${date}`;
        } catch (error) {
          return `• ${thread.open ? '🟢 Active' : '🔴 Closed'} | Unknown User | ${moment(thread.createdAt).format('MMM DD, YYYY')}`;
        }
      }));
      
      statsEmbed.addFields({
        name: 'Recent Threads',
        value: recentThreadsList.join('\n')
      });
    }
    
    await interaction.editReply({ embeds: [statsEmbed] });
  },
  
  async handleTimeframe(interaction, client) {
    const period = interaction.options.getString('period');
    
    // Calculate date range based on period
    let startDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }
    
    // Query for threads in the time period
    const threads = await client.db.ModmailThread.findAll({
      where: {
        guildId: interaction.guild.id,
        createdAt: {
          [Op.gte]: startDate
        }
      }
    });
    
    // Calculate statistics
    const totalThreads = threads.length;
    const activeThreads = threads.filter(thread => thread.open).length;
    const closedThreads = totalThreads - activeThreads;
    
    // Calculate average response time if possible (using createdAt and closedAt)
    let avgResponseTime = 'N/A';
    const closedThreadsWithBothDates = threads.filter(thread => !thread.open && thread.closedAt);
    
    if (closedThreadsWithBothDates.length > 0) {
      const totalResponseTimeMs = closedThreadsWithBothDates.reduce((sum, thread) => {
        const created = new Date(thread.createdAt).getTime();
        const closed = new Date(thread.closedAt).getTime();
        return sum + (closed - created);
      }, 0);
      
      const avgResponseTimeMs = totalResponseTimeMs / closedThreadsWithBothDates.length;
      
      // Format time nicely
      const avgResponseTimeMins = Math.floor(avgResponseTimeMs / (60 * 1000));
      
      if (avgResponseTimeMins < 60) {
        avgResponseTime = `${avgResponseTimeMins} minutes`;
      } else if (avgResponseTimeMins < 24 * 60) {
        avgResponseTime = `${Math.floor(avgResponseTimeMins / 60)} hours, ${avgResponseTimeMins % 60} minutes`;
      } else {
        const days = Math.floor(avgResponseTimeMins / (24 * 60));
        const hours = Math.floor((avgResponseTimeMins % (24 * 60)) / 60);
        avgResponseTime = `${days} days, ${hours} hours`;
      }
    }
    
    // Calculate average messages per thread
    let avgMessagesPerThread = 0;
    if (totalThreads > 0) {
      const totalMessages = threads.reduce((sum, thread) => sum + (thread.messageCount || 0), 0);
      avgMessagesPerThread = (totalMessages / totalThreads).toFixed(1);
    }
    
    // Prepare period name for display
    let periodName;
    switch (period) {
      case 'today':
        periodName = 'Today';
        break;
      case 'week':
        periodName = 'Past Week';
        break;
      case 'month':
        periodName = 'Past Month';
        break;
      case 'all':
        periodName = 'All Time';
        break;
    }
    
    // Create stats embed
    const statsEmbed = createInfoEmbed(
      `Here are the modmail statistics for ${periodName}:\n\n` +
      `**Total Threads:** ${totalThreads}\n` +
      `**Active Threads:** ${activeThreads}\n` +
      `**Closed Threads:** ${closedThreads}\n` +
      `**Avg. Messages Per Thread:** ${avgMessagesPerThread}\n` +
      `**Avg. Resolution Time:** ${avgResponseTime}`,
      `Modmail Statistics - ${periodName}`
    );
    
    await interaction.editReply({ embeds: [statsEmbed] });
  }
};