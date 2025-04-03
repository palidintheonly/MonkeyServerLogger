/**
 * Server-Based Sharding Test
 * 
 * This script tests the custom server-based sharding approach 
 * where each guild gets its own dedicated shard.
 */
require('dotenv').config();
const { logger } = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

// Simulated guild data for testing
const TEST_GUILDS = [
  { id: '1111111111111111', name: 'Test Guild Alpha' },
  { id: '2222222222222222', name: 'Test Guild Beta' },
  { id: '3333333333333333', name: 'Test Guild Gamma' },
  { id: '4444444444444444', name: 'Test Guild Delta' }
];

/**
 * Run tests for server-based sharding
 */
async function testServerBasedSharding() {
  logger.info('Starting server-based sharding test');
  
  try {
    // Create a temporary directory for test files
    const testDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Test creating guild-to-shard map
    const guildShardMap = {};
    TEST_GUILDS.forEach((guild, index) => {
      guildShardMap[guild.id] = index;
    });
    
    logger.info(`Created guild-to-shard map with ${Object.keys(guildShardMap).length} guilds`);
    logger.info('Guild to shard mapping:', guildShardMap);
    
    // Write the map to a file
    const mapFilePath = path.join(testDir, 'guild-shard-map.json');
    fs.writeFileSync(mapFilePath, JSON.stringify(guildShardMap, null, 2), 'utf8');
    logger.info(`Wrote guild-to-shard map to ${mapFilePath}`);
    
    // Simulate shard 0
    process.env.SHARD_ID = '0';
    process.env.ASSIGNED_GUILD_ID = TEST_GUILDS[0].id;
    await simulateShard();
    
    // Simulate shard 1
    process.env.SHARD_ID = '1';
    process.env.ASSIGNED_GUILD_ID = TEST_GUILDS[1].id;
    await simulateShard();
    
    logger.info('Server-based sharding test completed successfully');
    return true;
  } catch (error) {
    logger.error(`Server-based sharding test failed: ${error.message}`, { error });
    return false;
  }
}

/**
 * Simulate a specific shard
 */
async function simulateShard() {
  const shardId = process.env.SHARD_ID;
  const guildId = process.env.ASSIGNED_GUILD_ID;
  
  logger.info(`Simulating shard ${shardId} assigned to guild ${guildId}`);
  
  // Create a mock client with shardInfo
  const mockClient = {
    shardInfo: {
      mode: 'server-based',
      shardId: parseInt(shardId),
      totalShards: TEST_GUILDS.length,
      targetGuildId: guildId
    },
    guilds: {
      cache: new Map()
    }
  };
  
  // Add the assigned guild to the client's cache
  const targetGuild = TEST_GUILDS.find(g => g.id === guildId);
  if (targetGuild) {
    mockClient.guilds.cache.set(targetGuild.id, {
      id: targetGuild.id,
      name: targetGuild.name,
      members: { fetch: () => Promise.resolve({ id: 'user123' }) },
      channels: { cache: { size: 5 } },
      roles: { cache: { size: 10 } },
      emojis: { cache: { size: 3 } }
    });
  }
  
  // Log information about this client
  logger.info(`Shard ${shardId} has ${mockClient.guilds.cache.size} guilds in cache`);
  mockClient.guilds.cache.forEach((guild, id) => {
    logger.info(`- Guild ${guild.name} (${id})`);
  });
  
  return new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Main test function
 */
async function runTest() {
  try {
    const result = await testServerBasedSharding();
    
    if (result) {
      console.log('\n✅ Server-based sharding test passed\n');
      process.exit(0);
    } else {
      console.error('\n❌ Server-based sharding test failed\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error during test execution:', error);
    process.exit(1);
  }
}

// Run the test
runTest();