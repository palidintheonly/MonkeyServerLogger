/**
 * Fixed Issues Verification Script
 * 
 * This script validates that the critical issues we fixed are working properly:
 * 1. Guild model deepMerge function (preventing "Maximum call stack size exceeded")
 * 2. Ephemeral flag usage (ensuring we use the proper format)
 */

const { logger } = require('../src/utils/logger');
const { connectToDatabase } = require('../src/database/db');
const { EPHEMERAL_FLAG, convertEphemeralOption } = require('../src/utils/interactionUtils');
const fs = require('fs');
const path = require('path');

// Test the deep merge function in Guild model
async function testDeepMerge() {
  logger.info('=== Testing deepMerge function ===');
  
  try {
    // Create test objects that would previously cause infinite recursion
    const target = {
      level1: {
        level2: {
          level3: 'original value'
        }
      }
    };
    
    const source = {
      level1: {
        level2: {
          level3: 'new value',
          added: 'added value'
        },
        newProp: 'new property'
      }
    };
    
    // Create a circular reference that would cause stack overflow
    target.circular = target;
    source.sourceCircular = source;
    source.targetRef = target;
    
    // Get the Guild model
    const db = await connectToDatabase();
    const Guild = db.models.Guild;
    
    // Check if the deepMerge function is attached to the Guild model
    if (!Guild.deepMerge || typeof Guild.deepMerge !== 'function') {
      logger.warn(`deepMerge function is not attached to the Guild model directly; will test via model methods`);
    } else {
      logger.info(`deepMerge function is available, will test directly`);
      
      // Test direct call to deepMerge
      const directResult = Guild.deepMerge(target, source);
      logger.info(`Direct deepMerge call successful: ${!!directResult}`);
    }
    
    // Create a test guild
    const guildId = 'merge-test-' + Date.now();
    const [guild, created] = await Guild.findOrCreate({
      where: { guildId },
      defaults: {
        guildId,
        guildName: 'Deep Merge Test Guild'
      }
    });
    
    logger.info(`Test guild created: ${created}`);
    
    // Test updateSettings with circular references (would previously crash)
    await guild.updateSettings({
      circularTest: target,
      sourceTest: source
    });
    
    logger.info('Successfully updated settings with circular references');
    
    // Verify the update worked
    const circularTest = guild.getSetting('circularTest');
    logger.info(`circularTest exists: ${!!circularTest}`);
    
    const level3Value = guild.getSetting('circularTest.level1.level2.level3');
    logger.info(`level3Value: ${level3Value}`);
    
    logger.info('deepMerge function test passed!');
    return true;
  } catch (error) {
    logger.error(`deepMerge test failed: ${error.message}`, { error });
    return false;
  }
}

// Test the ephemeral option conversion
function testEphemeralConversion() {
  logger.info('\n=== Testing ephemeral conversion ===');
  
  try {
    // Test with ephemeral: true
    const options1 = { content: 'Test message', ephemeral: true };
    const converted1 = convertEphemeralOption(options1);
    
    logger.info(`Original: ${JSON.stringify(options1)}`);
    logger.info(`Converted: ${JSON.stringify(converted1)}`);
    
    if (converted1.ephemeral !== undefined) {
      throw new Error('ephemeral property still exists in converted object');
    }
    
    if (converted1.flags !== EPHEMERAL_FLAG) {
      throw new Error(`flags value is ${converted1.flags}, expected ${EPHEMERAL_FLAG}`);
    }
    
    // Test with already converted options
    const options2 = { content: 'Test message', flags: EPHEMERAL_FLAG };
    const converted2 = convertEphemeralOption(options2);
    
    logger.info(`Already converted: ${JSON.stringify(options2)}`);
    logger.info(`After conversion: ${JSON.stringify(converted2)}`);
    
    if (converted2.ephemeral !== undefined) {
      throw new Error('ephemeral property exists in already converted object');
    }
    
    if (converted2.flags !== EPHEMERAL_FLAG) {
      throw new Error(`flags value is ${converted2.flags}, expected ${EPHEMERAL_FLAG}`);
    }
    
    // Verify no ephemeral: true is used in the codebase files
    const srcPath = path.join(__dirname, '..', 'src');
    const ephemeralCount = countEphemeralUsage(srcPath);
    
    if (ephemeralCount > 0) {
      throw new Error(`Found ${ephemeralCount} instances of 'ephemeral: true' in the codebase`);
    }
    
    logger.info('ephemeral conversion test passed!');
    return true;
  } catch (error) {
    logger.error(`Ephemeral conversion test failed: ${error.message}`, { error });
    return false;
  }
}

// Count instances of "ephemeral: true" in the codebase
function countEphemeralUsage(dir) {
  let count = 0;
  
  // Get all files in directory recursively
  const filesInDir = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of filesInDir) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // Recursively check subdirectories
      count += countEphemeralUsage(fullPath);
    } else if (file.name.endsWith('.js')) {
      // Check JavaScript files
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Count instances of "ephemeral: true"
      const matches = content.match(/ephemeral:\s*true/g);
      
      if (matches) {
        logger.warn(`Found ${matches.length} instances of 'ephemeral: true' in ${fullPath}`);
        count += matches.length;
      }
    }
  }
  
  return count;
}

// Test database backups
async function testDatabaseBackups() {
  logger.info('\n=== Testing database backups ===');
  
  try {
    // Check if backup directory exists
    const backupDir = path.join(__dirname, '..', 'data', 'backup');
    
    if (!fs.existsSync(backupDir)) {
      throw new Error('Backup directory does not exist');
    }
    
    // Check for backup files
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.sqlite'));
    
    logger.info(`Found ${backupFiles.length} database backup files`);
    
    if (backupFiles.length === 0) {
      throw new Error('No database backup files found');
    }
    
    // List the backup files
    backupFiles.forEach(file => {
      logger.info(`Backup file: ${file}`);
    });
    
    logger.info('Database backup test passed!');
    return true;
  } catch (error) {
    logger.error(`Database backup test failed: ${error.message}`, { error });
    return false;
  }
}

// Run all tests
async function runAllTests() {
  logger.info('Starting verification of fixed issues...');
  
  // Run each test and collect results
  const deepMergeResult = await testDeepMerge();
  const ephemeralResult = testEphemeralConversion();
  const backupResult = await testDatabaseBackups();
  
  // Report overall results
  logger.info('\n=== Test Results ===');
  logger.info(`deepMerge function test: ${deepMergeResult ? 'PASSED' : 'FAILED'}`);
  logger.info(`Ephemeral conversion test: ${ephemeralResult ? 'PASSED' : 'FAILED'}`);
  logger.info(`Database backup test: ${backupResult ? 'PASSED' : 'FAILED'}`);
  
  const allPassed = deepMergeResult && ephemeralResult && backupResult;
  
  if (allPassed) {
    logger.info('\nAll tests PASSED! The critical fixes are working properly.');
  } else {
    logger.error('\nSome tests FAILED. Review the logs for details.');
  }
}

// Start the tests
runAllTests();
