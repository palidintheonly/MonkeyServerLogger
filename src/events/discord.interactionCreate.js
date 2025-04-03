/**
 * Discord.js Interaction Event
 */
const { Events, Collection } = require('discord.js');
const { logger } = require('../utils/logger');
const { commands } = require('../config');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Only process command interactions
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    
    // If command doesn't exist
    if (!command) {
      logger.warn(`User ${interaction.user.tag} tried to use unknown command: ${interaction.commandName}`);
      return;
    }
    
    // Handle cooldowns
    const { cooldowns } = client;
    
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? commands.cooldownDefault) * 1000;
    
    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        
        logger.debug(`User ${interaction.user.tag} tried to use ${command.data.name} while on cooldown`);
        
        return interaction.reply({
          content: `Please wait ${timeLeft.toFixed(1)} more second${timeLeft === 1 ? '' : 's'} before using the \`${command.data.name}\` command again.`,
          ephemeral: true
        });
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    
    try {
      logger.debug(`User ${interaction.user.tag} used command: ${interaction.commandName}`);
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}: ${error.message}`, { error });
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      }
    }
  }
};