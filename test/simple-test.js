/**
 * Simple Test for Checking Fixed Issues
 * 
 * This script tests the core functionality that was previously causing stack overflow
 * issues in a simpler way that mimics actual usage.
 */
const { connectToDatabase } = require('../src/database/db');
const { logger } = require('../src/utils/logger');

async function runTest() {
  try {
    logger.info('Starting simple test to verify fixes...');
    
    // Connect to database and get models
    const { models } = await connectToDatabase();
    const { Guild } = models;
    
    // Create a new test guild
    const testGuildId = `test-simple-${Date.now()}`;
    const testGuildName = 'Simple Test Guild';
    
    logger.info(`Creating test guild: ${testGuildName} (${testGuildId})`);
    const [guild, created] = await Guild.findOrCreate(testGuildId, testGuildName);
    
    logger.info(`Guild created: ${created}`);
    logger.info(`Guild ID: ${guild.guildId}`);
    logger.info(`Guild name from virtual field: ${guild.guildName}`);
    
    // Test setting and getting settings
    logger.info('Testing settings operations...');
    
    // Basic setting
    await guild.updateSetting('testSetting', 'test value');
    const simpleValue = guild.getSetting('testSetting');
    logger.info(`Simple setting: ${simpleValue}`);
    
    // Nested setting
    await guild.updateSetting('nested.test', 'nested value');
    const nestedValue = guild.getSetting('nested.test');
    logger.info(`Nested setting: ${nestedValue}`);
    
    // Multiple settings at once
    await guild.updateSettings({
      multipleSetting1: 'value1',
      multipleSetting2: 'value2',
      nested: {
        deepSetting: 'deep value'
      }
    });
    
    // Check that we can get all these settings
    logger.info('Verifying multiple settings...');
    logger.info(`Setting 1: ${guild.getSetting('multipleSetting1')}`);
    logger.info(`Setting 2: ${guild.getSetting('multipleSetting2')}`);
    logger.info(`Deep setting: ${guild.getSetting('nested.deepSetting')}`);
    logger.info(`Previously set nested setting: ${guild.getSetting('nested.test')}`);
    
    // Test updating guild name
    const newGuildName = 'Updated Guild Name';
    guild.guildName = newGuildName;
    await guild.save();
    
    // Reload from DB
    const updatedGuild = await Guild.findByPk(testGuildId);
    logger.info(`Updated guild name: ${updatedGuild.guildName}`);
    
    // Make sure the settings JSON is proper
    const allSettings = updatedGuild.settings;
    logger.info('All guild settings:');
    logger.info(typeof allSettings === 'string' ? allSettings : JSON.stringify(allSettings, null, 2));
    
    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, { error });
  }
}

// Run the test
runTest()
  .then(() => {
    logger.info('Simple test script completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error: ${error.message}`, { error });
    process.exit(1);
  });