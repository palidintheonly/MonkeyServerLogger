const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Create a standardized embed for the bot
 * @param {Object} options - Options for the embed
 * @param {String} options.title - Title of the embed
 * @param {String} options.description - Description of the embed
 * @param {String} options.color - Color of the embed (hex code)
 * @param {Array} options.fields - Fields for the embed
 * @param {String} options.thumbnail - URL for the thumbnail
 * @param {String} options.image - URL for the image
 * @param {String} options.author - Author object with name, icon, url
 * @param {String} options.footer - Footer text (overrides default)
 * @param {Boolean} options.timestamp - Whether to include timestamp (default: true)
 * @returns {EmbedBuilder} Discord.js embed
 */
function createEmbed(options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || config.bot.color);
  
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.fields) embed.addFields(options.fields);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  
  if (options.author) {
    embed.setAuthor({
      name: options.author.name || config.bot.name,
      iconURL: options.author.icon || null,
      url: options.author.url || null
    });
  }
  
  // Set footer
  embed.setFooter({
    text: options.footer || config.embeds.footer
  });
  
  // Set timestamp if needed
  if (options.timestamp !== false && config.embeds.timestamp) {
    embed.setTimestamp();
  }
  
  return embed;
}

/**
 * Create a log embed with standardized formatting
 * @param {Object} options - Options for the log embed
 * @param {String} options.category - Log category
 * @param {String} options.action - Action performed
 * @param {String} options.description - Description of the log event
 * @param {Array} options.fields - Additional fields for the embed
 * @param {String} options.color - Color override
 * @param {String} options.thumbnail - URL for the thumbnail
 * @returns {EmbedBuilder} Discord.js embed
 */
function createLogEmbed(options = {}) {
  const category = options.category ? config.logging.categories[options.category] : null;
  const emoji = category ? category.emoji : '📝';
  
  let title = `${emoji} `;
  if (category) title += `${category.name}: `;
  title += options.action || 'Log Entry';
  
  // Select color based on action type
  let color = options.color || config.bot.color;
  if (!options.color) {
    if (options.action && options.action.includes('Created')) {
      color = '#77B255'; // Green
    } else if (options.action && options.action.includes('Deleted')) {
      color = '#DD2E44'; // Red
    } else if (options.action && options.action.includes('Updated')) {
      color = '#3498DB'; // Blue
    }
  }
  
  return createEmbed({
    title: title,
    description: options.description,
    color: color,
    fields: options.fields || [],
    thumbnail: options.thumbnail,
    timestamp: true
  });
}

/**
 * Create an error embed
 * @param {String} errorMessage - Error message to display
 * @param {String} command - Command that caused the error (optional)
 * @returns {EmbedBuilder} Discord.js embed
 */
function createErrorEmbed(errorMessage, command = null) {
  return createEmbed({
    title: '❌ Error',
    description: errorMessage,
    color: '#FF0000',
    fields: command ? [
      { name: 'Command', value: command, inline: true }
    ] : [],
    timestamp: true
  });
}

/**
 * Create a success embed
 * @param {String} message - Success message to display
 * @param {String} title - Optional custom title
 * @returns {EmbedBuilder} Discord.js embed
 */
function createSuccessEmbed(message, title = '✅ Success') {
  return createEmbed({
    title: title,
    description: message,
    color: '#77B255',
    timestamp: true
  });
}

module.exports = {
  createEmbed,
  createLogEmbed,
  createErrorEmbed,
  createSuccessEmbed
};
