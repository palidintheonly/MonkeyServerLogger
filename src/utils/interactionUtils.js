/**
 * Interaction Utilities
 * Helper functions for interaction handling with Discord.js
 */

// Constants
const EPHEMERAL_FLAG = 1 << 6; // 2^6 (64) - Discord's flag for ephemeral responses

/**
 * Convert options with deprecated 'ephemeral' property to use proper flags
 * @param {Object} options - The options object that might contain ephemeral property
 * @returns {Object} - Updated options with flags instead of ephemeral
 */
function convertEphemeralOption(options) {
  if (!options) return options;
  
  const newOptions = { ...options };
  
  // If ephemeral is set to true, convert to flags
  if (newOptions.ephemeral === true) {
    newOptions.flags = EPHEMERAL_FLAG;
    delete newOptions.ephemeral;
  }
  
  // If fetchReply is present, remove it (we'll handle manually with fetchReply method)
  if (newOptions.fetchReply !== undefined) {
    delete newOptions.fetchReply;
  }
  
  return newOptions;
}

/**
 * Handles the reply/deferReply with proper response handling
 * @param {Interaction} interaction - The Discord interaction
 * @param {Object} options - Reply options 
 * @param {boolean} [needsResponse=false] - Whether we need the response object
 * @returns {Promise<Message|InteractionResponse|null>} The response if needed
 */
async function safeReply(interaction, options, needsResponse = false) {
  // Clean up any deprecated options
  const cleanOptions = convertEphemeralOption(options);
  
  try {
    await interaction.reply(cleanOptions);
    
    // Return the response if needed
    if (needsResponse) {
      return await interaction.fetchReply();
    }
    return null;
  } catch (error) {
    console.error(`Error in safeReply: ${error.message}`);
    return null;
  }
}

module.exports = {
  EPHEMERAL_FLAG,
  convertEphemeralOption,
  safeReply
};