/**
 * Interactive Slash Command Logger
 * 
 * This tool enhances the Discord bot by adding extensive logging of
 * slash command interactions, focusing specifically on subcommand detection
 * and handling.
 * 
 * Usage: Replace existing interactions handler or add this code to the 
 * interactionCreate event handler.
 */

const fs = require('fs');
const path = require('path');
const { writeFileSync, appendFileSync } = fs;
const { logger } = require('./src/utils/logger');

// Set up logging to a dedicated file
const logFilePath = path.join(__dirname, 'logs', 'interaction-debug.log');

// Clear log file on start
try {
  writeFileSync(logFilePath, `=== Interaction Debug Log - ${new Date().toISOString()} ===\n\n`);
  logger.info(`Initialized interaction debug log at ${logFilePath}`);
} catch (error) {
  logger.error(`Failed to initialize interaction debug log: ${error.message}`);
}

// Helper function to log to file
function logToFile(message) {
  try {
    appendFileSync(logFilePath, `${message}\n`);
  } catch (error) {
    logger.error(`Failed to write to interaction debug log: ${error.message}`);
  }
}

// Function to log interaction details
function logInteractionDetails(interaction) {
  try {
    // Basic interaction info
    let message = `\n=== INTERACTION at ${new Date().toISOString()} ===\n`;
    message += `Type: ${interaction.type}\n`;
    message += `Command Name: ${interaction.commandName || 'N/A'}\n`;
    message += `User: ${interaction.user.tag} (${interaction.user.id})\n`;
    message += `Channel: ${interaction.channel?.name || 'DM'} (${interaction.channelId})\n`;
    message += `Guild: ${interaction.guild?.name || 'N/A'} (${interaction.guildId || 'N/A'})\n`;
    
    // Command specific info
    if (interaction.isChatInputCommand()) {
      message += `\nCHAT INPUT COMMAND DETAILS:\n`;
      message += `Full Command: /${interaction.commandName}\n`;
      
      // Check for options
      const options = interaction.options;
      if (options) {
        message += `\nOptions Data:\n`;
        message += JSON.stringify(options._hoistedOptions, null, 2) + '\n';
        
        // Try to get subcommand (important for our debugging)
        try {
          const subcommand = options.getSubcommand(false);
          message += `\nSubcommand detected: ${subcommand || 'NONE'}\n`;
          
          // If we have a subcommand, list its options
          if (subcommand) {
            message += `Subcommand Options:\n`;
            options._hoistedOptions.forEach(opt => {
              message += `- ${opt.name}: ${opt.value} (type: ${opt.type})\n`;
            });
          }
        } catch (error) {
          message += `Error getting subcommand: ${error.message}\n`;
        }
        
        // Try to get subcommand group (for commands with nested subcommands)
        try {
          const subcommandGroup = options.getSubcommandGroup(false);
          if (subcommandGroup) {
            message += `\nSubcommand Group detected: ${subcommandGroup}\n`;
          }
        } catch (error) {
          // Ignore errors here as subcommand groups are optional
        }
        
        // Raw options data - this is the most detailed view
        message += `\nRaw Options Data:\n`;
        message += `_group: ${options._group || 'null'}\n`;
        message += `_subcommand: ${options._subcommand || 'null'}\n`;
        message += `_hoistedOptions length: ${options._hoistedOptions?.length || 0}\n`;
      }
    }
    
    logToFile(message);
    logger.debug(`Logged interaction details for ${interaction.commandName || 'unknown command'}`);
  } catch (error) {
    logger.error(`Error logging interaction details: ${error.message}`);
  }
}

// This function should be called from interactionCreate event handler
function enhancedInteractionHandler(interaction, client) {
  // Log the interaction details
  logInteractionDetails(interaction);
  
  // Continue with normal handling
  // The rest of your interaction handling code would go here...
}

module.exports = { 
  enhancedInteractionHandler,
  logInteractionDetails
};