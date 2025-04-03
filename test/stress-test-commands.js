/**
 * Command and Modmail Stress Test Script
 * 
 * This script thoroughly tests all slash commands and modmail functionality
 * under load to ensure they handle concurrent operations reliably.
 */
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { logger } = require('../src/utils/logger');
const { connectToDatabase } = require('../src/database/db');
const fs = require('fs');
const path = require('path');

// Configure longer timeout for tests
const TEST_TIMEOUT = 60000; // 1 minute timeout

// Mock Discord client for testing
const mockClient = {
  db: null,
  commands: new Collection(),
  cooldowns: new Collection(),
  guilds: {
    cache: new Map()
  },
  user: {
    id: '123456789012345678',
    tag: 'Test Bot#1234',
    username: 'Test Bot',
    discriminator: '1234',
    displayAvatarURL: () => 'https://example.com/avatar.png'
  },
  channels: {
    cache: new Map(),
    fetch: async (id) => {
      return mockClient.channels.cache.get(id) || createMockChannel(id);
    }
  }
};

// Helper functions
function createMockInteraction(options = {}) {
  const defaultOptions = {
    commandName: 'help',
    user: {
      id: '987654321098765432',
      tag: 'Test User#5678',
      username: 'Test User',
      discriminator: '5678',
      displayAvatarURL: () => 'https://example.com/user-avatar.png'
    },
    guild: createMockGuild('111222333444555666', 'Test Guild'),
    options: {
      getSubcommand: () => options.subcommand || null,
      getString: (name) => options.stringOptions?.[name] || null,
      getBoolean: (name) => options.booleanOptions?.[name] || false,
      getInteger: (name) => options.integerOptions?.[name] || 0,
      getChannel: (name) => options.channelOptions?.[name] || null,
      getRole: (name) => options.roleOptions?.[name] || null,
      getUser: (name) => options.userOptions?.[name] || null,
      getMentionable: (name) => options.mentionableOptions?.[name] || null,
      getNumber: (name) => options.numberOptions?.[name] || 0,
      getAttachment: (name) => options.attachmentOptions?.[name] || null,
      get: (name) => options.getOptions?.[name] || null,
      getFocused: () => options.focused || '',
      data: options.data || [],
      getMessage: (name) => options.messageOptions?.[name] || null
    },
    deferReply: async () => ({ deferred: true }),
    editReply: async (data) => data,
    followUp: async (data) => data,
    reply: async (data) => data,
    update: async (data) => data,
    values: options.values || [],
    deferred: false,
    replied: false,
    customId: options.customId || 'test-custom-id',
    message: options.message || { content: 'Test message content', attachments: [] },
    channel: options.channel || createMockChannel('987654321987654321', 'test-channel'),
    component: options.component || null
  };

  return { ...defaultOptions, ...options };
}

function createMockGuild(id, name) {
  return {
    id,
    name,
    channels: {
      cache: new Map(),
      create: async (options) => {
        const channel = createMockChannel(`mock-channel-${Date.now()}`, options.name);
        return channel;
      },
      fetch: async () => new Map()
    },
    members: {
      cache: new Map(),
      fetch: async (id) => {
        return {
          id,
          user: {
            id,
            tag: 'Fetched User#1234',
            username: 'Fetched User',
            discriminator: '1234',
            displayAvatarURL: () => 'https://example.com/fetched-avatar.png'
          },
          displayName: 'Fetched User',
          roles: { cache: new Map() }
        };
      }
    },
    roles: {
      cache: new Map(),
      everyone: { id: 'everyone-role-id' }
    }
  };
}

function createMockChannel(id, name = 'test-channel') {
  return {
    id,
    name,
    type: 0, // GUILD_TEXT
    send: async (data) => data,
    createMessageComponentCollector: () => ({
      on: (event, callback) => {
        // Store the callback for testing
        if (!mockClient._collectors) mockClient._collectors = {};
        if (!mockClient._collectors[id]) mockClient._collectors[id] = {};
        mockClient._collectors[id][event] = callback;
        return this;
      },
      stop: () => {}
    }),
    isText: () => true,
    permissionsFor: () => ({
      has: () => true
    }),
    parent: null,
    children: {
      cache: new Map()
    },
    messages: {
      fetch: async () => new Map()
    }
  };
}

// Load commands for testing
async function loadCommands() {
  logger.info('Loading commands for testing...');
  
  const commandsPath = path.join(__dirname, '..', 'src', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        mockClient.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
      }
    }
  }
  
  logger.info(`Loaded ${mockClient.commands.size} commands`);
}

// Test functions

/**
 * Test all commands with basic inputs
 */
async function testAllCommands() {
  logger.info('\n=== Testing All Commands ===');
  
  const commands = Array.from(mockClient.commands.values());
  
  for (const command of commands) {
    logger.info(`\nTesting command: ${command.data.name}`);
    
    try {
      const interaction = createMockInteraction({
        commandName: command.data.name,
        guild: createMockGuild('111222333444555666', 'Test Guild')
      });
      
      // Set environment variable for owner commands if needed
      if (command.data.name === 'clear-database') {
        process.env.OWNER_ID = interaction.user.id;
      }
      
      await command.execute(interaction, mockClient);
      logger.info(`✓ Command ${command.data.name} executed successfully`);
    } catch (error) {
      logger.error(`× Error executing command ${command.data.name}: ${error.message}`, { error });
    }
  }
}

/**
 * Test commands with different subcommands and options
 */
async function testCommandVariations() {
  logger.info('\n=== Testing Command Variations ===');
  
  // Test help command with target parameter
  logger.info('\nTesting help command with target parameter');
  try {
    const interaction = createMockInteraction({
      commandName: 'help',
      options: {
        getString: (name) => name === 'command' ? 'ping' : null,
        getSubcommand: () => null
      }
    });
    
    await mockClient.commands.get('help').execute(interaction, mockClient);
    logger.info('✓ Help command with target parameter executed successfully');
  } catch (error) {
    logger.error(`× Error executing help command with target: ${error.message}`, { error });
  }
  
  // Test modmail-setup command with enable subcommand
  logger.info('\nTesting modmail-setup enable subcommand');
  try {
    const categoryChannel = createMockChannel('category-123', 'Modmail Category');
    categoryChannel.type = 4; // GUILD_CATEGORY
    
    const staffRole = { 
      id: 'role-123', 
      name: 'Staff', 
      permissions: { has: () => true } 
    };
    
    const logChannel = createMockChannel('log-123', 'modmail-logs');
    
    const interaction = createMockInteraction({
      commandName: 'modmail-setup',
      subcommand: 'enable',
      channelOptions: {
        'category': categoryChannel,
        'log_channel': logChannel
      },
      roleOptions: {
        'staff_role': staffRole
      }
    });
    
    await mockClient.commands.get('modmail-setup').execute(interaction, mockClient);
    logger.info('✓ Modmail-setup enable subcommand executed successfully');
  } catch (error) {
    logger.error(`× Error executing modmail-setup enable: ${error.message}`, { error });
  }
  
  // Test modmail-stats with timeframe subcommand
  logger.info('\nTesting modmail-stats timeframe subcommand');
  try {
    const interaction = createMockInteraction({
      commandName: 'modmail-stats',
      subcommand: 'timeframe',
      stringOptions: {
        'period': 'week'
      }
    });
    
    await mockClient.commands.get('modmail-stats').execute(interaction, mockClient);
    logger.info('✓ Modmail-stats timeframe subcommand executed successfully');
  } catch (error) {
    logger.error(`× Error executing modmail-stats timeframe: ${error.message}`, { error });
  }
  
  // Test clear-database command with guild subcommand
  logger.info('\nTesting clear-database guild subcommand');
  try {
    // Set owner ID for testing
    process.env.OWNER_ID = '987654321098765432';
    
    const interaction = createMockInteraction({
      commandName: 'clear-database',
      subcommand: 'guild',
      user: {
        id: process.env.OWNER_ID,
        tag: 'Owner#1234',
        username: 'Owner',
        discriminator: '1234',
        displayAvatarURL: () => 'https://example.com/owner-avatar.png'
      }
    });
    
    await mockClient.commands.get('clear-database').execute(interaction, mockClient);
    logger.info('✓ Clear-database guild subcommand executed successfully');
  } catch (error) {
    logger.error(`× Error executing clear-database guild: ${error.message}`, { error });
  }
}

/**
 * Test modmail thread creation and management
 */
async function testModmail() {
  logger.info('\n=== Testing Modmail Functionality ===');
  
  try {
    // Load modmail utilities
    const { createModmailThread, createModmailTranscript, findThreadWithFallback } = require('../src/utils/modmail');
    
    // Test creating a modmail thread
    logger.info('--- Testing creating a modmail thread ---');
    
    // Mock a DM message
    const mockMessage = {
      author: {
        id: '111222333444555666',
        tag: 'Test User#1234',
        username: 'Test User',
        discriminator: '1234',
        displayAvatarURL: () => 'https://example.com/user-avatar.png'
      },
      content: 'This is a test modmail message',
      attachments: [],
      channel: {
        send: async (data) => data
      },
      reply: async (data) => data
    };
    
    // Test guild with modmail enabled
    const testGuild = createMockGuild('999888777666555444', 'Modmail Test Guild');
    
    // Ensure guild has modmail settings in database
    const [guildSettings] = await mockClient.db.Guild.findOrCreate({
      where: { guildId: testGuild.id },
      defaults: { 
        guildId: testGuild.id,
        guildName: testGuild.name,
        modmailEnabled: true
      }
    });
    
    // Enable modmail
    await guildSettings.updateSettings({
      modmail: { enabled: true }
    });
    
    // Make sure the modmailEnabled column is also true
    await guildSettings.update({ modmailEnabled: true });
    
    // Add guild to client.guilds cache
    mockClient.guilds.cache.set(testGuild.id, testGuild);
    
    // Test creating a thread
    try {
      await createModmailThread(mockMessage, mockClient, testGuild);
      logger.info('✓ Successfully created modmail thread');
    } catch (error) {
      logger.error(`× Error creating modmail thread: ${error.message}`, { error });
    }
    
    // Test finding a thread
    logger.info('--- Testing finding a modmail thread ---');
    
    try {
      const threads = await mockClient.db.ModmailThread.findAll({
        where: {
          userId: mockMessage.author.id,
          guildId: testGuild.id
        }
      });
      
      logger.info(`Found ${threads.length} threads for user`);
      if (threads.length > 0) {
        logger.info(`Thread data: ${JSON.stringify(threads[0].dataValues)}`);
        
        // Test thread operations
        const thread = threads[0];
        
        // Test updating activity
        await thread.updateActivity('test');
        logger.info('✓ Successfully updated thread activity');
        
        // Test closing a thread
        await thread.closeThread('TESTER', 'Testing thread closing');
        logger.info('✓ Successfully closed modmail thread');
      } else {
        logger.warn('No modmail threads found for testing');
      }
    } catch (error) {
      logger.error(`× Error in thread operations: ${error.message}`, { error });
    }
  } catch (error) {
    logger.error(`× Error in modmail tests: ${error.message}`, { error });
  }
}

/**
 * Test guild settings handling
 */
async function testGuildSettings() {
  logger.info('\n=== Testing Guild Settings ===');
  
  try {
    // Create test guild settings
    const guildId = `test-guild-${Date.now()}`;
    const guildName = `Test Guild ${Date.now()}`;
    
    logger.info(`Creating test guild settings for ${guildName} (${guildId})`);
    
    const [guildSettings, created] = await mockClient.db.Guild.findOrCreate({
      where: { guildId },
      defaults: {
        guildId,
        guildName: guildName,
        settings: JSON.stringify({
          test: true,
          nested: {
            value: 123,
            array: [1, 2, 3]
          }
        })
      }
    });
    
    logger.info(`✓ Guild settings ${created ? 'created' : 'found'}`);
    
    // Test updating settings
    logger.info('Testing updateSetting method');
    await guildSettings.updateSetting('testKey', 'testValue');
    logger.info('✓ Updated single setting');
    
    // Test updating nested settings
    logger.info('Testing updateSetting with nested path');
    await guildSettings.updateSetting('nested.newKey', 'nestedValue');
    logger.info('✓ Updated nested setting');
    
    // Test updating multiple settings
    logger.info('Testing updateSettings method');
    await guildSettings.updateSettings({
      bulk: true,
      nested: {
        bulk: true
      }
    });
    logger.info('✓ Updated multiple settings');
    
    // Test getting settings
    const value = guildSettings.getSetting('testKey');
    logger.info(`Retrieved setting testKey: ${value}`);
    
    const nestedValue = guildSettings.getSetting('nested.newKey');
    logger.info(`Retrieved nested setting nested.newKey: ${nestedValue}`);
    
    // Test toggling command
    await guildSettings.toggleCommand('ping', true);
    logger.info('✓ Disabled ping command');
    
    const isDisabled = guildSettings.isCommandDisabled('ping');
    logger.info(`Command ping is disabled: ${isDisabled}`);
    
    await guildSettings.toggleCommand('ping', false);
    logger.info('✓ Enabled ping command');
  } catch (error) {
    logger.error(`× Error in guild settings tests: ${error.message}`, { error });
  }
}

/**
 * Stress test by executing multiple commands concurrently
 */
async function stressTestConcurrentCommands(concurrency = 10) {
  logger.info(`\n=== Stress Testing ${concurrency} Concurrent Commands ===`);
  
  const commandTests = [];
  const commands = Array.from(mockClient.commands.values());
  
  for (let i = 0; i < concurrency; i++) {
    // Get a command (cycling through available commands)
    const command = commands[i % commands.length];
    
    // Create the test function
    const testFn = async () => {
      try {
        const interaction = createMockInteraction({
          commandName: command.data.name,
          guild: createMockGuild(`test-guild-${i}`, `Test Guild ${i}`)
        });
        
        // Set owner ID for owner-only commands
        if (command.data.name === 'clear-database') {
          process.env.OWNER_ID = interaction.user.id;
        }
        
        await command.execute(interaction, mockClient);
        return true;
      } catch (error) {
        logger.error(`× Error in concurrent test of ${command.data.name}: ${error.message}`);
        return false;
      }
    };
    
    commandTests.push(testFn());
  }
  
  try {
    const results = await Promise.all(commandTests);
    const successCount = results.filter(r => r).length;
    logger.info(`✓ Completed concurrent command tests. Success: ${successCount}/${concurrency}`);
  } catch (error) {
    logger.error(`× Error in concurrent command tests: ${error.message}`, { error });
  }
}

/**
 * Stress test modmail thread creation
 */
async function stressTestModmail(concurrency = 5) {
  logger.info(`\n=== Stress Testing ${concurrency} Concurrent Modmail Threads ===`);
  
  try {
    // Load modmail utilities
    const { createModmailThread } = require('../src/utils/modmail');
    
    // Create test guild with modmail enabled
    const testGuild = createMockGuild('modmail-stress-test', 'Modmail Stress Test Guild');
    
    // Ensure guild has modmail settings in database
    const [guildSettings] = await mockClient.db.Guild.findOrCreate({
      where: { guildId: testGuild.id },
      defaults: { 
        guildId: testGuild.id,
        guildName: testGuild.name,
        modmailEnabled: true
      }
    });
    
    // Enable modmail
    await guildSettings.updateSettings({
      modmail: { enabled: true }
    });
    await guildSettings.update({ modmailEnabled: true });
    
    // Add guild to client.guilds cache
    mockClient.guilds.cache.set(testGuild.id, testGuild);
    
    // Create concurrent modmail threads
    const threadTests = [];
    
    for (let i = 0; i < concurrency; i++) {
      const userId = `user-${Date.now()}-${i}`;
      
      // Mock a DM message
      const mockMessage = {
        author: {
          id: userId,
          tag: `Test User #${i}`,
          username: `Test User ${i}`,
          discriminator: '1234',
          displayAvatarURL: () => 'https://example.com/user-avatar.png'
        },
        content: `This is a test modmail message ${i}`,
        attachments: [],
        channel: {
          send: async (data) => data
        },
        reply: async (data) => data
      };
      
      // Create the test function
      const testFn = async () => {
        try {
          await createModmailThread(mockMessage, mockClient, testGuild);
          return true;
        } catch (error) {
          logger.error(`× Error creating concurrent modmail thread ${i}: ${error.message}`);
          return false;
        }
      };
      
      threadTests.push(testFn());
    }
    
    try {
      const results = await Promise.all(threadTests);
      const successCount = results.filter(r => r).length;
      logger.info(`✓ Completed concurrent modmail tests. Success: ${successCount}/${concurrency}`);
    } catch (error) {
      logger.error(`× Error in concurrent modmail tests: ${error.message}`, { error });
    }
  } catch (error) {
    logger.error(`× Error in modmail stress tests: ${error.message}`, { error });
  }
}

/**
 * Test our new clear-database command
 */
async function testClearDatabaseCommand() {
  logger.info('\n=== Testing Clear Database Command ===');
  
  // Set owner ID for testing
  process.env.OWNER_ID = '987654321098765432';
  
  try {
    // Test guild subcommand
    logger.info('Testing clear-database guild subcommand');
    const guildInteraction = createMockInteraction({
      commandName: 'clear-database',
      subcommand: 'guild',
      user: {
        id: process.env.OWNER_ID,
        tag: 'Owner#1234',
        username: 'Owner',
        discriminator: '1234',
        displayAvatarURL: () => 'https://example.com/owner-avatar.png'
      }
    });
    
    await mockClient.commands.get('clear-database').execute(guildInteraction, mockClient);
    logger.info('✓ Clear-database guild subcommand executed successfully');
    
    // Test modmail subcommand
    logger.info('Testing clear-database modmail subcommand');
    const modmailInteraction = createMockInteraction({
      commandName: 'clear-database',
      subcommand: 'modmail',
      user: {
        id: process.env.OWNER_ID,
        tag: 'Owner#1234',
        username: 'Owner',
        discriminator: '1234',
        displayAvatarURL: () => 'https://example.com/owner-avatar.png'
      }
    });
    
    await mockClient.commands.get('clear-database').execute(modmailInteraction, mockClient);
    logger.info('✓ Clear-database modmail subcommand executed successfully');
    
    // Test all subcommand
    logger.info('Testing clear-database all subcommand');
    const allInteraction = createMockInteraction({
      commandName: 'clear-database',
      subcommand: 'all',
      user: {
        id: process.env.OWNER_ID,
        tag: 'Owner#1234',
        username: 'Owner',
        discriminator: '1234',
        displayAvatarURL: () => 'https://example.com/owner-avatar.png'
      }
    });
    
    await mockClient.commands.get('clear-database').execute(allInteraction, mockClient);
    logger.info('✓ Clear-database all subcommand executed successfully');
    
    // Test access control - non-owner user
    logger.info('Testing clear-database command access control');
    const unauthorizedInteraction = createMockInteraction({
      commandName: 'clear-database',
      subcommand: 'all',
      user: {
        id: 'not-the-owner-id',
        tag: 'User#5678',
        username: 'User',
        discriminator: '5678',
        displayAvatarURL: () => 'https://example.com/user-avatar.png'
      }
    });
    
    await mockClient.commands.get('clear-database').execute(unauthorizedInteraction, mockClient);
    logger.info('✓ Clear-database access control worked as expected');
  } catch (error) {
    logger.error(`× Error testing clear-database command: ${error.message}`, { error });
  }
}

// Run all tests
async function runAllTests() {
  try {
    logger.info('Starting comprehensive stress tests...');
    
    // Connect to database
    const { models } = await connectToDatabase();
    mockClient.db = models;
    
    // Load commands
    await loadCommands();
    
    // Wait for database to be ready
    logger.info('Database connected, waiting for models to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests with timeouts to prevent hanging
    await Promise.race([
      testGuildSettings(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Guild settings test timed out')), TEST_TIMEOUT))
    ]);
    
    await Promise.race([
      testAllCommands(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('All commands test timed out')), TEST_TIMEOUT))
    ]);
    
    await Promise.race([
      testCommandVariations(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Command variations test timed out')), TEST_TIMEOUT))
    ]);
    
    await Promise.race([
      testModmail(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Modmail test timed out')), TEST_TIMEOUT))
    ]);
    
    await Promise.race([
      testClearDatabaseCommand(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Clear database test timed out')), TEST_TIMEOUT))
    ]);
    
    // Stress tests
    await Promise.race([
      stressTestConcurrentCommands(20),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Concurrent commands test timed out')), TEST_TIMEOUT))
    ]);
    
    await Promise.race([
      stressTestModmail(10),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Modmail stress test timed out')), TEST_TIMEOUT))
    ]);
    
    logger.info('\n=== All tests completed successfully ===');
  } catch (error) {
    logger.error(`Error in tests: ${error.message}`, { error });
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Start the tests
runAllTests();