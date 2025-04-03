/**
 * Modmail Settings Fix Utility
 * 
 * This script fixes inconsistencies between the modmailEnabled column and the settings.modmail.enabled JSON field.
 * It can be run as a standalone script or integrated with the bot startup.
 */
const { connectToDatabase } = require('../database/db');
const { logger } = require('./logger');

/**
 * Fix modmail settings inconsistencies for all guilds
 * @param {Object} [models] - Optional database models (used when called from index.js)
 * @returns {Promise<Object>} - Result object with stats
 */
async function fixModmailSettings(models) {
  try {
    logger.info('Starting modmail settings fix process');
    
    // Use provided models or connect to the database
    let db;
    if (models) {
      db = models;
    } else {
      // Connect to the database if models not provided
      const connection = await connectToDatabase();
      db = connection.models;
    }
    
    // Get all guilds
    const guilds = await db.Guild.findAll();
    logger.info(`Found ${guilds.length} guilds in database`);
    
    let fixedCount = 0;
    let consistentCount = 0;
    let errorCount = 0;
    
    // Iterate through each guild and fix inconsistencies
    for (const guild of guilds) {
      try {
        // Get current settings
        const modmailSettings = guild.getSetting('modmail') || {};
        const jsonEnabled = modmailSettings.enabled === true;
        const columnEnabled = guild.modmailEnabled === true;
        
        logger.debug(`Guild ${guild.guildId} - modmail settings: JSON=${jsonEnabled}, Column=${columnEnabled}`);
        
        // If settings match, skip
        if (jsonEnabled === columnEnabled) {
          consistentCount++;
          continue;
        }
        
        // Settings are inconsistent, fix them
        logger.info(`Fixing inconsistent modmail settings for guild ${guild.guildId}: JSON=${jsonEnabled}, Column=${columnEnabled}`);
        
        // Use JSON setting as source of truth if it exists
        const correctValue = modmailSettings.hasOwnProperty('enabled') ? jsonEnabled : columnEnabled;
        
        // Update both settings
        await guild.updateSettings({
          modmail: {
            ...modmailSettings,
            enabled: correctValue
          }
        });
        
        guild.modmailEnabled = correctValue;
        await guild.save();
        
        logger.info(`✅ Fixed modmail settings for guild ${guild.guildId}, set to: ${correctValue}`);
        fixedCount++;
      } catch (error) {
        logger.error(`Error fixing guild ${guild.guildId}: ${error.message}`);
        errorCount++;
      }
    }
    
    logger.info(`Modmail settings fix complete. Fixed: ${fixedCount}, Already Consistent: ${consistentCount}, Errors: ${errorCount}, Total: ${guilds.length}`);
    
    return {
      total: guilds.length,
      fixed: fixedCount,
      consistent: consistentCount,
      errors: errorCount
    };
  } catch (error) {
    logger.error(`Failed to fix modmail settings: ${error.message}`);
    throw error;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  fixModmailSettings()
    .then(result => {
      console.log('Modmail settings fix completed:');
      console.log(`- Total guilds: ${result.total}`);
      console.log(`- Fixed: ${result.fixed}`);
      console.log(`- Already consistent: ${result.consistent}`);
      console.log(`- Errors: ${result.errors}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to fix modmail settings:', error);
      process.exit(1);
    });
}

module.exports = { fixModmailSettings };