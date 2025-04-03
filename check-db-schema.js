/**
 * Database Schema Checker
 * Checks the schema of the Guild table
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
console.log(`Checking database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(`Error opening database: ${err.message}`);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Get the schema of the guilds table
db.all("PRAGMA table_info(guilds);", [], (err, rows) => {
  if (err) {
    console.error(`Error getting schema: ${err.message}`);
    db.close();
    process.exit(1);
  }
  
  console.log('Guild table schema:');
  rows.forEach((row) => {
    console.log(`${row.cid}: ${row.name} (${row.type}) ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  // Check if guildName column exists
  const guildNameColumn = rows.find(row => row.name === 'guildName');
  if (guildNameColumn) {
    console.log('\nguildName column exists in the table.');
  } else {
    console.log('\nguildName column does NOT exist in the table.');
  }
  
  // Get a few rows from the guilds table to see actual data
  db.all("SELECT * FROM guilds LIMIT 3;", [], (err, rows) => {
    if (err) {
      console.error(`Error getting sample data: ${err.message}`);
      db.close();
      process.exit(1);
    }
    
    console.log('\nSample data from guilds table:');
    rows.forEach((row) => {
      console.log(JSON.stringify(row, null, 2));
    });
    
    db.close();
  });
});