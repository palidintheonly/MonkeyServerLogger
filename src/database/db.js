/**
 * Database connection manager
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { database } = require('../config');
const { logger } = require('../utils/logger');

// Create the database directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const sequelize = new Sequelize(database.sqlite);

// Store models in this object
const models = {};

// Import all model files from the models directory
async function connectToDatabase() {
  try {
    // Test the connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Get all model files
    const modelsPath = path.join(__dirname, 'models');
    const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
    
    // Import each model
    for (const file of modelFiles) {
      const model = require(path.join(modelsPath, file))(sequelize);
      models[model.name] = model;
      logger.verbose(`Loaded model: ${model.name}`);
    }
    
    // Define associations if any
    if (models.Guild && models.ModAction) {
      models.Guild.hasMany(models.ModAction, { 
        foreignKey: 'guildId',
        as: 'actions'
      });
      models.ModAction.belongsTo(models.Guild, { 
        foreignKey: 'guildId',
        as: 'guild'
      });
    }
    
    if (models.Guild && models.ModmailThread) {
      models.Guild.hasMany(models.ModmailThread, {
        foreignKey: 'guildId',
        as: 'threads'
      });
      models.ModmailThread.belongsTo(models.Guild, {
        foreignKey: 'guildId',
        as: 'guild'
      });
    }
    
    // Sync with the database
    await sequelize.sync();
    logger.info('Database synchronized successfully');
    
    return { sequelize, models };
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sequelize,
  models,
  connectToDatabase
};