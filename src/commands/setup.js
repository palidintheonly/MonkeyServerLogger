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
    
    // Add a description field
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Logging system description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add a custom description for your logging system...')
      .setRequired(false)
      .setMaxLength(1000);
    
    // Add the components to the modal
    const firstActionRow = new ActionRowBuilder().addComponents(channelNameInput);
    const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
    
    // Add inputs to the modal
    modal.addComponents(firstActionRow, secondActionRow);
    
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
      
      // Find or create a guild record in the database
      const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
      
      // Create the channel if it doesn't exist
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
      
      // Update the guild settings
      await guildSettings.update({
        loggingChannelId: loggingChannel.id,
        setupCompleted: true
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
      
      // Send the category selection message
      await interaction.editReply({
        embeds: [createSuccessEmbed(`Logging channel ${loggingChannel} has been set up!`), categorySelectionEmbed],
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
      
      // Create final success embed
      const finalEmbed = createSuccessEmbed(
        `Setup completed successfully! The logging system is now active.\n\nUse \`/logs\` to manage log channels for each category, \`/ignore\` to configure ignored channels/roles, and \`/help\` to see all available commands.`,
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
          
          const setupCompleteEmbed = createEmbed({
            title: `${config.bot.name} Logging System Active`,
            description: `The logging system has been configured by ${interaction.user}.\n\nAll enabled log categories will now be reported in this channel unless configured otherwise with \`/logs\`.`,
            color: '#77B255',
            timestamp: true
          });
          
          await loggingChannel.send({ embeds: [setupCompleteEmbed] });
        } catch (error) {
          logger.error(`Error sending confirmation to logging channel: ${error.message}`);
        }
      }
    }
  }
};
