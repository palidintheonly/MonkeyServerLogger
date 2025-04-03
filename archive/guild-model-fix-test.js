/**
 * Guild Model Fix Test
 * Tests the fixes for the Guild model database issues
 */
const { connectToDatabase } = require('./src/database/db');
const { logger } = require('./src/utils/logger');

async function testGuildModelFixes() {
  try {
    logger.info('Starting Guild model fix test...');
    
    // Connect to database and get models
    const { models } = await connectToDatabase();
    const { Guild } = models;
    
    // Test 1: Find or create a guild
    logger.info('Test 1: Creating a new guild with findOrCreate...');
    const testGuildId = `test-fix-${Date.now()}`;
    const testGuildName = `Test Guild Fix ${Date.now()}`;
    
    let guild, created;
    try {
      [guild, created] = await Guild.findOrCreate(testGuildId, testGuildName);
      logger.info(`Guild created: ${created}`);
      logger.info(`Guild ID: ${guild.guildId}`);
      logger.info(`Guild Name: ${guild.guildName}`);
      
      if (guild.settings) {
        if (typeof guild.settings === 'string') {
          logger.info(`Guild Settings (string): ${guild.settings}`);
          logger.info(`Guild Settings (parsed): ${JSON.stringify(JSON.parse(guild.settings))}`);
        } else {
          logger.info(`Guild Settings (object): ${JSON.stringify(guild.settings)}`);
        }
      } else {
        logger.info('Guild Settings is null or undefined');
      }
    } catch (error) {
      logger.error(`Failed to create guild: ${error.message}`);
      throw error;
    }
    
    // Test 2: Update a setting
    logger.info('\nTest 2: Updating a setting...');
    try {
      await guild.updateSetting('testKey', 'testValue');
      logger.info(`Updated setting testKey to 'testValue'`);
      
      const testKeyValue = guild.getSetting('testKey');
      logger.info(`Retrieved setting testKey: ${testKeyValue}`);
      
      if (guild.settings) {
        if (typeof guild.settings === 'string') {
          logger.info(`Guild Settings after update (string): ${guild.settings}`);
          logger.info(`Guild Settings after update (parsed): ${JSON.stringify(JSON.parse(guild.settings))}`);
        } else {
          logger.info(`Guild Settings after update (object): ${JSON.stringify(guild.settings)}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to update setting: ${error.message}`);
      throw error;
    }
    
    // Test 3: Update nested settings
    logger.info('\nTest 3: Updating nested settings...');
    try {
      await guild.updateSetting('nested.key', 'nestedValue');
      logger.info(`Updated setting nested.key to 'nestedValue'`);
      
      const nestedKeyValue = guild.getSetting('nested.key');
      logger.info(`Retrieved setting nested.key: ${nestedKeyValue}`);
      
      if (guild.settings) {
        if (typeof guild.settings === 'string') {
          logger.info(`Guild Settings after nested update (string): ${guild.settings}`);
          logger.info(`Guild Settings after nested update (parsed): ${JSON.stringify(JSON.parse(guild.settings))}`);
        } else {
          logger.info(`Guild Settings after nested update (object): ${JSON.stringify(guild.settings)}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to update nested setting: ${error.message}`);
      throw error;
    }
    
    // Test 4: Update guildName through settings
    logger.info('\nTest 4: Updating guildName through settings...');
    try {
      const newGuildName = `Updated Guild Name ${Date.now()}`;
      await guild.updateSetting('guildName', newGuildName);
      logger.info(`Updated guildName setting to '${newGuildName}'`);
      
      // Reload to get fresh data
      await guild.reload();
      
      logger.info(`Guild Name after update: ${guild.guildName}`);
      const settingGuildName = guild.getSetting('guildName');
      logger.info(`Retrieved guildName from settings: ${settingGuildName}`);
    } catch (error) {
      logger.error(`Failed to update guildName: ${error.message}`);
      throw error;
    }
    
    // Test 5: Update multiple settings
    logger.info('\nTest 5: Updating multiple settings at once...');
    try {
      const multiSettings = {
        multiTest1: 'value1',
        multiTest2: 'value2',
        multiNested: {
          key1: 'nestedValue1',
          key2: 'nestedValue2'
        }
      };
      
      await guild.updateSettings(multiSettings);
      logger.info(`Updated multiple settings: ${JSON.stringify(multiSettings)}`);
      
      // Check values
      const multi1 = guild.getSetting('multiTest1');
      const multi2 = guild.getSetting('multiTest2');
      const nested1 = guild.getSetting('multiNested.key1');
      const nested2 = guild.getSetting('multiNested.key2');
      
      logger.info(`Retrieved multiTest1: ${multi1}`);
      logger.info(`Retrieved multiTest2: ${multi2}`);
      logger.info(`Retrieved multiNested.key1: ${nested1}`);
      logger.info(`Retrieved multiNested.key2: ${nested2}`);
      
      if (guild.settings) {
        if (typeof guild.settings === 'string') {
          logger.info(`Guild Settings after multiple updates (string): ${guild.settings}`);
          logger.info(`Guild Settings after multiple updates (parsed): ${JSON.stringify(JSON.parse(guild.settings))}`);
        } else {
          logger.info(`Guild Settings after multiple updates (object): ${JSON.stringify(guild.settings)}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to update multiple settings: ${error.message}`);
      throw error;
    }
    
    logger.info('\nAll tests completed successfully!');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, { error });
    throw error;
  }
}

// Run the test
testGuildModelFixes()
  .then(() => {
    logger.info('Guild model fix test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error in test: ${error.message}`, { error });
    process.exit(1);
  });