const { models } = require('../../database/db');
const { createLogEmbed } = require('../../utils/embedBuilder');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState, client) {
    // Skip if no guild is associated with the voice states
    if (!oldState.guild || !newState.guild) return;
    
    try {
      // Get guild settings
      const guildSettings = await models.Guild.findOrCreateGuild(newState.guild.id);
      
      // Skip if logging is not set up or voice logging is disabled
      if (!guildSettings.setupCompleted || !guildSettings.isCategoryEnabled('VOICE')) {
        return;
      }
      
      // Get the user associated with the voice states
      const member = newState.member || oldState.member;
      if (!member) return;
      
      // Get the logging channel
      const logChannelId = guildSettings.getCategoryChannel('VOICE');
      if (!logChannelId) return;
      
      const logChannel = await newState.guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;
      
      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        const embed = createLogEmbed({
          category: 'VOICE',
          action: 'Voice Channel Joined',
          description: `${member} joined the voice channel ${newState.channel}.`,
          fields: [
            { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: 'Channel', value: `${newState.channel.name} (${newState.channelId})`, inline: true }
          ],
          color: '#77B255', // Green color for joining
          thumbnail: member.displayAvatarURL({ dynamic: true })
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      // User left a voice channel
      else if (oldState.channelId && !newState.channelId) {
        const embed = createLogEmbed({
          category: 'VOICE',
          action: 'Voice Channel Left',
          description: `${member} left the voice channel ${oldState.channel}.`,
          fields: [
            { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: 'Channel', value: `${oldState.channel.name} (${oldState.channelId})`, inline: true }
          ],
          color: '#DD2E44', // Red color for leaving
          thumbnail: member.displayAvatarURL({ dynamic: true })
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      // User moved between voice channels
      else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const embed = createLogEmbed({
          category: 'VOICE',
          action: 'Voice Channel Moved',
          description: `${member} moved from one voice channel to another.`,
          fields: [
            { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: 'From', value: `${oldState.channel.name} (${oldState.channelId})`, inline: true },
            { name: 'To', value: `${newState.channel.name} (${newState.channelId})`, inline: true }
          ],
          color: '#3498DB', // Blue color for updates
          thumbnail: member.displayAvatarURL({ dynamic: true })
        });
        
        await logChannel.send({ embeds: [embed] });
      }
      
      // Voice state changes (mute, deafen, etc.)
      if (oldState.channelId === newState.channelId && oldState.channelId) {
        const changes = [];
        
        // Server mute/unmute
        if (oldState.serverMute !== newState.serverMute) {
          changes.push(`Server Mute: ${newState.serverMute ? 'Enabled' : 'Disabled'}`);
        }
        
        // Server deafen/undeafen
        if (oldState.serverDeaf !== newState.serverDeaf) {
          changes.push(`Server Deafen: ${newState.serverDeaf ? 'Enabled' : 'Disabled'}`);
        }
        
        // Self mute/unmute
        if (oldState.selfMute !== newState.selfMute) {
          changes.push(`Self Mute: ${newState.selfMute ? 'Enabled' : 'Disabled'}`);
        }
        
        // Self deafen/undeafen
        if (oldState.selfDeaf !== newState.selfDeaf) {
          changes.push(`Self Deafen: ${newState.selfDeaf ? 'Enabled' : 'Disabled'}`);
        }
        
        // Streaming start/stop
        if (oldState.streaming !== newState.streaming) {
          changes.push(`Streaming: ${newState.streaming ? 'Started' : 'Stopped'}`);
        }
        
        // Video start/stop
        if (oldState.selfVideo !== newState.selfVideo) {
          changes.push(`Camera: ${newState.selfVideo ? 'Started' : 'Stopped'}`);
        }
        
        // Send log if any changes were detected
        if (changes.length > 0) {
          const embed = createLogEmbed({
            category: 'VOICE',
            action: 'Voice State Updated',
            description: `${member}'s voice state was updated in ${newState.channel}.`,
            fields: [
              { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
              { name: 'Channel', value: `${newState.channel.name} (${newState.channelId})`, inline: true },
              { name: 'Changes', value: changes.join('\n'), inline: false }
            ],
            color: '#3498DB', // Blue color for updates
            thumbnail: member.displayAvatarURL({ dynamic: true })
          });
          
          await logChannel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      logger.error(`Error logging voice state update: ${error.message}`);
    }
  }
};
