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
  
  return newOptions;
}

module.exports = {
  EPHEMERAL_FLAG,
  convertEphemeralOption
};