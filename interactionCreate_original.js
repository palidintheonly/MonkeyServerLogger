const { Collection, InteractionType } = require('discord.js');
const { logger } = require('../../utils/logger');
const { createErrorEmbed } = require('../../utils/embedBuilder');
const { createLoader } = require('../../utils/loadingIndicator');
const config = require('../../config');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // Initialize cooldowns collection if it doesn't exist
    if (!client.cooldowns) client.cooldowns = new Collection();
    
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        logger.warn(`Command ${interaction.commandName} not found`);
        return;
      }
      
      // Check for cooldown
      const { cooldowns } = client;
      if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
      }
      
      const now = Date.now();
      const timestamps = cooldowns.get(command.data.name);
      const cooldownAmount = (command.cooldown ?? config.cooldowns.default) * 1000;
      
      if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
        
        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          await interaction.reply({
            embeds: [createErrorEmbed(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.data.name}\` command.`)],
            ephemeral: true
          });
          return;
        }
      }
      
      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
      
      // Store the loader in client to allow commands to access it
      if (!client.activeLoaders) {
        client.activeLoaders = new Collection();
      }
      
      // Execute command with loading indicator if applicable
      try {
        logger.info(`${interaction.user.tag} used command: ${interaction.commandName}`);
        
        // Check if command should use a loading indicator (most commands should)
        // Simple commands like ping don't need it
        const skipLoadingFor = ['ping', 'help', 'invite'];
        
        if (!skipLoadingFor.includes(interaction.commandName) && !command.skipLoading) {
          // Create a loading indicator
          const commandLabel = interaction.commandName.charAt(0).toUpperCase() + 
                               interaction.commandName.slice(1);
          
          const loadingText = `Processing ${commandLabel} command...`;
          const animationStyle = command.loadingStyle || 'dots';
          const colorTheme = command.loadingColor || 'blue';
          
          // Create and start the loader
          const loader = createLoader(interaction, {
            text: loadingText,
            style: animationStyle,
            color: colorTheme,
            ephemeral: command.ephemeral === true
          });
          
          // Store the loader for the command to use
          client.activeLoaders.set(interaction.id, loader);
          
          // Execute the command
          await command.execute(interaction, client);
          
          // If the loader wasn't stopped by the command, stop it now
          if (!loader.stopped) {
            await loader.stop({
              text: `${commandLabel} command completed successfully.`,
              success: true
            });
          }
        } else {
          // Execute without loading animation
          await command.execute(interaction, client);
        }
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        
        // Try to stop any active loader with an error message
        const loader = client.activeLoaders.get(interaction.id);
        if (loader && !loader.stopped) {
          await loader.stop({
            text: 'There was an error while executing this command!',
            success: false
          });
          client.activeLoaders.delete(interaction.id);
          return;
        }
        
        // Fallback error handling if no loader was active
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            embeds: [createErrorEmbed(errorMessage)],
            flags: { ephemeral: true }
          });
        } else {
          await interaction.reply({
            embeds: [createErrorEmbed(errorMessage)],
            flags: { ephemeral: true }
          });
        }
      }
    }
    
    // Handle context menu commands (user and message)
    else if (interaction.isContextMenuCommand()) {
      const command = client.contextCommands.get(interaction.commandName);
      
      if (!command) {
        logger.warn(`Context command ${interaction.commandName} not found in contextCommands collection. Checking main commands collection as fallback...`);
        // Try to find in regular commands as fallback
        const fallbackCommand = client.commands.get(interaction.commandName);
        if (!fallbackCommand) {
          logger.error(`Context command ${interaction.commandName} not found in any command collection`);
          return;
        }
        logger.info(`Found context command in main commands collection: ${interaction.commandName}`);
        try {
          await fallbackCommand.execute(interaction, client);
          return;
        } catch (error) {
          logger.error(`Error executing fallback context command ${interaction.commandName}:`, error);
          return;
        }
      }
      
      try {
        logger.info(`${interaction.user.tag} used context menu: ${interaction.commandName}`);
        
        // Use loading indicator for context menu commands
        if (!command.skipLoading) {
          // Create a loading indicator
          const commandLabel = interaction.commandName;
          
          const loadingText = `Processing ${commandLabel}...`;
          const animationStyle = command.loadingStyle || 'dots';
          const colorTheme = command.loadingColor || 'purple';
          
          // Create and start the loader
          const loader = createLoader(interaction, {
            text: loadingText,
            style: animationStyle,
            color: colorTheme,
            ephemeral: command.ephemeral === true
          });
          
          // Store the loader for the command to use
          if (!client.activeLoaders) client.activeLoaders = new Collection();
          client.activeLoaders.set(interaction.id, loader);
          
          // Execute the command
          await command.execute(interaction, client);
          
          // If the loader wasn't stopped by the command, stop it now
          if (!loader.stopped) {
            await loader.stop({
              text: `${commandLabel} completed successfully.`,
              success: true
            });
          }
        } else {
          // Execute without loading animation
          await command.execute(interaction, client);
        }
      } catch (error) {
        logger.error(`Error executing context command ${interaction.commandName}:`, error);
        
        // Try to stop any active loader with an error message
        if (client.activeLoaders && client.activeLoaders.has(interaction.id)) {
          const loader = client.activeLoaders.get(interaction.id);
          if (loader && !loader.stopped) {
            await loader.stop({
              text: 'There was an error while executing this command!',
              success: false
            });
            client.activeLoaders.delete(interaction.id);
            return;
          }
        }
        
        // Reply with error message
        const errorMessage = 'There was an error while executing this context menu command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            embeds: [createErrorEmbed(errorMessage)],
            flags: { ephemeral: true }
          });
        } else {
          await interaction.reply({
            embeds: [createErrorEmbed(errorMessage)],
            flags: { ephemeral: true }
          });
        }
      }
    }
    
    // Handle modals
    else if (interaction.type === InteractionType.ModalSubmit) {
      // Handle different types of modals based on customId
      if (interaction.customId.startsWith('setup-modal')) {
        // Inform user that modal setup has been replaced with direct options
        try {
          await interaction.reply({
            embeds: [createErrorEmbed('The setup process now uses direct slash command options. Please use the `/setup wizard` command with options instead of modal forms.')],
            flags: { ephemeral: true }
          });
          logger.info(`User ${interaction.user.tag} attempted to use the old setup modal`);
        } catch (error) {
          logger.error(`Error responding to setup modal: ${error.message}`);
        }
      } else if (interaction.customId.startsWith('report_message_')) {
        // Message report modal from context menu
        const reportCommand = client.contextCommands.get('Report Message');
        if (reportCommand && reportCommand.handleModal) {
          try {
            await reportCommand.handleModal(interaction, client);
          } catch (error) {
            logger.error(`Error handling report modal submission: ${error.message}`);
            await interaction.reply({
              embeds: [createErrorEmbed('There was an error processing your report!')],
              flags: { ephemeral: true }
            });
          }
        } else {
          // Try to find in regular commands as fallback
          logger.warn('Report Message not found in contextCommands, checking main commands...');
          const fallbackReportCommand = client.commands.get('Report Message');
          if (fallbackReportCommand && fallbackReportCommand.handleModal) {
            try {
              await fallbackReportCommand.handleModal(interaction, client);
            } catch (error) {
              logger.error(`Error handling report modal submission from fallback: ${error.message}`);
              await interaction.reply({
                embeds: [createErrorEmbed('There was an error processing your report!')],
                flags: { ephemeral: true }
              });
            }
          } else {
            logger.error('Report Message command not found in any command collection');
          }
        }
      } else if (interaction.customId.startsWith('modmail_reply_')) {
        // Modmail reply modal
        const modmailCommand = client.commands.get('modmail');
        if (modmailCommand && modmailCommand.handleModal) {
          try {
            await modmailCommand.handleModal(interaction, client);
          } catch (error) {
            logger.error(`Error handling modmail reply modal: ${error.message}`);
            await interaction.reply({
              embeds: [createErrorEmbed('There was an error sending your reply!')],
              flags: { ephemeral: true }
            });
          }
        }
      }
    }
    
    // Handle select menus
    else if (interaction.isStringSelectMenu()) {
      // Handle modmail server selection
      if (interaction.customId === 'modmail_server_select') {
        try {
          // Get the selected guild ID
          const selectedGuildId = interaction.values[0];
          const guild = client.guilds.cache.get(selectedGuildId);
          
          if (!guild) {
            logger.error(`Selected guild ${selectedGuildId} not found`);
            await interaction.update({
              content: 'The selected server was not found. Please try contacting a different server.',
              components: [],
              embeds: []
            });
            return;
          }
          
          // Get the pending message
          const pendingMessage = client.pendingModmailMessages.get(interaction.user.id);
          if (!pendingMessage) {
            logger.warn(`No pending message found for user ${interaction.user.tag}`);
            await interaction.update({
              content: 'Your message has expired. Please send a new message to start a modmail thread.',
              components: [],
              embeds: []
            });
            return;
          }
          
          // Update the interaction to acknowledge the selection
          await interaction.update({
            content: `You've selected to contact **${guild.name}**. Your message has been forwarded to their staff team.`,
            components: [],
            embeds: []
          });
          
          // Get the modmail handler
          const modmailHandlerFile = require('./directMessageCreate.js');
          if (!modmailHandlerFile.processModmail) {
            logger.error('Modmail processModmail method not found');
            return;
          }
          
          // Get the original message that triggered the modmail
          const pendingData = client.pendingModmailMessages.get(interaction.user.id);
          const originalMessage = interaction.message.reference?.messageId 
            ? await interaction.channel.messages.fetch(interaction.message.reference.messageId).catch(() => null)
            : interaction.message;
            
          // Process the modmail with the selected guild
          const isNewConversation = !client.activeModmailThreads?.has(interaction.user.id);
          await modmailHandlerFile.processModmail(originalMessage, client, guild, isNewConversation);
          
          // Clear the pending message
          client.pendingModmailMessages.delete(interaction.user.id);
          
        } catch (error) {
          logger.error(`Error handling modmail server selection: ${error.message}`);
          await interaction.update({
            content: 'There was an error processing your selection. Please try sending a new message.',
            components: [],
            embeds: []
          });
        }
        return;
      }
      
      // Extract command name from customId (format: command-name-action)
      const [commandName] = interaction.customId.split('-');
      
      const command = client.commands.get(commandName);
      if (command && command.handleSelectMenu) {
        try {
          // Use loading indicator for select menu interactions
          if (!command.skipLoadingSelects) {
            // Extract the action from the customId (format: command-action-id)
            const customIdParts = interaction.customId.split('-');
            const action = customIdParts.length > 1 ? customIdParts[1] : 'selection';
            
            const loadingText = `Processing ${action}...`;
            const animationStyle = command.loadingStyle || 'bounce';
            const colorTheme = command.loadingColor || 'blue';
            
            // Create and start the loader
            const loader = createLoader(interaction, {
              text: loadingText,
              style: animationStyle,
              color: colorTheme,
              ephemeral: false
            });
            
            // Store the loader for the command to use
            if (!client.activeLoaders) client.activeLoaders = new Collection();
            client.activeLoaders.set(interaction.id, loader);
            
            // Execute the select menu handler
            await command.handleSelectMenu(interaction, client);
            
            // If the loader wasn't stopped by the command, stop it now
            if (!loader.stopped) {
              await loader.stop({
                text: `Selection processed successfully.`,
                success: true
              });
            }
          } else {
            // Execute without loading animation
            await command.handleSelectMenu(interaction, client);
          }
        } catch (error) {
          logger.error(`Error handling select menu ${interaction.customId}:`, error);
          
          // Try to stop any active loader with an error message
          if (client.activeLoaders && client.activeLoaders.has(interaction.id)) {
            const loader = client.activeLoaders.get(interaction.id);
            if (loader && !loader.stopped) {
              await loader.stop({
                text: 'There was an error processing your selection!',
                success: false
              });
              client.activeLoaders.delete(interaction.id);
              return;
            }
          }
          
          await interaction.reply({
            embeds: [createErrorEmbed('There was an error processing your selection!')],
            flags: { ephemeral: true }
          });
        }
      }
    }
    
    // Handle buttons
    else if (interaction.isButton()) {
      // Handle special button interactions first
      if (interaction.customId.startsWith('setup-')) {
        const setupCommand = client.commands.get('setup');
        if (setupCommand && setupCommand.handleButton) {
          try {
            await setupCommand.handleButton(interaction, client);
            return;
          } catch (error) {
            logger.error(`Error handling setup button ${interaction.customId}:`, error);
            // Try to respond with an error message if possible
            try {
              if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                  embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
                  flags: { ephemeral: true }
                });
              } else {
                await interaction.followUp({
                  embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
                  flags: { ephemeral: true }
                });
              }
            } catch (replyError) {
              logger.error(`Failed to send error reply for setup button: ${replyError.message}`);
            }
            return;
          }
        }
      }
      
      // Handle reset command buttons
      if (interaction.customId.startsWith('reset-')) {
        const resetCommand = client.commands.get('reset');
        if (resetCommand && resetCommand.handleButton) {
          try {
            await resetCommand.handleButton(interaction, client);
            return;
          } catch (error) {
            logger.error(`Error handling reset button ${interaction.customId}:`, error);
            // Try to respond with an error message if possible
            try {
              if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                  embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
                  flags: { ephemeral: true }
                });
              } else {
                await interaction.followUp({
                  embeds: [createErrorEmbed(`An error occurred: ${error.message}`)],
                  flags: { ephemeral: true }
                });
              }
            } catch (replyError) {
              logger.error(`Failed to send error reply for reset button: ${replyError.message}`);
            }
            return;
          }
        }
      }
      
      // Handle other button interactions (format: command-action-id)
      const [commandName] = interaction.customId.split('-');
      
      const command = client.commands.get(commandName);
      if (command && command.handleButton) {
        try {
          // Use loading indicator for button interactions
          if (!command.skipLoadingButtons) {
            // Extract the action from the customId (format: command-action-id)
            const customIdParts = interaction.customId.split('-');
            const action = customIdParts.length > 1 ? customIdParts[1] : 'action';
            
            const loadingText = `Processing ${action}...`;
            const animationStyle = command.loadingStyle || 'spin';
            const colorTheme = command.loadingColor || 'green';
            
            // Create and start the loader
            const loader = createLoader(interaction, {
              text: loadingText,
              style: animationStyle,
              color: colorTheme,
              ephemeral: false
            });
            
            // Store the loader for the command to use
            if (!client.activeLoaders) client.activeLoaders = new Collection();
            client.activeLoaders.set(interaction.id, loader);
            
            // Execute the button handler
            await command.handleButton(interaction, client);
            
            // If the loader wasn't stopped by the command, stop it now
            if (!loader.stopped) {
              await loader.stop({
                text: `Action completed successfully.`,
                success: true
              });
            }
          } else {
            // Execute without loading animation
            await command.handleButton(interaction, client);
          }
        } catch (error) {
          logger.error(`Error handling button ${interaction.customId}:`, error);
          
          // Try to stop any active loader with an error message
          if (client.activeLoaders && client.activeLoaders.has(interaction.id)) {
            const loader = client.activeLoaders.get(interaction.id);
            if (loader && !loader.stopped) {
              await loader.stop({
                text: 'There was an error processing your action!',
                success: false
              });
              client.activeLoaders.delete(interaction.id);
              return;
            }
          }
          
          await interaction.reply({
            embeds: [createErrorEmbed('There was an error processing your button click!')],
            flags: { ephemeral: true }
          });
        }
      }
    }
  }
};
