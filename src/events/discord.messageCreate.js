/**
 * Discord.js Message Event
 * Handles incoming messages, specifically for DMs to enable modmail functionality
 */
const { Events, ChannelType } = require('discord.js');
const { logger } = require('../utils/logger');
const { createInfoEmbed } = require('../utils/embedBuilder');
const { createModmailThread, findThreadWithFallback } = require('../utils/modmail');

module.exports = {
  name: Events.MessageCreate,
  
  async execute(message, client) {
    // Ignore messages from bots
    if (message.author.bot) return;
    
    // Handle DM messages for modmail
    if (message.channel.type === ChannelType.DM) {
      // Check if the message has content or attachments
      if (!message.content && message.attachments.size === 0) return;
      
      try {
        logger.info(`Received DM from ${message.author.tag} (${message.author.id}): ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);
        
        // Check if there's a recent user session for faster thread lookup
        const userId = message.author.id;
        const userSession = client.userSessions?.get(userId);
        
        // If we have a recent session (within last hour), use it to help locate the thread
        if (userSession) {
          const sessionAge = Date.now() - userSession.lastMessageAt.getTime();
          const oneHour = 60 * 60 * 1000;
          
          if (sessionAge < oneHour) {
            logger.debug(`Found recent user session for ${userId} with thread ${userSession.threadId} in guild ${userSession.guildId} (${sessionAge / 1000}s old)`);
            
            // Try to find the thread using session data
            const thread = await findThreadWithFallback(
              client,
              userSession.threadId,
              userId,
              userSession.guildId
            );
            
            if (thread) {
              logger.info(`Using thread from user session: ${thread.id}`);
              // Process this as a single thread case
              return await handleExistingThreads(message, client, [thread]);
            }
          } else {
            logger.debug(`User session for ${userId} exists but is too old (${sessionAge / 1000}s)`);
          }
        }
        
        // Check if we're running in server-based sharding mode
        const isServerBasedSharding = process.env.ASSIGNED_GUILD_ID !== undefined;
        
        // Query params for finding active threads
        const queryParams = {
          where: {
            userId: message.author.id,
            open: true
          }
        };
        
        // If in server-based sharding mode, only look for threads in the assigned guild
        if (isServerBasedSharding) {
          queryParams.where.guildId = process.env.ASSIGNED_GUILD_ID;
        }
        
        // Check if user has existing active modmail threads
        const existingThreads = await client.db.ModmailThread.findAll(queryParams);
        
        if (existingThreads.length > 0) {
          // User has one or more active threads
          await handleExistingThreads(message, client, existingThreads);
        } else {
          // User doesn't have any active threads
          await handleNewModmail(message, client);
        }
      } catch (error) {
        logger.error(`Error handling DM from ${message.author.tag}: ${error.message}`, { error });
        
        // Send a generic error message
        try {
          await message.reply({
            content: "I'm sorry, but there was an error processing your message. Please try again later."
          });
        } catch (replyError) {
          logger.error(`Error sending error reply: ${replyError.message}`);
        }
      }
    }
  }
};

/**
 * Handle case where user has existing modmail threads
 * @param {Message} message - Original DM
 * @param {Client} client - Discord client
 * @param {Array<ModmailThread>} existingThreads - Active modmail threads
 */
async function handleExistingThreads(message, client, existingThreads) {
  try {
    // If there's only one thread, forward the message to that thread
    if (existingThreads.length === 1) {
      const thread = existingThreads[0];
      
      // Get the guild
      const guild = client.guilds.cache.get(thread.guildId);
      
      if (!guild) {
        // Guild no longer exists or bot was removed, close the thread
        await thread.closeThread('SYSTEM', 'Guild not accessible');
        return message.reply({
          content: "I can no longer access the server for your existing thread. It may have been deleted or I may have been removed from it. Your thread has been closed."
        });
      }
      
      // Get the channel - add extensive error handling and debugging
      logger.debug(`Attempting to fetch channel for thread ID ${thread.id} in guild ${guild.name} (${guild.id})`);
      
      let channel;
      try {
        channel = await guild.channels.fetch(thread.id).catch(error => {
          logger.error(`Error fetching channel ${thread.id}: ${error.message}`);
          return null;
        });
      } catch (fetchError) {
        logger.error(`Exception during channel fetch for thread ID ${thread.id}: ${fetchError.message}`);
        channel = null;
      }
      
      // If channel fetch failed, try to use an alternative lookup
      if (!channel) {
        logger.debug(`Primary channel fetch failed for thread ID ${thread.id}, trying to find via category`);
        
        try {
          // Try to get guild settings to find modmail category
          const guildSettings = await client.db.Guild.findOne({
            where: { guildId: guild.id }
          });
          
          if (guildSettings) {
            const modmailSettings = guildSettings.getSetting('modmail') || {};
            const categoryId = modmailSettings.categoryId;
            
            if (categoryId) {
              // Try to find the channel in that category with a matching name pattern
              const possibleChannels = guild.channels.cache
                .filter(c => c.parentId === categoryId && 
                       c.name.includes(message.author.id.substring(0, 8)))
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
              
              if (possibleChannels.size > 0) {
                channel = possibleChannels.first();
                logger.info(`Found alternative channel match ${channel.id} for user ${message.author.id}`);
                
                // Update thread record with new channel ID
                thread.id = channel.id;
                await thread.save();
              }
            }
          }
        } catch (altLookupError) {
          logger.error(`Alternative channel lookup failed: ${altLookupError.message}`);
        }
      }
      
      if (!channel) {
        // Channel was deleted, close the thread and create a new one
        await thread.closeThread('SYSTEM', 'Channel not found, creating new thread');
        
        // Ask the user if they want to create a new thread with this guild
        const confirmMessage = await message.reply({
          content: `Your previous thread with **${guild.name}** could not be found. Would you like to create a new one?`,
          components: [
            {
              type: 1, // ACTION_ROW
              components: [
                {
                  type: 2, // BUTTON
                  style: 3, // SUCCESS
                  label: 'Create New Thread',
                  custom_id: `new_thread_${guild.id}`
                },
                {
                  type: 2, // BUTTON
                  style: 4, // DANGER
                  label: 'Cancel',
                  custom_id: 'cancel_thread'
                }
              ]
            }
          ]
        });
        
        // Wait for button interaction
        try {
          const buttonInteraction = await confirmMessage.awaitMessageComponent({
            filter: i => i.user.id === message.author.id,
            time: 300000 // 5 minutes
          });
          
          if (buttonInteraction.customId === `new_thread_${guild.id}`) {
            await buttonInteraction.update({
              content: 'Creating new thread...',
              components: []
            });
            
            // Create a new thread
            await createModmailThread(message, client, guild);
            
            await buttonInteraction.editReply({
              content: `Your message has been sent to the staff of **${guild.name}**. They will respond to you here in DMs.`
            });
          } else if (buttonInteraction.customId === 'cancel_thread') {
            await buttonInteraction.update({
              content: 'Thread creation cancelled.',
              components: []
            });
          }
        } catch (timeoutError) {
          // Button interaction timed out
          await confirmMessage.edit({
            content: 'Thread creation timed out. You can try sending your message again.',
            components: []
          });
        }
        
        return;
      }
      
      // Thread exists and channel exists, forward the message
      // Update the thread's activity timestamp
      await thread.updateActivity('user_dm');
      
      // Create an embed for the forwarded message
      const forwardEmbed = {
        author: {
          name: message.author.tag,
          icon_url: message.author.displayAvatarURL({ dynamic: true })
        },
        description: message.content || '*No content*',
        color: 0x2F3136, // Discord dark theme color
        timestamp: new Date().toISOString()
      };
      
      // Send the embed and attachments to the thread channel
      await channel.send({ 
        embeds: [forwardEmbed],
        files: [...message.attachments.values()]
      });
      
      // Increment message count
      thread.messageCount += 1;
      await thread.save();
      
      // Send confirmation to the user
      await message.react('✅').catch(() => {});
      
      // Add a friendly message to remind the user they're in an active conversation
      // but only do it occasionally (every 3 messages) to avoid being spammy
      if (thread.messageCount % 3 === 0) {
        await message.channel.send({
          content: `✉️ You're chatting with **${guild.name}**. Staff will see and respond to your messages.`
        }).catch(() => {});
      }
      
      return;
    }
    
    // Check if any of the existingThreads had recent staff activity
    // Look for the most recently active thread
    const sortedThreads = [...existingThreads].sort((a, b) => 
      new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );
    
    // If the most recent thread was active within the last hour, use it automatically
    const mostRecentThread = sortedThreads[0];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (mostRecentThread && new Date(mostRecentThread.lastMessageAt) > oneHourAgo) {
      // Use the most recently active thread automatically
      logger.info(`Using most recently active thread ${mostRecentThread.id} for user ${message.author.id}`);
      
      const guild = client.guilds.cache.get(mostRecentThread.guildId);
      if (!guild) return; // Unexpected error, fall back to selection
      
      // Try to fetch the channel with extensive error handling
      logger.debug(`Attempting to fetch channel for most recent thread ID ${mostRecentThread.id} in guild ${guild.name} (${guild.id})`);
      
      let channel;
      try {
        channel = await guild.channels.fetch(mostRecentThread.id).catch(error => {
          logger.error(`Error fetching channel ${mostRecentThread.id}: ${error.message}`);
          return null;
        });
      } catch (fetchError) {
        logger.error(`Exception during channel fetch for thread ID ${mostRecentThread.id}: ${fetchError.message}`);
        channel = null;
      }
      
      // If channel fetch failed, try to use an alternative lookup
      if (!channel) {
        logger.debug(`Primary channel fetch failed for thread ID ${mostRecentThread.id}, trying to find via category`);
        
        try {
          // Try to get guild settings to find modmail category
          const guildSettings = await client.db.Guild.findOne({
            where: { guildId: guild.id }
          });
          
          if (guildSettings) {
            const modmailSettings = guildSettings.getSetting('modmail') || {};
            const categoryId = modmailSettings.categoryId;
            
            if (categoryId) {
              // Try to find the channel in that category with a matching name pattern
              const possibleChannels = guild.channels.cache
                .filter(c => c.parentId === categoryId && 
                       c.name.includes(message.author.id.substring(0, 8)))
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
              
              if (possibleChannels.size > 0) {
                channel = possibleChannels.first();
                logger.info(`Found alternative channel match ${channel.id} for user ${message.author.id}`);
                
                // Update thread record with new channel ID
                mostRecentThread.id = channel.id;
                await mostRecentThread.save();
              }
            }
          }
        } catch (altLookupError) {
          logger.error(`Alternative channel lookup failed: ${altLookupError.message}`);
        }
      }
      
      if (!channel) return; // Channel not found after all attempts, fall back to selection
      
      // Forward the message to this thread
      await mostRecentThread.updateActivity('user_dm_recent_thread');
      
      // Create an embed for the forwarded message
      const forwardEmbed = {
        author: {
          name: message.author.tag,
          icon_url: message.author.displayAvatarURL({ dynamic: true })
        },
        description: message.content || '*No content*',
        color: 0x2F3136, // Discord dark theme color
        timestamp: new Date().toISOString()
      };
      
      // Send the embed and attachments to the thread channel
      await channel.send({ 
        embeds: [forwardEmbed],
        files: [...message.attachments.values()]
      });
      
      // Increment message count
      mostRecentThread.messageCount += 1;
      await mostRecentThread.save();
      
      // Send confirmation to the user
      await message.react('✅').catch(() => {});
      
      // Let the user know which server they're talking to
      await message.channel.send({
        content: `✉️ Your message was sent to **${guild.name}**. If you want to contact a different server instead, please let me know.`
      }).catch(() => {});
      
      return;
    }
    
    // If no recent activity or multiple threads and none recently active,
    // fall back to the selection menu
    
    // User has multiple active threads
    // Create a selection menu for the user to choose which thread to continue
    const selectOptions = await Promise.all(
      existingThreads.map(async thread => {
        const guild = client.guilds.cache.get(thread.guildId);
        return {
          label: guild ? guild.name : `Unknown Server (${thread.guildId})`,
          description: `Continue your conversation with ${guild ? guild.name : 'this server'}`,
          value: thread.guildId
        };
      })
    );
    
    // Add option to create a new thread
    selectOptions.push({
      label: 'New Conversation',
      description: 'Start a new conversation with a different server',
      value: 'new_conversation'
    });
    
    // Create and send the select menu
    await message.reply({
      content: 'You have multiple active modmail threads. Where would you like to send this message?',
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 3, // SELECT_MENU
              custom_id: 'modmail_thread_select',
              placeholder: 'Select a conversation',
              options: selectOptions
            }
          ]
        }
      ]
    });
  } catch (error) {
    logger.error(`Error handling existing threads: ${error.message}`, { error });
    throw error; // Propagate to main handler
  }
}

/**
 * Get default guild settings object for database
 * @param {Guild} guild - Discord guild
 * @returns {Object} Default settings object
 */
function getDefaultGuildSettings(guild) {
  return {
    guildId: guild.id,
    guildName: guild.name,
    enabledCategories: '[]',
    setupCompleted: false,
    modmailEnabled: false,
    ignoredChannels: '[]',
    ignoredRoles: '[]',
    categoryChannels: '{}',
    setupProgress: JSON.stringify({ step: 0, lastUpdated: null }),
    setupData: '{}',
    settings: {
      guildName: guild.name,
      disabledCommands: [],
      modmail: {
        enabled: false
      }
    }
  };
}

/**
 * Handle creation of a new modmail thread
 * @param {Message} message - Original DM
 * @param {Client} client - Discord client
 */
async function handleNewModmail(message, client) {
  try {
    // Find all guilds where:
    // 1. The user is a member
    // 2. Modmail is enabled
    const guildsWithModmail = [];
    
    // Get shard information from client
    const shardInfo = client.shardInfo || { mode: 'standalone' };
    
    // In server-based sharding mode, only check the assigned guild
    if (shardInfo.mode === 'server-based') {
      const targetGuildId = shardInfo.targetGuildId;
      if (!targetGuildId) {
        logger.warn('Server-based sharding enabled but no target guild ID assigned');
        return message.reply({
          content: "I'm not currently configured to handle modmail. Please try again later or contact the bot administrator."
        });
      }
      
      const guild = client.guilds.cache.get(targetGuildId);
      if (!guild) {
        logger.warn(`Target guild ${targetGuildId} not found in cache for modmail`);
        return message.reply({
          content: "I'm currently having trouble connecting to your server. Please try again later."
        });
      }
      
      // Check if user is in this guild
      const member = await guild.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        return message.reply({
          content: `You are not a member of ${guild.name}, which is the only guild I'm configured to handle in this shard.`
        });
      }
      
      // Process this specific guild
      const [guildSettings] = await client.db.Guild.findOrCreate({
        where: { guildId: targetGuildId },
        defaults: getDefaultGuildSettings(guild)
      });
      
      // Check if modmail is enabled
      const modmailSettings = guildSettings && guildSettings.getSetting('modmail') || {};
      const jsonModmailEnabled = modmailSettings.enabled === true;
      const columnModmailEnabled = guildSettings.modmailEnabled === true;
      const modmailEnabled = jsonModmailEnabled && columnModmailEnabled;
      
      if (modmailEnabled) {
        guildsWithModmail.push(guild);
      } else {
        return message.reply({
          content: `Modmail is not enabled for ${guild.name}. Please ask a server administrator to enable it.`
        });
      }
    } else {
      // Standard mode: check all guilds
      for (const [guildId, guild] of client.guilds.cache) {
        // Check if user is in this guild
        const member = await guild.members.fetch(message.author.id).catch(() => null);
        if (!member) continue;
        
        // Check if modmail is enabled - use findOrCreate with proper format to ensure DB consistency
        const [guildSettings] = await client.db.Guild.findOrCreate({
          where: { guildId: guildId },
          defaults: { 
            guildId: guildId,
            guildName: guild.name,
            // Required fields from the schema
            enabledCategories: '[]',
            setupCompleted: false,
            modmailEnabled: false,
            ignoredChannels: '[]',
            ignoredRoles: '[]',
            categoryChannels: '{}',
            setupProgress: JSON.stringify({ step: 0, lastUpdated: null }),
            setupData: '{}',
            settings: {
              guildName: guild.name,
              disabledCommands: [],
              modmail: {
                enabled: false
              }
            }
          }
        });
        
        // Get modmail settings from both sources (JSON and dedicated column)
        const modmailSettings = guildSettings && guildSettings.getSetting('modmail') || {};
        const jsonModmailEnabled = modmailSettings.enabled === true;
        const columnModmailEnabled = guildSettings.modmailEnabled === true;
        
        // Modmail is enabled if BOTH the JSON setting and the database column are true
        const modmailEnabled = jsonModmailEnabled && columnModmailEnabled;
        
        // Add debug logging
        console.log(`Guild ${guild.name} (${guildId}) modmail settings:`, modmailSettings);
        console.log(`Guild ${guild.name} (${guildId}) modmail enabled - JSON:`, jsonModmailEnabled, 'Column:', columnModmailEnabled);
        
        if (!modmailEnabled) continue;
        
        guildsWithModmail.push(guild);
      }
    }
    
    if (guildsWithModmail.length === 0) {
      // User is not in any guilds with modmail enabled
      return message.reply({
        embeds: [createInfoEmbed(
          "I couldn't find any servers where you're a member and modmail is enabled.\n\n" +
          "To use modmail, an administrator on your server needs to enable it using the `/modmail-setup enable` command. Ask them to do this if you want to use modmail in your server.\n\n" + 
          "If you believe this is an error and modmail should already be enabled, please contact a server administrator.",
          "No Modmail Servers Found"
        )]
      });
    }
    
    if (guildsWithModmail.length === 1) {
      // Only one guild with modmail enabled, use that one
      const guild = guildsWithModmail[0];
      await createModmailThread(message, client, guild);
      
      return message.reply({
        content: `Your message has been sent to the staff of **${guild.name}**. They will respond to you here in DMs.`
      });
    }
    
    // Multiple guilds with modmail, let user select one
    const selectOptions = guildsWithModmail.map(guild => ({
      label: guild.name,
      description: `Send your message to ${guild.name}`,
      value: guild.id
    }));
    
    await message.reply({
      content: 'Please select which server you\'d like to contact:',
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 3, // SELECT_MENU
              custom_id: 'modmail_guild_select',
              placeholder: 'Select a server',
              options: selectOptions
            }
          ]
        }
      ]
    });
  } catch (error) {
    logger.error(`Error handling new modmail: ${error.message}`, { error });
    throw error; // Propagate to main handler
  }
}