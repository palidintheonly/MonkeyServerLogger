/**
 * Database connection manager
 */
const { Sequelize } = require('sequelize');
const { database: dbConfig } = require('../config');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

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
    
    // Sync models with database (in development, force: true will drop tables)
    await sequelize.sync({ 
      force: process.env.DB_FORCE_SYNC === 'true',
      alter: process.env.DB_ALTER_SYNC === 'true' && process.env.DB_FORCE_SYNC !== 'true'
    });
    logger.info('Database models synchronized');
    
    // Set up optional scheduled backups
    if (dbConfig.backups && dbConfig.backups.enabled) {
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
  
  // Ensure backup directory exists
  if (!fs.existsSync(dbConfig.backups.path)) {
    fs.mkdirSync(dbConfig.backups.path, { recursive: true });
  }
  
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(dbConfig.backups.path, `database_${timestamp}.sqlite`);
    
    fs.copyFileSync(dbConfig.mainDbPath, backupFile);
    logger.info(`Database backup created: ${backupFile}`);
    
    // Manage backup retention
    cleanupOldBackups();
  } catch (error) {
    logger.error(`Database backup error: ${error.message}`, { error });
  }
}

// Remove old backups exceeding the maxCount
function cleanupOldBackups() {
  const maxCount = dbConfig.backups.maxCount || 7;
  
  try {
    const backupFiles = fs.readdirSync(dbConfig.backups.path)
      .filter(file => file.startsWith('database_') && file.endsWith('.sqlite'))
      .map(file => ({
        name: file,
        path: path.join(dbConfig.backups.path, file),
        time: fs.statSync(path.join(dbConfig.backups.path, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort newest first
    
    // Delete older backups beyond the limit
    if (backupFiles.length > maxCount) {
      backupFiles.slice(maxCount).forEach(file => {
        fs.unlinkSync(file.path);
        logger.debug(`Removed old backup: ${file.name}`);
      });
    }
  } catch (error) {
    logger.error(`Backup cleanup error: ${error.message}`, { error });
  }
}

module.exports = {
  connectToDatabase,
  models,
  sequelize
};