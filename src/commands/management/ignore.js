const { SlashCommandBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder  } = require('discord.js');
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { models } = require('../../database/db');
const config = require('../../config');

module.exports = {
  cooldown: config.cooldowns.management,
  data: new SlashCommandBuilder()
    .setName('ignore')
    .setDescription('Configure channels and roles to ignore for logging')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Ignore or unignore a channel for logging')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to ignore or unignore')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Ignore or unignore a role for logging')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to ignore or unignore')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all ignored channels and roles')
    ),
  
  async execute(interaction, client) {
    // Check if setup has been completed
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    if (!guildSettings.setupCompleted) {
      await interaction.reply({
        embeds: [createErrorEmbed('You need to set up the logging system first. Use `/setup` to get started.')],
        flags: { ephemeral: true }
      });
      return;
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'channel') {
      await this.handleChannelCommand(interaction, guildSettings);
    } else if (subcommand === 'role') {
      await this.handleRoleCommand(interaction, guildSettings);
    } else if (subcommand === 'list') {
      await this.handleListCommand(interaction, guildSettings);
    }
  },
  
  /**
   * Handle the ignore channel command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleChannelCommand(interaction, guildSettings) {
    const channel = interaction.options.getChannel('channel');
    const ignoredChannels = guildSettings.ignoredChannels;
    
    // Check if channel is already ignored
    const isIgnored = ignoredChannels.includes(channel.id);
    
    if (isIgnored) {
      // Remove from ignored channels
      const updatedIgnoredChannels = ignoredChannels.filter(id => id !== channel.id);
      await guildSettings.update({ ignoredChannels: updatedIgnoredChannels });
      
      await interaction.reply({
        embeds: [createSuccessEmbed(`${channel} will now be logged again.`, 'Channel Unignored')],
        ephemeral: false
      });
    } else {
      // Add to ignored channels
      ignoredChannels.push(channel.id);
      await guildSettings.update({ ignoredChannels });
      
      await interaction.reply({
        embeds: [createSuccessEmbed(`${channel} will no longer be logged.`, 'Channel Ignored')],
        ephemeral: false
      });
    }
  },
  
  /**
   * Handle the ignore role command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleRoleCommand(interaction, guildSettings) {
    const role = interaction.options.getRole('role');
    const ignoredRoles = guildSettings.ignoredRoles;
    
    // Check if role is already ignored
    const isIgnored = ignoredRoles.includes(role.id);
    
    if (isIgnored) {
      // Remove from ignored roles
      const updatedIgnoredRoles = ignoredRoles.filter(id => id !== role.id);
      await guildSettings.update({ ignoredRoles: updatedIgnoredRoles });
      
      await interaction.reply({
        embeds: [createSuccessEmbed(`${role} will now be logged again.`, 'Role Unignored')],
        ephemeral: false
      });
    } else {
      // Add to ignored roles
      ignoredRoles.push(role.id);
      await guildSettings.update({ ignoredRoles });
      
      await interaction.reply({
        embeds: [createSuccessEmbed(`${role} will no longer be logged.`, 'Role Ignored')],
        ephemeral: false
      });
    }
  },
  
  /**
   * Handle the ignore list command
   * @param {Object} interaction - Discord interaction
   * @param {Object} guildSettings - Guild settings from database
   */
  async handleListCommand(interaction, guildSettings) {
    const ignoredChannels = guildSettings.ignoredChannels;
    const ignoredRoles = guildSettings.ignoredRoles;
    
    // Get channel objects
    const channelObjects = await Promise.all(
      ignoredChannels.map(async id => {
        const channel = await interaction.guild.channels.fetch(id).catch(() => null);
        return channel ? `${channel} (${id})` : `Deleted Channel (${id})`;
      })
    );
    
    // Get role objects
    const roleObjects = await Promise.all(
      ignoredRoles.map(async id => {
        const role = await interaction.guild.roles.fetch(id).catch(() => null);
        return role ? `${role} (${id})` : `Deleted Role (${id})`;
      })
    );
    
    // Create embed
    const embed = createEmbed({
      title: 'Ignored Channels & Roles',
      description: 'These channels and roles are currently being ignored by the logging system:',
      fields: [
        {
          name: '📝 Ignored Channels',
          value: channelObjects.length > 0 ? channelObjects.join('\n') : 'No ignored channels',
          inline: false
        },
        {
          name: '👑 Ignored Roles',
          value: roleObjects.length > 0 ? roleObjects.join('\n') : 'No ignored roles',
          inline: false
        }
      ]
    });
    
    // Create manage buttons
    const manageChannelsButton = new ButtonBuilder()
      .setCustomId('ignore-manage-channels')
      .setLabel('Manage Ignored Channels')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝');
    
    const manageRolesButton = new ButtonBuilder()
      .setCustomId('ignore-manage-roles')
      .setLabel('Manage Ignored Roles')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👑');
    
    const buttonRow = new ActionRowBuilder().addComponents(manageChannelsButton, manageRolesButton);
    
    await interaction.reply({
      embeds: [embed],
      components: [buttonRow],
      ephemeral: false
    });
  },
  
  /**
   * Handle button interactions
   * @param {Object} interaction - Button interaction
   * @param {Object} client - Discord client
   */
  async handleButton(interaction, client) {
    // Get guild settings
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    if (interaction.customId === 'ignore-manage-channels') {
      // Get the channels in the guild, excluding categories
      const guildChannels = interaction.guild.channels.cache.filter(
        channel => channel.type !== ChannelType.GuildCategory
      );
      
      // Get currently ignored channels
      const ignoredChannels = guildSettings.ignoredChannels;
      
      // Create channel select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ignore-channels-select')
        .setPlaceholder('Select channels to ignore')
        .setMinValues(0)
        .setMaxValues(Math.min(25, guildChannels.size)) // Discord limit of 25 options
        .addOptions(
          guildChannels.first(25).map(channel => ({
            label: channel.name.substring(0, 25), // Max 25 chars for label
            value: channel.id,
            description: `${channel.type === ChannelType.GuildText ? 'Text' : 'Voice'} Channel`,
            default: ignoredChannels.includes(channel.id)
          }))
        );
      
      const selectRow = new ActionRowBuilder().addComponents(selectMenu);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: 'Manage Ignored Channels',
          description: 'Select which channels you want to ignore:',
          fields: [
            { name: 'Instructions', value: 'Channels that are selected will be ignored. Unselected channels will be logged.' }
          ]
        })],
        components: [selectRow],
        flags: { ephemeral: true }
      });
    } else if (interaction.customId === 'ignore-manage-roles') {
      // Get the roles in the guild
      const guildRoles = interaction.guild.roles.cache.filter(
        role => !role.managed && role.id !== interaction.guild.id // Exclude managed roles and @everyone
      );
      
      // Get currently ignored roles
      const ignoredRoles = guildSettings.ignoredRoles;
      
      // Create role select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ignore-roles-select')
        .setPlaceholder('Select roles to ignore')
        .setMinValues(0)
        .setMaxValues(Math.min(25, guildRoles.size)) // Discord limit of 25 options
        .addOptions(
          guildRoles.first(25).map(role => ({
            label: role.name.substring(0, 25), // Max 25 chars for label
            value: role.id,
            description: `Ignore users with this role`,
            default: ignoredRoles.includes(role.id)
          }))
        );
      
      const selectRow = new ActionRowBuilder().addComponents(selectMenu);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: 'Manage Ignored Roles',
          description: 'Select which roles you want to ignore:',
          fields: [
            { name: 'Instructions', value: 'Roles that are selected will be ignored. Unselected roles will be logged.' }
          ]
        })],
        components: [selectRow],
        flags: { ephemeral: true }
      });
    }
  },
  
  /**
   * Handle select menu interactions
   * @param {Object} interaction - Select menu interaction
   * @param {Object} client - Discord client
   */
  async handleSelectMenu(interaction, client) {
    await interaction.deferUpdate();
    
    // Get guild settings
    const guildSettings = await models.Guild.findOrCreateGuild(interaction.guild.id);
    
    if (interaction.customId === 'ignore-channels-select') {
      // Update ignored channels
      await guildSettings.update({ ignoredChannels: interaction.values });
      
      const channelObjects = await Promise.all(
        interaction.values.map(async id => {
          const channel = await interaction.guild.channels.fetch(id).catch(() => null);
          return channel ? `${channel}` : `Unknown Channel (${id})`;
        })
      );
      
      const embed = createSuccessEmbed(
        'Ignored channels updated successfully!',
        'Channels Updated'
      );
      
      if (channelObjects.length > 0) {
        embed.addFields({ 
          name: '📝 Ignored Channels', 
          value: channelObjects.join('\n')
        });
      } else {
        embed.addFields({
          name: '📝 Ignored Channels',
          value: 'No channels are being ignored'
        });
      }
      
      await interaction.editReply({
        embeds: [embed],
        components: []
      });
    } else if (interaction.customId === 'ignore-roles-select') {
      // Update ignored roles
      await guildSettings.update({ ignoredRoles: interaction.values });
      
      const roleObjects = await Promise.all(
        interaction.values.map(async id => {
          const role = await interaction.guild.roles.fetch(id).catch(() => null);
          return role ? `${role}` : `Unknown Role (${id})`;
        })
      );
      
      const embed = createSuccessEmbed(
        'Ignored roles updated successfully!',
        'Roles Updated'
      );
      
      if (roleObjects.length > 0) {
        embed.addFields({ 
          name: '👑 Ignored Roles', 
          value: roleObjects.join('\n')
        });
      } else {
        embed.addFields({
          name: '👑 Ignored Roles',
          value: 'No roles are being ignored'
        });
      }
      
      await interaction.editReply({
        embeds: [embed],
        components: []
      });
    }
  }
};
