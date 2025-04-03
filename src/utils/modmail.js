/**
 * Modmail Utility Functions
 * Common functions for modmail operations across events
 */
const { ChannelType, AttachmentBuilder } = require('discord.js');
const { logger } = require('./logger');
const { createSuccessEmbed, createInfoEmbed } = require('./embedBuilder');
const discordTranscripts = require('discord-html-transcripts');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new modmail thread
 * @param {Message} message - Original DM or trigger message
 * @param {Client} client - Discord client
 * @param {Guild} guild - Discord guild to create thread for
 * @param {string} [content] - Optional message content (if not from original message)
 * @param {Array} [attachments] - Optional attachments
 */
async function createModmailThread(message, client, guild, content = null, attachments = []) {
  // Get modmail category from guild settings
  const guildSettings = await client.db.Guild.findOne({
    where: { guildId: guild.id }
  });
  
  if (!guildSettings) {
    throw new Error('Guild settings not found');
  }
  
  const modmailSettings = guildSettings.getSetting('modmail') || {};
  const categoryId = modmailSettings.categoryId;
  
  if (!categoryId) {
    throw new Error('Modmail category not configured');
  }
  
  // Get the category
  const category = await guild.channels.fetch(categoryId).catch(() => null);
  
  if (!category) {
    throw new Error('Modmail category not found');
  }
  
  // Create a new channel for the thread
  const user = message.author;
  const channelName = `${user.username}-${user.discriminator === '0' ? user.id.substring(0, 6) : user.discriminator}`;
  
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `Modmail thread with ${user.tag} (${user.id})`
  });
  
  // Create the thread in the database
  const thread = await client.db.ModmailThread.create({
    id: channel.id,
    userId: user.id,
    guildId: guild.id,
    open: true,
    subject: content?.substring(0, 50) || message.content?.substring(0, 50) || 'No subject',
    lastMessageAt: new Date(),
    messageCount: 1,
    createdBy: user.id
  });
  
  // Send initial message to the thread channel
  const userEmbed = {
    title: 'New Modmail Thread',
    author: {
      name: user.tag,
      icon_url: user.displayAvatarURL({ dynamic: true })
    },
    description: content || message.content || '_No content_',
    color: 0x5865F2, // Discord Blurple
    fields: [
      {
        name: 'User Info',
        value: `<@${user.id}> (${user.id})\nCreated: <t:${Math.floor(user.createdTimestamp / 1000)}:R>`
      }
    ],
    footer: {
      text: 'User Message'
    },
    timestamp: new Date().toISOString()
  };
  
  // Add member info if available
  try {
    const member = await guild.members.fetch(user.id);
    
    if (member) {
      userEmbed.fields.push({
        name: 'Member Info',
        value: `Joined: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\nRoles: ${member.roles.cache.filter(r => r.id !== guild.id).map(r => r.toString()).join(' ')}`
      });
    }
  } catch (error) {
    // User might not be in the guild
    userEmbed.fields.push({
      name: 'Member Info',
      value: '_User is not a member of this server_'
    });
  }
  
  // Add message attachments if any
  const files = attachments.length > 0 ? attachments : message.attachments ? [...message.attachments.values()] : [];
  
  if (files.length > 0) {
    userEmbed.fields.push({
      name: 'Attachments',
      value: `This message includes ${files.length} attachment(s)`
    });
  }
  
  // Send the embed to the thread channel
  await channel.send({ embeds: [userEmbed], files });
  
  // Add buttons for staff actions
  await channel.send({
    content: '**Staff Actions:**',
    components: [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 2, // SECONDARY
            label: 'Reply',
            custom_id: 'modmail_reply',
            emoji: { name: '💬' }
          },
          {
            type: 2, // BUTTON
            style: 4, // DANGER
            label: 'Close Thread',
            custom_id: 'modmail_close',
            emoji: { name: '🔒' }
          },
          {
            type: 2, // BUTTON
            style: 1, // PRIMARY
            label: 'Export Transcript',
            custom_id: 'modmail_transcript',
            emoji: { name: '📄' }
          }
        ]
      }
    ]
  });
  
  // Notify the log channel if configured
  if (modmailSettings.logChannelId) {
    try {
      const logChannel = await guild.channels.fetch(modmailSettings.logChannelId);
      await logChannel.send({
        embeds: [{
          title: 'Modmail Thread Created',
          description: `New thread opened by <@${user.id}> (${user.tag})`,
          fields: [
            {
              name: 'Channel',
              value: channel.toString()
            }
          ],
          color: 0x57F287, // Discord Green
          timestamp: new Date().toISOString()
        }]
      });
    } catch (error) {
      // Log channel error is not critical
      logger.warn(`Could not send to modmail log channel: ${error.message}`);
    }
  }
  
  return thread;
}

/**
 * Generate and send a transcript of a modmail thread
 * @param {TextChannel} channel - The modmail channel
 * @param {Client} client - Discord client
 * @param {boolean} [sendToUser=false] - Whether to also send to the user
 * @returns {Promise<string>} - URL to the transcript
 */
async function createModmailTranscript(channel, client, sendToUser = false) {
  try {
    // Find the thread info from the database
    const thread = await client.db.ModmailThread.findOne({
      where: { id: channel.id }
    });
    
    if (!thread) {
      throw new Error('Thread not found in database');
    }
    
    // Generate a unique filename
    const fileName = `modmail-${thread.userId}-${moment().format('YYYY-MM-DD')}-${uuidv4().substring(0, 8)}.html`;
    
    // Generate the transcript HTML
    const transcript = await discordTranscripts.createTranscript(channel, {
      limit: -1, // No limit
      filename: fileName,
      poweredBy: false,
      saveImages: true,
      footerText: `Modmail transcript for user ID ${thread.userId} | ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
    });
    
    // Send the transcript to the channel
    await channel.send({
      content: '📄 **Modmail Transcript Generated**',
      files: [transcript]
    });
    
    // Send to user if requested
    if (sendToUser) {
      try {
        const user = await client.users.fetch(thread.userId);
        await user.send({
          embeds: [createInfoEmbed(
            `Here is a transcript of your modmail conversation with **${channel.guild.name}**.`,
            'Modmail Transcript'
          )],
          files: [transcript]
        });
      } catch (dmError) {
        logger.warn(`Could not send transcript to user ${thread.userId}: ${dmError.message}`);
      }
    }
    
    // Get the guild settings to see if there's a log channel
    const guildSettings = await client.db.Guild.findOne({
      where: { guildId: channel.guild.id }
    });
    
    if (guildSettings) {
      const logChannelId = guildSettings.getSetting('modmail.logChannelId');
      
      if (logChannelId) {
        try {
          const logChannel = await channel.guild.channels.fetch(logChannelId);
          await logChannel.send({
            embeds: [{
              title: 'Modmail Transcript Generated',
              description: `Transcript created for thread with <@${thread.userId}>`,
              fields: [
                {
                  name: 'Channel',
                  value: channel.toString()
                },
                {
                  name: 'Generated By',
                  value: `<@${thread.closedBy || client.user.id}>`
                }
              ],
              color: 0x3498DB, // Blue
              timestamp: new Date().toISOString()
            }],
            files: [transcript]
          });
        } catch (logError) {
          logger.warn(`Could not send transcript to log channel: ${logError.message}`);
        }
      }
    }
    
    return transcript.attachment.url || "Transcript generated successfully";
  } catch (error) {
    logger.error(`Error creating transcript: ${error.message}`, { error });
    throw error;
  }
}

module.exports = {
  createModmailThread,
  createModmailTranscript
};