const { ContextMenuCommandBuilder, ApplicationCommandType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Report Message')
    .setType(ApplicationCommandType.Message),
  
  async execute(interaction, client) {
    try {
      // Get the reported message
      const targetMessage = interaction.targetMessage;
      const messageContent = targetMessage.content || '[No text content - contains attachment or embed]';
      const messageLink = `https://discord.com/channels/${interaction.guildId}/${targetMessage.channelId}/${targetMessage.id}`;
      
      // Create a modal for report submission
      const modal = new ModalBuilder()
        .setCustomId(`report_message_${targetMessage.id}`)
        .setTitle('Report Message');
      
      // Add text inputs to the modal
      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for reporting')
        .setPlaceholder('Please explain why you are reporting this message')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      
      // Create action rows with inputs
      const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
      
      // Add action rows to the modal
      modal.addComponents(reasonRow);
      
      // Show the modal to the user
      await interaction.showModal(modal);
      
      // Store message information for later processing
      client.reportedMessages = client.reportedMessages || new Map();
      client.reportedMessages.set(targetMessage.id, {
        messageId: targetMessage.id,
        channelId: targetMessage.channelId,
        authorId: targetMessage.author.id, 
        authorTag: targetMessage.author.tag,
        content: messageContent,
        link: messageLink,
        guildId: interaction.guildId,
        timestamp: targetMessage.createdTimestamp,
        attachments: Array.from(targetMessage.attachments.values()).map(a => a.url),
        reporter: interaction.user.id
      });
      
      logger.info(`User ${interaction.user.tag} opened a report modal for message ID: ${targetMessage.id}`);
      
    } catch (error) {
      logger.error(`Error in Report Message context menu: ${error.message}`);
      await interaction.reply({ 
        content: 'There was an error processing this command. Please try again later.', 
        ephemeral: true 
      });
    }
  },
  
  /**
   * Handle the modal submission
   * @param {Object} interaction - Modal submission interaction
   * @param {Object} client - Discord client instance
   */
  async handleModal(interaction, client) {
    try {
      // Get the message ID from the custom ID (format: report_message_[messageId])
      const messageId = interaction.customId.split('_')[2];
      
      // Get stored message data
      const messageData = client.reportedMessages.get(messageId);
      if (!messageData) {
        await interaction.reply({ 
          content: 'Could not find the reported message data. Please try again.', 
          ephemeral: true 
        });
        return;
      }
      
      // Get the reason from the modal
      const reason = interaction.fields.getTextInputValue('reason');
      
      // Try to fetch the log channel
      let logChannel = null;
      try {
        const guildSettings = await client.db.models.Guild.findByPk(interaction.guildId);
        if (guildSettings && guildSettings.setupCompleted && guildSettings.logChannelId) {
          logChannel = await interaction.guild.channels.fetch(guildSettings.logChannelId);
        }
      } catch (error) {
        logger.error(`Could not fetch log channel: ${error.message}`);
      }
      
      // If no log channel is found, notify the user
      if (!logChannel) {
        await interaction.reply({ 
          content: 'Thank you for your report. However, this server does not have a log channel set up yet. Your report has been recorded, but server moderators will not be notified.',
          ephemeral: true 
        });
        return;
      }
      
      // Create the embed for the log channel
      const { createEmbed } = require('../../utils/embedBuilder');
      
      const embed = createEmbed({
        title: '🚨 Message Reported',
        description: `A message has been reported by ${interaction.user.tag} (${interaction.user.id})`,
        fields: [
          {
            name: 'Author',
            value: `${messageData.authorTag} (${messageData.authorId})`,
            inline: true
          },
          {
            name: 'Channel',
            value: `<#${messageData.channelId}>`,
            inline: true
          },
          {
            name: 'Message Link',
            value: `[Jump to Message](${messageData.link})`,
            inline: true
          },
          {
            name: 'Reason for Report',
            value: reason || 'No reason provided',
            inline: false
          },
          {
            name: 'Message Content',
            value: messageData.content.substring(0, 1024) || '[No text content]',
            inline: false
          }
        ],
        color: '#FF0000', // Red color for reports
        timestamp: true
      });
      
      // If there are attachments, add them to the embed
      if (messageData.attachments && messageData.attachments.length > 0) {
        embed.addFields([{
          name: 'Attachments',
          value: messageData.attachments.map(url => `[Attachment](${url})`).join('\n').substring(0, 1024),
          inline: false
        }]);
      }
      
      // Send the report to the log channel
      await logChannel.send({ embeds: [embed] });
      
      // Acknowledge the report to the user
      await interaction.reply({ 
        content: 'Thank you for your report. The server moderators have been notified and will review the message.', 
        ephemeral: true 
      });
      
      logger.info(`User ${interaction.user.tag} submitted a report for message ID: ${messageId}`);
      
    } catch (error) {
      logger.error(`Error processing report submission: ${error.message}`);
      
      await interaction.reply({ 
        content: 'There was an error submitting your report. Please try again later.', 
        ephemeral: true 
      });
    }
  }
};