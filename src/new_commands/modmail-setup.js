const { 
  SlashCommandBuilder,
  ActionRowBuilder, 
  PermissionsBitField, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { models } = require('../database/db');
const config = require('../config');

module.exports = {
  cooldown: 10, // 10 seconds cooldown for setup commands
  data: new SlashCommandBuilder()
    .setName('modmail-setup')
    .setDescription('Set up the modmail system for your server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Enable or disable the modmail system')
        .setRequired(true)
    )
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('Modmail info channel (optional)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option => 
      option.setName('category_name')
        .setDescription('Name for the modmail category (default: "MODMAIL TICKETS")')
        .setRequired(false)
    ),
  
  async execute(interaction, client) {
    try {
      // Check if user is guild owner or has admin permission
      if (interaction.user.id !== interaction.guild.ownerId && 
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Only the server owner or administrators can use this command.')],
          ephemeral: true
        });
        return;
      }
      
      // Get guild settings from database
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const enabled = interaction.options.getBoolean('enabled');
        const channel = interaction.options.getChannel('channel');
        const categoryName = interaction.options.getString('category_name') || 'MODMAIL TICKETS';
        
        if (enabled) {
          // Set up modmail system
          let category;
          let infoChannel = channel;
          
          // If no channel is provided or if there's no existing modmail category
          if (!infoChannel || !guildSettings.modmailCategoryId) {
            // Create a new category
            category = await interaction.guild.channels.create({
              name: categoryName,
              type: ChannelType.GuildCategory,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: interaction.guild.members.me.id,
                  allow: [PermissionsBitField.Flags.ViewChannel]
                }
              ]
            });
            
            // Only create an info channel if one wasn't provided
            if (!infoChannel) {
              infoChannel = await interaction.guild.channels.create({
                name: 'modmail-info',
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                  {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                  },
                  {
                    id: interaction.guild.members.me.id,
                    allow: [PermissionsBitField.Flags.ViewChannel]
                  }
                ]
              });
            } else if (category) {
              // If a channel was provided but we created a new category
              await infoChannel.setParent(category.id, { lockPermissions: false });
            }
          }
          
          // Update guild settings
          await guildSettings.update({
            modmailEnabled: true,
            modmailCategoryId: category?.id || guildSettings.modmailCategoryId,
            modmailInfoChannelId: infoChannel.id
          });
          
          // Send info to the modmail info channel
          await infoChannel.send({
            embeds: [createEmbed({
              title: "📬 Modmail System Info",
              description: "This channel will display information about modmail conversations.",
              fields: [
                { 
                  name: "How It Works", 
                  value: "Users can DM the bot to contact server moderators." 
                },
                { 
                  name: "Available Commands", 
                  value: "`/modmail reply` - Reply to a user via modmail\n`/modmail close` - Close a modmail thread\n`/modmail block` - Block a user from using modmail\n`/modmail unblock` - Unblock a user from modmail" 
                },
                { 
                  name: "Setup Info", 
                  value: `Set up by: ${interaction.user}\nSetup Date: ${new Date().toISOString()}` 
                }
              ]
            })]
          });
          
          // Respond to the user
          await interaction.editReply({
            embeds: [createSuccessEmbed(
              `Modmail system has been enabled. Info channel: ${infoChannel}`,
              "Modmail Setup"
            )]
          });
        } else {
          // Disable modmail system
          await guildSettings.update({
            modmailEnabled: false
          });
          
          // Respond to the user
          await interaction.editReply({
            embeds: [createSuccessEmbed(
              "Modmail system has been disabled.",
              "Modmail Setup"
            )]
          });
        }
      } catch (error) {
        logger.error(`Error setting up modmail: ${error.message}`);
        await interaction.editReply({
          embeds: [createErrorEmbed(`Failed to set up modmail: ${error.message}`)]
        });
      }
    } catch (error) {
      logger.error(`Error executing modmail-setup command: ${error.message}`);
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
            ephemeral: true
          });
        } else {
          await interaction.editReply({
            embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
          });
        }
      } catch (replyError) {
        logger.error(`Failed to reply with error: ${replyError.message}`);
      }
    }
  },
  
  /**
   * Handle button interactions for this command
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    try {
      const customId = interaction.customId;
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      if (customId === 'modmail-view-info') {
        // Fetch the modmail info channel
        if (guildSettings.modmailInfoChannelId) {
          try {
            const channel = await interaction.guild.channels.fetch(guildSettings.modmailInfoChannelId);
            await interaction.reply({
              embeds: [createEmbed({
                title: '📬 ModMail Info Channel',
                description: `The ModMail info channel is ${channel}. Please check it for more information.`,
                color: '#3498db'
              })],
              ephemeral: true
            });
          } catch (err) {
            await interaction.reply({
              embeds: [createErrorEmbed(`Could not find the ModMail info channel. It may have been deleted.`)],
              ephemeral: true
            });
          }
        } else {
          await interaction.reply({
            embeds: [createErrorEmbed(`No ModMail info channel is configured for this server.`)],
            ephemeral: true
          });
        }
      } else if (customId === 'modmail-disable-confirm') {
        // Disable modmail
        await guildSettings.update({
          modmailEnabled: false
        });
        
        await interaction.update({
          embeds: [createSuccessEmbed(
            "The ModMail system has been disabled. Users can no longer create new tickets.",
            "ModMail Disabled"
          )],
          components: []
        });
      } else if (customId === 'modmail-disable-cancel') {
        // Cancel disabling modmail
        await interaction.update({
          embeds: [createEmbed({
            title: '❌ Operation Cancelled',
            description: 'The ModMail system remains enabled.',
            color: '#2ecc71'
          })],
          components: []
        });
      } else {
        await interaction.reply({
          embeds: [createErrorEmbed(`Unknown button interaction: ${customId}`)],
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error(`Error handling button interaction: ${error.message}`);
      await interaction.reply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
        ephemeral: true
      }).catch(err => logger.error(`Failed to reply with error: ${err.message}`));
    }
  }
};