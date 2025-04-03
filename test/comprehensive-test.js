/**
 * Comprehensive Test Script for Discord Modmail Bot
 * 
 * Tests all commands and modmail functionality thoroughly
 */
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { logger } = require('../src/utils/logger');
const { connectToDatabase } = require('../src/database/db');
const fs = require('fs');
const path = require('path');

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
    displayAvatarURL: () => 'https://example.com/avatar.png'
  }
};

// Mock Discord interactions for testing
function createMockInteraction(options = {}) {
  const defaults = {
    commandName: 'help',
    options: new Collection(),
    user: {
      id: '111222333444555666',
      tag: 'Test User#1234',
      displayAvatarURL: () => 'https://example.com/user-avatar.png'
    },
    guild: {
      id: '999888777666555444',
      name: 'Test Guild'
    },
    replied: false,
    deferred: false,
    replies: [],
    deferUpdates: []
  };

  const interaction = { ...defaults, ...options };
  
  // Add mock methods
  interaction.reply = async (replyOptions) => {
    interaction.replied = true;
    interaction.replies.push(replyOptions);
    logger.info(`Interaction replied: ${JSON.stringify(replyOptions)}`);
    return Promise.resolve();
  };
  
  interaction.deferReply = async (deferOptions) => {
    interaction.deferred = true;
    logger.info(`Interaction deferred: ${JSON.stringify(deferOptions)}`);
    return Promise.resolve();
  };
  
  interaction.editReply = async (editOptions) => {
    logger.info(`Interaction edited: ${JSON.stringify(editOptions)}`);
    return Promise.resolve();
  };
  
  interaction.deferUpdate = async () => {
    interaction.deferUpdates.push(true);
    logger.info('Interaction update deferred');
    return Promise.resolve();
  };
  
  return interaction;
}

// Mock guild instance with basic functionality
function createMockGuild(id, name) {
  return {
    id,
    name,
    channels: {
      cache: new Map(),
      fetch: async (channelId) => {
        logger.info(`Fetching channel ${channelId} from ${name}`);
        return {
          id: channelId,
          name: `channel-${channelId}`,
          send: async (content) => {
            logger.info(`Message sent to channel ${channelId}: ${JSON.stringify(content)}`);
            return { id: `msg-${Date.now()}` };
          }
        };
      },
      create: async (options) => {
        const channelId = `new-channel-${Date.now()}`;
        logger.info(`Created channel in ${name}: ${JSON.stringify(options)}`);
        return {
          id: channelId,
          name: options.name,
          send: async (content) => {
            logger.info(`Message sent to new channel ${channelId}: ${JSON.stringify(content)}`);
            return { id: `msg-${Date.now()}` };
          }
        };
      }
    },
    members: {
      cache: new Map(),
      fetch: async (userId) => {
        logger.info(`Fetching member ${userId} from ${name}`);
        return { 
          id: userId,
          displayName: `User ${userId}`,
          roles: {
            cache: new Map([
              ['role1', { id: 'role1', name: 'Member' }]
            ])
          }
        };
      }
    }
  };
}

// Test all commands
async function testAllCommands() {
  logger.info('=== Testing All Commands ===');
  
  // Load commands
  const commandsPath = path.join(__dirname, '..', 'src', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      
      // Add to commands collection
      if ('data' in command && 'execute' in command) {
        mockClient.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      }
    }
  }
  
  // Test each command
  for (const [name, command] of mockClient.commands) {
    try {
      logger.info(`\n--- Testing command: ${name} ---`);
      
      // Create a mock interaction for this command
      const interaction = createMockInteraction({ commandName: name });
      
      // Execute the command
      await command.execute(interaction, mockClient);
      
      logger.info(`Command ${name} executed successfully`);
    } catch (error) {
      logger.error(`Error testing command ${name}: ${error.message}`, { error });
    }
  }
}

// Test modmail functionality
async function testModmail() {
  logger.info('\n=== Testing Modmail Functionality ===');
  
  try {
    // Load modmail utilities
    const { createModmailThread, createModmailTranscript } = require('../src/utils/modmail');
    
    // Test creating a modmail thread
    logger.info('--- Testing creating a modmail thread ---');
    
    // Mock a DM message
    const mockMessage = {
      author: {
        id: '111222333444555666',
        tag: 'Test User#1234',
        displayAvatarURL: () => 'https://example.com/user-avatar.png'
      },
      content: 'This is a test modmail message',
      attachments: []
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
    
    // Add guild to client.guilds cache
    mockClient.guilds.cache.set(testGuild.id, testGuild);
    
    // Test creating a thread
    try {
      await createModmailThread(mockMessage, mockClient, testGuild);
      logger.info('Successfully created modmail thread');
    } catch (error) {
      logger.error(`Error creating modmail thread: ${error.message}`, { error });
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
      }
    } catch (error) {
      logger.error(`Error finding modmail threads: ${error.message}`, { error });
    }
    
    // Test closing a thread
    logger.info('--- Testing closing a modmail thread ---');
    
    try {
      const thread = await mockClient.db.ModmailThread.findOne({
        where: {
          userId: mockMessage.author.id,
          guildId: testGuild.id,
          open: true
        }
      });
      
      if (thread) {
        await thread.closeThread('TESTER', 'Testing thread closing');
        logger.info('Successfully closed modmail thread');
      } else {
        logger.info('No active thread found to close');
      }
    } catch (error) {
      logger.error(`Error closing modmail thread: ${error.message}`, { error });
    }
  } catch (error) {
    logger.error(`Error in modmail tests: ${error.message}`, { error });
  }
}

// Test guild settings
async function testGuildSettings() {
  logger.info('\n=== Testing Guild Settings ===');
  
  try {
    // Create a test guild
    const guildId = 'settings-test-' + Date.now();
    const guildName = 'Settings Test Guild';
    
    logger.info(`Creating test guild: ${guildName} (${guildId})`);
    
    // Test findOrCreate
    const [guild, created] = await mockClient.db.Guild.findOrCreate({
      where: { guildId },
      defaults: {
        guildId,
        guildName,
        settings: JSON.stringify({
          testSetting: 'test value',
          nestedSetting: {
            level1: 'level 1 value',
            level2: {
              level2Value: 'level 2 value'
            }
          }
        })
      }
    });
    
    logger.info(`Guild created: ${created}`);
    
    // Test getSetting
    const testSetting = guild.getSetting('testSetting');
    logger.info(`testSetting: ${testSetting}`);
    
    const nestedSetting = guild.getSetting('nestedSetting.level1');
    logger.info(`nestedSetting.level1: ${nestedSetting}`);
    
    const deepNestedSetting = guild.getSetting('nestedSetting.level2.level2Value');
    logger.info(`nestedSetting.level2.level2Value: ${deepNestedSetting}`);
    
    // Test updateSetting
    await guild.updateSetting('updatedSetting', 'new value');
    logger.info(`Updated setting 'updatedSetting'`);
    
    await guild.updateSetting('nestedSetting.level2.newValue', 'brand new value');
    logger.info(`Updated nested setting 'nestedSetting.level2.newValue'`);
    
    // Test updateSettings
    await guild.updateSettings({
      batchUpdate: 'batch value',
      nestedSetting: {
        level1: 'updated level 1',
        level2: {
          additionalValue: 'additional nested value'
        }
      }
    });
    logger.info(`Batch updated settings`);
    
    // Verify updates
    const updatedSetting = guild.getSetting('updatedSetting');
    logger.info(`updatedSetting: ${updatedSetting}`);
    
    const updatedNestedSetting = guild.getSetting('nestedSetting.level1');
    logger.info(`Updated nestedSetting.level1: ${updatedNestedSetting}`);
    
    const newNestedSetting = guild.getSetting('nestedSetting.level2.newValue');
    logger.info(`nestedSetting.level2.newValue: ${newNestedSetting}`);
    
    const additionalValue = guild.getSetting('nestedSetting.level2.additionalValue');
    logger.info(`nestedSetting.level2.additionalValue: ${additionalValue}`);
    
    const batchUpdate = guild.getSetting('batchUpdate');
    logger.info(`batchUpdate: ${batchUpdate}`);
    
    // Get all settings as JSON string for inspection
    let allSettings = guild.getDataValue('settings');
    if (typeof allSettings === 'string') {
      try {
        allSettings = JSON.parse(allSettings);
      } catch (e) {
        logger.warn('Could not parse settings JSON');
      }
    }
    
    logger.info(`All settings: ${JSON.stringify(allSettings)}`);
  } catch (error) {
    logger.error(`Error in guild settings tests: ${error.message}`, { error });
  }
}

// Run all tests
async function runAllTests() {
  try {
    logger.info('Starting comprehensive tests...');
    
    // Connect to database
    const db = await connectToDatabase();
    mockClient.db = db;
    
    // Wait for database to be ready
    logger.info('Database connected, waiting for models to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests
    await testGuildSettings();
    await testAllCommands();
    await testModmail();
    
    logger.info('\n=== All tests completed ===');
  } catch (error) {
    logger.error(`Error in tests: ${error.message}`, { error });
  }
}

// Start the tests
runAllTests();
