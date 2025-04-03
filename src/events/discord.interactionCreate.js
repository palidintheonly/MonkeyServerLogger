/**
 * Discord.js Interaction Event
 */
const { Events, Collection, InteractionType } = require('discord.js');
const { logger, interactionLogger } = require('../utils/logger');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embedBuilder');
const { bot: botConfig } = require('../config');
const { createModmailThread, createModmailTranscript } = require('../utils/modmail');

module.exports = {
  name: Events.InteractionCreate,
  
  async execute(interaction, client) {
    try {
      // Log interaction for debugging
      interactionLogger.debug(`Interaction received: ${interaction.type} from ${interaction.user.tag} (${interaction.user.id})`);
      
      // Handle different interaction types
      switch (interaction.type) {
        case InteractionType.ApplicationCommand:
          await handleCommand(interaction, client);
          break;
        
        case InteractionType.MessageComponent:
          // Handle components based on custom ID
          const customId = interaction.customId;
          
          // Modmail guild selection
          if (customId === 'modmail_guild_select') {
            await handleModmailGuildSelect(interaction, client);
          }
          // Modmail thread selection
          else if (customId === 'modmail_thread_select') {
            await handleModmailThreadSelect(interaction, client);
          }
          // Create new modmail conversation
          else if (customId === 'modmail_new_conversation') {
            await handleNewModmailConversation(interaction, client);
          }
          // Close modmail thread
          else if (customId === 'modmail_close') {
            await handleModmailClose(interaction, client);
          }
          // Reply to modmail thread
          else if (customId === 'modmail_reply') {
            await handleModmailReply(interaction, client);
          }
          // Generate transcript for modmail thread
          else if (customId === 'modmail_transcript') {
            await handleModmailTranscript(interaction, client);
          }
          // Handle any other button/select menu interactions
          else {
            await interaction.reply({
              content: 'This interaction is not currently handled.',
              ephemeral: true
            });
          }
          break;
        
        case InteractionType.ModalSubmit:
          // Handle modals based on custom ID
          const modalId = interaction.customId;
          
          // Modmail reply modal
          if (modalId.startsWith('modmail_reply_')) {
            await handleModmailReplySubmit(interaction, client);
          }
          // Handle any other modal submissions
          else {
            await interaction.reply({
              content: 'This modal submission is not currently handled.',
              ephemeral: true
            });
          }
          break;
      }
    } catch (error) {
      logger.error(`Error handling interaction: ${error.message}`, { error });
      
      // Only try to respond if interaction hasn't been replied to already
      if (interaction.deferred || interaction.replied) {
        try {
          await interaction.editReply({
            embeds: [createErrorEmbed('An error occurred while processing this interaction.')],
            ephemeral: true
          }).catch(() => {});
        } catch (followupError) {
          logger.error(`Error sending error response: ${followupError.message}`);
        }
      } else {
        try {
          await interaction.reply({
            embeds: [createErrorEmbed('An error occurred while processing this interaction.')],
            ephemeral: true
          }).catch(() => {});
        } catch (replyError) {
          logger.error(`Could not send error response: ${replyError.message}`);
        }
      }
    }
  }
};

/**
 * Handle slash commands
 * @param {Interaction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleCommand(interaction, client) {
  // Get the command from the collection
  const command = client.commands.get(interaction.commandName);
  
  // If command doesn't exist, return
  if (!command) {
    logger.warn(`User ${interaction.user.tag} tried to use unknown command: ${interaction.commandName}`);
    return interaction.reply({ 
      content: 'This command doesn\'t exist or is not currently available.',
      ephemeral: true
    });
  }
  
  // Check if command is guild-only and interaction is not in a guild
  if (command.guildOnly && !interaction.guild) {
    return interaction.reply({
      content: 'This command can only be used in a server, not in DMs.',
      ephemeral: true
    });
  }
  
  // Check if command is disabled in this guild
  if (interaction.guild) {
    try {
      const guildSettings = await client.db.Guild.findOne({
        where: { guildId: interaction.guild.id }
      });
      
      if (guildSettings && guildSettings.isCommandDisabled(interaction.commandName)) {
        return interaction.reply({
          content: 'This command has been disabled in this server.',
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error(`Error checking command status: ${error.message}`);
      // Continue execution if we can't check if it's disabled
    }
  }
  
  // Check cooldowns
  if (command.cooldown) {
    const cooldowns = client.cooldowns;
    
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || botConfig.defaultCooldown) * 1000;
    
    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return interaction.reply({
          content: `Please wait ${timeLeft.toFixed(1)} more second(s) before using the \`${command.data.name}\` command again.`,
          ephemeral: true
        });
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
  }
  
  // Execute the command
  try {
    logger.info(`User ${interaction.user.tag} used command: ${interaction.commandName}`);
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}: ${error.message}`, { error });
    
    // Handle response based on interaction state
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          embeds: [createErrorEmbed(`There was an error executing this command! ${error.message}`)],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          embeds: [createErrorEmbed(`There was an error executing this command! ${error.message}`)],
          ephemeral: true
        });
      }
    } catch (responseError) {
      logger.error(`Error responding to command error: ${responseError.message}`);
    }
  }
}

/**
 * Handle guild selection for modmail
 * @param {Interaction} interaction - Select menu interaction
 * @param {Client} client - Discord client
 */
async function handleModmailGuildSelect(interaction, client) {
  await interaction.deferUpdate();
  
  const selectedGuildId = interaction.values[0];
  
  try {
    // Get the guild 
    const guild = client.guilds.cache.get(selectedGuildId);
    
    if (!guild) {
      return interaction.editReply({
        content: 'I could not find that server. I may have been removed from it.',
        components: []
      });
    }
    
    // Check if modmail is enabled in that guild
    const guildSettings = await client.db.Guild.findOne({
      where: { guildId: selectedGuildId }
    });
    
    const modmailEnabled = guildSettings && guildSettings.getSetting('modmail.enabled');
    
    if (!modmailEnabled) {
      return interaction.editReply({
        content: `Modmail is not enabled in **${guild.name}**. Please contact a server administrator.`,
        components: []
      });
    }
    
    // Check for existing thread
    const existingThread = await client.db.ModmailThread.findActiveThread(interaction.user.id, selectedGuildId);
    
    if (existingThread) {
      return interaction.editReply({
        content: `You already have an active modmail thread with **${guild.name}**. Please continue the conversation there.`,
        components: []
      });
    }
    
    // Create a new thread
    const messageContent = interaction.message.content;
    const attachments = interaction.message.attachments;
    
    // Get the original DM message
    const message = {
      author: interaction.user,
      content: messageContent,
      attachments
    };
    
    // Create thread for selected guild
    await createModmailThread(message, client, guild);
    
    // Update the original message
    return interaction.editReply({
      content: `Your message has been sent to the staff of **${guild.name}**. They will respond to you here in DMs.`,
      components: []
    });
  } catch (error) {
    logger.error(`Error handling modmail guild select: ${error.message}`, { error });
    
    return interaction.editReply({
      content: 'An error occurred while creating your modmail thread. Please try again later.',
      components: []
    });
  }
}

/**
 * Handle thread selection for existing modmail conversations
 * @param {Interaction} interaction - Select menu interaction
 * @param {Client} client - Discord client
 */
async function handleModmailThreadSelect(interaction, client) {
  await interaction.deferUpdate();
  
  const selectedGuildId = interaction.values[0];
  
  try {
    if (selectedGuildId === 'new_conversation') {
      return handleNewModmailConversation(interaction, client);
    }
    
    // Get the guild
    const guild = client.guilds.cache.get(selectedGuildId);
    
    if (!guild) {
      return interaction.editReply({
        content: 'I could not find that server. I may have been removed from it.',
        components: []
      });
    }
    
    // Check for existing thread
    const existingThread = await client.db.ModmailThread.findActiveThread(interaction.user.id, selectedGuildId);
    
    if (!existingThread) {
      // Create a new thread if one doesn't exist
      const messageContent = interaction.message.content;
      const attachments = interaction.message.attachments;
      
      // Get the original DM message
      const message = {
        author: interaction.user,
        content: messageContent,
        attachments
      };
      
      // Create thread for selected guild
      await createModmailThread(message, client, guild);
      
      // Update the original message
      return interaction.editReply({
        content: `Your message has been sent to the staff of **${guild.name}**. They will respond to you here in DMs.`,
        components: []
      });
    }
    
    // Find the thread channel
    const threadChannel = await guild.channels.fetch(existingThread.id).catch(() => null);
    
    if (!threadChannel) {
      // Channel was deleted but thread is still active in DB
      // Close the thread and create a new one
      await existingThread.closeThread('SYSTEM', 'Channel not found, creating new thread');
      
      const messageContent = interaction.message.content;
      const attachments = interaction.message.attachments;
      
      // Get the original DM message
      const message = {
        author: interaction.user,
        content: messageContent,
        attachments
      };
      
      // Create thread for selected guild
      await createModmailThread(message, client, guild);
      
      // Update the original message
      return interaction.editReply({
        content: `Your previous thread with **${guild.name}** could not be found. A new thread has been created for you.`,
        components: []
      });
    }
    
    // Thread exists and channel exists, update the thread
    // Update the thread's activity timestamp
    await existingThread.updateActivity();
    
    // Forward the message to the thread
    const messageContent = interaction.message.content;
    const userTag = interaction.user.tag;
    
    const forwardEmbed = {
      author: {
        name: userTag,
        icon_url: interaction.user.displayAvatarURL({ dynamic: true })
      },
      description: messageContent,
      color: 0x2F3136,
      timestamp: new Date().toISOString()
    };
    
    // Send message to thread channel
    await threadChannel.send({
      embeds: [forwardEmbed],
      files: [...interaction.message.attachments.values()]
    });
    
    // Increment message count
    existingThread.messageCount += 1;
    await existingThread.save();
    
    // Update the original message
    return interaction.editReply({
      content: `Your message has been sent to the staff of **${guild.name}**. They will respond to you here in DMs.`,
      components: []
    });
  } catch (error) {
    logger.error(`Error handling modmail thread select: ${error.message}`, { error });
    
    return interaction.editReply({
      content: 'An error occurred while processing your modmail message. Please try again later.',
      components: []
    });
  }
}

/**
 * Handle creating a new modmail conversation from thread select menu
 * @param {Interaction} interaction - Select menu interaction
 * @param {Client} client - Discord client
 */
async function handleNewModmailConversation(interaction, client) {
  await interaction.deferUpdate();
  
  try {
    // Get all guilds with modmail enabled that the user is a member of
    const guildsWithModmail = [];
    
    for (const [guildId, guild] of client.guilds.cache) {
      // Check if user is in this guild
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) continue;
      
      // Check if modmail is enabled
      const guildSettings = await client.db.Guild.findOne({
        where: { guildId }
      });
      
      const modmailEnabled = guildSettings && guildSettings.getSetting('modmail.enabled');
      if (!modmailEnabled) continue;
      
      guildsWithModmail.push(guild);
    }
    
    if (guildsWithModmail.length === 0) {
      return interaction.editReply({
        content: "I couldn't find any servers with modmail enabled that you're a member of.",
        components: []
      });
    }
    
    if (guildsWithModmail.length === 1) {
      // Only one server has modmail, use that one
      const guild = guildsWithModmail[0];
      
      const messageContent = interaction.message.content;
      const attachments = interaction.message.attachments;
      
      // Get the original DM message
      const message = {
        author: interaction.user,
        content: messageContent,
        attachments
      };
      
      // Create thread for only available guild
      await createModmailThread(message, client, guild);
      
      // Update the original message
      return interaction.editReply({
        content: `Your message has been sent to the staff of **${guild.name}**. They will respond to you here in DMs.`,
        components: []
      });
    }
    
    // Multiple guilds with modmail, let user select one
    const selectOptions = guildsWithModmail.map(guild => ({
      label: guild.name,
      description: `Send your message to ${guild.name}`,
      value: guild.id
    }));
    
    // Create the select menu
    const selectMenu = {
      type: 3, // SELECT_MENU
      custom_id: 'modmail_guild_select',
      placeholder: 'Select a server to contact',
      options: selectOptions
    };
    
    const actionRow = {
      type: 1, // ACTION_ROW
      components: [selectMenu]
    };
    
    // Update the message with the select menu
    return interaction.editReply({
      content: 'Please select which server you\'d like to contact:',
      components: [actionRow]
    });
  } catch (error) {
    logger.error(`Error handling new modmail conversation: ${error.message}`, { error });
    
    return interaction.editReply({
      content: 'An error occurred while trying to create a new modmail conversation. Please try again later.',
      components: []
    });
  }
}

/**
 * Handle closing modmail threads
 * @param {Interaction} interaction - Button interaction
 * @param {Client} client - Discord client
 */
async function handleModmailClose(interaction, client) {
  await interaction.deferReply();
  
  try {
    // Get the channel/thread
    const channel = interaction.channel;
    
    // Get the thread from the database
    const thread = await client.db.ModmailThread.findOne({
      where: { id: channel.id }
    });
    
    if (!thread) {
      return interaction.editReply({
        content: 'This doesn\'t appear to be a modmail thread, or the thread data is missing.'
      });
    }
    
    if (!thread.open) {
      return interaction.editReply({
        content: 'This thread is already closed.'
      });
    }
    
    // Close the thread in the database
    await thread.closeThread(interaction.user.id, 'Closed by staff');
    
    // Send a message to the channel
    await channel.send({
      content: `📬 This modmail thread has been closed by ${interaction.user.tag}`,
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 2, // BUTTON
              style: 1, // PRIMARY
              label: 'Generate Transcript',
              custom_id: 'modmail_transcript',
              emoji: { name: '📄' }
            }
          ]
        }
      ]
    });
    
    // Try to notify the user
    try {
      const user = await client.users.fetch(thread.userId);
      await user.send({
        content: `📬 Your modmail thread with **${interaction.guild.name}** has been closed by a staff member.`
      });
    } catch (dmError) {
      // If we can't DM the user, just log it
      logger.warn(`Could not notify user ${thread.userId} about thread closure: ${dmError.message}`);
    }
    
    // Confirm to the moderator
    return interaction.editReply({
      content: `Thread closed successfully. The user has been notified.`
    });
  } catch (error) {
    logger.error(`Error closing modmail thread: ${error.message}`, { error });
    
    return interaction.editReply({
      content: 'An error occurred while trying to close the thread.'
    });
  }
}

/**
 * Handle modmail reply button
 * @param {Interaction} interaction - Button interaction
 * @param {Client} client - Discord client
 */
async function handleModmailReply(interaction, client) {
  try {
    // Get the thread ID from the channel
    const threadId = interaction.channel.id;
    
    // Create the modal for the reply
    await interaction.showModal({
      title: 'Reply to Modmail',
      custom_id: `modmail_reply_${threadId}`,
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 4, // TEXT_INPUT
              custom_id: 'modmail_reply_content',
              label: 'Your reply:',
              style: 2, // PARAGRAPH
              min_length: 1,
              max_length: 4000,
              placeholder: 'Type your message here...',
              required: true
            }
          ]
        }
      ]
    });
  } catch (error) {
    logger.error(`Error showing modmail reply modal: ${error.message}`, { error });
    
    await interaction.reply({
      content: 'An error occurred while trying to open the reply form.',
      ephemeral: true
    });
  }
}

/**
 * Handle modmail reply modal submission
 * @param {Interaction} interaction - Modal submission interaction
 * @param {Client} client - Discord client
 */
async function handleModmailReplySubmit(interaction, client) {
  await interaction.deferReply();
  
  try {
    // Get the thread ID from the modal custom ID
    const threadId = interaction.customId.replace('modmail_reply_', '');
    
    // Get the reply content
    const replyContent = interaction.fields.getTextInputValue('modmail_reply_content');
    
    // Get the thread from the database
    const thread = await client.db.ModmailThread.findOne({
      where: { id: threadId }
    });
    
    if (!thread) {
      return interaction.editReply({
        content: 'This thread could not be found in the database.'
      });
    }
    
    if (!thread.open) {
      return interaction.editReply({
        content: 'This thread is closed. Please re-open it before replying.'
      });
    }
    
    // Update the thread's activity timestamp
    await thread.updateActivity();
    
    // Try to send the reply to the user
    try {
      const user = await client.users.fetch(thread.userId);
      
      // Create an embed for the reply
      const replyEmbed = {
        author: {
          name: interaction.guild.name,
          icon_url: interaction.guild.iconURL({ dynamic: true })
        },
        description: replyContent,
        color: 0x5865F2, // Discord Blurple
        footer: {
          text: `From ${interaction.user.tag}`,
          icon_url: interaction.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: new Date().toISOString()
      };
      
      await user.send({ embeds: [replyEmbed] });
      
      // Echo the reply in the thread
      const echoEmbed = {
        author: {
          name: interaction.user.tag,
          icon_url: interaction.user.displayAvatarURL({ dynamic: true })
        },
        description: replyContent,
        color: 0x57F287, // Discord Green
        footer: {
          text: 'Staff Reply'
        },
        timestamp: new Date().toISOString()
      };
      
      await interaction.channel.send({ embeds: [echoEmbed] });
      
      // Increment message count
      thread.messageCount += 1;
      await thread.save();
      
      return interaction.editReply({
        content: 'Your reply has been sent to the user.'
      });
    } catch (dmError) {
      logger.error(`Could not send modmail reply to user ${thread.userId}: ${dmError.message}`);
      
      return interaction.editReply({
        content: `Could not send reply to user. They may have DMs disabled or have blocked the bot.\n\nYour message: "${replyContent}"`
      });
    }
  } catch (error) {
    logger.error(`Error handling modmail reply: ${error.message}`, { error });
    
    return interaction.editReply({
      content: 'An error occurred while trying to send your reply.'
    });
  }
}

/**
 * Handle modmail transcript generation
 * @param {Interaction} interaction - Button interaction
 * @param {Client} client - Discord client
 */
async function handleModmailTranscript(interaction, client) {
  await interaction.deferReply();
  
  try {
    // Get the channel/thread
    const channel = interaction.channel;
    
    // Get the thread from the database
    const thread = await client.db.ModmailThread.findOne({
      where: { id: channel.id }
    });
    
    if (!thread) {
      return interaction.editReply({
        content: 'This doesn\'t appear to be a modmail thread, or the thread data is missing.'
      });
    }
    
    // Generate transcript
    const sendToUser = interaction.member.permissions.has('ManageMessages');
    const transcriptUrl = await createModmailTranscript(channel, client, sendToUser);
    
    // Notify about transcript generation
    return interaction.editReply({
      embeds: [createSuccessEmbed(
        `Modmail transcript has been generated.${sendToUser ? ' A copy has also been sent to the user.' : ''}`,
        'Transcript Generated'
      )]
    });
  } catch (error) {
    logger.error(`Error generating transcript: ${error.message}`, { error });
    
    return interaction.editReply({
      content: 'An error occurred while trying to generate the transcript.'
    });
  }
}