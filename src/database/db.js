/**
 * Database connection manager
 */
const { Sequelize } = require('sequelize');
const { database: dbConfig } = require('../config');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const databaseBackup = require('../utils/database-backup');

// Create the main Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbConfig.mainDbPath,
  logging: msg => logger.debug(msg),
  logQueryParameters: process.env.NODE_ENV !== 'production',
  benchmark: true
});

// Import all model definitions dynamically
const models = {};
const modelsDir = path.join(__dirname, 'models');

// Create database and model directories if they don't exist
const dbDir = path.dirname(dbConfig.mainDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Initialize models
function initializeModels() {
  // Read all model files
  const modelFiles = fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.js'));
  
  // Import each model
  for (const file of modelFiles) {
    try {
      const model = require(path.join(modelsDir, file))(sequelize);
      models[model.name] = model;
      logger.debug(`Loaded model: ${model.name}`);
    } catch (error) {
      logger.error(`Error loading model from ${file}: ${error.message}`);
    }
  }
  
  // Set up associations (if any)
  Object.values(models).forEach(model => {
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  });
}

async function connectToDatabase() {
  try {
    // Initialize models
    initializeModels();
    
    // Test the connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Fix for the guilds_backup table issue - drop it if it exists
    try {
      await sequelize.query('DROP TABLE IF EXISTS guilds_backup');
      logger.info('Dropped guilds_backup table to prevent sync issues');
    } catch (dropError) {
      logger.warn(`Error dropping guilds_backup table: ${dropError.message}`);
      // Continue execution even if this fails
    }
    
    // Sync models with database (in development, force: true will drop tables)
    try {
      await sequelize.sync({ 
        force: process.env.DB_FORCE_SYNC === 'true',
        alter: process.env.DB_ALTER_SYNC === 'true' && process.env.DB_FORCE_SYNC !== 'true'
      });
      logger.info('Database models synchronized');
    } catch (syncError) {
      // If the error is related to guilds_backup, it's likely from a previous backup attempt
      if (syncError.message && syncError.message.includes('guilds_backup')) {
        logger.warn('Database synchronization warning (related to backup): ' + syncError.message);
      } else if (syncError.name === 'SequelizeUniqueConstraintError') {
        // Handle unique constraint errors specially
        logger.warn('Unique constraint error during sync, continuing anyway: ' + syncError.message);
      } else {
        // For other errors, re-throw
        throw syncError;
      }
    }
    
    // Set up optional scheduled backups - but disable if we had backup issues
    if (dbConfig.backups && dbConfig.backups.enabled) {
      // Use file copy method instead of SQL-based backup
      dbConfig.backups.useFileCopy = true;
      scheduleBackups();
    }
    
    return { sequelize, models };
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`, { error });
    throw error;
  }
}

// Schedule regular database backups
function scheduleBackups() {
  const backupInterval = dbConfig.backups.interval || 86400000; // Default 24 hours
  
  // Schedule first backup and then recurring ones
  setTimeout(() => {
    performBackup();
    setInterval(performBackup, backupInterval);
  }, 60000); // Start after 1 minute of bot runtime
  
  logger.info(`Database backups scheduled every ${backupInterval / 3600000} hours`);
}

// Perform actual backup
function performBackup() {
  try {
    // Use our centralized database backup utility
    databaseBackup.backupAllDatabases(false)
      .then(backupFiles => {
        if (backupFiles.length > 0) {
          logger.info(`Scheduled backup created: ${backupFiles.join(', ')}`);
        } else {
          logger.warn('Scheduled backup completed but no files were created');
        }
        
        // Manage backup retention
        return databaseBackup.cleanupOldBackups(dbConfig.backups.maxCount || 7);
      })
      .then(deletedCount => {
        if (deletedCount > 0) {
          logger.info(`Cleaned up ${deletedCount} old backup files`);
        }
      })
      .catch(error => {
        logger.error(`Database backup error: ${error.message}`, { error });
      });
  } catch (error) {
    logger.error(`Database backup error: ${error.message}`, { error });
  }
}

module.exports = {
  connectToDatabase,
  models,
  sequelize
};