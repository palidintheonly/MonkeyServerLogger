const { EmbedBuilder } = require('discord.js');
const { logger } = require('./logger');

// Animation frames for different styles
const animations = {
  dots: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  line: ['▰▱▱▱▱▱▱', '▰▰▱▱▱▱▱', '▰▰▰▱▱▱▱', '▰▰▰▰▱▱▱', '▰▰▰▰▰▱▱', '▰▰▰▰▰▰▱', '▰▰▰▰▰▰▰', '▰▱▱▱▱▱▱'],
  pulse: ['●∙∙∙', '∙●∙∙', '∙∙●∙', '∙∙∙●', '∙∙●∙', '∙●∙∙'],
  bounce: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  spin: ['◜', '◠', '◝', '◞', '◡', '◟'],
  clock: ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'],
  earth: ['🌎', '🌍', '🌏'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  hearts: ['💗', '💓', '💔', '💕', '💖', '💘', '💝'],
  gear: ['⚙️', '🔧', '⚙️', '🔩'],
};

/**
 * Different color themes for loading indicators
 */
const themes = {
  blue: 0x3498db,
  green: 0x2ecc71,
  purple: 0x9b59b6,
  orange: 0xe67e22,
  red: 0xe74c3c,
  gray: 0x95a5a6,
  random: () => Math.floor(Math.random() * 0xFFFFFF),
};

/**
 * Class to handle animated loading indicators in Discord messages
 */
class LoadingIndicator {
  /**
   * Create a new loading indicator
   * @param {Object} options - Configuration options
   * @param {string} options.text - Text to display with the animation
   * @param {string} options.style - Animation style (dots, line, pulse, etc.)
   * @param {string|number} options.color - Color theme or hex color
   * @param {number} options.interval - Animation interval in ms (default: 800)
   * @param {boolean} options.ephemeral - Whether the message is ephemeral (default: false)
   */
  constructor(options = {}) {
    this.text = options.text || 'Loading...';
    this.style = options.style || 'dots';
    this.colorTheme = options.color || 'blue';
    this.interval = options.interval || 800;
    this.ephemeral = options.ephemeral !== undefined ? options.ephemeral : false;
    this.frames = animations[this.style] || animations.dots;
    this.currentFrame = 0;
    this.intervalId = null;
    this.message = null;
    this.interaction = null;
    this.stopped = false;
    this.createdAt = Date.now();
  }

  /**
   * Generate the color for the indicator
   * @returns {number} Color in decimal format
   */
  getColor() {
    try {
      if (typeof this.colorTheme === 'number') {
        return this.colorTheme;
      } else if (typeof this.colorTheme === 'string' && this.colorTheme.startsWith('#')) {
        return parseInt(this.colorTheme.slice(1), 16);
      } else if (typeof this.colorTheme === 'string' && themes[this.colorTheme]) {
        return typeof themes[this.colorTheme] === 'function' 
          ? themes[this.colorTheme]() 
          : themes[this.colorTheme];
      }
      // Default fallback if the color theme is invalid
      return themes.blue;
    } catch (error) {
      logger.error(`Error in getColor: ${error.message}`);
      return themes.blue; // Safe fallback
    }
  }

  /**
   * Create an embed for the current animation frame
   * @returns {EmbedBuilder} Discord embed
   */
  createEmbed() {
    try {
      const frame = this.frames[this.currentFrame] || '⌛';
      const elapsed = ((Date.now() - this.createdAt) / 1000).toFixed(1);

      const embed = new EmbedBuilder()
        .setDescription(`${frame} ${this.text}`)
        .setFooter({ text: `Time elapsed: ${elapsed}s` });
        
      // Safely add color
      try {
        embed.setColor(this.getColor());
      } catch (colorError) {
        logger.error(`Error setting color in embed: ${colorError.message}`);
        embed.setColor(0x3498db); // Fallback to blue
      }
      
      return embed;
    } catch (error) {
      logger.error(`Error creating embed: ${error.message}`);
      // Return a simple fallback embed
      return new EmbedBuilder()
        .setDescription(`⌛ ${this.text || 'Loading...'}`)
        .setColor(0x3498db); // Fallback to blue
    }
  }

  /**
   * Start the loading indicator on a Discord interaction
   * @param {Interaction} interaction - Discord interaction
   * @returns {Promise<LoadingIndicator>} This instance for chaining
   */
  async start(interaction) {
    try {
      this.interaction = interaction;
      
      // Send initial message
      if (!interaction.deferred && !interaction.replied) {
        this.message = await interaction.reply({
          embeds: [this.createEmbed()],
          ephemeral: this.ephemeral,
          fetchReply: true,
        });
      } else {
        this.message = await interaction.editReply({
          embeds: [this.createEmbed()],
          fetchReply: true,
        });
      }

      // Start animation interval
      this.intervalId = setInterval(async () => {
        if (this.stopped) return clearInterval(this.intervalId);
        
        this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        
        try {
          await interaction.editReply({
            embeds: [this.createEmbed()],
          });
        } catch (error) {
          logger.error(`Error updating loading animation: ${error.message}`);
          this.stop();
        }
      }, this.interval);
      
      return this;
    } catch (error) {
      logger.error(`Error starting loading animation: ${error.message}`);
      this.stop();
      throw error;
    }
  }

  /**
   * Stop the loading animation and update with final content
   * @param {Object} options - Final content options
   * @param {string} options.text - Success message text
   * @param {EmbedBuilder[]} options.embeds - Array of embeds to display
   * @param {boolean} options.success - Whether the operation was successful (affects color)
   * @param {Object} options.components - Message components to include
   * @returns {Promise<Message>} The updated Discord message
   */
  async stop({ text, embeds, success = true, components } = {}) {
    if (this.stopped) return;
    
    this.stopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.interaction || (!this.interaction.replied && !this.interaction.deferred)) {
      return;
    }

    try {
      const updateOptions = {};
      
      if (text) {
        try {
          // Safely handle color
          let colorHex;
          try {
            colorHex = success ? themes.green : themes.red;
          } catch (colorError) {
            logger.error(`Error getting theme color: ${colorError.message}`);
            colorHex = success ? 0x2ecc71 : 0xe74c3c; // Fallback colors
          }
          
          const finalEmbed = new EmbedBuilder()
            .setDescription(text);
            
          try {
            finalEmbed.setColor(colorHex);
          } catch (embedColorError) {
            logger.error(`Error setting color in final embed: ${embedColorError.message}`);
          }
          
          updateOptions.embeds = [finalEmbed];
        } catch (embedError) {
          logger.error(`Error creating final embed: ${embedError.message}`);
          // In case of failure, just send plain text
          updateOptions.content = text;
          updateOptions.embeds = [];
        }
      } else if (embeds) {
        updateOptions.embeds = embeds;
      }
      
      if (components) {
        updateOptions.components = components;
      }
      
      return await this.interaction.editReply(updateOptions);
    } catch (error) {
      logger.error(`Error stopping loading animation: ${error.message}`);
    }
  }
  
  /**
   * Update the loading text while animation is ongoing
   * @param {string} newText - New text to display
   * @returns {Promise<void>}
   */
  async updateText(newText) {
    if (this.stopped) return;
    
    try {
      this.text = newText || 'Loading...';
      
      // Only proceed if interaction is valid
      if (this.interaction && (this.interaction.replied || this.interaction.deferred)) {
        try {
          // Create embed with error catching
          const embed = this.createEmbed();
          
          await this.interaction.editReply({
            embeds: [embed],
          });
        } catch (embedError) {
          logger.error(`Error with embed during text update: ${embedError.message}`);
          // Fallback to plain text update
          try {
            await this.interaction.editReply({
              content: `${this.text}`,
              embeds: []
            });
          } catch (fallbackError) {
            logger.error(`Even fallback plain text update failed: ${fallbackError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error updating loading text: ${error.message}`);
    }
  }
}

/**
 * Create and start a loading indicator for a Discord interaction
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} options - Loading indicator options
 * @returns {LoadingIndicator} The created loading indicator
 */
function createLoader(interaction, options = {}) {
  const loader = new LoadingIndicator(options);
  loader.start(interaction).catch(err => {
    logger.error(`Failed to start loader: ${err.message}`);
  });
  return loader;
}

module.exports = {
  LoadingIndicator,
  createLoader,
  animations,
  themes
};