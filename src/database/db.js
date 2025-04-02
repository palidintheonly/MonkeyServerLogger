const { Sequelize } = require('sequelize');
const config = require('../config');
const { logger } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Initialize Sequelize with SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/database.sqlite'),
  logging: msg => logger.debug(msg),
  define: {
    timestamps: true
  }
});

// Model registry
const models = {};

// Initialize models
function initModels() {
  const modelsPath = path.join(__dirname, 'models');
  const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
  
  for (const file of modelFiles) {
    const model = require(path.join(modelsPath, file))(sequelize);
    models[model.name] = model;
    logger.info(`Loaded model: ${model.name}`);
  }
  
  // Define relationships between models if needed
  // Example: models.User.hasMany(models.Post);
}

// Connect to the database with retry logic
async function connectToDatabase() {
  let retries = 0;
  
  while (retries < config.database.retryAttempts) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');
      
      // Initialize models
      initModels();
      
      // Sync database (create tables if they don't exist)
      await sequelize.sync();
      logger.info('Database synchronized successfully');
      
      return true;
    } catch (error) {
      retries++;
      logger.error(`Database connection attempt ${retries} failed:`, error);
      
      if (retries >= config.database.retryAttempts) {
        logger.error('Maximum database connection retry attempts reached');
        throw error;
      }
      
      // Wait before retrying
      logger.info(`Retrying in ${config.database.retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, config.database.retryDelay));
    }
  }
}

module.exports = {
  sequelize,
  models,
  connectToDatabase
};
