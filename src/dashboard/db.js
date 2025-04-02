// Dashboard database utility
const { Sequelize } = require('sequelize');
const path = require('path');
const { logger } = require('../utils/logger');

// Database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/dashboard.sqlite'),
  logging: msg => logger.debug(msg)
});

// Models
const DashboardUser = require('./models/DashboardUser')(sequelize);
const AuditLog = require('./models/AuditLog')(sequelize);
const MetricsData = require('./models/MetricsData')(sequelize);

// Set up associations
DashboardUser.hasMany(AuditLog);
AuditLog.belongsTo(DashboardUser);

// Initialize database connection
async function initDashboardDB() {
  try {
    await sequelize.authenticate();
    logger.info('Dashboard database connection established successfully');
    
    // Sync models with database
    await sequelize.sync();
    logger.info('Dashboard database models synchronized');
    
    return true;
  } catch (error) {
    logger.error('Failed to connect to dashboard database:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  initDashboardDB,
  models: {
    DashboardUser,
    AuditLog,
    MetricsData
  }
};