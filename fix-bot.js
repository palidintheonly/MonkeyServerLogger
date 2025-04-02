// Enhanced Discord.js bot with proper command handling
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./src/utils/logger');
const { logger: enhancedLogger } = require('./src/utils/enhanced-logger');
const { models, connectToDatabase } = require('./src/database/db');

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Initialize commands collection
client.commands = new Collection();

// Load commands from directory
function loadCommands() {
  const commandFolders = ['info', 'management'];
  const commandsPath = path.join(__dirname, 'src', 'commands');
  
  // First, load basic command files in commands directory
  const basicCommandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && !fs.statSync(path.join(commandsPath, file)).isDirectory());
  
  for (const file of basicCommandFiles) {
    const filePath = path.join(commandsPath, file);
    logger.info(`Loading command file: ${filePath}`);
    
    try {
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
      }
    } catch (error) {
      logger.error(`Error loading command file ${filePath}:`, error);
    }
  }
  
  // Now, load commands from subfolders
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    
    if (!fs.existsSync(folderPath)) {
      logger.warn(`Command folder not found: ${folderPath}`);
      continue;
    }
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      logger.info(`Loading command file: ${filePath}`);
      
      try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          logger.info(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
        }
      } catch (error) {
        logger.error(`Error loading command file ${filePath}:`, error);
      }
    }
  }
  
  logger.info(`Loaded ${client.commands.size} commands total`);
  return client.commands;
}

// Register commands with Discord API
async function registerCommands() {
  const appId = process.env.DISCORD_APPLICATION_ID || process.env.CLIENT_ID;
  const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
  
  if (!appId) {
    logger.error('No application ID found in environment variables!');
    return;
  }
  
  if (!token) {
    logger.error('No Discord bot token found in environment variables!');
    return;
  }
  
  try {
    // Load commands
    const commands = loadCommands();
    
    if (commands.size === 0) {
      logger.warn('No commands loaded, skipping registration');
      return;
    }
    
    // Convert commands to array for REST API
    const commandsArray = Array.from(commands.values()).map(cmd => cmd.data.toJSON());
    logger.info(`Prepared ${commandsArray.length} commands for registration`);
    
    // Register commands
    const rest = new REST({ version: '10' }).setToken(token);
    
    logger.info('Testing connection to Discord API...');
    try {
      const currentUser = await rest.get(Routes.user('@me'));
      logger.info(`API Connection successful! Logged in as ${currentUser.username}`);
    } catch (apiError) {
      logger.error('Failed to connect to Discord API:', apiError);
      return;
    }
    
    logger.info('Started refreshing application (/) commands...');
    
    // Register to each guild the bot is in
    const guilds = Array.from(client.guilds.cache.values());
    
    if (guilds.length > 0) {
      for (const guild of guilds) {
        try {
          logger.info(`Registering commands to guild ${guild.name} (${guild.id})`);
          
          const guildResponse = await rest.put(
            Routes.applicationGuildCommands(appId, guild.id),
            { body: commandsArray }
          );
          
          if (Array.isArray(guildResponse)) {
            logger.info(`Successfully registered ${guildResponse.length} application commands to guild ${guild.name}`);
            
            guildResponse.forEach(cmd => {
              logger.info(`- Registered guild command: ${cmd.name}`);
            });
          }
        } catch (guildError) {
          logger.error(`Failed to register commands to guild ${guild.name}:`, guildError);
        }
      }
    } else {
      logger.warn('No guilds found, will register commands globally only');
    }
    
    // Also register globally
    try {
      logger.info(`Registering commands globally to application ID: ${appId}`);
      
      const globalResponse = await rest.put(
        Routes.applicationCommands(appId),
        { body: commandsArray }
      );
      
      if (Array.isArray(globalResponse)) {
        logger.info(`Successfully registered ${globalResponse.length} application commands globally`);
        
        globalResponse.forEach(cmd => {
          logger.info(`- Registered global command: ${cmd.name}`);
        });
      }
    } catch (globalError) {
      logger.error('Failed to register commands globally:', globalError);
    }
    
    logger.info('Command registration complete');
  } catch (error) {
    logger.error('Error in registerCommands function:', error);
  }
}

// Handle command interactions
client.on('interactionCreate', async interaction => {
  // Log all interactions for debugging
  logger.info(`Received interaction: ${interaction.type} from ${interaction.user.tag} (${interaction.user.id})`);
  
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    logger.info(`Slash command executed: /${commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
    
    try {
      // Get command from collection
      const command = client.commands.get(commandName);
      
      if (!command) {
        logger.warn(`Command not found: ${commandName}`);
        await interaction.reply({ 
          content: 'This command is not properly implemented yet. Please try again later.',
          ephemeral: true
        });
        return;
      }
      
      // Execute command
      await command.execute(interaction, client);
      logger.info(`Command ${commandName} executed successfully`);
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      
      try {
        const errorMessage = `An error occurred while executing this command. Details: ${error.message}`;
        
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        logger.error('Error sending error response:', replyError);
      }
    }
  } else if (interaction.isButton()) {
    // Handle button interactions
    logger.info(`Button interaction: ${interaction.customId} by ${interaction.user.tag}`);
    
    // Command should be the first part before the first underscore
    const baseCommand = interaction.customId.split('_')[0];
    const command = client.commands.get(baseCommand);
    
    if (command && typeof command.handleButton === 'function') {
      try {
        await command.handleButton(interaction, client);
      } catch (error) {
        logger.error(`Error handling button interaction ${interaction.customId}:`, error);
        await interaction.reply({ 
          content: 'There was an error processing this button interaction.',
          ephemeral: true
        }).catch(e => logger.error('Could not send error response:', e));
      }
    } else {
      await interaction.reply({ 
        content: 'Button handler not implemented.',
        ephemeral: true
      });
    }
  } else if (interaction.isStringSelectMenu()) {
    // Handle select menu interactions
    logger.info(`Select menu interaction: ${interaction.customId} by ${interaction.user.tag}`);
    
    // Command should be the first part before the first underscore
    const baseCommand = interaction.customId.split('_')[0];
    const command = client.commands.get(baseCommand);
    
    if (command && typeof command.handleSelectMenu === 'function') {
      try {
        await command.handleSelectMenu(interaction, client);
      } catch (error) {
        logger.error(`Error handling select menu interaction ${interaction.customId}:`, error);
        await interaction.reply({ 
          content: 'There was an error processing this select menu interaction.', 
          ephemeral: true
        }).catch(e => logger.error('Could not send error response:', e));
      }
    } else {
      await interaction.reply({ 
        content: 'Select menu handler not implemented.',
        ephemeral: true
      });
    }
  } else if (interaction.isModalSubmit()) {
    // Handle modal submissions
    logger.info(`Modal submission: ${interaction.customId} by ${interaction.user.tag}`);
    
    // Command should be the first part before the first underscore
    const baseCommand = interaction.customId.split('_')[0];
    const command = client.commands.get(baseCommand);
    
    if (command && typeof command.handleModal === 'function') {
      try {
        await command.handleModal(interaction, client);
      } catch (error) {
        logger.error(`Error handling modal submission ${interaction.customId}:`, error);
        await interaction.reply({ 
          content: 'There was an error processing this modal submission.',
          ephemeral: true
        }).catch(e => logger.error('Could not send error response:', e));
      }
    } else {
      await interaction.reply({ 
        content: 'Modal submission handler not implemented.',
        ephemeral: true
      });
    }
  } else if (interaction.isContextMenuCommand()) {
    // Handle context menu commands
    logger.info(`Context menu command: ${interaction.commandName} by ${interaction.user.tag}`);
    
    const command = client.commands.get(interaction.commandName);
    
    if (command) {
      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing context menu command ${interaction.commandName}:`, error);
        await interaction.reply({ 
          content: 'There was an error executing this context menu command.',
          ephemeral: true
        }).catch(e => logger.error('Could not send error response:', e));
      }
    } else {
      await interaction.reply({ 
        content: 'This context menu command is not implemented yet.',
        ephemeral: true
      });
    }
  }
});

// Ready event handler
client.once('ready', async () => {
  logger.info('==================================================');
  logger.info('Bot is ready!');
  logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
  logger.info(`Serving ${client.guilds.cache.size} servers`);
  logger.info('==================================================');
  
  // Set activity
  client.user.setPresence({
    activities: [{ name: 'with Loading Animations & Enhanced Logging | /help', type: 0 }],
    status: 'online'
  });
  
  // Initialize enhanced logging
  enhancedLogger.initDiscordLogging(client);
  
  // Set up enhanced logging for each guild
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      // Load guild settings from database
      let guildSettings;
      try {
        // Check if models.Guild exists before trying to use it
        if (models && models.Guild) {
          // Load guild settings from database
          guildSettings = await models.Guild.findOrCreateGuild(guildId);
        } else {
          logger.warn(`Database models not initialized for guild ${guild.name}, skipping enhanced logging setup`);
          continue;
        }
      } catch (error) {
        logger.error(`Error accessing guild settings for ${guild.name}: ${error.message}`);
        continue;
      }
      
      // Skip if setup not completed
      if (!guildSettings || !guildSettings.setupCompleted) {
        logger.info(`Skipping logging setup for ${guild.name} (setup not completed)`);
        continue;
      }
      
      // Set up regular logging channel if available
      if (guildSettings.loggingChannelId) {
        try {
          const logChannel = await guild.channels.fetch(guildSettings.loggingChannelId);
          if (logChannel) {
            enhancedLogger.setLogChannel(logChannel, false);
            logger.info(`Regular logging initialized for ${guild.name}`);
          }
        } catch (error) {
          logger.error(`Error setting up regular logging channel for ${guild.name}: ${error.message}`);
        }
      }
      
      // Set up verbose logging if enabled
      if (guildSettings.isVerboseLoggingEnabled() && guildSettings.verboseLoggingChannelId) {
        try {
          const verboseChannel = await guild.channels.fetch(guildSettings.verboseLoggingChannelId);
          if (verboseChannel) {
            enhancedLogger.setLogChannel(verboseChannel, true);
            enhancedLogger.setVerboseLogging(true);
            logger.info(`Verbose logging initialized for ${guild.name}`);
            
            // Log test message to verbose channel
            enhancedLogger.debug(`Verbose logging initialized for ${guild.name}`, {
              guild: guild.name,
              time: new Date().toISOString(),
              verboseEnabled: true
            });
          }
        } catch (error) {
          logger.error(`Error setting up verbose logging channel for ${guild.name}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error initializing logging for guild ${guildId}: ${error.message}`);
    }
  }
  
  // Register commands
  await registerCommands();
  
  // Log guilds the bot is in
  logger.info('Bot is in the following guilds:');
  client.guilds.cache.forEach(guild => {
    logger.info(`- ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
  });
  
  // Initialize activeLoaders collection for tracking loading indicators
  client.activeLoaders = new Collection();
  logger.info('Animated loading indicators initialized for interactive commands');
  
  // Start a basic health check server
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Discord bot is running!');
  });
  
  // Try multiple ports in case the default is in use
  const tryPort = (port) => {
    server.once('error', err => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} is already in use, trying next port...`);
        tryPort(port + 1);
      } else {
        logger.error(`Server error:`, err);
      }
    });
    
    server.once('listening', () => {
      const address = server.address();
      logger.info(`Health check server running on port ${address.port}`);
    });
    
    server.listen(port, '0.0.0.0');
  };
  
  tryPort(8080); // Start with port 8080 instead of 5000 which may be in use
});

// Error handling
client.on('error', error => {
  logger.error('Discord client error:', error);
});

client.on('disconnect', () => {
  logger.warn('Bot disconnected from Discord');
});

client.on('reconnecting', () => {
  logger.info('Bot reconnecting to Discord');
});

process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
});

// Get token and login
const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
if (!token) {
  logger.error('No Discord bot token found in environment variables!');
  process.exit(1);
}

// Safely mask token in logs
const tokenLength = token.length;
const tokenFirstChars = token.substring(0, 5);
const tokenLastChars = token.substring(tokenLength - 5);
logger.info(`Using token of length ${tokenLength}, starting with ${tokenFirstChars}... and ending with ...${tokenLastChars}`);

// Connect to database first
logger.info('Connecting to database...');
connectToDatabase()
  .then(() => {
    // Login to Discord after database connection is established
    logger.info('Database connected, attempting to connect to Discord...');
    return client.login(token);
  })
  .catch(dbError => {
    logger.error('Failed to connect to database:', dbError);
    // Continue with Discord login even if database fails
    logger.info('Attempting to connect to Discord despite database error...');
    return client.login(token);
  })
  .catch(error => {
    logger.error('Failed to log in to Discord:', error);
    process.exit(1);
  });