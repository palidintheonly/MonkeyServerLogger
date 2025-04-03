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
      if (!client.pendingModmailMessages) {
        client.pendingModmailMessages = new Map();
      }
      
      // Check active threads from the database
      const activeThreads = await models.ModmailThread.findActiveThreadsByUser(message.author.id);
      const isNewConversation = activeThreads.length === 0;
      
      // Check if user is blocked from modmail in any guild
      const isBlocked = await models.BlockedUser.isUserBlocked(message.author.id, null);
      if (isBlocked) {
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
      // Check if user is blocked from this specific guild
      const isBlockedInGuild = await models.BlockedUser.isUserBlocked(message.author.id, supportGuild.id);
      if (isBlockedInGuild) {
        logger.info(`User ${message.author.tag} is blocked from modmail in guild ${supportGuild.name}`);
        await message.reply(`You are blocked from using modmail in the server **${supportGuild.name}**.`);
        return;
      }
      
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
          
          // Store the thread info in the database
          const threadData = await models.ModmailThread.createThread({
            userId: message.author.id,
            userTag: message.author.tag,
            guildId: supportGuild.id,
            channelId: threadChannel.id
          });
          
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
        try {
          // Get thread info from database
          const activeThreads = await models.ModmailThread.findActiveThreadsByUser(message.author.id);
          
          // Find the thread for this specific guild
          const threadForGuild = activeThreads.find(thread => thread.guildId === supportGuild.id);
          
          if (!threadForGuild) {
            // Thread for this guild may have been deleted, create a new one
            logger.info(`No active thread found for user ${message.author.tag} in guild ${supportGuild.name}, creating new one`);
            await this.processModmail(message, client, supportGuild, true);
            return;
          }
          
          const threadChannel = await supportGuild.channels.fetch(threadForGuild.channelId).catch(() => null);
          
          if (!threadChannel) {
            // Channel was deleted, remove from database and create new one
            await models.ModmailThread.closeThread(threadForGuild.channelId);
            logger.info(`Thread channel ${threadForGuild.channelId} no longer exists, creating new one`);
            await this.processModmail(message, client, supportGuild, true);
            return;
          }
          
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
          
          // Update last activity time
          await models.ModmailThread.updateActivity(threadChannel.id);
        } catch (error) {
          logger.error(`Error forwarding message to modmail thread: ${error.message}`);
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
   * This is now a no-op as we use the database with the findIdleThreads method 
   * for thread auto-closure, which is more reliable in a sharded environment
   * @param {String} userId - User ID associated with the thread (not used)
   * @param {Object} client - Discord client instance (not used)
   */
  setupAutoCloseTimer(userId, client) {
    // No longer needed as we'll use a database-driven approach
    // This function is kept for backward compatibility with existing code
  },
  
  /**
   * Reset auto-close timer for a modmail thread
   * This is now a no-op as we use the database for tracking thread activity
   * @param {String} userId - User ID associated with the thread (not used)
   * @param {Object} client - Discord client instance (not used)
   */
  resetAutoCloseTimer(userId, client) {
    // No longer needed as we'll use a database-driven approach
    // This function is kept for backward compatibility with existing code
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