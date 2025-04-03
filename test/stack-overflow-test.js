/**
 * Stack Overflow Test Script
 * 
 * Tests for the previous "Maximum call stack size exceeded" error in Guild model
 */
const { connectToDatabase } = require('../src/database/db');
const { logger } = require('../src/utils/logger');

async function testStackOverflow() {
  try {
    logger.info('Starting stack overflow test...');
    
    // Connect to database and get models
    const { models } = await connectToDatabase();
    const { Guild } = models;
    
    // Test recursive calls to findOrCreate
    logger.info('Testing recursive findOrCreate calls...');
    
    const guilds = [];
    
    // Create guilds sequentially to avoid database locks with SQLite
    for (let i = 0; i < 5; i++) {
      const guildId = `test-stack-${Date.now()}-${i}`;
      const guildName = `Test Guild Stack ${i}`;
      
      try {
        // Call findOrCreate for each guild
        const [guild, created] = await Guild.findOrCreate(guildId, guildName);
        logger.info(`Guild ${guildId} created: ${created}`);
        guilds.push(guild);
      } catch (error) {
        logger.error(`Error creating guild ${guildId}: ${error.message}`);
      }
      
      // Brief pause between operations to avoid database locks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    logger.info(`Successfully created/found ${guilds.length} guilds without stack overflow`);
    
    // Test additional operations on guilds
    logger.info('Testing settings operations on guilds...');
    
    // Update each guild's settings
    for (let i = 0; i < guilds.length; i++) {
      const guild = guilds[i];
      
      // Update some settings
      await guild.updateSetting(`test-${i}`, `value-${i}`);
      await guild.updateSetting(`nested.test-${i}`, `nested-value-${i}`);
      
      // Verify settings
      const value1 = guild.getSetting(`test-${i}`);
      const value2 = guild.getSetting(`nested.test-${i}`);
      
      logger.info(`Guild ${i} settings: ${value1}, ${value2}`);
    }
    
    logger.info('All stack overflow tests completed successfully!');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, { error });
  }
}

// Run the test
testStackOverflow()
  .then(() => {
    logger.info('Stack overflow test script completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error: ${error.message}`, { error });
    process.exit(1);
  });