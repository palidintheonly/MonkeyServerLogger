/**
 * Simple Test for Checking Fixed Issues
 * 
 * This script tests the core functionality that was previously causing stack overflow
 * issues in a simpler way that mimics actual usage.
 */

const { logger } = require('../src/utils/logger');
const { connectToDatabase } = require('../src/database/db');

async function runTest() {
  try {
    logger.info("Starting simple test...");
    
    // Connect to database
    const db = await connectToDatabase();
    
    // Create test guild ID
    const guildId = `simple-test-${Date.now()}`;
    
    logger.info(`Creating test guild ${guildId}...`);
    
    // Create test guild with initial settings
    const [guild, created] = await db.Guild.findOrCreate({
      where: { guildId },
      defaults: {
        guildId,
        guildName: 'Simple Test Guild',
        modmailEnabled: false
      }
    });
    
    logger.info(`Guild created: ${created}`);
    
    // Create test settings with circular references
    const testSettings = {
      testObj: {
        nestedObj: {
          deepObj: {
            value: 'test value'
          }
        }
      }
    };
    
    // Add a circular reference
    testSettings.circular = testSettings;
    testSettings.testObj.circular = testSettings.testObj;
    
    logger.info("Created test settings with circular references");
    
    // Update settings (this would previously cause stack overflow)
    logger.info("Attempting to update settings with circular references...");
    await guild.updateSettings(testSettings);
    
    logger.info("Settings updated successfully!");
    
    // Verify the update worked, but the circular refs were handled properly
    const testValue = guild.getSetting('testObj.nestedObj.deepObj.value');
    logger.info(`Retrieved test value: ${testValue}`);
    
    // Try to get the circular reference (should be undefined or handled gracefully)
    const circular = guild.getSetting('circular');
    logger.info(`Circular reference exists: ${!!circular}`);
    
    logger.info("Test completed successfully!");
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, { error });
  }
}

// Run the test
runTest();
