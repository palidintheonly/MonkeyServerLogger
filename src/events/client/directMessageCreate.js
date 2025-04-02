const { createEmbed, createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'messageCreate',
  once: false,
  
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
      
      // Check if this is a first-time message
      const isNewConversation = !client.activeModmailThreads?.has(message.author.id);
      
      // Initialize modmail threads collection if it doesn't exist
      if (!client.activeModmailThreads) {
        client.activeModmailThreads = new Map();
      }
      
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
      
      // Get the modmail support server and channel
      const supportGuildId = process.env.SUPPORT_GUILD_ID;
      if (!supportGuildId) {
        logger.error('SUPPORT_GUILD_ID is not configured.');
        await message.reply('The modmail system is not properly configured. Please contact the bot administrators.');
        return;
      }
      
      // Get the support guild
      const supportGuild = client.guilds.cache.get(supportGuildId);
      if (!supportGuild) {
        logger.error(`Could not find support guild with ID: ${supportGuildId}`);
        await message.reply('The modmail system is not properly configured. Please contact the bot administrators.');
        return;
      }
      
      // Get guild settings to check if modmail is enabled
      const guildSettings = await models.Guild.findOrCreateGuild(supportGuild.id);
      
      if (!guildSettings.isModmailEnabled()) {
        logger.info(`Modmail not enabled for guild ${supportGuild.name}`);
        await message.reply('The modmail system is not enabled for this bot. Please contact the server administrators directly.');
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
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: supportGuild.roles.cache.find(r => r.name === 'Staff')?.id || supportGuild.ownerId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
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
            status: 'open'
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
          
        } catch (error) {
          logger.error(`Error forwarding message to modmail thread: ${error.message}`);
          
          // The thread might have been deleted, create a new one
          client.activeModmailThreads.delete(message.author.id);
          
          // Re-run this function to create a new thread
          this.execute(message, client);
        }
      }
      
    } catch (error) {
      logger.error(`Error in modmail system: ${error.message}`);
      await message.reply('There was an unexpected error in the modmail system. Please try again later.');
    }
  }
};