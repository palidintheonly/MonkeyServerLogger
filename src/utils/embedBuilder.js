/**
 * Embed Builder Utility
 * Functions to create consistent, professional embeds for Discord messages
 */
const { EmbedBuilder } = require('discord.js');

/**
 * Create a generic embed with consistent styling
 * @param {Object} options - Embed options
 * @param {string} [options.title] - Embed title
 * @param {string} [options.description] - Embed description
 * @param {string} [options.color] - Hex color code (e.g. '#FF0000')
 * @param {string} [options.url] - URL for title
 * @param {string} [options.thumbnail] - Thumbnail URL
 * @param {string} [options.image] - Image URL
 * @param {Array<Object>} [options.fields] - Fields array
 * @param {Object} [options.author] - Author object
 * @param {Object} [options.footer] - Footer object
 * @param {boolean} [options.timestamp] - Whether to add timestamp
 * @returns {EmbedBuilder} Discord.js embed
 */
function createEmbed({
  title,
  description,
  color = '#5865F2',
  url,
  thumbnail,
  image,
  fields = [],
  author,
  footer,
  timestamp = false
}) {
  const embed = new EmbedBuilder();
  
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  if (url) embed.setURL(url);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (fields.length > 0) embed.addFields(...fields);
  if (author) embed.setAuthor(author);
  if (footer) embed.setFooter(footer);
  if (timestamp) embed.setTimestamp();
  
  return embed;
}

/**
 * Create a success embed with green color and checkmark emoji
 * @param {string} message - Success message
 * @param {string} [title='Success'] - Embed title
 * @param {Object} [options={}] - Additional embed options
 * @returns {EmbedBuilder} Discord.js embed
 */
function createSuccessEmbed(message, title = 'Success', options = {}) {
  return createEmbed({
    title: `✅ ${title}`,
    description: message,
    color: '#2ECC71',
    ...options
  });
}

/**
 * Create an error embed with red color and X emoji
 * @param {string} message - Error message
 * @param {string} [title='Error'] - Embed title
 * @param {Object} [options={}] - Additional embed options
 * @returns {EmbedBuilder} Discord.js embed
 */
function createErrorEmbed(message, title = 'Error', options = {}) {
  return createEmbed({
    title: `❌ ${title}`,
    description: message,
    color: '#E74C3C',
    ...options
  });
}

/**
 * Create a warning embed with yellow color and warning emoji
 * @param {string} message - Warning message
 * @param {string} [title='Warning'] - Embed title
 * @param {Object} [options={}] - Additional embed options
 * @returns {EmbedBuilder} Discord.js embed
 */
function createWarningEmbed(message, title = 'Warning', options = {}) {
  return createEmbed({
    title: `⚠️ ${title}`,
    description: message,
    color: '#F39C12',
    ...options
  });
}

/**
 * Create an info embed with blue color and info emoji
 * @param {string} message - Info message
 * @param {string} [title='Information'] - Embed title
 * @param {Object} [options={}] - Additional embed options
 * @returns {EmbedBuilder} Discord.js embed
 */
function createInfoEmbed(message, title = 'Information', options = {}) {
  return createEmbed({
    title: `ℹ️ ${title}`,
    description: message,
    color: '#3498DB',
    ...options
  });
}

module.exports = {
  createEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  createWarningEmbed,
  createInfoEmbed
};