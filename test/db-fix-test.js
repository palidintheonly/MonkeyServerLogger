/**
 * Database Fix Test Script
 * 
 * Tests our fix for the Guild model database schema mismatch
 */
const { connectToDatabase, sequelize } = require('../src/database/db');
const { logger } = require('../src/utils/logger');

async function testDatabaseFix() {
  try {
    logger.info('Starting database fix test...');
    
    // Connect to database and get models
    const { models } = await connectToDatabase();
    const { Guild } = models;
    
    // Test 1: Create a new guild
    logger.info('Test 1: Creating a new guild...');
    const testGuildId = `test-${Date.now()}`;
    const testGuildName = `Test Guild ${Date.now()}`;
    
    const [guild, created] = await Guild.findOrCreate(testGuildId, testGuildName);
    
    logger.info(`Guild created: ${created}`);
    logger.info(`Guild ID: ${guild.guildId}`);
    logger.info(`Guild Name: ${guild.guildName}`);
    logger.info(`Guild Settings: ${JSON.stringify(guild.settings)}`);
    
    // Test 2: Modify guild settings
    logger.info('Test 2: Modifying guild settings...');
    await guild.updateSetting('testKey', 'testValue');
    await guild.updateSetting('nested.key', 'nestedValue');
    
    // Manually check database to see the actual stored values
    const checkResult = await sequelize.query(
      `SELECT settings FROM guilds WHERE guildId = '${testGuildId}'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    logger.info(`Raw settings from database: ${JSON.stringify(checkResult[0].settings)}`);
    
    // Reload from database to check persistence
    const updatedGuild = await Guild.findOne({ where: { guildId: testGuildId } });
    logger.info(`Updated Guild Settings: ${JSON.stringify(updatedGuild.settings)}`);
    
    // Test 3: Update guild name using settings
    logger.info('Test 3: Updating guild name via settings...');
    await updatedGuild.updateSetting('guildName', 'New Test Guild Name');
    
    // Reload again
    const renamedGuild = await Guild.findOne({ where: { guildId: testGuildId } });
    logger.info(`Guild after name change: ${renamedGuild.guildName}`);
    logger.info(`Settings after name change: ${JSON.stringify(renamedGuild.settings)}`);
    
    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, { error });
  }
}

// Run the test
testDatabaseFix()
  .then(() => {
    logger.info('Test script completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error: ${error.message}`, { error });
    process.exit(1);
  });