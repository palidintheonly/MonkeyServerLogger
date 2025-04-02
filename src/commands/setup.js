const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, ChannelType, SelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require('../utils/embedBuilder');
const { logger } = require('../utils/logger');
const { models } = require('../database/db');
const config = require('../config');

module.exports = {
  cooldown: config.cooldowns.setup,
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the logging system for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  /**
   * Execute the setup command
   * @param {Object} interaction - Discord interaction object
   * @param {Object} client - Discord client
   */
  async execute(interaction, client) {
    // Check if user is guild owner or has admin permission
    if (interaction.user.id !== interaction.guild.ownerId && 
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Only the server owner or administrators can use the setup command.')],
        ephemeral: true
      });
      return;
    }
    
    // Create a modal for initial setup
    const modal = new ModalBuilder()
      .setCustomId('setup-modal')
      .setTitle('Monkey Bytes Logging Setup');
    
    // Add text input for the main logging channel
    const channelNameInput = new TextInputBuilder()
      .setCustomId('channelName')
      .setLabel('Main logging channel name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(config.logging.defaultChannelName)
      .setRequired(false)
      .setMaxLength(100);
    
    // Add input for modmail channel
    const modmailChannelInput = new TextInputBuilder()
      .setCustomId('modmailChannel')
      .setLabel('Modmail channel name (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('modmail-tickets')
      .setRequired(false)
      .setMaxLength(100);
    
    // Add a description field
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Logging system description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add a custom description for your logging system...')
      .setRequired(false)
      .setMaxLength(1000);
    
    // Add toggle for enabling modmail
    const modmailToggleInput = new TextInputBuilder()
      .setCustomId('enableModmail')
      .setLabel('Enable Modmail? (yes/no)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('yes')
      .setRequired(false)
      .setMaxLength(3);
    
    // Add the components to the modal
    const firstActionRow = new ActionRowBuilder().addComponents(channelNameInput);
    const secondActionRow = new ActionRowBuilder().addComponents(modmailChannelInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(modmailToggleInput);
    const fourthActionRow = new ActionRowBuilder().addComponents(descriptionInput);
    
    // Add inputs to the modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);
    
    // Show the modal
    await interaction.showModal(modal);
  },
  
  /**
   * Handle the modal submission
   * @param {Object} interaction - Modal interaction
   * @param {Object} client - Discord client
   */
  async handleModal(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Get the input values
      const channelName = interaction.fields.getTextInputValue('channelName').trim() || config.logging.defaultChannelName;
      const description = interaction.fields.getTextInputValue('description').trim() || 'The Royal Court logging system powered by Monkey Bytes.';
      const modmailChannelName = interaction.fields.getTextInputValue('modmailChannel').trim() || 'modmail-tickets';
      
      // Check if modmail should be enabled
      let enableModmail = false;
      try {
        const modmailToggle = interaction.fields.getTextInputValue('enableModmail').trim().toLowerCase();
        enableModmail = modmailToggle === 'yes' || modmailToggle === 'y';
      } catch (error) {
        // If field is missing or empty, default to false
        enableModmail = false;
      }
      
      // Find or create a guild record in the database
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Create the logging channel if it doesn't exist
      let loggingChannel;
      
      if (guildSettings.loggingChannelId) {
        // Try to use existing channel
        loggingChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId).catch(() => null);
      }
      
      if (!loggingChannel) {
        // Create a new channel
        loggingChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: `${config.bot.name} - ${config.bot.slogan} | Logging Channel`,
          reason: 'Monkey Bytes Logging System Setup'
        });
        
        logger.info(`Created logging channel ${loggingChannel.name} in ${interaction.guild.name}`);
      }
      
      // Set up modmail category and channel if enabled
      let modmailChannel = null;
      let modmailCategoryId = null;
      
      if (enableModmail) {
        try {
          // Create or find a modmail category
          let modmailCategory = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === 'MODMAIL TICKETS'
          );
          
          if (!modmailCategory) {
            modmailCategory = await interaction.guild.channels.create({
              name: 'MODMAIL TICKETS',
              type: ChannelType.GuildCategory,
              permissionOverwrites: [
                {
                  id: interaction.guild.id, // @everyone role
                  deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                  id: interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.ownerId,
                  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }
              ]
            });
            
            logger.info(`Created modmail category in ${interaction.guild.name}`);
          }
          
          modmailCategoryId = modmailCategory.id;
          
          // Create a welcome/info channel for modmail in the category
          modmailChannel = await interaction.guild.channels.create({
            name: modmailChannelName,
            type: ChannelType.GuildText,
            parent: modmailCategory.id,
            topic: 'Modmail system information and tickets'
          });
          
          // Create welcome message for modmail channel
          const modmailWelcomeEmbed = createEmbed({
            title: '📬 Modmail System',
            description: 'This channel is for the modmail system. Users who DM the bot will have their messages forwarded here. Staff can reply to these messages using the `/modmail` commands.',
            fields: [
              {
                name: '📋 Available Commands',
                value: '`/modmail reply` - Reply to a user via modmail\n`/modmail close` - Close a modmail thread\n`/modmail block` - Block a user from using modmail\n`/modmail unblock` - Unblock a user from modmail'
              },
              {
                name: '⚠️ Important Notes',
                value: '- When users DM the bot, a new channel will be created under this category\n- Only members with access to this category can view modmail conversations\n- Be professional in your responses as you represent the server'
              }
            ],
            color: '#5865F2',
            timestamp: true
          });
          
          await modmailChannel.send({ embeds: [modmailWelcomeEmbed] });
          logger.info(`Created modmail info channel ${modmailChannel.name} in ${interaction.guild.name}`);
          
          // Set environment variable for this server as support guild if requested
          if (process.env.SUPPORT_GUILD_ID === undefined || process.env.SUPPORT_GUILD_ID === '') {
            process.env.SUPPORT_GUILD_ID = interaction.guild.id;
            logger.info(`Set ${interaction.guild.name} (${interaction.guild.id}) as SUPPORT_GUILD_ID for modmail system`);
          }
        } catch (error) {
          logger.error(`Error setting up modmail: ${error.message}`);
        }
      }
      
      // Update the guild settings
      await guildSettings.update({
        loggingChannelId: loggingChannel.id,
        setupCompleted: true,
        modmailEnabled: enableModmail,
        modmailCategoryId: modmailCategoryId,
        modmailInfoChannelId: modmailChannel?.id
      });
      
      // Create the welcome embed for the logging channel
      const welcomeEmbed = createEmbed({
        title: `${config.bot.name} Logging System`,
        description: description,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        fields: [
          { name: '🔧 Configuration', value: 'Use `/logs` to configure individual log categories and channels.' },
          { name: '⚠️ Permissions', value: 'Make sure this channel has limited visibility to server staff only.' },
          { name: '🛠️ Additional Setup', value: 'Use `/help` to see all available commands.' }
        ]
      });
      
      // Add modmail info to welcome embed if enabled
      if (enableModmail) {
        welcomeEmbed.addFields({
          name: '📬 Modmail System',
          value: `The modmail system has been enabled. Check ${modmailChannel} for details on how it works.`
        });
      }
      
      // Send the welcome message to the logging channel
      await loggingChannel.send({ embeds: [welcomeEmbed] });
      
      // Send category selection message
      const categorySelectionEmbed = createEmbed({
        title: 'Log Category Setup',
        description: 'Select which log categories you want to enable or disable:',
        fields: Object.entries(config.logging.categories).map(([key, category]) => ({
          name: `${category.emoji} ${category.name}`,
          value: category.description,
          inline: true
        }))
      });
      
      // Create select menu for categories
      const categorySelect = new SelectMenuBuilder()
        .setCustomId('setup-categories')
        .setPlaceholder('Select categories to configure')
        .setMinValues(1)
        .setMaxValues(Object.keys(config.logging.categories).length)
        .addOptions(Object.entries(config.logging.categories).map(([key, category]) => ({
          label: category.name,
          value: key,
          description: `${category.description.substring(0, 90)}...`,
          emoji: category.emoji,
          default: category.enabled
        })));
      
      const selectRow = new ActionRowBuilder().addComponents(categorySelect);
      
      // Create confirm button
      const confirmButton = new ButtonBuilder()
        .setCustomId('setup-confirm')
        .setLabel('Confirm Setup')
        .setStyle(ButtonStyle.Success);
      
      const buttonRow = new ActionRowBuilder().addComponents(confirmButton);
      
      // Create setup success message
      let setupSuccessMessage = `Logging channel ${loggingChannel} has been set up!`;
      if (enableModmail) {
        setupSuccessMessage += `\nModmail system has been enabled in the ${modmailChannel} channel.`;
      }
      
      // Send the category selection message
      await interaction.editReply({
        embeds: [createSuccessEmbed(setupSuccessMessage), categorySelectionEmbed],
        components: [selectRow, buttonRow]
      });
      
    } catch (error) {
      logger.error(`Error in setup modal handler: ${error.message}`);
      await interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred during setup: ${error.message}`)],
        ephemeral: true
      });
    }
  },
  
  /**
   * Handle select menu interactions
   * @param {Object} interaction - Select menu interaction
   * @param {Object} client - Discord client
   */
  async handleSelectMenu(interaction, client) {
    if (interaction.customId === 'setup-categories') {
      await interaction.deferUpdate();
      
      // Get the selected categories
      const selectedCategories = interaction.values;
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Create enabled categories object
      const enabledCategories = {};
      
      // Set all categories to disabled initially
      Object.keys(config.logging.categories).forEach(category => {
        enabledCategories[category] = selectedCategories.includes(category);
      });
      
      // Update guild settings with enabled categories
      await guildSettings.update({
        enabledCategories: enabledCategories
      });
      
      // Update the embed to show selected categories
      const updatedEmbed = createEmbed({
        title: 'Log Category Setup',
        description: 'You have selected the following categories:',
        fields: Object.entries(config.logging.categories)
          .filter(([key]) => selectedCategories.includes(key))
          .map(([key, category]) => ({
            name: `${category.emoji} ${category.name}`,
            value: category.description,
            inline: true
          }))
      });
      
      // Update the message
      await interaction.editReply({
        embeds: [createSuccessEmbed('Categories updated!'), updatedEmbed],
        components: interaction.message.components
      });
    }
  },
  
  /**
   * Handle button interactions
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    if (interaction.customId === 'setup-confirm') {
      await interaction.deferUpdate();
      
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Build success message
      let successMessage = `Setup completed successfully! The logging system is now active.\n\nUse \`/logs\` to manage log channels for each category, \`/ignore\` to configure ignored channels/roles, and \`/help\` to see all available commands.`;
      
      // Add modmail info if enabled
      if (guildSettings.modmailEnabled) {
        successMessage += `\n\n📬 **Modmail System**\nThe modmail system is active. Users can send direct messages to the bot to contact staff. Staff can reply using \`/modmail reply\` in the modmail channels.`;
      }
      
      // Create final success embed
      const finalEmbed = createSuccessEmbed(
        successMessage,
        '✅ Setup Complete'
      );
      
      // Remove components from the message
      await interaction.editReply({
        embeds: [finalEmbed],
        components: []
      });
      
      // Send a message to the logging channel
      if (guildSettings.loggingChannelId) {
        try {
          const loggingChannel = await interaction.guild.channels.fetch(guildSettings.loggingChannelId);
          
          // Build the setup complete embed fields
          const fields = [
            {
              name: '📝 Log Categories',
              value: 'All enabled log categories will be reported in this channel unless configured otherwise with `/logs`.',
              inline: false
            }
          ];
          
          // Add modmail field if enabled
          if (guildSettings.modmailEnabled && guildSettings.modmailInfoChannelId) {
            try {
              const modmailChannel = await interaction.guild.channels.fetch(guildSettings.modmailInfoChannelId);
              if (modmailChannel) {
                fields.push({
                  name: '📬 Modmail System',
                  value: `The modmail system is active. Check ${modmailChannel} for more information.`,
                  inline: false
                });
              }
            } catch (error) {
              logger.error(`Error fetching modmail channel: ${error.message}`);
            }
          }
          
          const setupCompleteEmbed = createEmbed({
            title: `${config.bot.name} Logging System Active`,
            description: `The logging system has been configured by ${interaction.user}.`,
            color: '#77B255',
            timestamp: true,
            fields: fields
          });
          
          await loggingChannel.send({ embeds: [setupCompleteEmbed] });
        } catch (error) {
          logger.error(`Error sending confirmation to logging channel: ${error.message}`);
        }
      }
    }
  }
};
