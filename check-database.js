/**
 * Database Check Script
 * This script checks current entries in each table
 */
const { connectToDatabase, sequelize } = require('./src/database/db');
const { logger } = require('./src/utils/logger');

async function checkDatabase() {
  try {
    // Connect to the database
    await connectToDatabase();
    console.log('Connected to database. Checking tables...');
    
    // Get a list of all tables
    const tableResults = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const tables = tableResults.map(result => result.name);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);
    
    // Check count in each table
    for (const table of tables) {
      const countResult = await sequelize.query(
        `SELECT COUNT(*) as count FROM "${table}";`,
        { type: sequelize.QueryTypes.SELECT }
      );
      
      const count = countResult[0].count;
      console.log(`Table ${table}: ${count} entries`);
      
      // If there are entries, show a sample
      if (count > 0) {
        const sampleResult = await sequelize.query(
          `SELECT * FROM "${table}" LIMIT 1;`,
          { type: sequelize.QueryTypes.SELECT }
        );
        
        console.log(`Sample entry from ${table}:`);
        console.log(JSON.stringify(sampleResult[0], null, 2));
      }
    }
    
    console.log('Database check complete.');
    
    // Exit with success
    process.exit(0);
  } catch (error) {
    console.error(`Error checking database: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
checkDatabase();