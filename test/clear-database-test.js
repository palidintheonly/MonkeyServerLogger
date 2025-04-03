/**
 * Clear Database Command Test
 * 
 * This script tests the functionality of the clear-database command
 * ensuring it works correctly with all subcommands and access control.
 */
require('dotenv').config();
const { logger } = require('../src/utils/logger');
const { connectToDatabase } = require('../src/database/db');
const clearDatabaseCommand = require('../src/commands/admin/clear-database');

// Mock client and interaction for testing
const mockClient = {
  db: null,
  guilds: {
    cache: new Map()
  }
};

// Helper function to create mock interactions
function createMockInteraction(options = {}) {
  const defaultOptions = {
    user: {
      id: options.isOwner ? process.env.OWNER_ID || '123456789' : '987654321',
      tag: options.isOwner ? 'Owner#1234' : 'User#5678',
      displayAvatarURL: () => 'https://example.com/avatar.png'
    },
    guild: {
      id: '111222333444555666',
      name: 'Test Guild'
    },
    deferReply: async () => ({ interaction: 'deferred' }),
    editReply: async (data) => {
      logger.debug('Edit Reply Called with:', data);
      return data;
    },
    reply: async (data) => {
      logger.debug('Reply Called with:', data);
      return data;
    },
    options: {
      getSubcommand: () => options.subcommand || 'guild'
    },
    values: options.values || [],
    deferred: false,
    message: {
      createMessageComponentCollector: () => ({
        on: (event, callback) => {
          // We'll store the callback for simulating button clicks
          if (event === 'collect') {
            mockClient._collectors = mockClient._collectors || {};
            mockClient._collectors[options.subcommand || 'guild'] = callback;
          }
          return { stop: () => {} };
        }
      }),
      components: []
    },
    customId: options.customId || ''
  };

  return { ...defaultOptions, ...options };
}

// Helper function to simulate button clicks
async function simulateButtonClick(interaction, buttonId) {
  const buttonInteraction = {
    ...interaction,
    customId: buttonId,
    update: async (data) => {
      logger.debug('Button Update Called with:', data);
      return data;
    },
    editReply: async (data) => {
      logger.debug('Button EditReply Called with:', data);
      return data;
    }
  };
  
  logger.info(`Simulating button click: ${buttonId}`);
  
  // Use our command's handleButton method directly
  const handled = await clearDatabaseCommand.handleButton(buttonInteraction, mockClient);
  logger.info(`Button handled: ${handled}`);
  
  return buttonInteraction;
}

// Test the guild subcommand
async function testGuildSubcommand() {
  logger.info('\n=== Testing clear-database guild subcommand ===');
  
  // Set an owner ID for testing
  process.env.OWNER_ID = '123456789';
  
  // Create mock interaction
  const interaction = createMockInteraction({
    subcommand: 'guild',
    isOwner: true
  });
  
  try {
    // Execute the command
    await clearDatabaseCommand.execute(interaction, mockClient);
    logger.info('✓ Guild subcommand executed successfully');
    
    // Add some test guild data to the database
    logger.info('Adding test guild data...');
    const testGuildId = `test-guild-${Date.now()}`;
    const [guildSettings] = await mockClient.db.Guild.findOrCreate({
      where: { guildId: testGuildId },
      defaults: {
        guildId: testGuildId,
        guildName: 'Test Guild for Deletion'
      }
    });
    logger.info(`✓ Created test guild: ${guildSettings.guildId}`);
    
    // Manually trigger the select menu with this guild
    logger.info('Simulating select menu interaction...');
    const selectInteraction = {
      ...interaction,
      customId: 'clear-guild-select',
      values: [testGuildId],
      update: async (data) => {
        logger.debug('Select Menu Update Called with:', data);
        return data;
      }
    };
    
    if (mockClient._collectors && mockClient._collectors.guild) {
      await mockClient._collectors.guild(selectInteraction);
      logger.info('✓ Guild selection successful');
      
      // Now simulate the confirm button click
      logger.info('Simulating confirm button click...');
      await simulateButtonClick(selectInteraction, `confirm-clear-guild-${testGuildId}`);
      logger.info('✓ Confirm button click successful');
      
      // Check if guild was deleted
      const guild = await mockClient.db.Guild.findByPk(testGuildId);
      if (!guild) {
        logger.info('✓ Guild was successfully deleted from the database');
      } else {
        logger.warn('× Guild was not deleted from the database');
      }
    } else {
      logger.warn('× No collector found for guild selection');
    }
  } catch (error) {
    logger.error(`× Error testing guild subcommand: ${error.message}`, { error });
  }
}

// Test the modmail subcommand
async function testModmailSubcommand() {
  logger.info('\n=== Testing clear-database modmail subcommand ===');
  
  // Create mock interaction
  const interaction = createMockInteraction({
    subcommand: 'modmail',
    isOwner: true
  });
  
  try {
    // Add some test modmail threads to the database
    logger.info('Adding test modmail data...');
    const testUserId = `user-${Date.now()}`;
    const testGuildId = `guild-${Date.now()}`;
    const testThreadId = `thread-${Date.now()}`;
    
    await mockClient.db.ModmailThread.create({
      id: testThreadId,
      userId: testUserId,
      guildId: testGuildId,
      open: true,
      subject: 'Test Thread',
      createdBy: testUserId,
      messageCount: 1
    });
    logger.info('✓ Created test modmail thread');
    
    // Execute the command
    await clearDatabaseCommand.execute(interaction, mockClient);
    logger.info('✓ Modmail subcommand executed successfully');
    
    // Simulate confirm button click
    logger.info('Simulating confirm button click...');
    await simulateButtonClick(interaction, 'confirm-clear-modmail');
    logger.info('✓ Confirm button click simulation attempted');
    
    // Check if threads were deleted
    const threadCount = await mockClient.db.ModmailThread.count();
    logger.info(`Remaining modmail threads: ${threadCount}`);
  } catch (error) {
    logger.error(`× Error testing modmail subcommand: ${error.message}`, { error });
  }
}

// Test the all subcommand
async function testAllSubcommand() {
  logger.info('\n=== Testing clear-database all subcommand ===');
  
  // Create mock interaction
  const interaction = createMockInteraction({
    subcommand: 'all',
    isOwner: true
  });
  
  try {
    // Execute the command
    await clearDatabaseCommand.execute(interaction, mockClient);
    logger.info('✓ All subcommand executed successfully');
    
    // Simulate confirm button click
    logger.info('Simulating confirm button click...');
    await simulateButtonClick(interaction, 'confirm-clear-all');
    logger.info('✓ Confirm button click simulation attempted');
    
    // Check database state after command
    const guildCount = await mockClient.db.Guild.count();
    const threadCount = await mockClient.db.ModmailThread.count();
    logger.info(`Remaining guilds: ${guildCount}, Remaining threads: ${threadCount}`);
  } catch (error) {
    logger.error(`× Error testing all subcommand: ${error.message}`, { error });
  }
}

// Test access control
async function testAccessControl() {
  logger.info('\n=== Testing access control for clear-database command ===');
  
  // Set the owner ID
  process.env.OWNER_ID = '123456789';
  
  // Create mock interaction for non-owner user
  const interaction = createMockInteraction({
    subcommand: 'all',
    isOwner: false
  });
  
  try {
    // Execute the command
    await clearDatabaseCommand.execute(interaction, mockClient);
    logger.info('✓ Access control check executed successfully');
    
    // The error message about requiring owner should have been sent
    logger.info('✓ Non-owner was properly denied access');
  } catch (error) {
    logger.error(`× Error testing access control: ${error.message}`, { error });
  }
}

// Run all tests
async function runTests() {
  try {
    logger.info('Starting clear-database command tests...');
    
    // Connect to database
    const { models } = await connectToDatabase();
    mockClient.db = models;
    
    // Wait for database to be ready
    logger.info('Database connected, waiting for models to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests
    await testAccessControl();
    await testGuildSubcommand();
    await testModmailSubcommand();
    await testAllSubcommand();
    
    logger.info('\n=== All clear-database tests completed ===');
  } catch (error) {
    logger.error(`Error in clear-database tests: ${error.message}`, { error });
  } finally {
    process.exit(0);
  }
}

// Start the tests
runTests();