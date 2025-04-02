const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Manage modmail threads')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand => 
      subcommand
        .setName('reply')
        .setDescription('Reply to the current modmail thread')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('close')
        .setDescription('Close the current modmail thread')
        .addStringOption(option => 
          option
            .setName('reason')
            .setDescription('Reason for closing the thread')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('block')
        .setDescription('Block a user from using modmail')
        .addUserOption(option => 
          option
            .setName('user')
            .setDescription('User to block')
            .setRequired(true)
        )
        .addStringOption(option => 
          option
            .setName('reason')
            .setDescription('Reason for blocking')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('unblock')
        .setDescription('Unblock a user from using modmail')
        .addUserOption(option => 
          option
            .setName('user')
            .setDescription('User to unblock')
            .setRequired(true)
        )
    ),
  
  async execute(interaction, client) {
    try {
      // Get guild settings to check if modmail is enabled
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Check if modmail is enabled for this guild
      if (!guildSettings.isModmailEnabled()) {
        await interaction.reply({
          embeds: [createErrorEmbed('Modmail is not enabled on this server. Ask an administrator to set it up using the `/setup` command.', 'Modmail')],
          ephemeral: true
        });
        return;
      }
      
      // Special case for block/unblock commands which can be used outside of modmail channels
      if (interaction.options.getSubcommand() === 'block' || interaction.options.getSubcommand() === 'unblock') {
        // These commands require Administrator or Manager Server permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
            !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({
            embeds: [createErrorEmbed('You need Administrator or Manage Server permissions to use this command.', 'Modmail')],
            ephemeral: true
          });
          return;
        }
      } else {
        // For other commands, check if this is a modmail channel
        if (!interaction.channel.name.startsWith('modmail-')) {
          await interaction.reply({
            embeds: [createErrorEmbed('This command can only be used in modmail channels.', 'Modmail')],
            ephemeral: true
          });
          return;
        }
      }
      
      // Get the active thread for this channel
      let threadInfo = null;
      let userId = null;
      
      // Initialize modmail collections if they don't exist
      if (!client.activeModmailThreads) {
        client.activeModmailThreads = new Map();
      }
      
      if (!client.blockedModmailUsers) {
        client.blockedModmailUsers = new Set();
      }
      
      // Find the thread that corresponds to this channel
      for (const [id, thread] of client.activeModmailThreads.entries()) {
        if (thread.channelId === interaction.channel.id) {
          threadInfo = thread;
          userId = id;
          break;
        }
      }
      
      if (!threadInfo && interaction.options.getSubcommand() !== 'block' && interaction.options.getSubcommand() !== 'unblock') {
        await interaction.reply({
          embeds: [createErrorEmbed('This channel is not associated with an active modmail thread.', 'Modmail')],
          ephemeral: true
        });
        return;
      }
      
      // Handle subcommands
      switch (interaction.options.getSubcommand()) {
        case 'reply':
          await this.handleReply(interaction, client, userId);
          break;
          
        case 'close':
          await this.handleClose(interaction, client, userId, threadInfo);
          break;
          
        case 'block':
          await this.handleBlock(interaction, client);
          break;
          
        case 'unblock':
          await this.handleUnblock(interaction, client);
          break;
      }
      
    } catch (error) {
      logger.error(`Error in modmail command: ${error.message}`);
      
      await interaction.reply({
        embeds: [createErrorEmbed('There was an error processing your command.', 'Modmail')],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle the reply subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {String} userId - ID of the user associated with the thread
   */
  async handleReply(interaction, client, userId) {
    try {
      // Show a modal to get the reply content
      const modal = new ModalBuilder()
        .setCustomId(`modmail_reply_${userId}`)
        .setTitle('Reply to Modmail');
      
      const contentInput = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Message')
        .setPlaceholder('Type your reply here...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);
      
      const contentRow = new ActionRowBuilder().addComponents(contentInput);
      modal.addComponents(contentRow);
      
      await interaction.showModal(modal);
      
    } catch (error) {
      logger.error(`Error showing modmail reply modal: ${error.message}`);
      
      await interaction.reply({
        embeds: [createErrorEmbed('There was an error opening the reply form.', 'Modmail')],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle the close subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   * @param {String} userId - ID of the user associated with the thread
   * @param {Object} threadInfo - Thread information
   */
  async handleClose(interaction, client, userId, threadInfo) {
    try {
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      // Try to notify the user that the thread is being closed
      try {
        const user = await client.users.fetch(userId);
        
        const closeEmbed = createEmbed({
          title: '📝 Modmail Thread Closed',
          description: 'Your modmail thread has been closed by a staff member.',
          fields: [
            {
              name: 'Reason',
              value: reason
            },
            {
              name: 'Need more help?',
              value: 'You can send another message anytime to open a new modmail thread.'
            }
          ],
          color: '#F04747', // Red
          timestamp: true
        });
        
        await user.send({ embeds: [closeEmbed] });
      } catch (error) {
        logger.error(`Could not notify user ${userId} about thread closure: ${error.message}`);
      }
      
      // Create a closed notification embed for the channel
      const closedEmbed = createEmbed({
        title: '🔒 Thread Closed',
        description: `This modmail thread has been closed by ${interaction.user.tag}.`,
        fields: [
          {
            name: 'User',
            value: `${threadInfo.userName} (${userId})`,
            inline: true
          },
          {
            name: 'Reason',
            value: reason,
            inline: true
          },
          {
            name: 'Thread Duration',
            value: this.getTimeDifference(threadInfo.createdAt, new Date()),
            inline: true
          }
        ],
        color: '#F04747', // Red
        timestamp: true
      });
      
      await interaction.reply({ embeds: [closedEmbed] });
      
      // Remove from active threads
      client.activeModmailThreads.delete(userId);
      
      // Archive the channel (optional, depends on preference)
      // Alternatively, you could delete it after a certain time
      setTimeout(async () => {
        try {
          await interaction.channel.send('This channel will be deleted in 10 seconds.');
          
          setTimeout(async () => {
            try {
              await interaction.channel.delete(`Modmail thread closed by ${interaction.user.tag}`);
            } catch (err) {
              logger.error(`Could not delete modmail channel: ${err.message}`);
            }
          }, 10000);
        } catch (err) {
          logger.error(`Error sending pre-delete message: ${err.message}`);
        }
      }, 5000);
      
      logger.info(`Modmail thread with ${threadInfo.userName} (${userId}) closed by ${interaction.user.tag}`);
      
    } catch (error) {
      logger.error(`Error closing modmail thread: ${error.message}`);
      
      await interaction.reply({
        embeds: [createErrorEmbed('There was an error closing this thread.', 'Modmail')],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle the block subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async handleBlock(interaction, client) {
    try {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      // Check if user is already blocked
      if (client.blockedModmailUsers.has(user.id)) {
        await interaction.reply({
          embeds: [createErrorEmbed(`${user.tag} is already blocked from using modmail.`, 'Modmail')],
          ephemeral: true
        });
        return;
      }
      
      // Add user to blocked list
      client.blockedModmailUsers.add(user.id);
      
      // Create a confirmation embed
      const blockEmbed = createSuccessEmbed(
        `${user.tag} (${user.id}) has been blocked from using the modmail system.\nReason: ${reason}`,
        '🚫 User Blocked'
      );
      
      await interaction.reply({ embeds: [blockEmbed] });
      
      // Close any active threads from this user
      let threadInfo = null;
      let threadExists = false;
      
      for (const [id, thread] of client.activeModmailThreads.entries()) {
        if (id === user.id) {
          threadInfo = thread;
          threadExists = true;
          break;
        }
      }
      
      if (threadExists) {
        // Try to notify the user about being blocked
        try {
          const blockedEmbed = createEmbed({
            title: '🚫 You Have Been Blocked',
            description: 'You have been blocked from using the modmail system.',
            fields: [
              {
                name: 'Reason',
                value: reason
              }
            ],
            color: '#F04747', // Red
            timestamp: true
          });
          
          await user.send({ embeds: [blockedEmbed] });
        } catch (error) {
          logger.error(`Could not notify user ${user.id} about being blocked: ${error.message}`);
        }
        
        // Close and delete the thread's channel
        try {
          const channel = await interaction.guild.channels.fetch(threadInfo.channelId);
          
          if (channel) {
            await channel.send({
              embeds: [createEmbed({
                title: '🚫 User Blocked',
                description: `This thread is being closed because ${user.tag} has been blocked from using modmail.`,
                fields: [
                  {
                    name: 'Blocked By',
                    value: interaction.user.tag,
                    inline: true
                  },
                  {
                    name: 'Reason',
                    value: reason,
                    inline: true
                  }
                ],
                color: '#F04747',
                timestamp: true
              })]
            });
            
            // Delete the channel after a short delay
            setTimeout(async () => {
              try {
                await channel.delete(`User ${user.tag} blocked from modmail by ${interaction.user.tag}`);
              } catch (err) {
                logger.error(`Could not delete channel for blocked user: ${err.message}`);
              }
            }, 5000);
          }
        } catch (error) {
          logger.error(`Error closing thread for blocked user: ${error.message}`);
        }
        
        // Remove from active threads
        client.activeModmailThreads.delete(user.id);
      }
      
      logger.info(`User ${user.tag} (${user.id}) blocked from modmail by ${interaction.user.tag}`);
      
    } catch (error) {
      logger.error(`Error blocking user from modmail: ${error.message}`);
      
      await interaction.reply({
        embeds: [createErrorEmbed('There was an error blocking this user.', 'Modmail')],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle the unblock subcommand
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async handleUnblock(interaction, client) {
    try {
      const user = interaction.options.getUser('user');
      
      // Check if user is actually blocked
      if (!client.blockedModmailUsers.has(user.id)) {
        await interaction.reply({
          embeds: [createErrorEmbed(`${user.tag} is not currently blocked from using modmail.`, 'Modmail')],
          ephemeral: true
        });
        return;
      }
      
      // Remove user from blocked list
      client.blockedModmailUsers.delete(user.id);
      
      // Create a confirmation embed
      const unblockEmbed = createSuccessEmbed(
        `${user.tag} (${user.id}) has been unblocked and can now use the modmail system again.`,
        '✅ User Unblocked'
      );
      
      await interaction.reply({ embeds: [unblockEmbed] });
      
      // Optionally, notify the user they've been unblocked
      try {
        const notifyEmbed = createEmbed({
          title: '✅ Modmail Access Restored',
          description: 'You have been unblocked and can now use the modmail system again.',
          color: '#43B581', // Green
          timestamp: true
        });
        
        await user.send({ embeds: [notifyEmbed] });
      } catch (error) {
        logger.error(`Could not notify user ${user.id} about being unblocked: ${error.message}`);
      }
      
      logger.info(`User ${user.tag} (${user.id}) unblocked from modmail by ${interaction.user.tag}`);
      
    } catch (error) {
      logger.error(`Error unblocking user from modmail: ${error.message}`);
      
      await interaction.reply({
        embeds: [createErrorEmbed('There was an error unblocking this user.', 'Modmail')],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle modal submission for modmail replies
   * @param {Object} interaction - Modal submission interaction
   * @param {Object} client - Discord client
   */
  async handleModal(interaction, client) {
    try {
      // Get the user ID from the custom ID (format: modmail_reply_[userId])
      const userId = interaction.customId.split('_')[2];
      
      // Get the message content from the modal
      const content = interaction.fields.getTextInputValue('content');
      
      // Try to send the message to the user
      try {
        const user = await client.users.fetch(userId);
        
        // Create an embed for the user
        const replyEmbed = createEmbed({
          author: {
            name: `${interaction.user.tag} (Staff)`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          },
          description: content,
          color: '#43B581', // Green
          timestamp: true,
          footer: 'Staff Reply'
        });
        
        await user.send({ embeds: [replyEmbed] });
        
        // Create an embed for the channel to show the sent message
        const staffEmbed = createEmbed({
          author: {
            name: `${interaction.user.tag} (Staff)`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          },
          description: content,
          color: '#5865F2', // Blue
          timestamp: true,
          footer: 'Staff Reply'
        });
        
        await interaction.reply({ embeds: [staffEmbed] });
        
        logger.info(`Staff ${interaction.user.tag} sent modmail reply to ${user.tag} (${userId})`);
        
      } catch (error) {
        logger.error(`Error sending modmail reply to user: ${error.message}`);
        
        await interaction.reply({
          embeds: [createErrorEmbed(`Could not send message to user. They may have DMs disabled or have blocked the bot.\n\nError: ${error.message}`, 'Modmail')],
          ephemeral: true
        });
      }
      
    } catch (error) {
      logger.error(`Error processing modmail reply: ${error.message}`);
      
      await interaction.reply({
        embeds: [createErrorEmbed('There was an error sending your reply.', 'Modmail')],
        ephemeral: true
      });
    }
  },
  
  /**
   * Calculate time difference between two dates in a human-readable format
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @returns {String} Formatted time difference
   */
  getTimeDifference(start, end) {
    const diff = Math.abs(end - start);
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
};