/**
 * Stress Test for the Discord Bot
 * 
 * This script tests various components of the bot for performance and reliability.
 * It specifically focuses on the Guild model which had the maximum call stack error.
 */
const { connectToDatabase } = require('../src/database/db');
const { logger } = require('../src/utils/logger');

// Helper functions
function generateRandomId() {
  return `test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function generateRandomGuildName() {
  const adjectives = ['Happy', 'Awesome', 'Epic', 'Cool', 'Super', 'Mega', 'Ultra', 'Pro'];
  const nouns = ['Gamers', 'Squad', 'Team', 'Guild', 'Crew', 'Clan', 'Server', 'Community'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj} ${noun}`;
}

async function testGuildFindOrCreate(models, concurrentCalls = 50) {
  const { Guild } = models;
  logger.info(`Starting Guild findOrCreate stress test with ${concurrentCalls} concurrent calls...`);
  
  // Create an array for sequential execution to avoid database locks
  const results = [];
  
  for (let i = 0; i < concurrentCalls; i++) {
    try {
      const guildId = generateRandomId();
      const guildName = generateRandomGuildName();
      
      // Add random delay to simulate real-world conditions and avoid locks
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
      
      // Call findOrCreate
      const [guild, created] = await Guild.findOrCreate(guildId, guildName);
      
      // Add to results
      results.push({
        guildId,
        guildName,
        guild,
        created
      });
      
      if (i % 10 === 0) {
        logger.info(`Progress: ${i}/${concurrentCalls} guilds created`);
      }
    } catch (error) {
      logger.error(`Error in iteration ${i}: ${error.message}`);
    }
  }
  
  logger.info(`Completed findOrCreate test, successfully created/found ${results.length} guilds`);
  return results;
}

async function testGuildSettings(models) {
  const { Guild } = models;
  
  // Create a test guild
  const guildId = generateRandomId();
  const guildName = generateRandomGuildName();
  
  logger.info(`Testing settings with guild ${guildName} (${guildId})...`);
  
  const [guild, created] = await Guild.findOrCreate(guildId, guildName);
  logger.info(`Guild created: ${created}`);
  
  // Test nested settings that don't conflict
  // We'll create separate branches of nested settings
  for (let branch = 1; branch <= 3; branch++) {
    logger.info(`Testing branch ${branch} of nested settings...`);
    
    // Each branch can go 3 levels deep
    const prefix = `branch${branch}`;
    
    // Level 1
    await guild.updateSetting(prefix, `Branch ${branch} root value`);
    logger.info(`${prefix}: ${guild.getSetting(prefix)}`);
    
    // Level 2
    await guild.updateSetting(`${prefix}.level2`, `Branch ${branch} level 2 value`);
    logger.info(`${prefix}.level2: ${guild.getSetting(`${prefix}.level2`)}`);
    
    // Level 3
    await guild.updateSetting(`${prefix}.level2.level3`, `Branch ${branch} level 3 value`);
    logger.info(`${prefix}.level2.level3: ${guild.getSetting(`${prefix}.level2.level3`)}`);
    
    // Test array in settings
    await guild.updateSetting(`${prefix}.items`, [1, 2, 3, `item ${branch}`]);
    logger.info(`${prefix}.items: ${JSON.stringify(guild.getSetting(`${prefix}.items`))}`);
  }
  
  // Now get all settings and check the structure
  const allSettings = guild.settings;
  logger.info('All settings with nested structure:');
  logger.info(typeof allSettings === 'string' ? allSettings : JSON.stringify(allSettings, null, 2));
  
  return guild;
}

async function runTests() {
  try {
    logger.info('Starting stress tests...');
    
    // Connect to database
    const { models } = await connectToDatabase();
    
    // Test Guild findOrCreate with concurrent calls
    const guilds = await testGuildFindOrCreate(models, 30);
    
    // Test settings with deep nesting
    await testGuildSettings(models);
    
    logger.info('All stress tests completed successfully!');
  } catch (error) {
    logger.error(`Stress test failed: ${error.message}`, { error });
  }
}

// Run the tests
runTests()
  .then(() => {
    logger.info('Stress test script completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Unhandled error: ${error.message}`, { error });
    process.exit(1);
  });