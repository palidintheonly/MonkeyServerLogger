const { createEmbed, createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const { ChannelType, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { Op } = require('sequelize');

module.exports = {
  name: 'messageCreate',
  once: false,
  processModmail: null, // Will be assigned in the processModmail function definition
  
  /**
   * Handle direct messages to the bot (modmail system)
   * @param {Object} message - Discord message object
   * @param {Object} client - Discord client instance
   */
  async execute(message, client) {
    // Ignore messages that aren't DMs or are from bots
    if (message.guild !== null || message.author.bot) return;
    
    try {
      logger.info(`Received DM from ${message.author.tag} (${message.author.id}): ${message.content}`);
      
      // Initialize collections if they don't exist
      if (!client.activeModmailThreads) {
        client.activeModmailThreads = new Map();
      }
      
      if (!client.pendingModmailMessages) {
        client.pendingModmailMessages = new Map();
      }
      
      // Check if this is a first-time message
      const isNewConversation = !client.activeModmailThreads?.has(message.author.id);
      
      // Check if user is blocked from modmail
      if (client.blockedModmailUsers && client.blockedModmailUsers.has(message.author.id)) {
        logger.info(`Blocked modmail from ${message.author.tag} (${message.author.id})`);
        // Only notify if they haven't been notified recently
        if (!client.notifiedBlockedUsers) {
          client.notifiedBlockedUsers = new Map();
        }
        
        const now = Date.now();
        const lastNotified = client.notifiedBlockedUsers.get(message.author.id) || 0;
        const oneHour = 3600000; // 1 hour in milliseconds
        
        if (now - lastNotified > oneHour) {
          await message.reply('You have been blocked from using the modmail system.');
          client.notifiedBlockedUsers.set(message.author.id, now);
        }
        return;
      }
      
      // Check if the user is awaiting server selection
      const pendingMessage = client.pendingModmailMessages.get(message.author.id);
      if (pendingMessage && pendingMessage.type === 'server_selection') {
        // The user sent a message instead of using the selection menu
        // Assume they want to continue with the default support server
        logger.info(`User ${message.author.tag} sent a message while awaiting server selection, using default server.`);
        
        const supportGuild = client.guilds.cache.get(process.env.SUPPORT_GUILD_ID);
        if (!supportGuild) {
          logger.error(`Default support guild not found: ${process.env.SUPPORT_GUILD_ID}`);
          await message.reply('The modmail system is not properly configured. Please contact the bot administrators.');
          return;
        }
        
        // Clear the pending message
        client.pendingModmailMessages.delete(message.author.id);
        
        // Continue with the default server
        await this.processModmail(message, client, supportGuild, isNewConversation);
        return;
      }
      
      // Find all servers with modmail enabled where the user is a member
      const userGuilds = [];
      
      // Get all guilds with modmail enabled from the database
      const guildsWithModmail = await models.Guild.findAll({
        where: {
          modmailEnabled: true
        }
      });
      
      // Filter to only include guilds where the user is a member
      for (const guildSetting of guildsWithModmail) {
        const guild = client.guilds.cache.get(guildSetting.guildId);
        if (guild) {
          try {
            // Check if the user is a member of this guild
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (member) {
              userGuilds.push({
                guild: guild,
                settings: guildSetting
              });
            }
          } catch (error) {
            // Ignore errors when fetching members - user might not be in the guild
            logger.debug(`Error checking if user is in guild ${guild.name}: ${error.message}`);
          }
        }
      }
      
      // If the user isn't in any guilds with modmail enabled
      if (userGuilds.length === 0) {
        logger.info(`User ${message.author.tag} is not in any servers with modmail enabled.`);
        await message.reply('You are not a member of any servers that have the modmail system enabled.');
        return;
      }
      
      // If the user is only in one guild with modmail enabled, use that
      if (userGuilds.length === 1) {
        const supportGuild = userGuilds[0].guild;
        await this.processModmail(message, client, supportGuild, isNewConversation);
        return;
      }
      
      // If the user is in multiple guilds with modmail enabled, ask which one they want to contact
      const selectOptions = userGuilds.map(({ guild }) => ({
        label: guild.name,
        value: guild.id,
        description: `Send your message to ${guild.name}`,
        emoji: '📬'
      }));
      
      // Create a select menu for server selection
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('modmail_server_select')
        .setPlaceholder('Select a server to contact')
        .addOptions(selectOptions);
      
      const row = new ActionRowBuilder().addComponents(selectMenu);
      
      const selectionEmbed = createEmbed({
        title: '📬 Server Selection',
        description: 'You are a member of multiple servers that use our modmail system. Please select which server you would like to contact:',
        color: '#5865F2',
        timestamp: true
      });
      
      const selectionMessage = await message.reply({
        embeds: [selectionEmbed],
        components: [row]
      });
      
      // Store the message in pending messages
      client.pendingModmailMessages.set(message.author.id, {
        type: 'server_selection',
        messageId: selectionMessage.id,
        content: message.content,
        attachments: message.attachments,
        timestamp: Date.now()
      });
      
      // Clean up the pending message after 5 minutes
      setTimeout(() => {
        if (client.pendingModmailMessages.has(message.author.id) && 
            client.pendingModmailMessages.get(message.author.id).messageId === selectionMessage.id) {
          client.pendingModmailMessages.delete(message.author.id);
        }
      }, 300000); // 5 minutes
      
      return;
    } catch (error) {
      logger.error(`Error in modmail system: ${error.message}`);
      await message.reply('There was an unexpected error in the modmail system. Please try again later.');
    }
  },
  
  /**
   * Process modmail message after server selection
   * @param {Object} message - Discord message object
   * @param {Object} client - Discord client instance
   * @param {Object} supportGuild - The selected guild for modmail
   * @param {Boolean} isNewConversation - Whether this is a new conversation
   */
  async processModmail(message, client, supportGuild, isNewConversation) {
    try {
      // Get guild settings to check if modmail is enabled
      const guildSettings = await models.Guild.findOrCreateGuild(supportGuild.id);
      
      if (!guildSettings.isModmailEnabled()) {
        logger.info(`Modmail not enabled for guild ${supportGuild.name}`);
        await message.reply('The modmail system is not enabled for this server. Please contact the server administrators directly.');
        return;
      }
      
      // Get the modmail category from database
      let modmailCategory;
      try {
        // Try to fetch from database first
        const categoryId = guildSettings.getModmailCategory();
        if (categoryId) {
          modmailCategory = await supportGuild.channels.fetch(categoryId).catch(() => null);
        }
        
        // If not found in database or not valid, find by name
        if (!modmailCategory) {
          modmailCategory = supportGuild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === 'MODMAIL TICKETS'
          );
        }
        
        // If still not found, create it
        if (!modmailCategory) {
          modmailCategory = await supportGuild.channels.create({
            name: 'MODMAIL TICKETS',
            type: ChannelType.GuildCategory,
            position: 0,
            permissionOverwrites: [
              {
                id: supportGuild.id, // @everyone role
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: supportGuild.roles.cache.find(r => r.name === 'Staff')?.id || supportGuild.ownerId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
              }
            ]
          });
          
          // Update the guild settings with the new category ID
          await guildSettings.update({ modmailCategoryId: modmailCategory.id });
          logger.info(`Created modmail category in support guild: ${modmailCategory.id}`);
        }
      } catch (error) {
        logger.error(`Error finding/creating modmail category: ${error.message}`);
        await message.reply('There was an error processing your message. Please try again later.');
        return;
      }
      
      // If this is a new conversation, create a new thread for this user
      if (isNewConversation) {
        try {
          // Create new channel for this conversation
          const threadChannel = await supportGuild.channels.create({
            name: `modmail-${message.author.username}`,
            type: ChannelType.GuildText,
            parent: modmailCategory.id,
            topic: `Modmail thread with ${message.author.tag} (${message.author.id})`
          });
          
          // Store the thread info
          client.activeModmailThreads.set(message.author.id, {
            channelId: threadChannel.id,
            userId: message.author.id,
            userName: message.author.tag,
            createdAt: new Date(),
            lastActivity: new Date(),
            status: 'open',
            guildId: supportGuild.id,
            autoCloseTimer: null,
            warningsSent: {
              thirty: false,
              ten: false
            }
          });
          
          // Set up auto-close timer
          this.setupAutoCloseTimer(message.author.id, client);
          
          // Send initial information to the thread
          const userInfoEmbed = createEmbed({
            title: `New Modmail Thread - ${message.author.tag}`,
            description: 'A new modmail conversation has been started.',
            thumbnail: message.author.displayAvatarURL({ dynamic: true }),
            fields: [
              {
                name: 'User',
                value: `${message.author.tag} (${message.author.id})`,
                inline: true
              },
              {
                name: 'Account Created',
                value: `<t:${Math.floor(message.author.createdTimestamp / 1000)}:R>`,
                inline: true
              },
              {
                name: 'Commands',
                value: '`/modmail close` - Close this thread\n`/modmail reply` - Reply to user\n`/modmail block` - Block user from modmail',
                inline: false
              }
            ],
            color: '#5865F2',
            timestamp: true
          });
          
          await threadChannel.send({ embeds: [userInfoEmbed] });
          
          // Send the first message to the thread
          const initialMessageEmbed = createEmbed({
            author: {
              name: message.author.tag,
              iconURL: message.author.displayAvatarURL({ dynamic: true })
            },
            description: message.content || '[No text content]',
            color: '#5865F2',
            timestamp: true,
            footer: `User ID: ${message.author.id}`
          });
          
          // Handle attachments if any
          if (message.attachments.size > 0) {
            initialMessageEmbed.addFields([{
              name: 'Attachments',
              value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n')
            }]);
          }
          
          await threadChannel.send({ embeds: [initialMessageEmbed] });
          
          // Acknowledge receipt to the user
          const replyEmbed = createEmbed({
            title: '✅ Message Received',
            description: 'Thank you for contacting us! Your message has been sent to our support team. A staff member will reply to you as soon as possible.',
            color: '#43B581', // Green
            timestamp: true
          });
          
          await message.reply({ embeds: [replyEmbed] });
          
          logger.info(`Created new modmail thread for ${message.author.tag} in channel ${threadChannel.id}`);
          
        } catch (error) {
          logger.error(`Error creating modmail thread: ${error.message}`);
          await message.reply('There was an error processing your modmail request. Please try again later.');
          return;
        }
      } else {
        // This is a continuation of an existing conversation
        const threadInfo = client.activeModmailThreads.get(message.author.id);
        
        // Verify the thread still exists
        try {
          const threadChannel = await supportGuild.channels.fetch(threadInfo.channelId);
          
          // Forward the message to the thread
          const messageEmbed = createEmbed({
            author: {
              name: message.author.tag,
              iconURL: message.author.displayAvatarURL({ dynamic: true })
            },
            description: message.content || '[No text content]',
            color: '#5865F2',
            timestamp: true,
            footer: `User ID: ${message.author.id}`
          });
          
          // Handle attachments if any
          if (message.attachments.size > 0) {
            messageEmbed.addFields([{
              name: 'Attachments',
              value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n')
            }]);
          }
          
          await threadChannel.send({ embeds: [messageEmbed] });
          
          // Send a simple acknowledgement
          await message.react('✅');
          
          // Update last activity time and reset auto-close timer
          threadInfo.lastActivity = new Date();
          
          // Clear any existing timer and reset warnings
          this.resetAutoCloseTimer(message.author.id, client);
          
          // Set up new auto-close timer
          this.setupAutoCloseTimer(message.author.id, client);
          
        } catch (error) {
          logger.error(`Error forwarding message to modmail thread: ${error.message}`);
          
          // The thread might have been deleted, create a new one
          client.activeModmailThreads.delete(message.author.id);
          
          // Re-run this function to create a new thread
          await this.processModmail(message, client, supportGuild, true);
        }
      }
      
    } catch (error) {
      logger.error(`Error in modmail system: ${error.message}`);
      await message.reply('There was an unexpected error in the modmail system. Please try again later.');
    }
  },
  
  /**
   * Set up auto-close timer for a modmail thread
   * @param {String} userId - User ID associated with the thread
   * @param {Object} client - Discord client instance
   */
  setupAutoCloseTimer(userId, client) {
    const threadInfo = client.activeModmailThreads.get(userId);
    if (!threadInfo) return;
    
    // Clear any existing timer
    if (threadInfo.autoCloseTimer) {
      clearTimeout(threadInfo.autoCloseTimer);
    }
    
    // Auto-close after 24 hours of inactivity
    const idleTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    threadInfo.autoCloseTimer = setTimeout(async () => {
      try {
        const guild = client.guilds.cache.get(threadInfo.guildId);
        if (!guild) return;
        
        const threadChannel = await guild.channels.fetch(threadInfo.channelId).catch(() => null);
        if (!threadChannel) {
          // Channel no longer exists, remove thread from tracking
          client.activeModmailThreads.delete(userId);
          return;
        }
        
        // Close the thread
        await threadChannel.send({
          embeds: [
            createEmbed({
              title: '🔒 Thread Auto-Closed',
              description: 'This modmail thread has been automatically closed due to 24 hours of inactivity.',
              color: '#FF5555',
              timestamp: true
            })
          ]
        });
        
        // Archive or rename the channel
        await threadChannel.setName(`closed-${threadChannel.name}`);
        
        // Remove from active threads
        client.activeModmailThreads.delete(userId);
        
        logger.info(`Auto-closed modmail thread for ${threadInfo.userName} after 24 hours of inactivity.`);
      } catch (error) {
        logger.error(`Error auto-closing modmail thread: ${error.message}`);
      }
    }, idleTimeout);
    
    // Set warning timers (30 minutes and 10 minutes before closing)
    setTimeout(async () => {
      try {
        const currentInfo = client.activeModmailThreads.get(userId);
        if (!currentInfo || currentInfo.warningsSent.thirty) return;
        
        const guild = client.guilds.cache.get(currentInfo.guildId);
        if (!guild) return;
        
        const threadChannel = await guild.channels.fetch(currentInfo.channelId).catch(() => null);
        if (!threadChannel) return;
        
        // Send warning
        await threadChannel.send({
          embeds: [
            createEmbed({
              title: '⚠️ Inactivity Warning',
              description: 'This modmail thread will be automatically closed in 30 minutes due to inactivity.',
              color: '#FFA500',
              timestamp: true
            })
          ]
        });
        
        // Mark warning as sent
        currentInfo.warningsSent.thirty = true;
      } catch (error) {
        logger.error(`Error sending 30-minute warning: ${error.message}`);
      }
    }, idleTimeout - (30 * 60 * 1000)); // 30 minutes before timeout
    
    // Ten minute warning
    setTimeout(async () => {
      try {
        const currentInfo = client.activeModmailThreads.get(userId);
        if (!currentInfo || currentInfo.warningsSent.ten) return;
        
        const guild = client.guilds.cache.get(currentInfo.guildId);
        if (!guild) return;
        
        const threadChannel = await guild.channels.fetch(currentInfo.channelId).catch(() => null);
        if (!threadChannel) return;
        
        // Send warning
        await threadChannel.send({
          embeds: [
            createEmbed({
              title: '⚠️ Final Warning',
              description: 'This modmail thread will be automatically closed in 10 minutes due to inactivity.',
              color: '#FF5555',
              timestamp: true
            })
          ]
        });
        
        // Mark warning as sent
        currentInfo.warningsSent.ten = true;
      } catch (error) {
        logger.error(`Error sending 10-minute warning: ${error.message}`);
      }
    }, idleTimeout - (10 * 60 * 1000)); // 10 minutes before timeout
  },
  
  /**
   * Reset auto-close timer for a modmail thread
   * @param {String} userId - User ID associated with the thread
   * @param {Object} client - Discord client instance
   */
  resetAutoCloseTimer(userId, client) {
    const threadInfo = client.activeModmailThreads.get(userId);
    if (!threadInfo) return;
    
    // Clear existing timer
    if (threadInfo.autoCloseTimer) {
      clearTimeout(threadInfo.autoCloseTimer);
      threadInfo.autoCloseTimer = null;
    }
    
    // Reset warning flags
    threadInfo.warningsSent = {
      thirty: false,
      ten: false
    };
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

// No need to export processModmail since it's already included in the module.exports object