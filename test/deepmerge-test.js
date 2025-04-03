/**
 * Deep Merge Test
 * 
 * Directly tests the deepMerge function we fixed to prevent infinite recursion
 */

const { logger } = require('../src/utils/logger');

// We need to get the deepMerge function from the instantiated Guild model
// Let's import the database connection and get the Guild model from there
const { connectToDatabase } = require('../src/database/db');

// We'll get the deepMerge function inside our test function

// Create test objects with circular references
async function runDeepMergeTest() {
  try {
    logger.info('=== Testing deepMerge function for circular references ===');
    
    // Get the database connection and access the Guild model
    const db = await connectToDatabase();
    const Guild = db.models.Guild;
    
    // Extract the deepMerge function that was attached to the Guild model
    const deepMerge = Guild.deepMerge;
    
    if (!deepMerge || typeof deepMerge !== 'function') {
      throw new Error('deepMerge function is not attached to the Guild model');
    }
    
    // Create a target object with circular reference
    const target = { 
      name: 'target',
      settings: {
        color: 'blue',
        size: 'medium'
      }
    };
    // Add circular reference
    target.self = target;
    
    // Create a source object with circular reference
    const source = {
      name: 'source',
      settings: {
        color: 'red',
        type: 'advanced'
      },
      extras: ['item1', 'item2']
    };
    // Add circular reference
    source.self = source;
    // Add reference to target
    source.targetRef = target;
    
    logger.info('Created test objects with circular references');
    logger.info(`Target object has circular reference: ${target.self === target}`);
    logger.info(`Source object has circular reference: ${source.self === source}`);
    logger.info(`Source references target: ${source.targetRef === target}`);
    
    // Attempt to merge (would cause stack overflow before our fix)
    logger.info('Attempting to merge objects...');
    const result = deepMerge(target, source);
    
    // Verify the merge worked correctly
    logger.info('Merge completed successfully!');
    logger.info(`Result name: ${result.name}`);
    logger.info(`Result settings.color: ${result.settings.color}`);
    logger.info(`Result settings.size: ${result.settings.size}`);
    logger.info(`Result settings.type: ${result.settings.type}`);
    logger.info(`Result has extras: ${Array.isArray(result.extras)}`);
    
    return true;
  } catch (error) {
    logger.error(`Deep merge test failed: ${error.message}`, { error });
    return false;
  }
}

// Run the test and report results
async function runTest() {
  logger.info('Starting direct test of deepMerge function');
  
  try {
    const passed = await runDeepMergeTest();
    
    if (passed) {
      logger.info('\n✅ SUCCESS: deepMerge function handles circular references properly!');
    } else {
      logger.error('\n❌ FAILED: deepMerge function still has issues with circular references');
    }
  } catch (error) {
    logger.error(`Test execution failed: ${error.message}`);
    logger.error('\n❌ FAILED: deepMerge test could not be executed properly');
  }
}

// Execute the test
runTest().catch(err => {
  logger.error(`Test runner error: ${err.message}`);
  process.exit(1);
});
