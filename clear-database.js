/**
 * Database Cleanup Script
 * This script clears all entries from the database for a fresh start
 */
const { connectToDatabase, sequelize, models } = require('./src/database/db');
const { logger } = require('./src/utils/logger');

async function clearDatabase() {
  try {
    // Connect to the database
    await connectToDatabase();
    logger.info('Connected to database. Beginning cleanup...');
    
    // Get a list of all tables
    const tableResults = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const tables = tableResults.map(result => result.name);
    logger.info(`Found ${tables.length} tables: ${tables.join(', ')}`);
    
    // Clear each table using TRUNCATE (for SQLite this is DELETE FROM)
    for (const table of tables) {
      // Skip SequelizeMeta table if it exists (used for migrations)
      if (table === 'SequelizeMeta') {
        logger.info(`Skipping migration table: ${table}`);
        continue;
      }
      
      logger.info(`Clearing table: ${table}`);
      await sequelize.query(`DELETE FROM "${table}";`);
      
      // Reset SQLite sequences if they exist
      try {
        await sequelize.query(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
      } catch (seqError) {
        // Ignore errors for tables without auto-increment
        logger.debug(`Note: Could not reset sequence for ${table}: ${seqError.message}`);
      }
    }
    
    logger.info('Database cleanup complete. All tables have been cleared.');
    
    // Exit with success
    process.exit(0);
  } catch (error) {
    logger.error(`Error clearing database: ${error.message}`, { error });
    process.exit(1);
  }
}

// Run the script
clearDatabase();