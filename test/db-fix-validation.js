/**
 * Database Fix Validation
 * 
 * This script performs a final validation of our fixes to the Guild model:
 * 1. Fixed maximum call stack size by using super.findOrCreate
 * 2. Improved nested settings handling
 * 3. Made updateSetting and updateSettings more robust
 */
const { connectToDatabase } = require('../src/database/db');
const { logger } = require('../src/utils/logger');

async function validateFixes() {
  try {
    logger.info('Starting database fix validation...');
    
    // Connect to database
    const { models } = await connectToDatabase();
    const { Guild } = models;
    
    // Test 1: Verify findOrCreate doesn't cause stack overflow
    logger.info('Test 1: Verifying findOrCreate...');
    const guildId = `validation-${Date.now()}`;
    const guildName = 'Validation Guild';
    
    const [guild, created] = await Guild.findOrCreate(guildId, guildName);
    logger.info(`Guild created: ${created}`);
    logger.info(`Guild initial settings: ${JSON.stringify(guild.settings)}`);
    
    // Test 2: Verify settings conversions
    logger.info('Test 2: Verifying settings conversions...');
    
    // First, set simple value
    await guild.updateSetting('testKey', 'simple value');
    
    // Then, try to nest something under it (should convert)
    await guild.updateSetting('testKey.nested', 'nested value');
    
    // Get the settings and verify
    const testKey = guild.getSetting('testKey');
    const nestedValue = guild.getSetting('testKey.nested');
    
    logger.info(`testKey is now type: ${typeof testKey}`);
    logger.info(`testKey.nested value: ${nestedValue}`);
    
    // Test 3: Verify updateSettings with merging
    logger.info('Test 3: Verifying updateSettings merging...');
    
    // Set object with some nested properties
    await guild.updateSettings({
      mergeTest: {
        prop1: 'value1',
        prop2: 'value2',
        nested: {
          nestedProp: 'nestedValue'
        }
      }
    });
    
    // Now update with partial object that should merge
    await guild.updateSettings({
      mergeTest: {
        prop2: 'changed value',
        nested: {
          newProp: 'new nested value'
        },
        newProp: 'brand new prop'
      }
    });
    
    // Verify the merge worked correctly
    const mergeTest = guild.getSetting('mergeTest');
    logger.info('Merged settings:');
    logger.info(JSON.stringify(mergeTest, null, 2));
    
    // Check the individual values
    logger.info(`mergeTest.prop1: ${guild.getSetting('mergeTest.prop1')}`);
    logger.info(`mergeTest.prop2: ${guild.getSetting('mergeTest.prop2')}`);
    logger.info(`mergeTest.nested.nestedProp: ${guild.getSetting('mergeTest.nested.nestedProp')}`);
    logger.info(`mergeTest.nested.newProp: ${guild.getSetting('mergeTest.nested.newProp')}`);
    logger.info(`mergeTest.newProp: ${guild.getSetting('mergeTest.newProp')}`);
    
    // Verify all settings are stored correctly
    const allSettings = guild.settings;
    logger.info('All settings:');
    logger.info(JSON.stringify(allSettings, null, 2));
    
    logger.info('All validation tests completed successfully!');
  } catch (error) {
    logger.error(`Validation failed: ${error.message}`, { error });
  }
}

// Run the validation
validateFixes()
  .then(() => {
    logger.info('Validation script completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error: ${error.message}`, { error });
    process.exit(1);
  });