/**
 * Clear Database Command
 * Clears database entries with options to select what server to clear
 */
const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { createInfoEmbed, createWarningEmbed, createSuccessEmbed, createErrorEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');
const { sequelize } = require('../../database/db');
const { safeReply } = require('../../utils/interactionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear-database')
    .setDescription('Clear database entries with options to select what server to clear')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('guild')
        .setDescription('Clear data for a specific guild/server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('modmail')
        .setDescription('Clear all modmail threads')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Clear all database tables (warning: irreversible)')
    ),
  
  // This command can only be used in a guild
  guildOnly: true,
  
  // Development servers only
  devOnly: true,

  // 10 second cooldown
  cooldown: 10,
  
  async execute(interaction, client) {
    // Defer the reply as this might take a moment
    await interaction.deferReply();
    
    // Only allow the bot owner to use this command
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.editReply({
        embeds: [createErrorEmbed('This command is only available to the bot owner.')]
      });
    }
    
    try {
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'guild':
          return this.handleGuildClear(interaction, client);
        case 'modmail':
          return this.handleModmailClear(interaction, client);
        case 'all':
          return this.handleAllClear(interaction, client);
        default:
          return interaction.editReply({
            embeds: [createErrorEmbed('Invalid subcommand. Please try again.')]
          });
      }
    } catch (error) {
      logger.error(`Error executing clear-database command: ${error.message}`, { error });
      return interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle guild data clearing
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async handleGuildClear(interaction, client) {
    try {
      // Get all guilds from the database
      const guilds = await client.db.Guild.findAll();
      
      if (guilds.length === 0) {
        return interaction.editReply({
          embeds: [createInfoEmbed('No guild data found in the database.')]
        });
      }
      
      // Create a select menu with guild options
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('clear-guild-select')
        .setPlaceholder('Select a guild to clear')
        .addOptions(
          guilds.map(guild => ({
            label: guild.guildName || `Guild ${guild.guildId}`,
            description: `ID: ${guild.guildId}`,
            value: guild.guildId
          }))
        );
      
      const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu);
      
      const message = await interaction.editReply({
        embeds: [createInfoEmbed(
          'Select a guild to clear from the database.\n\n' +
          '**Warning:** This will remove all settings and data for the selected guild. ' +
          'This action cannot be undone.',
          'Clear Guild Data'
        )],
        components: [actionRow]
      });
      
      // Set up collector for the select menu
      const filter = i => i.customId === 'clear-guild-select' && i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({ filter, time: 60000 });
      
      collector.on('collect', async i => {
        const guildId = i.values[0];
        
        // Confirm deletion with buttons
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`confirm-clear-guild-${guildId}`)
              .setLabel('Confirm Delete')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('cancel-clear-guild')
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Secondary)
          );
        
        // Find the selected guild
        const selectedGuild = guilds.find(g => g.guildId === guildId);
        const guildName = selectedGuild?.guildName || `Guild ${guildId}`;
        
        await i.update({
          embeds: [createWarningEmbed(
            `Are you sure you want to clear all data for **${guildName}**?\n\n` +
            'This action cannot be undone.',
            'Confirm Deletion'
          )],
          components: [confirmRow]
        });
        
        // Set up collector for the confirmation buttons
        const buttonFilter = i => i.customId.startsWith('confirm-clear-guild') || i.customId === 'cancel-clear-guild';
        const buttonCollector = message.createMessageComponentCollector({ filter: buttonFilter, time: 30000 });
        
        buttonCollector.on('collect', async i => {
          if (i.customId === 'cancel-clear-guild') {
            await i.update({
              embeds: [createInfoEmbed('Guild deletion cancelled.')],
              components: []
            });
            buttonCollector.stop();
            return;
          }
          
          if (i.customId === `confirm-clear-guild-${guildId}`) {
            try {
              // Delete the guild from the database
              const guild = await client.db.Guild.findByPk(guildId);
              if (guild) {
                await guild.destroy();
                await i.update({
                  embeds: [createSuccessEmbed(`Successfully deleted all data for guild **${guildName}**.`)],
                  components: []
                });
              } else {
                await i.update({
                  embeds: [createErrorEmbed(`Guild **${guildName}** not found.`)],
                  components: []
                });
              }
              buttonCollector.stop();
            } catch (error) {
              logger.error(`Error deleting guild ${guildId}: ${error.message}`, { error });
              await i.update({
                embeds: [createErrorEmbed(`An error occurred while deleting the guild: ${error.message}`)],
                components: []
              });
              buttonCollector.stop();
            }
          }
        });
        
        buttonCollector.on('end', async (collected, reason) => {
          if (reason === 'time' && collected.size === 0) {
            await interaction.editReply({
              embeds: [createInfoEmbed('Confirmation timed out. Guild deletion cancelled.')],
              components: []
            });
          }
        });
        
        collector.stop();
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            embeds: [createInfoEmbed('Selection timed out. Command cancelled.')],
            components: []
          });
        }
      });
    } catch (error) {
      logger.error(`Error handling guild clear: ${error.message}`, { error });
      return interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle modmail data clearing
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async handleModmailClear(interaction, client) {
    try {
      // Get count of modmail threads
      const count = await client.db.ModmailThread.count();
      
      if (count === 0) {
        return interaction.editReply({
          embeds: [createInfoEmbed('No modmail threads found in the database.')]
        });
      }
      
      // Create confirmation buttons
      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm-clear-modmail')
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel-clear-modmail')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
      
      const message = await interaction.editReply({
        embeds: [createWarningEmbed(
          `Are you sure you want to clear all **${count} modmail threads** from the database?\n\n` +
          'This will remove all modmail history and cannot be undone.',
          'Confirm Modmail Deletion'
        )],
        components: [confirmRow]
      });
      
      // Set up collector for the confirmation buttons
      const filter = i => (i.customId === 'confirm-clear-modmail' || i.customId === 'cancel-clear-modmail') && 
                          i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({ filter, time: 30000 });
      
      collector.on('collect', async i => {
        if (i.customId === 'cancel-clear-modmail') {
          await i.update({
            embeds: [createInfoEmbed('Modmail deletion cancelled.')],
            components: []
          });
          collector.stop();
          return;
        }
        
        if (i.customId === 'confirm-clear-modmail') {
          try {
            // Delete all modmail threads
            await client.db.ModmailThread.destroy({ where: {} });
            await i.update({
              embeds: [createSuccessEmbed(`Successfully deleted all ${count} modmail threads.`)],
              components: []
            });
            collector.stop();
          } catch (error) {
            logger.error(`Error deleting modmail threads: ${error.message}`, { error });
            await i.update({
              embeds: [createErrorEmbed(`An error occurred while deleting modmail threads: ${error.message}`)],
              components: []
            });
            collector.stop();
          }
        }
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            embeds: [createInfoEmbed('Confirmation timed out. Modmail deletion cancelled.')],
            components: []
          });
        }
      });
    } catch (error) {
      logger.error(`Error handling modmail clear: ${error.message}`, { error });
      return interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
      });
    }
  },
  
  /**
   * Handle clearing all database tables
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async handleAllClear(interaction, client) {
    try {
      // Get a list of all tables
      const tableResults = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
        { type: sequelize.QueryTypes.SELECT }
      );
      
      const tables = tableResults.map(result => result.name);
      
      // Create confirmation buttons
      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm-clear-all')
            .setLabel('Confirm Complete Reset')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel-clear-all')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
      
      const message = await interaction.editReply({
        embeds: [createWarningEmbed(
          `⚠️ **DANGER ZONE** ⚠️\n\n` +
          `You are about to delete ALL data from ${tables.length} tables:\n` +
          `\`${tables.join('`, `')}\`\n\n` +
          'This will reset the entire bot database and cannot be undone.\n' +
          'Are you absolutely sure you want to proceed?',
          'Confirm Complete Database Reset'
        )],
        components: [confirmRow]
      });
      
      // Set up collector for the confirmation buttons
      const filter = i => (i.customId === 'confirm-clear-all' || i.customId === 'cancel-clear-all') && 
                          i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({ filter, time: 30000 });
      
      collector.on('collect', async i => {
        if (i.customId === 'cancel-clear-all') {
          await i.update({
            embeds: [createInfoEmbed('Database reset cancelled.')],
            components: []
          });
          collector.stop();
          return;
        }
        
        if (i.customId === 'confirm-clear-all') {
          try {
            // Create a processing message
            await i.update({
              embeds: [createInfoEmbed('Processing database reset...')],
              components: []
            });
            
            // Clear each table using TRUNCATE (for SQLite this is DELETE FROM)
            for (const table of tables) {
              // Skip SequelizeMeta table if it exists (used for migrations)
              if (table === 'SequelizeMeta') {
                logger.info(`Skipping migration table: ${table}`);
                continue;
              }
              
              logger.info(`Clearing table: ${table}`);
              await sequelize.query(`DELETE FROM "${table}";`);
              
              // Reset SQLite sequences if they exist
              try {
                await sequelize.query(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
              } catch (seqError) {
                // Ignore errors for tables without auto-increment
                logger.debug(`Note: Could not reset sequence for ${table}: ${seqError.message}`);
              }
            }
            
            await interaction.editReply({
              embeds: [createSuccessEmbed(
                `Successfully reset the entire database.\n` +
                `All ${tables.length} tables have been cleared.`,
                'Database Reset Complete'
              )],
              components: []
            });
            collector.stop();
          } catch (error) {
            logger.error(`Error clearing all tables: ${error.message}`, { error });
            await interaction.editReply({
              embeds: [createErrorEmbed(`An error occurred while resetting the database: ${error.message}`)],
              components: []
            });
            collector.stop();
          }
        }
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            embeds: [createInfoEmbed('Confirmation timed out. Database reset cancelled.')],
            components: []
          });
        }
      });
    } catch (error) {
      logger.error(`Error handling database clear: ${error.message}`, { error });
      return interaction.editReply({
        embeds: [createErrorEmbed(`An error occurred: ${error.message}`)]
      });
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
      
      // Handle guild clear cancel button
      if (customId === 'cancel-clear-guild') {
        await interaction.update({
          embeds: [createInfoEmbed('Guild deletion cancelled.')],
          components: []
        });
        return true;
      }
      
      // Handle guild clear confirm button
      if (customId.startsWith('confirm-clear-guild-')) {
        const guildId = customId.replace('confirm-clear-guild-', '');
        
        // Find the guild in the database
        const guild = await client.db.Guild.findByPk(guildId);
        
        if (!guild) {
          await interaction.update({
            embeds: [createErrorEmbed(`Guild with ID ${guildId} not found.`)],
            components: []
          });
          return true;
        }
        
        const guildName = guild.guildName || `Guild ${guildId}`;
        
        try {
          // Delete the guild from the database
          await guild.destroy();
          await interaction.update({
            embeds: [createSuccessEmbed(`Successfully deleted all data for guild **${guildName}**.`)],
            components: []
          });
        } catch (error) {
          logger.error(`Error deleting guild ${guildId}: ${error.message}`, { error });
          await interaction.update({
            embeds: [createErrorEmbed(`An error occurred while deleting the guild: ${error.message}`)],
            components: []
          });
        }
        return true;
      }
      
      // Handle modmail clear cancel button
      if (customId === 'cancel-clear-modmail') {
        await interaction.update({
          embeds: [createInfoEmbed('Modmail deletion cancelled.')],
          components: []
        });
        return true;
      }
      
      // Handle modmail clear confirm button
      if (customId === 'confirm-clear-modmail') {
        try {
          // Get count first for the message
          const count = await client.db.ModmailThread.count();
          
          // Delete all modmail threads
          await client.db.ModmailThread.destroy({ where: {} });
          await interaction.update({
            embeds: [createSuccessEmbed(`Successfully deleted all ${count} modmail threads.`)],
            components: []
          });
        } catch (error) {
          logger.error(`Error deleting modmail threads: ${error.message}`, { error });
          await interaction.update({
            embeds: [createErrorEmbed(`An error occurred while deleting modmail threads: ${error.message}`)],
            components: []
          });
        }
        return true;
      }
      
      // Handle all clear cancel button
      if (customId === 'cancel-clear-all') {
        await interaction.update({
          embeds: [createInfoEmbed('Database reset cancelled.')],
          components: []
        });
        return true;
      }
      
      // Handle all clear confirm button
      if (customId === 'confirm-clear-all') {
        try {
          // Create a processing message
          await interaction.update({
            embeds: [createInfoEmbed('Processing database reset...')],
            components: []
          });
          
          // Get a list of all tables
          const tableResults = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
            { type: sequelize.QueryTypes.SELECT }
          );
          
          const tables = tableResults.map(result => result.name);
          
          // Clear each table using TRUNCATE (for SQLite this is DELETE FROM)
          for (const table of tables) {
            // Skip SequelizeMeta table if it exists (used for migrations)
            if (table === 'SequelizeMeta') {
              logger.info(`Skipping migration table: ${table}`);
              continue;
            }
            
            logger.info(`Clearing table: ${table}`);
            await sequelize.query(`DELETE FROM "${table}";`);
            
            // Reset SQLite sequences if they exist
            try {
              await sequelize.query(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
            } catch (seqError) {
              // Ignore errors for tables without auto-increment
              logger.debug(`Note: Could not reset sequence for ${table}: ${seqError.message}`);
            }
          }
          
          await interaction.editReply({
            embeds: [createSuccessEmbed(
              `Successfully reset the entire database.\n` +
              `All ${tables.length} tables have been cleared.`,
              'Database Reset Complete'
            )],
            components: []
          });
        } catch (error) {
          logger.error(`Error clearing all tables: ${error.message}`, { error });
          await interaction.editReply({
            embeds: [createErrorEmbed(`An error occurred while resetting the database: ${error.message}`)],
            components: []
          });
        }
        return true;
      }
      
      // If we reached here, the button wasn't handled
      return false;
    } catch (error) {
      logger.error(`Error handling button in clear-database: ${error.message}`, { error });
      return false;
    }
  }
};