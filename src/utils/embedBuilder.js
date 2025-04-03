/**
 * Embed Builder Utility
 * Functions to create consistent, professional embeds for Discord messages
 */
const { EmbedBuilder } = require('discord.js');
const { Embed } = require('oceanic.js');
const { bot } = require('../config');

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
  color = bot.defaultEmbedColor || '#5865F2',
  url,
  thumbnail,
  image,
  fields,
  author,
  footer,
  timestamp = false
}) {
  // Create new embed
  const embed = new EmbedBuilder();
  
  // Set basic properties
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  if (url) embed.setURL(url);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  
  // Add fields if provided
  if (fields && Array.isArray(fields)) {
    embed.addFields(...fields);
  }
  
  // Set author if provided
  if (author) {
    embed.setAuthor({
      name: author.name,
      iconURL: author.iconURL,
      url: author.url
    });
  }
  
  // Set footer if provided or use default
  if (footer) {
    embed.setFooter({
      text: footer.text,
      iconURL: footer.iconURL
    });
  } else if (bot.name) {
    embed.setFooter({
      text: bot.name,
      iconURL: bot.iconURL
    });
  }
  
  // Add timestamp if requested
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
    color: '#57F287', // Discord green
    ...options,
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
    color: '#ED4245', // Discord red
    ...options,
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
    color: '#FEE75C', // Discord yellow
    ...options,
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
    color: '#5865F2', // Discord blue
    ...options,
  });
}

/**
 * Create an Oceanic.js embed
 * @param {Object} options - Embed options (same as createEmbed)
 * @returns {Embed} Oceanic.js embed
 */
function createOceanicEmbed(options) {
  // Extract all options
  const {
    title,
    description,
    color = bot.defaultEmbedColor || '#5865F2',
    url,
    thumbnail,
    image,
    fields,
    author,
    footer,
    timestamp = false
  } = options;
  
  // Convert hex color to decimal for Oceanic.js
  let colorDecimal = color;
  if (typeof color === 'string' && color.startsWith('#')) {
    colorDecimal = parseInt(color.replace('#', ''), 16);
  }
  
  // Create the embed data
  const embedData = {
    title,
    description,
    color: colorDecimal,
    url,
    timestamp: timestamp ? new Date().toISOString() : undefined,
  };
  
  // Add thumbnail if provided
  if (thumbnail) {
    embedData.thumbnail = { url: thumbnail };
  }
  
  // Add image if provided
  if (image) {
    embedData.image = { url: image };
  }
  
  // Add fields if provided
  if (fields && Array.isArray(fields)) {
    embedData.fields = fields;
  }
  
  // Add author if provided
  if (author) {
    embedData.author = {
      name: author.name,
      icon_url: author.iconURL,
      url: author.url
    };
  }
  
  // Add footer if provided
  if (footer) {
    embedData.footer = {
      text: footer.text,
      icon_url: footer.iconURL
    };
  } else if (bot.name) {
    embedData.footer = {
      text: bot.name,
      icon_url: bot.iconURL
    };
  }
  
  // Create and return the Oceanic.js embed
  return new Embed(embedData);
}

module.exports = {
  createEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  createWarningEmbed,
  createInfoEmbed,
  createOceanicEmbed
};