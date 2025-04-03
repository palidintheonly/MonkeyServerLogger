/**
 * Test for fixing the Invalid value error for Guild.findOrCreate
 */
const { connectToDatabase } = require('../src/database/db');
const { logger } = require('../src/utils/logger');

async function testFindOrCreateFix() {
  try {
    logger.info('Testing fix for Guild.findOrCreate with only where condition...');
    
    // Connect to database and get models
    const { models } = await connectToDatabase();
    const { Guild } = models;
    
    // Test with just a where condition and no default values
    const testGuildId = `test-where-only-${Date.now()}`;
    
    const [guild, created] = await Guild.findOrCreate({
      where: { guildId: testGuildId }
    });
    
    logger.info(`Guild ${testGuildId} created: ${created}`);
    logger.info(`Guild has enabledCategories: ${guild.enabledCategories}`);
    
    // Test with where and some defaults but missing required fields
    const testGuildId2 = `test-partial-defaults-${Date.now()}`;
    
    const [guild2, created2] = await Guild.findOrCreate({
      where: { guildId: testGuildId2 },
      defaults: {
        guildName: 'Partial Defaults Test'
      }
    });
    
    logger.info(`Guild ${testGuildId2} created: ${created2}`);
    logger.info(`Guild has enabledCategories: ${guild2.enabledCategories}`);
    
    logger.info('Test completed successfully!');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, { error });
  }
}

// Run the test
testFindOrCreateFix()
  .then(() => {
    logger.info('Find or create fix test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error: ${error.message}`, { error });
    process.exit(1);
  });
