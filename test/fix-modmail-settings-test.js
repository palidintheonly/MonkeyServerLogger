/**
 * Modmail Settings Fix Test
 * 
 * This script tests the modmail settings fix utility that ensures
 * consistency between the database column and JSON setting.
 */
const { connectToDatabase } = require('../src/database/db');
const { fixModmailSettings } = require('../src/utils/fix-modmail');

async function testModmailSettingsFix() {
  console.log('Starting modmail settings fix test...');
  
  // Connect to database to get models
  const db = await connectToDatabase();
  
  // Run fix-modmail utility with models
  const result = await fixModmailSettings(db.models);
  
  console.log('Modmail settings fix test completed:');
  console.log(`- Total guilds: ${result.total}`);
  console.log(`- Fixed: ${result.fixed}`);
  console.log(`- Already consistent: ${result.consistent}`);
  console.log(`- Errors: ${result.errors}`);
  
  // Verify the fixes worked
  console.log('\nVerifying consistency after fixes...');
  
  // Get all guilds
  const guilds = await db.models.Guild.findAll();
  let inconsistencies = 0;
  
  for (const guild of guilds) {
    const modmailSettings = guild.getSetting('modmail') || {};
    const jsonEnabled = modmailSettings.enabled === true;
    const columnEnabled = guild.modmailEnabled === true;
    
    if (jsonEnabled !== columnEnabled) {
      console.error(`❌ Inconsistency found in guild ${guild.guildId}: JSON=${jsonEnabled}, Column=${columnEnabled}`);
      inconsistencies++;
    }
  }
  
  if (inconsistencies === 0) {
    console.log('✅ All modmail settings are consistent after fixing!');
  } else {
    console.error(`❌ Found ${inconsistencies} inconsistencies after running fix.`);
  }
  
  return {
    success: inconsistencies === 0,
    inconsistenciesFound: inconsistencies
  };
}

// Run the test if script is executed directly
if (require.main === module) {
  testModmailSettingsFix()
    .then(result => {
      console.log(`\nTest ${result.success ? 'PASSED' : 'FAILED'}`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}

module.exports = { testModmailSettingsFix };