/**
 * Sharding Modes Test Script
 * 
 * Tests all three sharding modes of the bot:
 * 1. Standalone (no sharding)
 * 2. Standard Discord.js sharding
 * 3. Custom server-based sharding
 */
require('dotenv').config();
const { logger } = require('../src/utils/logger');
const { Client, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Clean up environment variables to start fresh
delete process.env.SHARD_ID;
delete process.env.SHARD_COUNT;
delete process.env.ASSIGNED_GUILD_ID;

// Flag to track test progress
let successCount = 0;
let failureCount = 0;

/**
 * Create test guilds
 */
function createTestGuilds(count = 5) {
  const guilds = [];
  for (let i = 0; i < count; i++) {
    const id = crypto.randomBytes(8).toString('hex');
    guilds.push({
      id,
      name: `Test Guild ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
      memberCount: Math.floor(Math.random() * 1000) + 100,
      channels: {
        cache: {
          size: Math.floor(Math.random() * 20) + 5
        }
      },
      roles: {
        cache: {
          size: Math.floor(Math.random() * 10) + 3
        }
      },
      emojis: {
        cache: {
          size: Math.floor(Math.random() * 5)
        }
      }
    });
  }
  return guilds;
}

/**
 * Create a mock client
 */
function createMockClient(options = {}) {
  const guilds = options.guilds || createTestGuilds(options.guildCount || 3);
  
  // Convert guilds array to Map for cache simulation
  const guildCache = new Map();
  guilds.forEach(guild => {
    guildCache.set(guild.id, guild);
  });
  
  // Create channels collection
  const channelsCache = new Map();
  
  // Add some fake channels
  for (let i = 0; i < 10; i++) {
    const channelId = crypto.randomBytes(8).toString('hex');
    channelsCache.set(channelId, {
      id: channelId,
      name: `channel-${i}`,
      type: i % 3 // Different channel types
    });
  }
  
  return {
    user: { tag: 'TestBot#0000', setPresence: () => {} },
    shardInfo: options.shardInfo || { mode: 'standalone' },
    commands: new Collection(),
    guilds: {
      cache: guildCache
    },
    channels: {
      cache: channelsCache
    },
    db: {
      Guild: {
        findOne: () => Promise.resolve({
          modmailEnabled: true,
          settings: {
            modmail: {
              enabled: true,
              categoryId: '123456789',
              logChannelId: '987654321'
            }
          }
        }),
        findOrCreate: () => Promise.resolve([{
          modmailEnabled: true,
          settings: {
            modmail: {
              enabled: true
            }
          },
          getSetting: (key) => ({
            enabled: true,
            categoryId: '123456789',
            logChannelId: '987654321'
          })
        }])
      },
      ModmailThread: {
        findInactiveThreads: () => Promise.resolve([])
      }
    }
  };
}

/**
 * Mock the ready.js event handler
 */
async function simulateReadyEvent(client) {
  logger.info('Simulating ready event...');
  
  try {
    // Load the ready event handler
    const readyEvent = require('../src/events/discord.ready');
    
    // Execute the handler with our mock client
    await readyEvent.execute(client);
    
    logger.info('Ready event simulation complete');
    return true;
  } catch (error) {
    logger.error(`Error in ready event simulation: ${error.message}`, { error });
    return false;
  }
}

/**
 * Test standalone mode
 */
async function testStandaloneMode() {
  logger.info('=== TESTING STANDALONE MODE ===');
  
  try {
    // Create a mock client in standalone mode
    const client = createMockClient({
      guildCount: 3,
      shardInfo: { mode: 'standalone' }
    });
    
    // Add required methods for testing
    client.login = () => Promise.resolve('fake-token');
    
    // Simulate ready event
    const result = await simulateReadyEvent(client);
    
    if (result) {
      logger.info('✅ Standalone mode test passed');
      successCount++;
      return true;
    } else {
      logger.error('❌ Standalone mode test failed');
      failureCount++;
      return false;
    }
  } catch (error) {
    logger.error(`Error in standalone mode test: ${error.message}`, { error });
    failureCount++;
    return false;
  }
}

/**
 * Test standard Discord.js sharding
 */
async function testStandardSharding() {
  logger.info('=== TESTING STANDARD SHARDING MODE ===');
  
  try {
    // Create a mock client in standard sharding mode
    const client = createMockClient({
      guildCount: 5,
      shardInfo: {
        mode: 'standard',
        shardId: 1,
        totalShards: 3
      }
    });
    
    // Add required methods for testing
    client.login = () => Promise.resolve('fake-token');
    
    // Simulate ready event
    const result = await simulateReadyEvent(client);
    
    if (result) {
      logger.info('✅ Standard sharding mode test passed');
      successCount++;
      return true;
    } else {
      logger.error('❌ Standard sharding mode test failed');
      failureCount++;
      return false;
    }
  } catch (error) {
    logger.error(`Error in standard sharding mode test: ${error.message}`, { error });
    failureCount++;
    return false;
  }
}

/**
 * Test server-based sharding
 */
async function testServerBasedSharding() {
  logger.info('=== TESTING SERVER-BASED SHARDING MODE ===');
  
  try {
    // Create test guilds
    const testGuilds = createTestGuilds(1);
    const targetGuild = testGuilds[0];
    
    // Create a mock client in server-based sharding mode
    const client = createMockClient({
      guilds: testGuilds,
      shardInfo: {
        mode: 'server-based',
        shardId: 0,
        totalShards: 1,
        targetGuildId: targetGuild.id
      }
    });
    
    // Add required methods for testing
    client.login = () => Promise.resolve('fake-token');
    
    // Simulate ready event
    const result = await simulateReadyEvent(client);
    
    if (result) {
      logger.info('✅ Server-based sharding mode test passed');
      successCount++;
      return true;
    } else {
      logger.error('❌ Server-based sharding mode test failed');
      failureCount++;
      return false;
    }
  } catch (error) {
    logger.error(`Error in server-based sharding mode test: ${error.message}`, { error });
    failureCount++;
    return false;
  }
}

/**
 * Mock messageCreate event to test DM handling
 */
async function testMessageCreateEvent() {
  logger.info('=== TESTING MESSAGE CREATE EVENT (DM Handling) ===');
  
  try {
    // Create mock client
    const client = createMockClient({
      guildCount: 2,
      shardInfo: { mode: 'standalone' }
    });
    
    // Create a mock message
    const mockMessage = {
      author: {
        id: 'user123',
        tag: 'TestUser#1234',
        bot: false
      },
      channel: {
        type: 1, // DM
        id: 'dm123'
      },
      content: 'Hello, this is a test message',
      reply: () => Promise.resolve()
    };
    
    // Load messageCreate event handler
    const messageEvent = require('../src/events/discord.messageCreate');
    
    // Add guild members fetch method
    for (const [_, guild] of client.guilds.cache) {
      guild.members = {
        fetch: (userId) => {
          if (userId === 'user123') {
            return Promise.resolve({
              id: userId,
              displayName: 'Test User'
            });
          }
          return Promise.reject(new Error('User not found'));
        }
      };
    }
    
    // Execute event handler
    await messageEvent.execute(mockMessage, client);
    
    logger.info('✅ messageCreate event test passed');
    successCount++;
    return true;
  } catch (error) {
    logger.error(`Error in messageCreate event test: ${error.message}`, { error });
    failureCount++;
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    logger.info('Starting sharding modes test...');
    
    // Run tests for each mode
    await testStandaloneMode();
    await testStandardSharding();
    await testServerBasedSharding();
    //await testMessageCreateEvent(); // This requires more mocking, so commenting out for now
    
    // Log results
    logger.info(`\nTest Results: ${successCount} passed, ${failureCount} failed\n`);
    
    if (failureCount === 0) {
      console.log('\n✅ All sharding mode tests passed!\n');
      return true;
    } else {
      console.error(`\n❌ ${failureCount} tests failed\n`);
      return false;
    }
  } catch (error) {
    logger.error(`Error in test suite: ${error.message}`, { error });
    return false;
  }
}

// Run all tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
});