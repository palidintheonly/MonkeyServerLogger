/**
 * Modmail Setup Command
 * Sets up the modmail system for a server
 */
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modmail-setup')
    .setDescription('Configure the modmail system for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => 
      subcommand
        .setName('enable')
        .setDescription('Enable the modmail system')
        .addChannelOption(option => 
          option.setName('category')
            .setDescription('Category where modmail threads will be created')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption(option => 
          option.setName('staff_role')
            .setDescription('Role that can view and respond to modmail threads')
            .setRequired(true)
        )
        .addChannelOption(option => 
          option.setName('log_channel')
            .setDescription('Channel where modmail logs will be sent')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('disable')
        .setDescription('Disable the modmail system')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('status')
        .setDescription('Check the current status of the modmail system')
    ),
  
  cooldown: 5,
  
  async execute(interaction, client) {
    // Defer the reply as this might take a moment
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    // Get or create guild settings using proper format
    const [guildSettings] = await client.db.Guild.findOrCreate({
      where: { guildId: interaction.guild.id },
      defaults: { 
        guildId: interaction.guild.id,
        guildName: interaction.guild.name 
      }
    });
    
    try {
      switch (subcommand) {
        case 'enable':
          await this.handleEnable(interaction, client, guildSettings);
          break;
        case 'disable':
          await this.handleDisable(interaction, client, guildSettings);
          break;
        case 'status':
          await this.handleStatus(interaction, client, guildSettings);
          break;
      }
    } catch (error) {
      console.error('Error in modmail-setup command:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(`Failed to ${subcommand} modmail: ${error.message}`)]
      });
    }
  },
  
  async handleEnable(interaction, client, guildSettings) {
    const category = interaction.options.getChannel('category');
    const staffRole = interaction.options.getRole('staff_role');
    const logChannel = interaction.options.getChannel('log_channel');
    
    // Check permissions in the category
    const botMember = interaction.guild.members.cache.get(client.user.id);
    const botPermissions = category.permissionsFor(botMember);
    
    const requiredPermissions = [
      'ViewChannel',
      'ManageChannels',
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'AddReactions'
    ];
    
    const missingPermissions = requiredPermissions.filter(perm => !botPermissions.has(perm));
    
    if (missingPermissions.length > 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          `I'm missing the following required permissions in the category: ${missingPermissions.join(', ')}`,
          'Missing Permissions'
        )]
      });
    }
    
    // Update both settings JSON and dedicated column
    await guildSettings.updateSettings({
      modmail: {
        enabled: true,
        categoryId: category.id,
        staffRoleId: staffRole.id,
        logChannelId: logChannel ? logChannel.id : null
      }
    });
    
    // Also update the dedicated column to keep them in sync
    guildSettings.modmailEnabled = true;
    guildSettings.modmailCategoryId = category.id;
    await guildSettings.save();
    
    // Set category permissions to be private but accessible by staff role
    try {
      // Remove view permission for @everyone
      await category.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        ViewChannel: false
      });
      
      // Add permissions for the staff role
      await category.permissionOverwrites.edit(staffRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
      });
      
      // Ensure bot has permissions
      await category.permissionOverwrites.edit(client.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true,
        EmbedLinks: true,
        AttachFiles: true
      });
      
    } catch (error) {
      console.error('Error setting permissions:', error);
      // Continue anyway, as this isn't critical
    }
    
    // Send success message
    await interaction.editReply({
      embeds: [createSuccessEmbed(
        `Modmail system enabled for this server!\n\n` +
        `**Category:** ${category}\n` +
        `**Staff Role:** ${staffRole}\n` +
        `**Log Channel:** ${logChannel ? logChannel : 'None set'}`,
        'Modmail Enabled'
      )]
    });
  },
  
  async handleDisable(interaction, client, guildSettings) {
    // Check if modmail is enabled
    const modmailEnabled = guildSettings.getSetting('modmail.enabled');
    
    if (!modmailEnabled) {
      return interaction.editReply({
        embeds: [createInfoEmbed(
          'Modmail is already disabled for this server.',
          'No Action Needed'
        )]
      });
    }
    
    // Update both settings JSON and dedicated column
    await guildSettings.updateSettings({
      modmail: {
        enabled: false
      }
    });
    
    // Also update the dedicated column to keep them in sync
    guildSettings.modmailEnabled = false;
    await guildSettings.save();
    
    // Send success message
    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Modmail system has been disabled for this server. Users will no longer be able to create modmail threads here.',
        'Modmail Disabled'
      )]
    });
    
    // Close any active threads
    try {
      const activeThreads = await client.db.ModmailThread.findAll({
        where: {
          guildId: interaction.guild.id,
          open: true
        }
      });
      
      if (activeThreads.length > 0) {
        // Create a close reason and notify user about it
        const reason = 'Modmail system was disabled by an administrator';
        
        for (const thread of activeThreads) {
          // Close thread in database
          await thread.closeThread(interaction.user.id, reason);
          
          // Try to get the channel to send a closing message
          const channel = await interaction.guild.channels.fetch(thread.id).catch(() => null);
          if (channel) {
            await channel.send({
              content: `📬 This modmail thread has been closed: ${reason}`
            });
          }
          
          // Try to DM the user that their thread was closed
          try {
            const user = await client.users.fetch(thread.userId);
            await user.send({
              embeds: [createInfoEmbed(
                `Your modmail thread with **${interaction.guild.name}** has been closed because the modmail system was disabled.`,
                'Modmail Thread Closed'
              )]
            });
          } catch (dmError) {
            // Ignore errors from DM failures
          }
        }
        
        await interaction.followUp({
          embeds: [createInfoEmbed(
            `Closed ${activeThreads.length} active modmail thread(s).`,
            'Threads Closed'
          )]
        });
      }
    } catch (error) {
      console.error('Error closing threads:', error);
      // This isn't critical so we'll just log it
    }
  },
  
  async handleStatus(interaction, client, guildSettings) {
    const modmailSettings = guildSettings.getSetting('modmail') || {};
    const enabled = modmailSettings.enabled || false;
    
    if (!enabled) {
      return interaction.editReply({
        embeds: [createInfoEmbed(
          'The modmail system is currently **disabled** for this server.\n\n' +
          'Use `/modmail-setup enable` to set it up.',
          'Modmail Status'
        )]
      });
    }
    
    // Get current settings objects
    const category = modmailSettings.categoryId ? 
      await interaction.guild.channels.fetch(modmailSettings.categoryId).catch(() => null) : null;
    
    const staffRole = modmailSettings.staffRoleId ?
      await interaction.guild.roles.fetch(modmailSettings.staffRoleId).catch(() => null) : null;
    
    const logChannel = modmailSettings.logChannelId ?
      await interaction.guild.channels.fetch(modmailSettings.logChannelId).catch(() => null) : null;
    
    // Get count of active threads
    const activeThreadCount = await client.db.ModmailThread.count({
      where: {
        guildId: interaction.guild.id,
        open: true
      }
    });
    
    // Get total thread count
    const totalThreadCount = await client.db.ModmailThread.count({
      where: {
        guildId: interaction.guild.id
      }
    });
    
    // Build status message
    const statusEmbed = createInfoEmbed(
      `The modmail system is currently **enabled** for this server.\n\n` +
      `**Category:** ${category ? category : 'Not found (was it deleted?)'}\n` +
      `**Staff Role:** ${staffRole ? staffRole : 'Not found (was it deleted?)'}\n` +
      `**Log Channel:** ${logChannel ? logChannel : 'None set'}\n\n` +
      `**Active Threads:** ${activeThreadCount}\n` +
      `**Total Threads:** ${totalThreadCount}`,
      'Modmail Status'
    );
    
    // Check for issues
    const issues = [];
    
    if (!category) {
      issues.push('⚠️ The modmail category was not found. Was it deleted?');
    }
    
    if (!staffRole) {
      issues.push('⚠️ The staff role was not found. Was it deleted?');
    }
    
    if (logChannel && !logChannel.viewable) {
      issues.push('⚠️ I cannot access the log channel.');
    }
    
    if (category) {
      const botMember = interaction.guild.members.cache.get(client.user.id);
      const botPermissions = category.permissionsFor(botMember);
      
      const requiredPermissions = [
        'ViewChannel',
        'ManageChannels',
        'SendMessages', 
        'ReadMessageHistory'
      ];
      
      const missingPermissions = requiredPermissions.filter(perm => !botPermissions.has(perm));
      
      if (missingPermissions.length > 0) {
        issues.push(`⚠️ Missing permissions in category: ${missingPermissions.join(', ')}`);
      }
    }
    
    if (issues.length > 0) {
      statusEmbed.addFields({
        name: 'Issues Detected',
        value: issues.join('\n')
      });
    }
    
    await interaction.editReply({ embeds: [statusEmbed] });
  }
};