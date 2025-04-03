/**
 * Modmail Settings Synchronization Utility
 * 
 * This utility ensures that modmail settings are consistent across both the
 * dedicated database column and the JSON settings field.
 */
const { logger } = require('./logger');

/**
 * Synchronize modmail settings for a guild
 * @param {Object} guildSettings - The Guild model instance to synchronize
 * @param {boolean} [saveChanges=true] - Whether to save changes to the database
 * @returns {Promise<boolean>} - Whether any changes were made
 */
async function syncModmailSettings(guildSettings, saveChanges = true) {
  try {
    // Extract settings from both sources
    const modmailSettings = guildSettings.getSetting('modmail') || {};
    const jsonEnabled = modmailSettings.enabled === true;
    const columnEnabled = guildSettings.modmailEnabled === true;
    
    // If settings are already consistent, no changes needed
    if (jsonEnabled === columnEnabled) {
      logger.debug(`Guild ${guildSettings.guildId} modmail settings already synchronized: ${jsonEnabled}`);
      return false;
    }
    
    logger.info(`Fixing inconsistent modmail settings for guild ${guildSettings.guildId} - JSON: ${jsonEnabled}, Column: ${columnEnabled}`);
    
    // Determine which setting to use as the source of truth
    // Strategy: Use the JSON settings as source of truth if it exists,
    // otherwise use the column value
    const useEnabled = modmailSettings.hasOwnProperty('enabled') ? jsonEnabled : columnEnabled;
    
    // Update both settings
    if (useEnabled !== jsonEnabled) {
      await guildSettings.updateSettings({
        modmail: {
          ...modmailSettings,
          enabled: useEnabled
        }
      });
    }
    
    if (useEnabled !== columnEnabled) {
      guildSettings.modmailEnabled = useEnabled;
    }
    
    // Save changes if requested
    if (saveChanges) {
      await guildSettings.save();
    }
    
    logger.info(`Successfully synchronized modmail settings for guild ${guildSettings.guildId} to: ${useEnabled}`);
    return true;
  } catch (error) {
    logger.error(`Error synchronizing modmail settings for guild ${guildSettings?.guildId}: ${error.message}`);
    throw error;
  }
}

/**
 * Synchronize modmail settings for all guilds in the database
 * @param {Object} db - Database object with Guild model
 * @returns {Promise<Object>} - Result with counts
 */
async function syncAllGuildModmailSettings(db) {
  try {
    const guilds = await db.Guild.findAll();
    logger.info(`Synchronizing modmail settings for ${guilds.length} guilds`);
    
    let syncCount = 0;
    let errorCount = 0;
    
    for (const guild of guilds) {
      try {
        const changed = await syncModmailSettings(guild);
        if (changed) syncCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Error synchronizing guild ${guild.guildId}: ${error.message}`);
      }
    }
    
    logger.info(`Modmail settings synchronization complete. Changed: ${syncCount}, Errors: ${errorCount}, Total: ${guilds.length}`);
    
    return {
      total: guilds.length,
      changed: syncCount,
      errors: errorCount
    };
  } catch (error) {
    logger.error(`Error in syncAllGuildModmailSettings: ${error.message}`);
    throw error;
  }
}

module.exports = {
  syncModmailSettings,
  syncAllGuildModmailSettings
};